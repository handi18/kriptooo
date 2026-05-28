//API public key

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

// 4. Server Explorer
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

//delete file API
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

refreshRecipientsBtn.addEventListener('click', fetchPublicKeys);
clearAllBtn.addEventListener('click', clearAllFiles);

// Initial Load
fetchServerData();
fetchPublicKeys();
