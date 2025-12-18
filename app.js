const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { MessageMedia } = require('whatsapp-web.js'); // Keep for media handling utils if needed
const { sendMessageWithDelay } = require('./modules/sender');
const SessionManager = require('./modules/SessionManager');

// --- Global Error Handlers ---
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

// --- Initialization ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- CORS ---
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    return next();
});

app.use(express.static('public'));
app.use(express.json());

const PORT = 3000;

// --- Session Manager ---
const sessionManager = new SessionManager(io);

// --- Express Routes ---

// List all active sessions
app.get('/sessions', (req, res) => {
    const sessions = [];
    for (const [id, data] of sessionManager.sessions.entries()) {
        sessions.push({
            id,
            status: data.status,
            lastError: data.lastError
        });
    }
    res.json({ success: true, sessions });
});

// Initialize a new session
app.post('/session/init', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    try {
        const session = await sessionManager.initSession(sessionId);
        res.json({ success: true, message: 'Session initialization started', status: session.status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Session Status
app.get('/session/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({
        success: true,
        sessionId,
        status: session.status,
        lastError: session.lastError
    });
});

// Get QR Code
app.get('/session/:sessionId/qr', (req, res) => {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({
        success: true,
        sessionId,
        qr: session.qr,
        status: session.status
    });
});

// Restart Session
app.post('/session/:sessionId/restart', async (req, res) => {
    const { sessionId } = req.params;
    const clearSession = Boolean(req.body && (req.body.clearSession || req.body.clear_session));

    console.log(`Restart request for ${sessionId}, clearSession=${clearSession}`);
    await sessionManager.stopSession(sessionId);

    if (clearSession) {
        await sessionManager.clearSessionData(sessionId);
    }

    // Re-init
    sessionManager.initSession(sessionId);

    res.json({ success: true, message: 'Session restarting...' });
});

// Send Message (Blast)
app.post('/send', async (req, res) => {
    const { sessionId, contacts, message, mediaUrl } = req.body;

    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = sessionManager.getSession(sessionId);
    if (!session || !session.client || session.status !== 'READY') {
        return res.status(503).json({ success: false, error: 'Session not ready or not found' });
    }

    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ success: false, error: 'Invalid contacts data' });
    }

    // Process in background
    (async () => {
        sessionManager._log(sessionId, `Starting blast to ${contacts.length} numbers...`, 'INFO');

        let media = null;
        if (mediaUrl) {
            try {
                sessionManager._log(sessionId, `Downloading media from ${mediaUrl}...`, 'INFO');
                media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
            } catch (e) {
                sessionManager._log(sessionId, `Failed to download media: ${e.message}`, 'ERROR');
            }
        }

        const client = session.client;

        for (const [index, c] of contacts.entries()) {
            let number = c.number.replace(/\D/g, '');
            if (number.startsWith('0')) number = '62' + number.slice(1);
            if (!number.endsWith('@c.us')) number += '@c.us';

            const userMessage = c.message || message;

            // Send Media if available
            if (media) {
                await sendMessageWithDelay({
                    sendMessage: (n, m) => client.sendMessage(n, m)
                }, number, media);
            }

            // Send Text
            await sendMessageWithDelay({
                sendMessage: (n, m) => client.sendMessage(n, m)
            }, number, userMessage);
        }
        sessionManager._log(sessionId, 'Blast completed!', 'SUCCESS');
    })();

    res.json({ success: true, message: 'Process started' });
});

// --- Socket Connection ---
io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    // Client asks to join a session room to listen for events
    socket.on('join_session', (sessionId) => {
        console.log(`Socket ${socket.id} joining session ${sessionId}`);
        socket.join(sessionId);

        // Send immediate status if session exists
        const session = sessionManager.getSession(sessionId);
        if (session) {
            socket.emit('wa_status', { sessionId, status: session.status });
            if (session.qr && session.status === 'QR_READY') {
                socket.emit('qr', { sessionId, qr: session.qr });
            }
        } else {
            // socket.emit('wa_status', { sessionId, status: 'NOT_FOUND' });
        }
    });
});

// --- Start ---
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

