const socket = io();

// Elements
const statusEl = document.getElementById('status-indicator');
const qrContainer = document.getElementById('qr-container');
const logsContainer = document.getElementById('logs-container');
const numbersInput = document.getElementById('numbers-input');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// --- Socket Events ---

socket.on('connect', () => {
    logToUi('Connected to server', 'INFO');
});

socket.on('disconnect', () => {
    statusEl.className = 'status disconnected';
    statusEl.innerText = 'Disconnected';
    logToUi('Disconnected from server', 'ERROR');
});

socket.on('wa_status', (status) => {
    // status: 'DISCONNECTED', 'QR_READY', 'AUTHENTICATED', 'READY'
    if (status === 'READY') {
        statusEl.className = 'status connected';
        statusEl.innerText = 'WA Ready';
        qrContainer.innerHTML = '<p>WhatsApp Connected!</p>';
        sendBtn.disabled = false;
    } else if (status === 'QR_READY') {
        statusEl.className = 'status disconnected';
        statusEl.innerText = 'Scan QR';
        sendBtn.disabled = true;
    } else {
        statusEl.className = 'status disconnected';
        statusEl.innerText = status;
        sendBtn.disabled = true;
    }
});

socket.on('qr', (qrData) => {
    qrContainer.innerHTML = '';
    // Use qrcode.js library to render
    new QRCode(qrContainer, {
        text: qrData,
        width: 256,
        height: 256
    });
});

socket.on('log', (data) => {
    logToUi(data.message, data.type);
});

// --- UI Logic ---

sendBtn.addEventListener('click', async () => {
    const numbersText = numbersInput.value.trim();
    const messageText = messageInput.value.trim();

    if (!numbersText) {
        alert('Please enter at least one number');
        return;
    }

    const numbers = numbersText.split('\n').map(n => n.trim()).filter(n => n.length > 5);

    if (numbers.length === 0) {
        alert('No valid numbers found');
        return;
    }

    sendBtn.disabled = true;

    try {
        const response = await fetch('/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contacts: numbers.map(n => ({ number: n })),
                message: messageText
            })
        });

        const result = await response.json();
        if (result.success) {
            logToUi('Blast process started...', 'SUCCESS');
        } else {
            logToUi('Failed to start blast: ' + result.error, 'ERROR');
            sendBtn.disabled = false;
        }
    } catch (e) {
        logToUi('Request failed: ' + e.message, 'ERROR');
        sendBtn.disabled = false;
    }
});

function logToUi(msg, type) {
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString();
    div.innerText = `[${time}] ${msg}`;
    logsContainer.appendChild(div);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}
