const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

class SessionManager {
    constructor(io) {
        this.io = io;
        this.sessions = new Map(); // sessionId -> { client, status, qr, lastError }
        this.sessionDir = path.join(__dirname, '../session');
    }

    // Initialize or get an existing session
    async initSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            // If disconnected or error, maybe we want to re-init?
            // For now, return existing if it's active or setting up.
            return session;
        }

        // Create new session entry
        const sessionData = {
            id: sessionId,
            client: null,
            status: 'INITIALIZING',
            qr: null,
            lastError: null
        };
        this.sessions.set(sessionId, sessionData);

        this._log(sessionId, 'Initializing new session...');

        try {
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: sessionId,
                    dataPath: this.sessionDir
                }),
                puppeteer: {
                    headless: true,
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-zygote'
                    ]
                }
            });

            sessionData.client = client;
            this._attachListeners(sessionId, client);

            // Initialize async
            client.initialize().catch(err => {
                this._handleError(sessionId, err);
            });

            return sessionData;
        } catch (err) {
            this._handleError(sessionId, err);
            return sessionData;
        }
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    async stopSession(sessionId) {
        if (!this.sessions.has(sessionId)) return;
        const session = this.sessions.get(sessionId);

        try {
            if (session.client) {
                await session.client.destroy();
            }
        } catch (e) {
            this._log(sessionId, `Error stopping session: ${e.message}`, 'ERROR');
        }

        this.sessions.delete(sessionId);
        this._emitStatus(sessionId, 'DESTROYED');
        this._log(sessionId, 'Session stopped and removed.');
    }

    async clearSessionData(sessionId) {
        // Path logic from whatsapp-web.js LocalAuth
        // It creates a folder inside dataPath called "session-<clientId>"
        const sessionFolder = path.join(this.sessionDir, `session-${sessionId}`);
        this._log(sessionId, `Creating request to delete session data at ${sessionFolder}`, 'WARNING');
        try {
            fs.rmSync(sessionFolder, { recursive: true, force: true });
            this._log(sessionId, 'Session data deleted.', 'SUCCESS');
        } catch (e) {
            this._log(sessionId, `Failed to delete session data: ${e.message}`, 'ERROR');
        }
    }

    // Helper to log and emit to specific room
    _log(sessionId, message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${sessionId}][${type}] ${message}`);
        this.io.to(sessionId).emit('log', { sessionId, message, type, timestamp });
    }

    _emitStatus(sessionId, status) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = status;
            // Clear QR if status is not QR_READY (unless we want to keep it? usually clear it on ready)
            if (status !== 'QR_READY') {
                session.qr = null;
            }
        }
        this.io.to(sessionId).emit('wa_status', { sessionId, status });
        this._log(sessionId, `Status changed to ${status}`);
    }

    _handleError(sessionId, err) {
        const msg = err.message || String(err);
        this._log(sessionId, `Error: ${msg}`, 'ERROR');
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastError = msg;
            session.status = 'ERROR';
        }
        this.io.to(sessionId).emit('wa_status', { sessionId, status: 'ERROR', error: msg });
    }

    _attachListeners(sessionId, client) {
        client.on('qr', (qr) => {
            const session = this.sessions.get(sessionId);
            if (session) {
                session.qr = qr;
                session.status = 'QR_READY';
            }
            this._log(sessionId, 'QR Code received');
            this.io.to(sessionId).emit('qr', { sessionId, qr });
            this._emitStatus(sessionId, 'QR_READY');
        });

        client.on('ready', () => {
            this._emitStatus(sessionId, 'READY');
            this._log(sessionId, 'Client is ready!', 'SUCCESS');
        });

        client.on('authenticated', () => {
            this._emitStatus(sessionId, 'AUTHENTICATED');
        });

        client.on('auth_failure', (msg) => {
            this._handleError(sessionId, new Error(`Auth failure: ${msg}`));
            this._emitStatus(sessionId, 'AUTH_FAILURE');
        });

        client.on('disconnected', (reason) => {
            this._emitStatus(sessionId, 'DISCONNECTED');
            this._log(sessionId, `Client disconnected: ${reason}`, 'WARNING');
            // Optional: Auto cleanup? Or let user restart manually?
            // For now, keep the session entry but marked disconnected.
        });
    }
}

module.exports = SessionManager;
