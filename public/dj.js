// dj.js

const form = document.getElementById('createEventForm');
const eventInfo = document.getElementById('eventInfo');
const eventSelector = document.getElementById('eventSelector');
const deleteEventBtn = document.getElementById('deleteEventBtn');

const requestedList = document.getElementById('requestedList');
const playedList = document.getElementById('playedList');
const rejectedList = document.getElementById('rejectedList');
const eventCodeDisplay = document.getElementById('eventCodeDisplay');

let eventId = null;
let rankingInterval = null;

// ------------------------- Crear event ----------------------------------
form.addEventListener('submit', async e => {
    e.preventDefault();

    const name = document.getElementById('eventName').value;
    const date = document.getElementById('eventDate').value;
    const code = document.getElementById('eventCodeInput')?.value; // input opcional pel codi

    if (!name || !date) {
        alert('Nom i data requerits');
        return;
    }

    try {
        const res = await fetch('/api/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, code })
        });

        const data = await res.json();

        if (res.ok) {
            eventId = data.event.id;
            eventInfo.innerHTML = `Event creat! Codi: <strong>${eventId}</strong>`;
            alert(`Event creat! Codi: ${eventId}`);
            loadEvents();
            startRankingAutoUpdate();
        } else {
            alert(data.error || 'Error creant event');
        }
    } catch (err) {
        console.error(err);
        alert('Error creant event');
    }
});

// ------------------------- Carregar events -----------------------------
async function loadEvents() {
    const res = await fetch('/api/events');
    const events = await res.json();

    // Netejar el selector abans d'afegir opcions noves
    eventSelector.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Tria un event --';
    eventSelector.appendChild(defaultOption);

    events.forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = `${e.name} (${e.date})`;
        eventSelector.appendChild(option);
    });
}

// ------------------------- Seleccionar event ---------------------------
eventSelector.addEventListener('change', () => {
    eventId = eventSelector.value;

    if (eventId) {
        eventCodeDisplay.textContent = `Codi de l'event: ${eventId}`;
        fetchRanking();
        startRankingAutoUpdate();
    } else {
        eventCodeDisplay.textContent = '';
        requestedList.innerHTML = '';
        playedList.innerHTML = '';
        rejectedList.innerHTML = '';
        stopRankingAutoUpdate();
    }
});

// ------------------------- Esborrar event -----------------------------
deleteEventBtn.addEventListener('click', async () => {
    if (!eventId) {
        alert('Tria primer un event!');
        return;
    }

    if (!confirm('Segur que vols esborrar aquest event? Aquesta acció no es pot desfer.')) return;

    const res = await fetch(`/api/event/${eventId}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
        alert(data.message);
        eventId = null;
        eventSelector.value = '';
        eventCodeDisplay.textContent = '';
        requestedList.innerHTML = '';
        playedList.innerHTML = '';
        rejectedList.innerHTML = '';
        stopRankingAutoUpdate();
        loadEvents();
    } else {
        alert(data.error || 'Error esborrant event');
    }
});

// ------------------------- Actualitzar estat cançó --------------------
async function updateSongStatus(trackId, status) {
    if (!eventId) {
        alert('Tria primer un event!');
        return;
    }

    try {
        const res = await fetch(`/api/event/${eventId}/song-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackId, status })
        });

        const data = await res.json();
        alert(data.message);
        fetchRanking();
    } catch (err) {
        console.error(err);
        alert('Error actualitzant estat cançó');
    }
}

// ------------------------- Carregar ranking / llistes ------------------
async function fetchRanking() {
    if (!eventId) return;
    try {
        const res = await fetch(`/api/event/${eventId}/all-songs`);
        const songs = await res.json();

        requestedList.innerHTML = '';
        playedList.innerHTML = '';
        rejectedList.innerHTML = '';

        songs.forEach((song, i) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${song.title}</strong> - ${song.artist} (${song.votes} vots)`;

            if (song.status === 'sol·licitada') {
                li.innerHTML += `
                    <button onclick="updateSongStatus('${song.trackId}','reproduida')">Reproduïda</button>
                    <button onclick="updateSongStatus('${song.trackId}','rebutjada')">Rebutjada</button>`;
                requestedList.appendChild(li);
            } else if (song.status === 'reproduida') {
                playedList.appendChild(li);
            } else if (song.status === 'rebutjada') {
                rejectedList.appendChild(li);
            }
        });
    } catch (err) {
        console.error(err);
    }
}

// ------------------------- Auto refresh ranking -----------------------
function startRankingAutoUpdate() {
    stopRankingAutoUpdate(); // aturar interval existent
    rankingInterval = setInterval(fetchRanking, 5000);
}

function stopRankingAutoUpdate() {
    if (rankingInterval) {
        clearInterval(rankingInterval);
        rankingInterval = null;
    }
}

// ------------------------- Inicialització -----------------------------
loadEvents();
