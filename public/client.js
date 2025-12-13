let eventId = null;

document.getElementById('joinEvent').addEventListener('click', async () => {
    eventId = document.getElementById('eventCode').value.trim();
    if (!eventId) return alert('Introdueix un codi d’event');

    const res = await fetch(`/api/event/${eventId}`);
    if (!res.ok) return alert('Event no trobat');

    document.getElementById('clientSection').style.display = 'block';
    fetchRequestedSongs();
    setInterval(fetchRequestedSongs, 5000); // refresc cada 5 segons
});

// Cerca i votacions (igual que abans però amb /api/event/:id)
document.getElementById('searchButton').addEventListener('click', searchSpotify);
let spotifyToken = '';

async function fetchToken() {
    try {
        const res = await fetch('/api/token');
        const data = await res.json();
        spotifyToken = data.access_token;
    } catch {
        alert('No es pot connectar amb Spotify');
    }
}

async function searchSpotify() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query || !eventId) return;

    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    displayResults(data.tracks.items);
}

function displayResults(tracks) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    tracks.forEach(track => {
        const div = document.createElement('div');
        div.innerHTML = `
            ${track.name} - ${track.artists[0].name}
            <button onclick="requestSong('${track.id}','${track.name.replace(/'/g,"\\'")}','${track.artists[0].name.replace(/'/g,"\\'")}')">Pedir/Votar</button>
        `;
        resultsDiv.appendChild(div);
    });
}

async function requestSong(trackId, title, artist) {
    if (!eventId) return;
    const res = await fetch(`/api/event/${eventId}/request`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({trackId,title,artist})
    });
    const data = await res.json();
    alert(`Vots: ${data.votes}`);
    fetchRequestedSongs();
}

// --------------------------
// 🔹 FETCH CANÇONS SOL·LICITADES
// --------------------------
async function fetchRequestedSongs() {
    if (!eventId) return;

    try {
        const res = await fetch(`/api/event/${eventId}/requested`); // nou endpoint
        const songs = await res.json();

        const ul = document.getElementById('songRankingList');
        ul.innerHTML = '';

        songs.forEach((s,i)=> {
            const li = document.createElement('li');
            li.innerHTML = `${i+1}. ${s.title} - ${s.artist} (${s.votes} vots)`;
            ul.appendChild(li);
        });

    } catch (error) {
        console.error('Error carregant les cançons sol·licitades:', error);
    }
}

// Inicialització
fetchToken();
