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