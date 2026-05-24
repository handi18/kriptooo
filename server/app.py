# pyrefly: ignore [missing-import]
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
    try:
        with open(STORAGE_FILE, 'r') as f:
            content = f.read()
            if not content.strip(): return []
            return json.loads(content)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

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

@app.route('/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    try:
        storage = get_storage()
        storage = [entry for entry in storage if entry.get("id") != file_id]
        save_storage(storage)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/files', methods=['DELETE'])
def clear_files():
    try:
        save_storage([])
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    init_storage()
    app.run(debug=True, port=5000)
