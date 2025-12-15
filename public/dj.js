const createForm = document.getElementById('createEventForm');
const eventSelector = document.getElementById('eventSelector');
const deleteBtn = document.getElementById('deleteEventBtn');
const eventCodeDisplay = document.getElementById('eventCodeDisplay');

const requestedTableBody = document.querySelector('#requestedTable tbody');
const playedTableBody = document.querySelector('#playedTable tbody');
const rejectedTableBody = document.querySelector('#rejectedTable tbody');

let currentEventId = null;

// ----------------- CREAR EVENT -----------------
createForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('eventName').value.trim();
    const code = document.getElementById('eventCodeInput').value.trim();
    const date = document.getElementById('eventDate').value;

    const res = await fetch('/api/event', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,date,code})
    });
    const data = await res.json();
    if(res.ok){ alert('Event creat correctament!'); loadEvents(); }
    else alert(data.error);
});

// ----------------- ESBORRAR EVENT -----------------
deleteBtn.addEventListener('click', async () => {
    if(!currentEventId) return alert('Tria un event');
    const res = await fetch(`/api/event/${currentEventId}`, { method:'DELETE' });
    const data = await res.json();
    if(res.ok) { alert('Event esborrat'); currentEventId=null; loadEvents(); clearTables(); }
    else alert(data.error);
});

// ----------------- SELECCIONAR EVENT -----------------
eventSelector.addEventListener('change', e => {
    currentEventId = e.target.value;
    eventCodeDisplay.textContent = currentEventId ? `Codi: ${currentEventId}` : '';
    if(currentEventId) fetchAllSongs();
});

// ----------------- CÀRREGA EVENTS -----------------
async function loadEvents(){
    const res = await fetch('/api/events');
    const events = await res.json();
    eventSelector.innerHTML = '<option value="">-- Tria un event --</option>';
    events.forEach(ev=>{
        const opt=document.createElement('option');
        opt.value=ev.id;
        opt.textContent=`${ev.name} (${ev.date})`;
        eventSelector.appendChild(opt);
    });
}

// ----------------- FETCH CANÇONS -----------------
async function fetchAllSongs() {
    if(!currentEventId) return;
    const res = await fetch(`/api/event/${currentEventId}/all-songs`);
    const songs = await res.json();

    requestedTableBody.innerHTML='';
    playedTableBody.innerHTML='';
    rejectedTableBody.innerHTML='';

    // Sol·licitades
    songs.filter(s=>s.status==='sol·licitada').sort((a,b)=>b.votes-a.votes).forEach(s=>{
        const img=s.cover || 'https://via.placeholder.com/50';
        const tr=document.createElement('tr');
        tr.innerHTML=`
            <td><img src="${img}" width="50" height="50"></td>
            <td>${s.title}</td>
            <td>${s.artist}</td>
            <td>${s.votes}</td>
            <td>
                <button class="btn-dj" onclick="updateSongStatus('${s.trackId}','reproduida')">✅</button>
                <button class="btn-dj btn-red" onclick="updateSongStatus('${s.trackId}','rebutjada')">❌</button>
            </td>
        `;
        requestedTableBody.appendChild(tr);
    });

    // Reproduïdes
    songs.filter(s=>s.status==='reproduida').forEach(s=>{
        const img=s.cover || 'https://via.placeholder.com/50';
        const tr=document.createElement('tr');
        tr.innerHTML=`<td><img src="${img}" width="50" height="50"></td><td>${s.title}</td><td>${s.artist}</td>`;
        playedTableBody.appendChild(tr);
    });

    // Rebutjades
    songs.filter(s=>s.status==='rebutjada').forEach(s=>{
        const img=s.cover || 'https://via.placeholder.com/50';
        const tr=document.createElement('tr');
        tr.innerHTML=`<td><img src="${img}" width="50" height="50"></td><td>${s.title}</td><td>${s.artist}</td>`;
        rejectedTableBody.appendChild(tr);
    });
}

// ----------------- CANVIAR ESTAT CANÇÓ -----------------
async function updateSongStatus(trackId,status){
    if(!currentEventId) return alert('Tria primer un event!');
    try{
        const res=await fetch(`/api/event/${currentEventId}/song-status`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({trackId,status})
        });
        if(!res.ok){ const err=await res.json(); return alert(err.error||'Error'); }
        fetchAllSongs();
    } catch(err){ console.error(err); }
}

// ----------------- ESBORRAR LLISTA -----------------
async function clearList(listType){
    if(!currentEventId) return alert('Tria primer un event!');
    try{
        const res=await fetch(`/api/event/${currentEventId}/clear-${listType}`, { method:'DELETE' });
        if(!res.ok){ const err=await res.json(); return alert(err.error||'Error'); }
        fetchAllSongs();
    } catch(err){ console.error('Error esborrant llista:', err); }
}

// ----------------- INICIALITZACIÓ -----------------
loadEvents();
setInterval(()=>{ if(currentEventId) fetchAllSongs(); },5000);

function clearTables(){
    requestedTableBody.innerHTML='';
    playedTableBody.innerHTML='';
    rejectedTableBody.innerHTML='';
    eventCodeDisplay.textContent='';
}
