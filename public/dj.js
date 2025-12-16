const createForm = document.getElementById('createEventForm');
const eventSelector = document.getElementById('eventSelector');
const deleteBtn = document.getElementById('deleteEventBtn');
const eventCodeDisplay = document.getElementById('eventCodeDisplay');

const requestedTableBody = document.querySelector('#requestedTable tbody');
const playedTableBody = document.querySelector('#playedTable tbody');
const rejectedTableBody = document.querySelector('#rejectedTable tbody');

let currentEventId = null;
let refreshInterval = null;

/* ---------- CREAR EVENT ---------- */
createForm.addEventListener('submit', async e => {
    e.preventDefault();

    const name = eventName.value.trim();
    const code = eventCodeInput.value.trim();
    const date = eventDate.value;

    const res = await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, code })
    });

    if (res.ok) {
        alert('Event creat');
        createForm.reset();
        loadEvents();
    } else {
        const err = await res.json();
        alert(err.error || 'Error');
    }
});

/* ---------- ESBORRAR EVENT ---------- */
deleteBtn.addEventListener('click', async () => {
    if(!currentEventId) return alert('Tria un event');
    const res = await fetch(`/api/event/${currentEventId}`, { method:'DELETE' });
    const data = await res.json();
    if(res.ok) { alert('Event esborrat'); currentEventId=null; loadEvents(); clearTables(); }
    else alert(data.error);
});


/* ---------- SELECCIONAR EVENT ---------- */
eventSelector.addEventListener('change', () => {
    currentEventId = eventSelector.value;

    clearTables();
    eventCodeDisplay.textContent = currentEventId ? `Codi: ${currentEventId}` : '';

    if (refreshInterval) clearInterval(refreshInterval);

    if (currentEventId) {
        fetchAllSongs();
        refreshInterval = setInterval(fetchAllSongs, 5000);
    }
});

/* ---------- CARREGAR EVENTS ---------- */
async function loadEvents() {
    const res = await fetch('/api/events');
    const events = await res.json();

    events.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.id;
        opt.textContent = `${ev.name} (${ev.date})`;
        eventSelector.appendChild(opt);
    });
}

/* ---------- CANÇONS ---------- */
async function fetchAllSongs() {
    if (!currentEventId) return;

    const res = await fetch(`/api/event/${currentEventId}/all-songs`);
    if (!res.ok) return;

    const songs = await res.json();
    clearTables();

    songs.forEach(s => {
        const img = s.cover || 'https://via.placeholder.com/50';

        if (s.status === 'sol·licitada') {
            requestedTableBody.innerHTML += `
            <tr>
                <td><img src="${img}"></td>
                <td>${s.title}</td>
                <td>${s.artist}</td>
                <td>${s.votes}</td>
                <td>
                    <button onclick="updateSongStatus('${s.trackId}','reproduida')">✅</button>
                    <button onclick="updateSongStatus('${s.trackId}','rebutjada')">❌</button>
                </td>
            </tr>`;
        }

        if (s.status === 'reproduida') {
            playedTableBody.innerHTML += `
            <tr><td><img src="${img}"></td><td>${s.title}</td><td>${s.artist}</td></tr>`;
        }

        if (s.status === 'rebutjada') {
            rejectedTableBody.innerHTML += `
            <tr><td><img src="${img}"></td><td>${s.title}</td><td>${s.artist}</td></tr>`;
        }
    });
}

/* ---------- CANVI ESTAT ---------- */
async function updateSongStatus(trackId, status) {
    if (!currentEventId) return;

    await fetch(`/api/event/${currentEventId}/song-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, status })
    });

    fetchAllSongs();
}

/* ---------- NETEJA ---------- */
function clearTables() {
    requestedTableBody.innerHTML = '';
    playedTableBody.innerHTML = '';
    rejectedTableBody.innerHTML = '';
}

/* ---------- INIT ---------- */
loadEvents();
