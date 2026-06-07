// Configuration
const API_URL = 'http://localhost:5000';

// State
let rsaKeyPair = null;
let recipientPublicKey = null;
let selectedFile = null;
let serverFilesData = [];

// RSA Key Parameters
const RSA_PARAMS = { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };

// Helper: Download any Blob as a file
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Helper: ArrayBuffer → Base64
const toB64 = buf => window.btoa(String.fromCharCode(...new Uint8Array(buf)));

// 1. Generate RSA Key Pair
async function generateKeys() {
    try {
        const username = prompt("Siapa nama Anda?");
        if (!username) { log('Key generation cancelled.', 'system'); return; }

        log('Generating RSA-OAEP 2048-bit key pair...', 'process');
        rsaKeyPair = await window.crypto.subtle.generateKey(RSA_PARAMS, true, ["encrypt", "decrypt"]);

        const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
        log(`Uploading Public Key to directory for user '${username}'...`, 'process');
        await fetch(`${API_URL}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, public_key: publicKeyJwk })
        });

        log('RSA Keys generated and registered successfully.', 'success');
        keyStatus.innerHTML = `<span class="dot active"></span> RSA Keys Ready (${username})`;
        exportKeyBtn.classList.remove('hidden');
        exportPubKeyBtn.classList.remove('hidden');
        checkReadyState();
        fetchPublicKeys();
    } catch (err) {
        log('Key generation failed: ' + err.message, 'error');
    }
}

// 1.5 Export Keys (mode: 'full' = private+public, 'public' = public only)
async function exportKeys(mode = 'full') {
    if (!rsaKeyPair) return;
    if (mode instanceof Event) mode = 'full'; // dipanggil langsung oleh click listener

    try {
        const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
        let keyData, filename;

        if (mode === 'public') {
            keyData = JSON.stringify({ public: publicKeyJwk }, null, 2);
            filename = `public_key_${Math.floor(Date.now() / 1000)}.json`;
            log("Public key exported successfully. You can share this file.", "success");
        } else {
            const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.privateKey);
            keyData = JSON.stringify({ public: publicKeyJwk, private: privateKeyJwk }, null, 2);
            filename = `kunci_RSA_sesi_${Math.floor(Date.now() / 1000)}.json`;
            log(`RSA keys exported to file '${filename}'.`, "success");
        }

        downloadBlob(new Blob([keyData], { type: "application/json" }), filename);
    } catch (e) {
        log("Export failed: " + e.message, "error");
    }
}

// Import Key dari file JSON
importKeyInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const keyData = JSON.parse(await file.text());
        const publicKey = await window.crypto.subtle.importKey("jwk", keyData.public, RSA_PARAMS, true, ["encrypt"]);
        const privateKey = await window.crypto.subtle.importKey("jwk", keyData.private, RSA_PARAMS, true, ["decrypt"]);
        rsaKeyPair = { publicKey, privateKey };
        log('RSA Keys imported successfully from file.', 'success');
        keyStatus.innerHTML = '<span class="dot active"></span> RSA Keys Ready';
        exportKeyBtn.classList.remove('hidden');
        exportPubKeyBtn.classList.remove('hidden');
        checkReadyState();
    } catch (err) {
        log('Key import failed. Invalid file format or corrupted keys.', 'error');
    }
    e.target.value = '';
});

// 2. Handle File Selection
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        fileNameDisplay.textContent = selectedFile.name;
        filePreview.classList.remove('hidden');
        log(`File selected: ${selectedFile.name} (${selectedFile.size} bytes)`, 'system');
        checkReadyState();
    }
    e.target.value = '';
});

function checkReadyState() {
    if (rsaKeyPair && selectedFile) encryptBtn.disabled = false;
}

// 3. Encrypt and Upload (Fase 1)
async function handleEncryption() {
    if (!rsaKeyPair || !selectedFile) return;
    encryptBtn.disabled = true;
    log('--- Starting Fase 1: Encryption ---', 'process');

    try {
        // Step A: Generate AES Key
        const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

        // Step B: Encrypt File with AES-GCM
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, await selectedFile.arrayBuffer());

        // Pisahkan Ciphertext & Auth Tag (16 bytes terakhir)
        const encBytes = new Uint8Array(encryptedData);
        const ciphertext = encBytes.slice(0, -16);
        const authTag = encBytes.slice(-16);

        // Step C: Wrap AES Key dengan RSA Public Key
        const targetPubKey = recipientPublicKey ?? rsaKeyPair.publicKey;
        const targetName = recipientPublicKey ? "Recipient" : "Yourself";
        log(`Wrapping AES key with ${targetName}'s RSA Public Key...`, 'process');
        const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, targetPubKey, exportedAesKey);

        // Step D: Upload ke Flask Server
        const packet = {
            filename: selectedFile.name,
            ciphertext: toB64(ciphertext),
            auth_tag: toB64(authTag),
            nonce: toB64(iv),
            encrypted_aes_key: toB64(encryptedAesKeyBuffer),
            timestamp: new Date().toISOString()
        };

        log('Uploading to Flask server...', 'process');
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(packet)
        });

        const result = await response.json();
        if (response.ok) {
            log('Success! File encrypted and stored on server.', 'success');
            log(`Server ID: ${result.id}`, 'system');
            fetchServerData();
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        log('Encryption/Upload failed: ' + err.message, 'error');
        encryptBtn.disabled = false;
    }
}

// 5. Decrypt and Download (Fase 2)
async function handleDecryption(fileId) {
    if (!rsaKeyPair) {
        log('RSA Keys not found. Please generate or import your keys first.', 'error');
        alert('RSA Keys not found. You need the original RSA private key to decrypt.');
        return;
    }

    const fileData = serverFilesData.find(f => f.id === fileId);
    if (!fileData) return;
    log(`--- Starting Fase 2: Decrypting ${fileData.filename} ---`, 'process');

    try {
        // Helper: Base64 → ArrayBuffer
        const fromB64 = b64 => Uint8Array.from(window.atob(b64), c => c.charCodeAt(0)).buffer;

        const encryptedAesKeyBuffer = fromB64(fileData.encrypted_aes_key);
        const ciphertextBuffer      = fromB64(fileData.ciphertext);
        const authTagBuffer         = fromB64(fileData.auth_tag);
        const nonceBuffer           = fromB64(fileData.nonce);

        // Step B: Unwrap AES Key dengan RSA Private Key
        log('Unwrapping AES key with RSA Private Key...', 'process');
        const exportedAesKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaKeyPair.privateKey, encryptedAesKeyBuffer);
        const aesKey = await window.crypto.subtle.importKey("raw", exportedAesKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

        // Step C: Gabungkan Ciphertext + Auth Tag
        const combined = new Uint8Array(ciphertextBuffer.byteLength + authTagBuffer.byteLength);
        combined.set(new Uint8Array(ciphertextBuffer), 0);
        combined.set(new Uint8Array(authTagBuffer), ciphertextBuffer.byteLength);

        // Step D: Decrypt dengan AES-GCM (verifikasi Auth Tag otomatis)
        log('Decrypting file data with AES-GCM and verifying Auth Tag...', 'process');
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(nonceBuffer) }, aesKey, combined.buffer);

        // Step E: Download hasil dekripsi
        log('Data decrypted successfully. Initiating download...', 'success');
        downloadBlob(new Blob([decryptedBuffer]), `decrypted_${fileData.filename}`);

    } catch (err) {
        log('Decryption failed: ' + err.message + ' (Possibly wrong RSA key or tampered data)', 'error');
        alert('Decryption failed. Check console logs for details.');
    }
}

// Event Listeners
generateKeysBtn.addEventListener('click', generateKeys);
exportKeyBtn.addEventListener('click', exportKeys);
exportPubKeyBtn.addEventListener('click', () => exportKeys('public'));
encryptBtn.addEventListener('click', handleEncryption);
