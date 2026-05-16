from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os

# Configure Flask to serve static files from the 'client' directory
app = Flask(__name__, static_folder='../client', static_url_path='')
CORS(app)

STORAGE_FILE = 'storage.json'

def init_storage():
    if not os.path.exists(STORAGE_FILE):
        with open(STORAGE_FILE, 'w') as f:
            json.dump([], f)

def get_storage():
    with open(STORAGE_FILE, 'r') as f:
        return json.load(f)

def save_storage(data):
    with open(STORAGE_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/upload', methods=['POST'])
def upload():
    try:
        data = request.json
        # Expecting: { filename, ciphertext, auth_tag, nonce, encrypted_aes_key }
        
        storage = get_storage()
        entry = {
            "id": len(storage) + 1,
            "filename": data.get('filename'),
            "ciphertext": data.get('ciphertext'),
            "auth_tag": data.get('auth_tag'),
            "nonce": data.get('nonce'),
            "encrypted_aes_key": data.get('encrypted_aes_key'),
            "timestamp": data.get('timestamp')
        }
        storage.append(entry)
        save_storage(storage)
        
        return jsonify({"status": "success", "message": "File encrypted and uploaded successfully!", "id": entry["id"]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/files', methods=['GET'])
def list_files():
    storage = get_storage()
    return jsonify(storage)

@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    init_storage()
    app.run(debug=True, port=5000)
