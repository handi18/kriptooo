// Configuration
const API_URL = 'http://localhost:5000';

// State
let rsaKeyPair = null;
let selectedFile = null;

// UI Elements
const logConsole = document.getElementById('logConsole');
const generateKeysBtn = document.getElementById('generateKeysBtn');
const keyStatus = document.getElementById('keyStatus');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileNameDisplay = document.getElementById('fileName');
const encryptBtn = document.getElementById('encryptBtn');
const refreshBtn = document.getElementById('refreshBtn');
const serverTableBody = document.getElementById('serverTableBody');

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
    log('Generating RSA-OAEP 2048-bit key pair...', 'process');
    try {
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
        
        log('RSA Keys generated successfully.', 'success');
        keyStatus.querySelector('.dot').classList.add('active');
        keyStatus.innerHTML = '<span class="dot active"></span> RSA Keys Ready';
        generateKeysBtn.disabled = true;
        checkReadyState();
    } catch (err) {
        log('Key generation failed: ' + err.message, 'error');
    }
}

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

        // Step C: Wrap AES Key with RSA Public Key
        log('Wrapping AES key with RSA Public Key...', 'process');
        const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const encryptedAesKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            rsaKeyPair.publicKey,
            exportedAesKey
        );

        // Step D: Prepare Packet for Upload
        log('Preparing secure packet...', 'process');
        const packet = {
            filename: selectedFile.name,
            ciphertext: arrayBufferToBase64(ciphertext),
            auth_tag: arrayBufferToBase64(authTag),
            nonce: arrayBufferToBase64(iv),
            encrypted_aes_key: arrayBufferToBase64(encryptedAesKey),
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
        const files = await response.json();
        
        serverTableBody.innerHTML = '';
        
        if (files.length === 0) {
            serverTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No data on server.</td></tr>';
            return;
        }

        files.reverse().forEach(file => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${file.id}</td>
                <td title="${file.filename}">${file.filename}</td>
                <td title="${file.ciphertext}">${file.ciphertext}</td>
                <td>${file.auth_tag}</td>
                <td>${new Date(file.timestamp).toLocaleString()}</td>
            `;
            serverTableBody.appendChild(tr);
        });
    } catch (err) {
        log('Failed to fetch server data: ' + err.message, 'error');
    }
}

// Event Listeners
generateKeysBtn.addEventListener('click', generateKeys);
encryptBtn.addEventListener('click', handleEncryption);
refreshBtn.addEventListener('click', fetchServerData);

// Initial Load
fetchServerData();

// Note: Removed dropZone click listener because <label for="fileInput"> already handles it.
// Adding manual click on dropZone causes double-triggering in some browsers.
