require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const app = express();
const PORT = process.env.PUERTO || 3000;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const DJ_USER = process.env.DJ_USER || 'dj';
const DJ_PASS = process.env.DJ_PASSWORD || '1234';

const DB_FILE = path.join(__dirname, 'requests.json');

/* -------------------- MIDDLEWARE -------------------- */

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

/* -------------------- AUTH DJ -------------------- */

function requireDJAuth(req, res, next) {
    if (req.session.djLogged === true) return next();
    res.redirect('/dj-login.html');
}

/* -------------------- BASE DE DADES -------------------- */

function readDB() {
    if (!fs.existsSync(DB_FILE)) return { events: [] };
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { events: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/* -------------------- LOGIN DJ -------------------- */

app.post('/api/dj/login', (req, res) => {
    const { username, password } = req.body;

    if (username === DJ_USER && password === DJ_PASS) {
        req.session.djLogged = true;
        return res.json({ ok: true });
    }

    res.status(401).json({ error: 'Credencials incorrectes' });
});

app.post('/api/dj/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

/* -------------------- RUTA DJ PROTEGIDA -------------------- */
app.get('/dj', requireDJAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dj.html'));
});

app.get('/dj.html', requireDJAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dj.html'));
});

/* -------------------- TOKEN SPOTIFY -------------------- */

app.get('/api/token', (req, res) => {
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const postData = 'grant_type=client_credentials';

    const options = {
        hostname: 'accounts.spotify.com',
        port: 443,
        path: '/api/token',
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const request = https.request(options, response => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
            try { res.json(JSON.parse(data)); }
            catch { res.status(500).json({ error: 'Error processant token' }); }
        });
    });

    request.on('error', err => res.status(500).json({ error: err.message }));
    request.write(postData);
    request.end();
});

/* -------------------- CERCA SPOTIFY -------------------- */

app.get('/api/search', async (req, res) => {
    if (!req.query.q) return res.status(400).json({ error: 'Missing query' });

    try {
        const tokenRes = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
                }
            }
        );

        const token = tokenRes.data.access_token;

        const searchRes = await axios.get(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(req.query.q)}&type=track&limit=20`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        res.json(searchRes.data);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Spotify error' });
    }
});

/* -------------------- RATE LIMIT -------------------- */

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10
});

/* -------------------- EVENTS & SONGS -------------------- */

app.post('/api/event', (req, res) => {
    const { name, date, code } = req.body;
    if (!name || !date) return res.status(400).json({ error: 'Nom i data requerits' });

    const db = readDB();
    const id = code?.trim() || Math.random().toString(36).substring(2,10);

    if (db.events.some(e => e.id === id))
        return res.status(400).json({ error: 'Codi ja existent' });

    db.events.push({ id, name, date, songs: [] });
    writeDB(db);

    res.json({ ok: true });
});

app.get('/api/events', (req,res) => {
    const db = readDB();
    res.json(db.events.map(e => ({ id:e.id, name:e.name, date:e.date })));
});

app.get('/api/event/:id', (req,res) => {
    const event = readDB().events.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });
    res.json(event);
});

/* ----------------- ESBORRAR EVENT ----------------- */
app.delete('/api/event/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const len = db.events.length;
    db.events = db.events.filter(e => e.id !== id);

    if (db.events.length === len) return res.status(404).json({ error: 'Event no trobat' });
    writeDB(db);
    res.json({ message: 'Event esborrat correctament' });
});

app.post('/api/event/:id/request', apiLimiter, (req,res) => {
    const { trackId, title, artist, cover } = req.body;
    const db = readDB();
    const event = db.events.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    let song = event.songs.find(s => s.trackId === trackId);
    if (song) song.votes++;
    else event.songs.push({
        trackId, title, artist, cover,
        votes: 1, status: 'sol·licitada'
    });

    writeDB(db);
    res.json({ ok:true, votes: song ? song.votes : 1 });
});

app.get('/api/event/:id/requested', (req,res) => {
    const event = readDB().events.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error:'Event no trobat' });

    res.json(
        event.songs
            .filter(s => s.status === 'sol·licitada')
            .sort((a,b)=>b.votes-a.votes)
    );
});

app.get('/api/event/:id/all-songs', (req,res) => {
    const event = readDB().events.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error:'Event no trobat' });
    res.json(event.songs);
});

app.post('/api/event/:id/song-status', (req,res) => {
    const { trackId, status } = req.body;
    const db = readDB();
    const event = db.events.find(e => e.id === req.params.id);
    const song = event?.songs.find(s => s.trackId === trackId);
    if (!song) return res.status(404).json({ error:'Cançó no trobada' });

    song.status = status;
    writeDB(db);
    res.json({ ok:true });
});

/* -------------------- ROOT -------------------- */
app.get('/', (req,res) => res.redirect('/client.html'));

app.listen(PORT, () => {
    console.log(`Servidor actiu a http://localhost:${PORT}`);
});
