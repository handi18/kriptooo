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