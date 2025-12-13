require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PUERTO || 3000;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const DB_FILE = path.join(__dirname, 'requests.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------- BASE DE DADES ------------------------------------------
function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return { events: [] };
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
        console.error('Error llegint DB:', err);
        return { events: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error escrivint DB:', err);
    }
}

// ----------------- TOKEN SPOTIFY ------------------------------------------
app.get('/api/token', (req, res) => {
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const postData = 'grant_type=client_credentials';

    const options = {
        hostname: 'accounts.spotify.com',
        port: 443,
        path: '/api/token',
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
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

    request.on('error', err => {
        console.error('Error token:', err.message);
        res.status(500).json({ error: 'No s’ha pogut obtenir token' });
    });

    request.write(postData);
    request.end();
});

// ----------------- CERCA SPOTIFY ------------------------------------------
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        const tokenRes = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' +
                        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
                }
            }
        );

        const token = tokenRes.data.access_token;

        const searchRes = await axios.get(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        res.json(searchRes.data);

    } catch (err) {
        console.error('Error Spotify:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify error' });
    }
});

// ----------------- LIMITADOR D’IP ------------------------------------------
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Massa peticions, espera un minut'
});

// ----------------- CREAR EVENT AMB CODI OPCIONAL --------------------------------
app.post('/api/event', (req, res) => {
    const { name, date, code } = req.body;
    if (!name || !date) return res.status(400).json({ error: 'Nom i data requerits' });

    const db = readDB();
    db.events = db.events || [];

    // Només assignem un id: el codi del DJ si existeix, sinó un generat
    let id = code?.trim() || Math.random().toString(36).substring(2,10);

    // Comprovem duplicat
    if (db.events.some(e => e.id === id)) {
        return res.status(400).json({ error: 'Codi ja existent, tria’n un altre' });
    }

    // Creem només un event
    const event = { id, name, date, songs: [] };
    db.events.push(event);
    writeDB(db);

    res.json({ message: 'Event creat', event });
});


// ----------------- ESBORRAR EVENT --------------------------------
app.delete('/api/event/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const initialLength = db.events.length;

    db.events = db.events.filter(e => e.id !== id);

    if (db.events.length === initialLength) {
        return res.status(404).json({ error: 'Event no trobat' });
    }

    writeDB(db);
    res.json({ message: 'Event esborrat correctament' });
});

// ----------------- ACCEDIR EVENT ------------------------------------------
app.get('/api/event/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const event = db.events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    res.json(event);
});

// ----------------- PETICIO CANÇÓ DINS EVENT --------------------------------
app.post('/api/event/:id/request', apiLimiter, (req, res) => {
    const { id } = req.params;
    const { trackId, title, artist } = req.body;

    if (!trackId || !title || !artist) return res.status(400).json({ error: 'Dades incompletes' });

    const db = readDB();
    const event = db.events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    let song = event.songs.find(s => s.trackId === trackId);
    if (song) {
        song.votes++;
    } else {
        event.songs.push({ trackId, title, artist, votes: 1, status: 'sol·licitada' });
    }

    writeDB(db);
    res.json({ message: 'Petició registrada', votes: song ? song.votes : 1 });
});

app.get('/api/event/:id/all-songs', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const event = db.events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    res.json(event.songs); // inclou title, artist, votes, status
});

// ----------------- RANKING EVENT ------------------------------------------
app.get('/api/event/:id/ranking', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const event = db.events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    const ranking = [...event.songs].sort((a,b) => b.votes - a.votes).slice(0,10);
    res.json(ranking);
});

// Llistar tots els events
app.get('/api/events', (req, res) => {
    const db = readDB();
    db.events = db.events || [];
    res.json(db.events.map(e => ({ id: e.id, name: e.name, date: e.date })));
});

// Marcar una cançó com reproduïda o rebutjada dins un event
app.post('/api/event/:id/song-status', (req, res) => {
    const { id } = req.params;
    const { trackId, status } = req.body;

    if (!trackId || !status) return res.status(400).json({ error: 'Dades incompletes' });

    const db = readDB();
    const event = db.events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    const song = event.songs.find(s => s.trackId === trackId);
    if (!song) return res.status(404).json({ error: 'Cançó no trobada' });

    song.status = status;
    writeDB(db);

    res.json({ message: `Cançó marcada com ${status}` });
});

// Llistar cançons sol·licitades d'un event
app.get('/api/event/:id/requested', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const event = db.events.find(e => e.id === id);

    if (!event) return res.status(404).json({ error: 'Event no trobat' });

    const requestedSongs = event.songs
        .filter(song => song.status === 'sol·licitada')
        .sort((a, b) => b.votes - a.votes); // opcional, per ordre de vots

    res.json(requestedSongs);
});


// ----------------- REDIRECT CLIENT -----------------------------------------
app.get('/', (req, res) => res.redirect('/client.html'));

// ----------------- INICIAR SERVIDOR ---------------------------------------
app.listen(PORT, () => console.log(`Servidor actiu a http://localhost:${PORT}`));
