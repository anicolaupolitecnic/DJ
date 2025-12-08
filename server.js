// server.js (NUEVO CONTENIDO COMPLETO)
require('dotenv').config();
//console.log("ID cargado:", process.env.SPOTIFY_CLIENT_ID); // <-- AÑADE ESTA LÍNEA
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PUERTO || 3000;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const DB_FILE = path.join(__dirname, 'requests.json');

app.use(express.json()); // Habilita el parsing de JSON en peticiones POST

// Middleware para servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, '')));

// --- Funciones de Gestión de Archivo JSON (Nuestra "Base de Datos") ---
const readDB = () => {
    if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    }
    return { songs: [] };
};

const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// --- API Endpoints ---

// Ruta para obtener el token de Spotify (sin cambios)
app.get('/api/token', async (req, res) => {
    // ... (El código de obtención de token de antes sigue siendo válido aquí) ...
    try {
        const authOptions = {
            method: 'POST',
            url: 'accounts.spotify.com', // <--- Revisa que esta URL sea exacta
            headers: {
                // Asegúrate de que las mayúsculas/minúsculas sean correctas aquí
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials' // <--- Revisa que esto sea exacto
        };

        const response = await axios(authOptions);
        // Devolvemos el token al frontend
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener el token de Spotify' });
    }
});

// Ruta para obtener el ranking de canciones (ordenado por votos)
app.get('/api/ranking', (req, res) => {
    const db = readDB();
    // Ordenar por votos descendente
    const ranking = db.songs.sort((a, b) => b.votes - a.votes).slice(0, 10);
    res.json(ranking);
});

// Limitador de peticiones por IP (Máximo 5 peticiones por minuto por IP)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5, 
    message: "Demasiadas peticiones desde esta IP, espera un minuto para pedir más canciones."
});

// Ruta para solicitar/votar una canción (protegida por el limitador de IP)
app.post('/api/request', apiLimiter, (req, res) => {
    const { trackId, title, artist } = req.body;
    const db = readDB();

    // Comprobar si la canción ya existe
    const existingSong = db.songs.find(s => s.trackId === trackId);

    if (existingSong) {
        // Si existe, incrementa los votos
        existingSong.votes += 1;
    } else {
        // Si no existe, añádela con 1 voto
        db.songs.push({ trackId, title, artist, votes: 1 });
    }

    writeDB(db);
    res.status(200).json({ message: 'Solicitud/Voto registrado con éxito', votes: existingSong ? existingSong.votes : 1 });
});


app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en http://localhost:${PORT}`);
});