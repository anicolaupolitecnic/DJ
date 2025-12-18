let eventId = null;

const joinBtn = document.getElementById('joinEvent');
const eventCodeInput = document.getElementById('eventCode');
const clientSection = document.getElementById('clientSection');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const searchResultsTable = document.getElementById('searchResults');
const songRankingTable = document.getElementById('songRankingList');
const searchResultsBody = searchResultsTable.querySelector('tbody');
const songRankingBody = songRankingTable.querySelector('tbody');

let spotifyToken = '';
let rankingInterval = null;

// --------------------------- ACCEDIR EVENT ---------------------------
joinBtn.addEventListener('click', async () => {
    eventId = eventCodeInput.value.trim();
    if (!eventId) return alert('Introdueix un codi d’event');

    try {
        const res = await fetch(`/api/event/${eventId}`);
        if (!res.ok) return alert('Event no trobat');

        // Mostrar la secció client utilitzant classes
        clientSection.classList.remove('hidden');

        fetchRequestedSongs();
        if (rankingInterval) clearInterval(rankingInterval);
        rankingInterval = setInterval(fetchRequestedSongs, 5000);
    } catch (err) {
        console.error(err);
        alert('Error accedint a l’event');
    }
});

// --------------------------- TOKEN SPOTIFY ---------------------------
async function fetchToken() {
    try {
        const res = await fetch('/api/token');
        const data = await res.json();
        spotifyToken = data.access_token;
    } catch {
        alert('No es pot connectar amb Spotify');
    }
}

// --------------------------- CERCA SPOTIFY ---------------------------
searchButton.addEventListener('click', searchSpotify);

async function searchSpotify() {
    const query = searchInput.value.trim();
    if (!query || !eventId) return;

    if (!spotifyToken) await fetchToken();

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        displayResults(data.tracks.items);
    } catch (err) {
        console.error('Error cerca Spotify:', err);
    }
}

// --------------------------- MOSTRAR RESULTATS ---------------------------
function displayResults(tracks) {
    searchResultsBody.innerHTML = '';

    tracks.forEach(track => {
        const imgUrl = track.album.images.length ? track.album.images[0].url : 'https://via.placeholder.com/50';
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><img src="${imgUrl}" width="50" height="50"/></td>
            <td>${track.name}</td>
            <td>${track.artists.map(a=>a.name).join(', ')}</td>
            <td>
                <button onclick="requestSong('${track.id}','${track.name.replace(/'/g,"\\'")}','${track.artists[0].name.replace(/'/g,"\\'")}','${imgUrl}')">
                    Pedir/Votar
                </button>
            </td>
        `;

        searchResultsBody.appendChild(tr);
    });
}

// --------------------------- PETICIÓ CANÇÓ ---------------------------
async function requestSong(trackId, title, artist, cover) {
    if (!eventId) return;

    try {
        const res = await fetch(`/api/event/${eventId}/request`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({trackId,title,artist,cover})
        });

        if (!res.ok) {
            const errData = await res.json();
            return alert(errData.error || 'Error sol·licitant cançó');
        }

        const data = await res.json();
        alert(`Cançó sol·licitada! Vots: ${data.votes}`);
        fetchRequestedSongs();

    } catch (err) {
        console.error('Error sol·licitant cançó:', err);
    }
}

// --------------------------- FETCH CANÇONS SOL·LICITADES ---------------------------
async function fetchRequestedSongs() {
    if (!eventId) return;

    try {
        const res = await fetch(`/api/event/${eventId}/requested`);
        const songs = await res.json();

        songRankingBody.innerHTML = '';

        songs.forEach((s,i)=> {
            const imgUrl = s.cover && s.cover.length ? s.cover : 'https://via.placeholder.com/50';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${imgUrl}" width="50" height="50"/></td>
                <td>${s.title}</td>
                <td>${s.artist}</td>
                <td>${s.votes}</td>
            `;
            songRankingBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error carregant les cançons sol·licitades:', error);
    }
}

// --------------------------- INICIALITZACIÓ ---------------------------
fetchToken();
