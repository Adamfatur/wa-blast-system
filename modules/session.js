const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { log } = require('./logger');

function initSession() {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: "client-one", dataPath: "./session" }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        log('QR RECEIVED', 'INFO');
        qrcode.generate(qr, { small: true });
        console.log('Please scan the QR code with your WhatsApp app.');
    });

    client.on('ready', () => {
        log('Client is ready!', 'SUCCESS');
    });

    client.on('authenticated', () => {
        log('Client authenticated', 'SUCCESS');
    });

    client.on('auth_failure', (msg) => {
        log(`AUTHENTICATION FAILURE: ${msg}`, 'ERROR');
    });

    client.on('disconnected', (reason) => {
        log(`Client was disconnected: ${reason}`, 'WARNING');
    });

    return client;
}

module.exports = { initSession };
