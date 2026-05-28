// Configuration
const API_URL = 'http://localhost:5000';

// State
let rsaKeyPair = null;
let recipientPublicKey = null;
let selectedFile = null;
let serverFilesData = [];

// 1. Generate RSA Key Pair
async function generateKeys() {
    try {
        const username = prompt("Siapa nama Anda?");
        if (!username) {
            log('Key generation cancelled.', 'system');
            generateKeysBtn.disabled = false;
            return;
        }

        log('Generating RSA-OAEP 2048-bit key pair...', 'process');
        rsaKeyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );

        // Upload public key to server
        const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
        log(`Uploading Public Key to directory for user '${username}'...`, 'process');
        await fetch(`${API_URL}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, public_key: publicKeyJwk })
        });

        log('RSA Keys generated and registered successfully.', 'success');
        keyStatus.querySelector('.dot').classList.add('active');
        keyStatus.innerHTML = `<span class="dot active"></span> RSA Keys Ready (${username})`;
        exportKeyBtn.classList.remove('hidden');
        exportPubKeyBtn.classList.remove('hidden');
        checkReadyState();

        fetchPublicKeys(); // refresh dropdown
    } catch (err) {
        log('Key generation failed: ' + err.message, 'error');
    }
}

// 1.5 Export and Import Keys
async function exportPublicKeyOnly() {
    if (!rsaKeyPair) return;
    try {
        const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
        const keyData = JSON.stringify({ public: publicKeyJwk }, null, 2);

        const blob = new Blob([keyData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `public_key_${Math.floor(Date.now() / 1000)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log("Public key exported successfully. You can share this file.", "success");
    } catch (e) {
        log("Export public key failed: " + e.message, "error");
    }
}

// lanjutan API function

async function exportKeys(filename = "my_rsa_keys.json") {
    if (!rsaKeyPair) return;

    // Handle Event object if triggered directly by click listener
    if (filename instanceof Event) {
        filename = `kunci_RSA_sesi_${Math.floor(Date.now() / 1000)}.json`;
    }

    try {
        const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
        const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.privateKey);
        const keyData = JSON.stringify({ public: publicKeyJwk, private: privateKeyJwk }, null, 2);

        const blob = new Blob([keyData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log(`RSA keys exported to file '${filename}'.`, "success");
    } catch (e) {
        log("Export failed: " + e.message, "error");
    }
}

importKeyInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const keyData = JSON.parse(text);

        const publicKey = await window.crypto.subtle.importKey(
            "jwk",
            keyData.public,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );

        const privateKey = await window.crypto.subtle.importKey(
            "jwk",
            keyData.private,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        );

        rsaKeyPair = { publicKey, privateKey };

        log('RSA Keys imported successfully from file.', 'success');
        keyStatus.innerHTML = '<span class="dot active"></span> RSA Keys Ready';
        exportKeyBtn.classList.remove('hidden');
        exportPubKeyBtn.classList.remove('hidden');
        checkReadyState();
    } catch (err) {
        log('Key import failed. Invalid file format or corrupted keys.', 'error');
    }
    e.target.value = ''; // reset
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
    // Reset value so change event fires even if same file is selected again
    e.target.value = '';
});

function checkReadyState() {
    if (rsaKeyPair && selectedFile) {
        encryptBtn.disabled = false;
    }
}

// 3. Encrypt and Upload (Fase 1)
async function handleEncryption() {
    if (!rsaKeyPair || !selectedFile) return;

    encryptBtn.disabled = true;
    log('--- Starting Fase 1: Encryption ---', 'process');

    try {
        // Step A: Generate AES Key
        log('Generating random AES-GCM 256-bit key...', 'process');
        const aesKey = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        // Step B: Encrypt File Data with AES
        log('Reading file content...', 'process');
        const fileBuffer = await selectedFile.arrayBuffer();

        log('Encrypting data with AES-GCM...', 'process');
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Nonce
        const encryptedData = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            fileBuffer
        );

        // Separate Ciphertext and Auth Tag (Web Crypto API includes Tag at the end of output)
        const encryptedBytes = new Uint8Array(encryptedData);
        // AES-GCM tag is usually 16 bytes by default in Web Crypto
        const tagLength = 16;
        const ciphertext = encryptedBytes.slice(0, -tagLength);
        const authTag = encryptedBytes.slice(-tagLength);

        // 4. Wrap AES Key with RSA Public Key (Target's Key)
        const targetPubKey = recipientPublicKey ? recipientPublicKey : rsaKeyPair.publicKey;
        const targetName = recipientPublicKey ? "Recipient" : "Yourself";
        log(`Wrapping AES key with ${targetName}'s RSA Public Key...`, 'process');

        const exportedAesKey = await window.crypto.subtle.exportKey(
            "raw",
            aesKey
        );

        const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            targetPubKey,
            exportedAesKey
        );

        // Step D: Prepare Packet for Upload
        log('Preparing secure packet...', 'process');
        const packet = {
            filename: selectedFile.name,
            ciphertext: arrayBufferToBase64(ciphertext),
            auth_tag: arrayBufferToBase64(authTag),
            nonce: arrayBufferToBase64(iv),
            encrypted_aes_key: arrayBufferToBase64(encryptedAesKeyBuffer),
            timestamp: new Date().toISOString()
        };

        // Step E: Send to Flask Server
        log('Uploading to Flask server...', 'process');
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packet)
        });

        const result = await response.json();
        if (response.ok) {
            log('Success! File encrypted and stored on server.', 'success');
            log(`Server ID: ${result.id}`, 'system');
            fetchServerData(); // Update explorer after upload
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        log('Encryption/Upload failed: ' + err.message, 'error');
        encryptBtn.disabled = false;
    }
}

// Helpers
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// 4. Server Explorer (0.5.1) -> di API.js

// 5. Decrypt and Download (Fase 2)
async function handleDecryption(fileId) {
    if (!rsaKeyPair) {
        log('RSA Keys not found. Please generate keys first (or they were lost after page refresh).', 'error');
        alert('RSA Keys not found. You need the original RSA private key to decrypt.');
        return;
    }

    const fileData = serverFilesData.find(f => f.id === fileId);
    if (!fileData) return;

    log(`--- Starting Fase 2: Decrypting ${fileData.filename} ---`, 'process');

    try {
        // Step A: Base64 to ArrayBuffer helper
        const base64ToArrayBuffer = (base64) => {
            const binaryString = window.atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        };

        const encryptedAesKeyBuffer = base64ToArrayBuffer(fileData.encrypted_aes_key);
        const ciphertextBuffer = base64ToArrayBuffer(fileData.ciphertext);
        const authTagBuffer = base64ToArrayBuffer(fileData.auth_tag);
        const nonceBuffer = base64ToArrayBuffer(fileData.nonce);

        // Step B: Unwrap AES Key with RSA Private Key
        log('Unwrapping AES key with RSA Private Key...', 'process');
        const exportedAesKey = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            rsaKeyPair.privateKey,
            encryptedAesKeyBuffer
        );

        // Re-import AES key
        const aesKey = await window.crypto.subtle.importKey(
            "raw",
            exportedAesKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        // Step C: Combine Ciphertext and Auth Tag
        // Web Crypto API AES-GCM expects ciphertext + auth_tag in one contiguous buffer
        const combinedLength = ciphertextBuffer.byteLength + authTagBuffer.byteLength;
        const combinedBuffer = new Uint8Array(combinedLength);
        combinedBuffer.set(new Uint8Array(ciphertextBuffer), 0);
        combinedBuffer.set(new Uint8Array(authTagBuffer), ciphertextBuffer.byteLength);

        // Step D: Decrypt with AES-GCM
        log('Decrypting file data with AES-GCM and verifying Auth Tag...', 'process');
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(nonceBuffer) },
            aesKey,
            combinedBuffer.buffer
        );

        // Step E: Create Blob and Download
        log('Data decrypted successfully. Initiating download...', 'success');
        const blob = new Blob([decryptedBuffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `decrypted_${fileData.filename}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        log('Decryption failed: ' + err.message + ' (Possibly wrong RSA key or tampered data)', 'error');
        alert('Decryption failed. Check console logs for details.');
    }
}

// 7. Delete Data API Calls -> di API.js

// Event Listeners
generateKeysBtn.addEventListener('click', generateKeys);
exportKeyBtn.addEventListener('click', exportKeys);
exportPubKeyBtn.addEventListener('click', exportPublicKeyOnly);
encryptBtn.addEventListener('click', handleEncryption);

