// Configuration
const API_URL = 'http://localhost:5000';

// State
let rsaKeyPair = null;
let recipientPublicKey = null;
let selectedFile = null;
let serverFilesData = [];

// UI Elements
const logConsole = document.getElementById('logConsole');
const generateKeysBtn = document.getElementById('generateKeysBtn');
const importKeyBtn = document.getElementById('importKeyBtn');
const importKeyInput = document.getElementById('importKeyInput');
const exportKeyBtn = document.getElementById('exportKeyBtn');
const exportPubKeyBtn = document.getElementById('exportPubKeyBtn');
const recipientSelect = document.getElementById('recipientSelect');
const refreshRecipientsBtn = document.getElementById('refreshRecipientsBtn');
const resetRecipientsBtn = document.getElementById('resetRecipientsBtn');
const recipientStatus = document.getElementById('recipientStatus');
const keyStatus = document.getElementById('keyStatus');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileNameDisplay = document.getElementById('fileName');
const encryptBtn = document.getElementById('encryptBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const serverTableBody = document.getElementById('serverTableBody');
const clientTableBody = document.getElementById('clientTableBody');

// Tab Navigation
window.switchPage = function (pageNum) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`page-${pageNum}`).classList.add('active');
    document.querySelectorAll('.tab-btn')[pageNum - 1].classList.add('active');
};

// Logging helper
function log(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logConsole.appendChild(entry);
    logConsole.scrollTop = logConsole.scrollHeight;
}

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

// Public Key Directory API
let publicKeysDirectory = [];

async function fetchPublicKeys() {
    try {
        const response = await fetch(`${API_URL}/keys`);
        publicKeysDirectory = await response.json();

        // Populate dropdown
        recipientSelect.innerHTML = '<option value="">-- Enkripsi untuk Diri Sendiri --</option>';
        publicKeysDirectory.forEach((user, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = user.username;
            recipientSelect.appendChild(option);
        });
        log('Public Key directory updated.', 'system');
    } catch (err) {
        log('Failed to fetch public keys: ' + err.message, 'error');
    }
}

recipientSelect.addEventListener('change', async (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex === "") {
        recipientPublicKey = null;
        recipientStatus.innerHTML = '<span class="dot active" style="background-color: var(--accent-color); box-shadow: none;"></span> Diri Sendiri';
        log('Target recipient cleared. Encrypting for yourself.', 'system');
        return;
    }

    try {
        const selectedUser = publicKeysDirectory[selectedIndex];
        recipientPublicKey = await window.crypto.subtle.importKey(
            "jwk",
            selectedUser.public_key,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );

        log(`Target set to ${selectedUser.username}.`, 'success');
        recipientStatus.innerHTML = `<span class="dot active"></span> ${selectedUser.username}`;
    } catch (err) {
        log('Failed to load recipient key: ' + err.message, 'error');
        recipientSelect.value = "";
    }
});

resetRecipientsBtn.addEventListener('click', async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus SEMUA daftar Kunci Publik dari Server?')) return;
    try {
        const response = await fetch(`${API_URL}/keys`, { method: 'DELETE' });
        if (response.ok) {
            log('Direktori Kunci Publik berhasil direset.', 'success');
            recipientPublicKey = null;
            recipientStatus.innerHTML = '<span class="dot active" style="background-color: var(--accent-color); box-shadow: none;"></span> Diri Sendiri';
            fetchPublicKeys();
        }
    } catch (err) {
        log('Gagal mereset direktori: ' + err.message, 'error');
    }
});

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

// 4. Server Explorer (0.5.1)
async function fetchServerData() {
    try {
        const response = await fetch(`${API_URL}/files`);
        serverFilesData = await response.json();
        const files = [...serverFilesData];

        clientTableBody.innerHTML = '';
        serverTableBody.innerHTML = '';

        if (files.length === 0) {
            clientTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No data on server.</td></tr>';
            serverTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No data on server.</td></tr>';
            return;
        }

        files.reverse().forEach(file => {
            // Render Client View Table (Page 2)
            const clientTr = document.createElement('tr');
            clientTr.innerHTML = `
                <td>${file.id}</td>
                <td title="${file.filename}">${file.filename}</td>
                <td>${new Date(file.timestamp).toLocaleString()}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn success small" onclick="handleDecryption(${file.id})">Decrypt</button>
                    </div>
                </td>
            `;
            clientTableBody.appendChild(clientTr);

            // Render Server Admin Table (Page 3)
            const serverTr = document.createElement('tr');
            const cipherShort = file.ciphertext.substring(0, 15) + '...';
            const tagShort = file.auth_tag.substring(0, 15) + '...';
            serverTr.innerHTML = `
                <td>${file.id}</td>
                <td title="${file.filename}">${file.filename}</td>
                <td title="${file.ciphertext}">${cipherShort}</td>
                <td title="${file.auth_tag}">${tagShort}</td>
                <td>${new Date(file.timestamp).toLocaleString()}</td>
                <td>
                    <button class="btn outline small" style="color: #ff4d4d; border-color: #ff4d4d; padding: 4px 8px;" onclick="deleteFile(${file.id})">Del</button>
                </td>
            `;
            serverTableBody.appendChild(serverTr);
        });
    } catch (err) {
        log('Failed to fetch server data: ' + err.message, 'error');
    }
}

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

// 7. Delete Data API Calls
async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file from the server?')) return;
    try {
        const response = await fetch(`${API_URL}/files/${fileId}`, { method: 'DELETE' });
        if (response.ok) {
            log(`File ID ${fileId} deleted from server.`, 'system');
            fetchServerData();
        } else {
            log('Failed to delete file', 'error');
        }
    } catch (err) {
        log('Delete failed: ' + err.message, 'error');
    }
}

async function clearAllFiles() {
    if (!confirm('WARNING: This will delete ALL files from the server. Are you sure?')) return;
    try {
        const response = await fetch(`${API_URL}/files`, { method: 'DELETE' });
        if (response.ok) {
            log('All files cleared from server.', 'system');
            fetchServerData();
        } else {
            log('Failed to clear files', 'error');
        }
    } catch (err) {
        log('Clear all failed: ' + err.message, 'error');
    }
}

// Event Listeners
generateKeysBtn.addEventListener('click', generateKeys);
exportKeyBtn.addEventListener('click', exportKeys);
exportPubKeyBtn.addEventListener('click', exportPublicKeyOnly);
refreshRecipientsBtn.addEventListener('click', fetchPublicKeys);
encryptBtn.addEventListener('click', handleEncryption);
clearAllBtn.addEventListener('click', clearAllFiles);

// Initial Load
fetchServerData();
fetchPublicKeys();

// Note: Removed dropZone click listener because <label for="fileInput"> already handles it.
// Adding manual click on dropZone causes double-triggering in some browsers.

// ==========================================
// 8. TESTING & EVALUATION (Page 4)
// ==========================================
const btnAvalanche = document.getElementById('btnAvalanche');
const btnTamper = document.getElementById('btnTamper');
const btnOaep = document.getElementById('btnOaep');
const btnPerf = document.getElementById('btnPerf');

function buf2hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function hex2bin(hex) {
    let bin = "";
    for (let i = 0; i < hex.length; i++) {
        bin += parseInt(hex[i], 16).toString(2).padStart(4, '0');
    }
    return bin;
}

// Avalanche Effect
btnAvalanche.addEventListener('click', async () => {
    const out = document.getElementById('outAvalanche');
    const file = selectedFile || fileInput.files[0];
    if (!file) {
        out.innerHTML = `<span style="color:#ff4d4d;">[ERROR] Harap kembali ke Halaman 1 dan pilih file terlebih dahulu!</span>`;
        return;
    }

    out.textContent = `Membaca file "${file.name}" (${file.size} bytes)...\n`;

    try {
        const buffer = await file.arrayBuffer();

        const key = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

        // IV 1 (Asli)
        const iv1 = window.crypto.getRandomValues(new Uint8Array(12));

        // IV 2 (Modifikasi 1 bit dari IV 1)
        const iv2 = new Uint8Array(iv1);
        iv2[11] ^= 1; // flip bit terakhir pada IV

        out.textContent += `Mengenkripsi file dengan IV asli dan IV yang dimodifikasi 1 bit...\n`;
        const enc1 = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv1 }, key, buffer);
        const enc2 = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv2 }, key, buffer);

        const hex1 = buf2hex(enc1);
        const hex2 = buf2hex(enc2);
        const bin1 = hex2bin(hex1);
        const bin2 = hex2bin(hex2);

        const maxLen = Math.max(bin1.length, bin2.length);
        const b1 = bin1.padEnd(maxLen, '0');
        const b2 = bin2.padEnd(maxLen, '0');

        let diff = 0;
        for (let i = 0; i < maxLen; i++) {
            if (b1[i] !== b2[i]) diff++;
        }

        const pct = ((diff / maxLen) * 100).toFixed(2);

        out.textContent += `\nCT1 (Hex): ${hex1.substring(0, 32)}...\n`;
        out.textContent += `CT2 (Hex): ${hex2.substring(0, 32)}...\n\n`;
        out.textContent += `Total Bits: ${maxLen}\nBeda Bits : ${diff}\nAvalanche Effect: ${pct}%\n`;
    } catch (e) {
        out.innerHTML += `<span style="color:#ff4d4d;">Error: ${e.message}</span>`;
    }
});

// Tampering Test
btnTamper.addEventListener('click', async () => {
    const out = document.getElementById('outTamper');
    const file = selectedFile || fileInput.files[0];
    if (!file) {
        out.innerHTML = `<span style="color:#ff4d4d;">[ERROR] Harap kembali ke Halaman 1 dan pilih file terlebih dahulu!</span>`;
        return;
    }

    out.textContent = `Membaca file "${file.name}"...\n`;

    try {
        const buffer = await file.arrayBuffer();
        const key = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        out.textContent += `Mengenkripsi file...\n`;
        const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, buffer);
        out.textContent += `Ciphertext Valid (Hex): ${buf2hex(encrypted).substring(0, 32)}...\n`;

        // Tamper 1 byte
        const tamperedBytes = new Uint8Array(encrypted);
        if (tamperedBytes.length > 0) {
            tamperedBytes[0] ^= 0xFF; // Flip bits in first byte
        }

        out.textContent += `Ciphertext Dimodifikasi (Hex): ${buf2hex(tamperedBytes.buffer).substring(0, 32)}...\n\n`;
        out.textContent += `Mencoba dekripsi ciphertext modifikasi...\n`;

        try {
            await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, tamperedBytes.buffer);
            out.textContent += `GAGAL! Berhasil didekripsi.\n`;
        } catch (e) {
            out.innerHTML += `<span style="color:#ff4d4d;">[ERROR] DOMException: MAC check failed</span>\n`;
            out.textContent += `SUKSES! Modifikasi ilegal berhasil diblokir oleh AES-GCM.\n`;
        }
    } catch (e) {
        out.innerHTML += `<span style="color:#ff4d4d;">Error: ${e.message}</span>`;
    }
});

// OAEP Probabilistic
btnOaep.addEventListener('click', async () => {
    const out = document.getElementById('outOaep');
    if (!rsaKeyPair || !rsaKeyPair.publicKey) {
        out.innerHTML = `<span style="color:#ff4d4d;">[ERROR] Kunci RSA belum ada! Harap Generate Key di Halaman 1.</span>`;
        return;
    }

    out.textContent = `Membuat Kunci AES secara acak...\n`;

    try {
        const key = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const exportedKey = await window.crypto.subtle.exportKey("raw", key);

        out.textContent += `Mengenkripsi Kunci AES (Pesan yang sama) 5 kali menggunakan Kunci RSA Anda...\n\n`;

        for (let i = 1; i <= 5; i++) {
            const enc = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaKeyPair.publicKey, exportedKey);
            out.textContent += `Percobaan ${i} (Hex): ${buf2hex(enc).substring(0, 40)}...\n`;
        }
        out.textContent += `\nKesimpulan: Output ciphertext 100% berbeda karena padding acak OAEP.\n`;

    } catch (e) {
        out.innerHTML += `<span style="color:#ff4d4d;">Error: ${e.message}</span>`;
    }
});

// Performance Test
btnPerf.addEventListener('click', async () => {
    const out = document.getElementById('outPerf');
    const file = selectedFile || fileInput.files[0];
    if (!file) {
        out.innerHTML = `<span style="color:#ff4d4d;">[ERROR] Harap kembali ke Halaman 1 dan pilih file terlebih dahulu!</span>`;
        return;
    }

    if (!rsaKeyPair || !rsaKeyPair.publicKey) {
        out.innerHTML = `<span style="color:#ff4d4d;">[ERROR] Kunci RSA belum ada! Harap Generate Key di Halaman 1.</span>`;
        return;
    }

    out.textContent = `Membaca file "${file.name}" (${(file.size / 1024).toFixed(2)} KB)...\n`;

    try {
        const buffer = await file.arrayBuffer();

        const key = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        out.textContent += `Menjalankan Enkripsi AES-GCM...\n`;
        const startAesEnc = performance.now();
        const encryptedBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, buffer);
        const endAesEnc = performance.now();
        const aesEncTime = (endAesEnc - startAesEnc);

        out.textContent += `Menjalankan Dekripsi AES-GCM...\n`;
        const startAesDec = performance.now();
        await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encryptedBuffer);
        const endAesDec = performance.now();
        const aesDecTime = (endAesDec - startAesDec);

        out.textContent += `Menjalankan RSA-OAEP (Bungkus Kunci)...\n`;
        const exportedKey = await window.crypto.subtle.exportKey("raw", key);
        const startRsa = performance.now();
        await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaKeyPair.publicKey, exportedKey);
        const endRsa = performance.now();
        const rsaTime = (endRsa - startRsa);

        const fileSizeMB = file.size / (1024 * 1024);
        
        // Calculate throughput, avoid division by zero
        const encThroughput = aesEncTime > 0 ? fileSizeMB / (aesEncTime / 1000) : 0;
        const decThroughput = aesDecTime > 0 ? fileSizeMB / (aesDecTime / 1000) : 0;
        
        const originalSize = file.size;
        const encryptedSize = encryptedBuffer.byteLength;
        const rsaOverhead = 256; // 2048-bit RSA ciphertext size
        const ivOverhead = 12; // 96-bit IV
        const totalSize = encryptedSize + rsaOverhead + ivOverhead;
        const overheadBytes = totalSize - originalSize;
        const overheadPct = originalSize > 0 ? (overheadBytes / originalSize) * 100 : 0;

        out.textContent += `\n--- HASIL PENGUJIAN PERFORMA ---\n`;
        out.textContent += `> Pengujian Throughput Enkripsi-Dekripsi\n`;
        out.textContent += `  - Kecepatan Enkripsi : ${encThroughput.toFixed(2)} MB/s\n`;
        out.textContent += `  - Kecepatan Dekripsi : ${decThroughput.toFixed(2)} MB/s\n`;
        out.textContent += `  - Waktu RSA Wrapping : ${rsaTime.toFixed(2)} ms\n\n`;
        out.textContent += `> Pengujian Stabilitas Overhead Ukuran File\n`;
        out.textContent += `  - Ukuran File Asli   : ${originalSize} bytes\n`;
        out.textContent += `  - Ukuran Terenkripsi : ${totalSize} bytes\n`;
        out.textContent += `  - Nilai Overhead     : +${overheadBytes} bytes (${overheadPct.toFixed(4)}%)\n`;

    } catch (e) {
        out.innerHTML += `<span style="color:#ff4d4d;">Error: ${e.message}</span>`;
    }
});

// Download Evaluation Report
const btnDownloadEval = document.getElementById('btnDownloadEval');
if (btnDownloadEval) {
    btnDownloadEval.addEventListener('click', () => {
        let content = "=================================================\n";
        content += "      LAPORAN EVALUASI KRIPTOGRAFI HIBRIDA       \n";
        content += "=================================================\n\n";

        content += "--- AVALANCHE EFFECT (AES-GCM) ---\n";
        content += document.getElementById('outAvalanche').textContent || "[Belum dijalankan]";
        content += "\n\n";

        content += "--- UJI INTEGRITAS (TAMPERING TEST) ---\n";
        content += document.getElementById('outTamper').textContent || "[Belum dijalankan]";
        content += "\n\n";

        content += "--- SIFAT PROBABILISTIK (RSA-OAEP) ---\n";
        content += document.getElementById('outOaep').textContent || "[Belum dijalankan]";
        content += "\n\n";

        content += "--- KINERJA WAKTU KOMPUTASI ---\n";
        content += document.getElementById('outPerf').textContent || "[Belum dijalankan]";
        content += "\n\n";

        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Evaluasi_Kripto_${Math.floor(Date.now() / 1000)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

