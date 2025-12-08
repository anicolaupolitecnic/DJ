// script.js
document.getElementById('searchButton').addEventListener('click', searchSpotify);

let spotifyToken = '';

// 1. Obtener el token de Spotify del backend al cargar la página
async function fetchToken() {
    try {
        const response = await fetch('/api/token');
        const data = await response.json();
        spotifyToken = data.access_token;
        console.log("Token obtenido:", spotifyToken);
    } catch (error) {
        console.error("Error al obtener el token:", error);
        alert("No se pudo conectar con Spotify. Intenta recargar la página.");
    }
}

// 2. Función de búsqueda
async function searchSpotify() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;

    if (!spotifyToken) await fetchToken();

    try {
        const response = await fetch(`api.spotify.com{encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': `Bearer ${spotifyToken}`
            }
        });

        if (response.status === 401) { // El token expiró, lo recargamos
            await fetchToken();
            return searchSpotify(); // Intentamos de nuevo
        }

        const data = await response.json();
        displayResults(data.tracks.items);

    } catch (error) {
        console.error("Error en la búsqueda:", error);
    }
}

// 3. Mostrar resultados de búsqueda en el HTML
function displayResults(tracks) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    tracks.forEach(track => {
        const item = document.createElement('div');
        item.classList.add('song-item');
        item.innerHTML = `
            <span>${track.name} - ${track.artists[0].name}</span>
            <button class="vote-button" onclick="requestSong('${track.id}', '${track.name.replace(/'/g, "\\'")}', '${track.artists[0].name.replace(/'/g, "\\'")}')">Pedir/Votar</button>
        `;
        resultsDiv.appendChild(item);
    });
}

// 4. Función para enviar la solicitud al backend y votar
async function requestSong(trackId, title, artist) {
    try {
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trackId, title, artist })
        });

        if (response.status === 429) { // 429 Too Many Requests (del limitador de IP)
            const errorData = await response.json();
            alert(`Límite de solicitudes alcanzado: ${errorData.message}`);
            return;
        }

        if (!response.ok) {
            throw new Error('Error al solicitar la canción');
        }

        const result = await response.json();
        alert(`¡Gracias! Se ha solicitado/votado la canción. Votos actuales: ${result.votes || 1}`);
        fetchRanking(); // Actualiza la lista de ranking inmediatamente
        
    } catch (error) {
        console.error("Error al solicitar la canción:", error);
        alert("Ocurrió un error al procesar tu solicitud.");
    }
}

// 5. Función para cargar el ranking de canciones
async function fetchRanking() {
    try {
        const response = await fetch('/api/ranking');
        const ranking = await response.json();
        displayRanking(ranking);
    } catch (error) {
        console.error("Error al cargar el ranking:", error);
    }
}

// 6. Mostrar el ranking en el HTML
function displayRanking(ranking) {
    const rankingList = document.getElementById('songRankingList');
    rankingList.innerHTML = '';
    ranking.forEach((song, index) => {
        const item = document.createElement('li');
        item.classList.add('song-item');
        item.innerHTML = `
            <strong>${index + 1}.</strong> ${song.title} - ${song.artist} 
            <span>(Votos: ${song.votes})</span>
        `;
        rankingList.appendChild(item);
    });
}

// Inicializar la obtención del token Y cargar el ranking al cargar la página
fetchToken();
fetchRanking();
// Opcional: Actualizar el ranking cada 30 segundos automáticamente
setInterval(fetchRanking, 30000); 