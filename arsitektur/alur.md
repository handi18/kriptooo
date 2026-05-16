
 simulasinya menggunakan data *dummy* berupa teks pendek agar proses Kriptografi Hibrid (AES + RSA) ini sangat mudah dibayangkan.

Anggaplah kamu punya sebuah dokumen rahasia, dan ini adalah "bahan baku" yang kita miliki sebelum proses dimulai:

> **Data Dummy Awal:**
> * **Plaintext (Isi File Asli):** `"LAPORAN_KEUANGAN"`
> * **Kunci AES (Dibuat acak oleh sistem):** `"KunciAES-999"`
> * **Kunci Publik RSA (Milik Client):** `"Gembok-RSA-Client"`
> * **Kunci Privat RSA (Rahasia Client):** `"KunciBuka-RSA-Client"`
> 
> 

Berikut adalah alur perjalanannya dari sisi *Client* menuju server *Flask*, dan kembali lagi ke *Client*.

---

### Fase 1: Enkripsi di Sisi Client (Persiapan Upload)

Proses ini terjadi murni di komputer pengguna sebelum file menyentuh jaringan.

**1. Enkripsi Data Asli dengan AES (Cepat)**
Client mengunci teks asli menggunakan Kunci AES dengan mode GCM.

* **Proses:** `"LAPORAN_KEUANGAN"` dikunci dengan `"KunciAES-999"`
* **Hasilnya:**
* **Ciphertext (Data Acak):** `"XyZ77#bQ!"`
* **Auth Tag (Segel Keamanan):** `"Tag-Aman-01"`



**2. Enkripsi Kunci AES dengan RSA (Aman)**
Karena `"KunciAES-999"` sangat rahasia dan harus disimpan untuk membuka file nanti, kunci AES ini dibungkus ke dalam brankas RSA menggunakan Kunci Publik.

* **Proses:** `"KunciAES-999"` dikunci dengan `"Gembok-RSA-Client"`
* **Hasilnya:**
* **Encrypted AES Key:** `"Brankas-Abc123"`



**3. Paket Dikirim ke Server Flask**
Client mengirimkan data yang sudah diamankan lewat HTTP ke server Flask. Server Flask hanya melihat dan menyimpan data ini:

* Ciphertext: `"XyZ77#bQ!"`
* Auth Tag: `"Tag-Aman-01"`
* Encrypted AES Key: `"Brankas-Abc123"`

*(Catatan: Di titik ini, administrator server Flask sekalipun tidak akan tahu isi file aslinya apa, dan tidak tahu apa isi kunci AES-nya).*

---

### Fase 2: Dekripsi di Sisi Client (Setelah Download)

Ketika pengguna ingin membuka filenya, aplikasi Client mengunduh ketiga data acak di atas dari server Flask. Sekarang prosesnya dibalik.

**1. Buka Brankas Kunci AES dengan RSA**
Langkah pertama yang harus dilakukan Client adalah mendapatkan kunci AES-nya kembali. Client menggunakan Kunci Privat RSA yang dirahasiakan di komputernya.

* **Proses:** `"Brankas-Abc123"` dibuka menggunakan `"KunciBuka-RSA-Client"`
* **Hasilnya:** Kunci AES asli berhasil didapatkan kembali, yaitu `"KunciAES-999"`.

**2. Verifikasi dan Buka File dengan AES**
Kini Client sudah memegang kunci AES yang benar. Client akan mencoba membuka Ciphertext dan mencocokkan Auth Tag-nya untuk memastikan file tidak diotak-atik saat berada di server Flask.

* **Proses:** `"XyZ77#bQ!"` dibuka dengan `"KunciAES-999"`, sambil memvalidasi `"Tag-Aman-01"`.
* **Hasilnya:** Teks asli kembali terbaca utuh: **`"LAPORAN_KEUANGAN"`**.

Dengan alur ini, kecepatan AES digunakan untuk memproses datanya yang panjang, dan keamanan tingkat tinggi RSA digunakan untuk menyembunyikan kunci AES-nya.

---

### Status Realisasi (16 Mei 2026)

Proyek ini telah direalisasikan dengan spesifikasi berikut:

*   **Backend:** Python Flask (port 5000) sebagai media penyimpanan JSON.
*   **Frontend:** HTML5 + Vanilla JS dengan **Web Crypto API** untuk proses kriptografi sisi client (Zero-Knowledge).
*   **Algoritma:** 
    *   **AES-GCM 256-bit** (Enkripsi Data + Auth Tag).
    *   **RSA-OAEP 2048-bit** (Key Wrapping).

**Hasil Pengujian Fase 1 (Encryption):**
Data yang berhasil dienkripsi dan disimpan di server (`storage.json`) memiliki format riil sebagai berikut:

```json
{
    "filename": "dummy.txt",
    "ciphertext": "ILuQJNYCv5cR1scI1of5ITcgvIsXU29HRfbYdbWAMwCg+0WJlA==",
    "auth_tag": "tRarfsQKhv4TDkmlDMSgdg==",
    "nonce": "0+lS4q1Ni5UlI8Lk",
    "encrypted_aes_key": "rQsUWtWKK820AWZN7LvVrCRfWgZXp7hdbycBh9tqtE5A3KD7VbuF+np+S/nKv3I9Xk94q+a3VNurQKCmR03X5HwktLgLjtnCrn/pAy8pORECBzo7VAuYZT1igixDGhiv0u/fG9feuA5tOS3jC/OJkEhJFcAxRbQ0JmypjbB0PnkbYJSHFPOnHXuH9GTbPtRohf+9H47+yrlQ9pnOIGc9nxXpr7IO91P2EDTMPqs9T5rijPJNN6XLoCcEwQ6AdtpM/RqTIjWcXJZyZiLT/SNpPeQV/V8hrZ1q2QOk+j+BLJvAcVZdRXjcOmFF46SrzcZvEHXEW7xmAsX2nZ3WNJo3wg==",
    "timestamp": "2026-05-16T06:48:13.708Z"
}
```

*Status saat ini: **Fase 1 Berhasil**. Fase 2 (Dekripsi) dijadwalkan untuk tahap berikutnya.*


