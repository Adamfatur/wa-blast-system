const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../data/logs/blast.log');

// Ensure log directory exists
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;

    console.log(logMessage.trim());

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) console.error('Failed to write log:', err);
    });
}

module.exports = { log };
