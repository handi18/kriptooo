import os
# pyrefly: ignore [missing-import]
from Crypto.Cipher import AES

def string_to_bin(s):
    """Convert a string to its binary representation."""
    return ''.join(format(ord(c), '08b') for c in s)

def bytes_to_bin(b):
    """Convert bytes to its binary representation."""
    return ''.join(format(byte, '08b') for byte in b)

def hamming_distance(bin1, bin2):
    """Calculate the number of different bits between two binary strings."""
    if len(bin1) != len(bin2):
        raise ValueError(f"Length mismatch: {len(bin1)} != {len(bin2)}")
    return sum(c1 != c2 for c1, c2 in zip(bin1, bin2))

def flip_one_bit_in_bytes(data):
    """Flip the very first bit of a byte array."""
    mutable_data = bytearray(data)
    mutable_data[0] ^= 0b10000000 # Flip the highest bit of the first byte
    return bytes(mutable_data)

def flip_one_char_in_string(s):
    """Change one character in a string (which changes bits)."""
    # Just change the first character slightly
    return chr(ord(s[0]) ^ 1) + s[1:]

def print_avalanche_result(name, bit_diff, total_bits):
    percentage = (bit_diff / total_bits) * 100
    print(f"--- Skenario: {name} ---")
    print(f"Total Bits  : {total_bits}")
    print(f"Bit Berbeda : {bit_diff}")
    print(f"Avalanche   : {percentage:.2f}%\n")


def test_avalanche():
    print("="*40)
    print("PENGUJIAN AVALANCHE EFFECT (AES-256-GCM)")
    print("="*40)

    # 1. Setup Base Parameters
    plaintext_A = "DOKUMEN RAHASIA NEGARA"
    key_A = os.urandom(32) # 256-bit key
    nonce = os.urandom(12) # 96-bit nonce (harus konstan untuk pengujian ini)

    # Base Encryption
    cipher_A = AES.new(key_A, AES.MODE_GCM, nonce=nonce)
    ciphertext_A, tag_A = cipher_A.encrypt_and_digest(plaintext_A.encode('utf-8'))
    bin_cipher_A = bytes_to_bin(ciphertext_A)
    total_bits = len(bin_cipher_A)

    # ==========================================
    # SKENARIO 1: AVALANCHE PADA PLAINTEXT
    # ==========================================
    # Ubah sedikit plaintext (1 karakter/bit)
    plaintext_B = flip_one_char_in_string(plaintext_A)
    
    cipher_B = AES.new(key_A, AES.MODE_GCM, nonce=nonce)
    ciphertext_B, tag_B = cipher_B.encrypt_and_digest(plaintext_B.encode('utf-8'))
    bin_cipher_B = bytes_to_bin(ciphertext_B)

    diff_plaintext = hamming_distance(bin_cipher_A, bin_cipher_B)
    print_avalanche_result("Ubah 1 Bit pada Plaintext", diff_plaintext, total_bits)

    # ==========================================
    # SKENARIO 2: AVALANCHE PADA KUNCI (KEY)
    # ==========================================
    # Ubah 1 bit pada kunci AES
    key_B = flip_one_bit_in_bytes(key_A)

    cipher_C = AES.new(key_B, AES.MODE_GCM, nonce=nonce)
    ciphertext_C, tag_C = cipher_C.encrypt_and_digest(plaintext_A.encode('utf-8'))
    bin_cipher_C = bytes_to_bin(ciphertext_C)

    diff_key = hamming_distance(bin_cipher_A, bin_cipher_C)
    print_avalanche_result("Ubah 1 Bit pada Kunci AES", diff_key, total_bits)


if __name__ == '__main__':
    test_avalanche()
