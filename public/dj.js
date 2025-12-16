const createForm = document.getElementById('createEventForm');
const eventSelector = document.getElementById('eventSelector');
const deleteBtn = document.getElementById('deleteEventBtn');
const eventCodeDisplay = document.getElementById('eventCodeDisplay');

const requestedTableBody = document.querySelector('#requestedTable tbody');
const playedTableBody = document.querySelector('#playedTable tbody');
const rejectedTableBody = document.querySelector('#rejectedTable tbody');

let currentEventId = null;

/* ================= CREAR EVENT ================= */
createForm.addEventListener('submit', async e => {
    e.preventDefault();

    const name = document.getElementById('eventName').value.trim();
    const code = document.getElementById('eventCodeInput').value.trim();
    const date = document.getElementById('eventDate').value;

    if (!name || !date) return alert('Nom i data obligatoris');

    const res = await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, code })
    });

    const data = await res.json();

    if (res.ok) {
        alert('Event creat correctament');
        await loadEvents();

        // seleccionar automàticament el nou event
        eventSelector.value = data.event.id;
        setCurrentEvent(data.event.id);
    } else {
        alert(data.error || 'Error creant event');
    }
});

/* ================= ESBORRAR EVENT ================= */
deleteBtn.addEventListener('click', async () => {
    const selectedId = eventSelector.value;

    if (!selectedId) {
        alert('Has de seleccionar un event');
        return;
    }

    const confirmDelete = confirm(
        `Segur que vols esborrar l'event "${selectedId}"?\nAquesta acció NO es pot desfer.`
    );
    if (!confirmDelete) return;

    const res = await fetch(`/api/event/${selectedId}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
        alert('Event esborrat correctament');
        currentEventId = null;
        clearTables();
        eventSelector.value = '';
        eventCodeDisplay.textContent = '';
        loadEvents();
    } else {
        alert(data.error || 'Error esborrant event');
    }
});

/* ================= SELECCIONAR EVENT ================= */
eventSelector.addEventListener('change', e => {
    setCurrentEvent(e.target.value);
});

function setCurrentEvent(eventId) {
    currentEventId = eventId || null;
    eventCodeDisplay.textContent = currentEventId ? `Codi: ${currentEventId}` : '';
    clearTables();
    if (currentEventId) fetchAllSongs();
}

/* ================= CÀRREGA EVENTS ================= */
async function loadEvents() {
    const res = await fetch('/api/events');
    const events = await res.json();

    eventSelector.innerHTML = '<option value="">-- Tria un event --</option>';

    events.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.id;
        opt.textContent = `${ev.name} (${ev.date})`;
        eventSelector.appendChild(opt);
    });
}

/* ================= FETCH CANÇONS ================= */
async function fetchAllSongs() {
    if (!currentEventId) return;

    const res = await fetch(`/api/event/${currentEventId}/all-songs`);
    const songs = await res.json();

    requestedTableBody.innerHTML = '';
    playedTableBody.innerHTML = '';
    rejectedTableBody.innerHTML = '';

    songs
        .filter(s => s.status === 'sol·licitada')
        .sort((a, b) => b.votes - a.votes)
        .forEach(renderRequestedSong);

    songs.filter(s => s.status === 'reproduida').forEach(renderSimpleRow(playedTableBody));
    songs.filter(s => s.status === 'rebutjada').forEach(renderSimpleRow(rejectedTableBody));
}

function renderRequestedSong(s) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><img src="${s.cover || 'https://via.placeholder.com/50'}"></td>
        <td>${s.title}</td>
        <td>${s.artist}</td>
        <td>${s.votes}</td>
        <td>
            <button class="btn-dj" onclick="updateSongStatus('${s.trackId}','reproduida')">✅</button>
            <button class="btn-dj btn-red" onclick="updateSongStatus('${s.trackId}','rebutjada')">❌</button>
        </td>
    `;
    requestedTableBody.appendChild(tr);
}

const renderSimpleRow = table => s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><img src="${s.cover || 'https://via.placeholder.com/50'}"></td>
        <td>${s.title}</td>
        <td>${s.artist}</td>
    `;
    table.appendChild(tr);
};

/* ================= CANVIAR ESTAT CANÇÓ ================= */
async function updateSongStatus(trackId, status) {
    if (!currentEventId) return;

    await fetch(`/api/event/${currentEventId}/song-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, status })
    });

    fetchAllSongs();
}

/* ================= NETEJA ================= */
function clearTables() {
    requestedTableBody.innerHTML = '';
    playedTableBody.innerHTML = '';
    rejectedTableBody.innerHTML = '';
}

/* ================= INIT ================= */
loadEvents();
setInterval(() => {
    if (currentEventId) fetchAllSongs();
}, 5000);
