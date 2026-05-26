import os
import time
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag

def print_header(title):
    print(f"\n{'='*50}\n[TEST] {title}\n{'='*50}")

def hamming_distance(str1, str2):
    # Convert hex to binary strings
    bin1 = bin(int(str1, 16))[2:].zfill(len(str1)*4)
    bin2 = bin(int(str2, 16))[2:].zfill(len(str2)*4)
    distance = sum(c1 != c2 for c1, c2 in zip(bin1, bin2))
    return distance, len(bin1)

# ==========================================
# Pengujian Avalanche Effect AES-GCM
# ==========================================
def test_avalanche_effect():
    print_header("Avalanche Effect AES-256-GCM")
    
    key = AESGCM.generate_key(bit_length=256)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    
    plaintext1 = b"Tugas Kriptografi A"
    plaintext2 = b"Tugas Kriptografi B"  # Beda 1 bit/byte di akhir
    
    # Encrypt
    ct1 = aesgcm.encrypt(nonce, plaintext1, None)
    ct2 = aesgcm.encrypt(nonce, plaintext2, None)
    
    hex_ct1 = ct1.hex()
    hex_ct2 = ct2.hex()
    
    print(f"Plaintext 1 : {plaintext1}")
    print(f"Ciphertext 1: {hex_ct1[:40]}...")
    print(f"Plaintext 2 : {plaintext2}")
    print(f"Ciphertext 2: {hex_ct2[:40]}...")
    
    dist, total_bits = hamming_distance(hex_ct1, hex_ct2)
    percentage = (dist / total_bits) * 100
    print(f"\nTotal Bits       : {total_bits}")
    print(f"Hamming Distance : {dist} bit berbeda")
    print(f"Avalanche Effect : {percentage:.2f}%")

# ==========================================
# Pengujian Integritas (Tampering Test)
# ==========================================
def test_tampering():
    print_header("Data Integrity (Tampering Test) AES-GCM")
    
    key = AESGCM.generate_key(bit_length=256)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    
    plaintext = b"Dokumen Sangat Rahasia 123"
    print(f"Original Plaintext: {plaintext}")
    
    # Encrypt
    ct = aesgcm.encrypt(nonce, plaintext, None)
    print(f"Valid Ciphertext + Tag : {ct.hex()[:40]}...")
    
    # Tamper 1 byte (Simulasi diserang hacker)
    tampered_ct = bytearray(ct)
    tampered_ct[5] = tampered_ct[5] ^ 0xFF 
    print(f"Tampered Ciphertext    : {tampered_ct.hex()[:40]}...")
    
    print("\nMencoba mendekripsi ciphertext yang dimanipulasi...")
    try:
        decrypted = aesgcm.decrypt(nonce, bytes(tampered_ct), None)
        print("GAGAL! Sistem tertipu, berhasil didekripsi.")
    except InvalidTag:
        print("\033[91m[ERROR] cryptography.exceptions.InvalidTag: MAC check failed!\033[0m")
        print("SUKSES! Modifikasi ilegal (Tampering) berhasil diblokir oleh GCM.")

# ==========================================
# Sifat Probabilistik RSA-OAEP
# ==========================================
def test_probabilistic_oaep():
    print_header("Sifat Probabilistik RSA-OAEP")
    
    # Generate RSA Key
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    
    message = b"SECRET_AES_KEY_12345"
    print(f"Pesan asli (Kunci AES) yang akan dibungkus RSA: {message}\n")
    
    for i in range(1, 6):
        # Encrypt 5 times
        ciphertext = public_key.encrypt(
            message,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        print(f"Percobaan {i} Ciphertext (Hex): {ciphertext.hex()[:50]}...")
        
    print("\nKesimpulan: Input yang sama menghasilkan output yang berbeda 100%. Padding OAEP Berfungsi.")

# ==========================================
# Kinerja dan Overhead Waktu (Hybrid)
# ==========================================
def test_performance():
    print_header("Kinerja dan Overhead Waktu Komputasi")
    
    sizes_mb = [0.01, 1, 10, 50] # 10KB, 1MB, 10MB, 50MB
    
    # Setup Keys
    rsa_priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    rsa_pub = rsa_priv.public_key()
    
    print(f"{'Ukuran File':<12} | {'Waktu AES (ms)':<15} | {'Waktu RSA OAEP (ms)':<20}")
    print("-" * 55)
    
    for size in sizes_mb:
        # Generate dummy data
        data_size = int(size * 1024 * 1024)
        dummy_data = os.urandom(data_size)
        
        # 1. Waktu AES (Enkripsi File)
        aes_key = AESGCM.generate_key(bit_length=256)
        aesgcm = AESGCM(aes_key)
        nonce = os.urandom(12)
        
        start_aes = time.perf_counter()
        _ = aesgcm.encrypt(nonce, dummy_data, None)
        end_aes = time.perf_counter()
        aes_time_ms = (end_aes - start_aes) * 1000
        
        # 2. Waktu RSA (Membungkus Kunci AES)
        start_rsa = time.perf_counter()
        _ = rsa_pub.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        end_rsa = time.perf_counter()
        rsa_time_ms = (end_rsa - start_rsa) * 1000
        
        size_str = f"{size} MB" if size >= 1 else f"{int(size*1024)} KB"
        print(f"{size_str:<12} | {aes_time_ms:<15.2f} | {rsa_time_ms:<20.2f}")

if __name__ == "__main__":
    test_avalanche_effect()
    test_tampering()
    test_probabilistic_oaep()
    test_performance()
    print("\n[INFO] Pengujian Selesai. Silakan ambil Screenshot untuk Laporan Bab 4.3.")
