// --- KONFIGURAATIO ---
const firebaseConfig = { databaseURL: "https://approplaybook-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- GLOBAALIT MUUTTUJAT ---
let myName = localStorage.getItem('appro_name') || null;
let currentResetId = localStorage.getItem('appro_reset_id') || null;
let allPlayers = [];
let taskLibrary = [];
let localSpyState = {}; 
let lastMyScore = null;
let lastKnownTasks = {}; 
let taskHistory = [];

const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

// --- TEHTÄVÄPAKKA (Oletukset) ---
const defaultTasks = [
    { id: 1, n: "Mise en place", d: "Varmista, että kaikilla pöytäseurueen jäsenillä on lasissa juotavaa (myös vettä). Jos jollain on tyhjää, täytä se.", p: 2, m: 2, b: false, r: 2 },
    { id: 4, n: "Air Drop saapuu", d: "Tilaa synttärisankarille juoma (mieto tai alkoholiton käy).", p: 3, m: 1, b: true, r: 1 },
    { id: 85, n: "PUBG Emote (Sankari)", d: "Sankarin on esitettävä jokin PUBG-pelin tuuletus tai liike baarin keskellä mahdollisimman näyttävästi.", p: 3, m: 1, b: true, r: 1, isHero: true },
    { id: 102, n: "System Overload (Sankari)", d: "Sankarin on lueteltava 10 IT-termiä, 10 frisbeegolf-termiä tai 10 PUBG-termiä 30 sekunnissa.", p: 3, m: 1, b: true, r: 1, isHero: true }
];

// --- TAPAHTUMALOKI ---
function logEvent(msg) {
    const time = new Date().toLocaleTimeString('fi-FI');
    db.ref('gameState/eventLog').push({ time, msg });
}

// --- NOLLAUS ---
window.resetGame = function() {
    if (confirm("VAROITUS: Tämä poistaa kaikki tiedot. Jatketaanko?")) {
        const newResetId = Date.now().toString();
        db.ref('gameState').set({
            players: [],
            tasks: defaultTasks,
            usedTaskIds: [],
            activeTasks: {},
            history: [],
            eventLog: {},
            resetId: newResetId,
            config: { useCooldowns: true, excludeUsedTasks: true, bdayHero: null }
        }).then(() => { localStorage.clear(); location.reload(); });
    }
};

// --- DATA-KUUNTELIJA ---
db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) return;

    if (currentResetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    allPlayers = data.players || [];
    taskLibrary = data.tasks || [];
    taskHistory = Object.values(data.history || {}).reverse().slice(0, 10);
    const config = data.config || {};
    const heroId = config.bdayHero;

    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score !== lastMyScore) { showXPAnimation(me.score - lastMyScore); }
        lastMyScore = me.score;
    }

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, heroId);
    updateManualTaskSelect();
    renderHistory();
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList(heroId);
        renderTaskLibrary();
        renderEventLog(data.eventLog);
        document.getElementById('useCooldowns').checked = !!config.useCooldowns;
        document.getElementById('excludeUsedTasks').checked = !!config.excludeUsedTasks;
    }

    checkForNewWinnerPopups(data.activeTasks || {});
    renderActiveTasks(data.activeTasks || {}, config);
    lastKnownTasks = JSON.parse(JSON.stringify(data.activeTasks || {}));
});

// --- POP-UP TARKISTUS ---
function checkForNewWinnerPopups(newTasks) {
    if (!myName) return;
    Object.keys(newTasks).forEach(taskId => {
        const newTask = newTasks[taskId];
        const oldTask = lastKnownTasks[taskId];
        const wasJustLocked = newTask.locked && (!oldTask || !oldTask.locked);
        if (wasJustLocked) {
            const results = newTask.participants || [];
            const isMeSelected = results.some(r => r.name === myName && r.win);
            if (isMeSelected) triggerWinnerOverlay(newTask.n);
        }
    });
}

// --- RENDERÖINTI: AKTIIVISET TEHTÄVÄT ---
function renderActiveTasks(tasksObj, config) {
    const container = document.getElementById('activeTasksContainer');
    const isGM = document.body.className.includes('gm');
    const heroId = config.bdayHero;
    
    const currentIds = Object.keys(tasksObj);
    const existingIds = Array.from(container.querySelectorAll('.active-task-item')).map(el => el.getAttribute('data-task-id'));

    existingIds.forEach(id => { if (!currentIds.includes(id)) { const el = container.querySelector(`[data-task-id="${id}"]`); if (el) el.remove(); } });

    currentIds.forEach(taskId => {
        const taskData = tasksObj[taskId];
        const isLocked = !!taskData.locked;
        const results = taskData.participants || [];
        const isMePart = results.some(r => r.name === myName && r.win);
        const isHeroTask = !!taskData.isHero;
        
        let card = container.querySelector(`[data-task-id="${taskId}"]`);
        if (!card) {
            card = document.createElement('div');
            card.className = 'card task-box active-task-item';
            card.setAttribute('data-task-id', taskId);
            container.appendChild(card);
        }

        card.classList.toggle('hero-task-gold', isHeroTask);
        card.classList.toggle('participating', !isGM && !isHeroTask && isLocked && isMePart);
        card.classList.toggle('not-participating', !isGM && !isHeroTask && isLocked && !isMePart);

        let html = '';
        if (isHeroTask) {
            html += `<div class="task-status-tag" style="background: gold; color: black; font-weight: 900;">✨ SANKARITEHTÄVÄ ✨</div>`;
        } else if (!isGM && isLocked) {
            html += `<div class="task-status-tag ${isMePart ? '' : 'muted'}">${isMePart ? '🎉 SINUN TEHTÄVÄSI' : '👀 SEURAA MUIDEN SUORITUSTA'}</div>`;
        }

        html += `<h1>${taskData.n}</h1><div class="xp-badge" style="display:inline-block; margin-bottom:10px;">${taskData.p} XP</div>`;

        const showDesc = isLocked || (isGM && localSpyState[taskId]) || isHeroTask;
        if (showDesc) {
            html += `<div class="instruction-card"><p><strong>OHJEET:</strong><br>${taskData.d}</p></div>`;
            if ((isLocked || isHeroTask) && !isHeroTask) {
                const winners = results.filter(r => r.win).map(r => r.name);
                if (winners.length > 0) html += `<div style="margin-top:10px; font-weight:900; color:var(--success); font-size:0.8rem;">SUORITTAJAT: ${winners.join(', ')}</div>`;
            }
        } else {
            html += `<p class="task-description" style="opacity:0.5; font-size:1.1rem;">Odotetaan valintoja...</p>`;
        }

        if (!isLocked && !isHeroTask) {
            const myD = allPlayers.find(p => p.name === myName);
            const onCD = config.useCooldowns && myD && myD.cooldown;
            const amIIn = results.some(r => r.name === myName);
            html += `<div class="join-action-area" style="margin-top:15px;">`;
            if (onCD && !amIIn) html += `<p style="color:var(--danger); font-weight:800; text-align:center;">JÄÄHYLLÄ!</p>`;
            else html += `<button class="btn ${amIIn ? 'btn-success' : 'btn-primary'}" onclick="volunteer('${taskId}')">${amIIn ? 'MUKANA ✓' : 'OSALLISTU'}</button>`;
            html += `</div>`;
        }

        if (isGM) {
            html += `
                <div class="gm-controls-compact" style="margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                    ${!isHeroTask ? `
                        <div class="volunteer-selector-grid" id="grid-${taskId}"></div>
                        <div style="display:flex; gap:5px; margin-bottom:10px;">
                            <select id="drawCount-${taskId}" style="flex:1;"></select>
                            <button class="btn btn-gm" style="flex:2;" onclick="drawRandom('${taskId}')">ARVO</button>
                            <button class="btn btn-success" style="flex:2;" onclick="lockParticipants('${taskId}')">LUKITSE</button>
                        </div>
                    ` : `<div id="hero-status-${taskId}" style="text-align:center; padding:10px; color:gold; font-weight:bold;">SANKARI: ${heroId !== null ? allPlayers[heroId].name : 'EI VALITTU'}</div>`}
                    
                    <div id="scoring-${taskId}"></div>
                    
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-success" id="finish-${taskId}" style="display:${(isLocked || isHeroTask) ? 'block' : 'none'}; flex:3;" onclick="showScoring('${taskId}')">VALMIS / JAA PISTEET</button>
                        <button class="btn btn-secondary" style="flex:1; font-size:0.6rem;" onclick="toggleGMSpy('${taskId}')">SPEKSIT</button>
                    </div>
                </div>
            `;
        }

        if (card.innerHTML !== html) card.innerHTML = html;
        if (isGM) {
            if (!isHeroTask) {
                renderGMGrid(taskId, results, isLocked, taskData.isLotteryRunning, config.useCooldowns);
                updateDrawCountSelect(taskId, taskData);
            }
            if (isLocked || isHeroTask) renderScoringArea(taskId, results, isHeroTask, heroId);
        }
    });
}

// --- ARVONTA ---
function drawRandom(taskId) {
    const sel = document.getElementById(`drawCount-${taskId}`);
    const count = parseInt(sel.value) || 1;
    db.ref(`gameState/activeTasks/${taskId}`).once('value', s => {
        const taskData = s.val();
        let list = taskData.participants || [];
        if(list.length === 0) return;
        db.ref(`gameState/activeTasks/${taskId}/isLotteryRunning`).set(true);
        setTimeout(() => {
            let winners = [...list].sort(() => 0.5 - Math.random()).slice(0, count).map(p => ({ ...p, win: true }));
            db.ref(`gameState/activeTasks/${taskId}`).update({ participants: winners, isLotteryRunning: false });
        }, 1200);
    });
}

// --- GM GRID ---
function renderGMGrid(taskId, results, isLocked, isShuffling, showCD) {
    const grid = document.getElementById(`grid-${taskId}`);
    if(!grid) return; grid.innerHTML = '';
    allPlayers.forEach(p => {
        const isInc = results.some(r => r.name === p.name);
        const onCD = showCD && p.cooldown;
        const btn = document.createElement('button');
        btn.className = `btn ${isInc ? 'btn-primary selected-participant' : 'btn-secondary'} ${onCD ? 'on-cooldown' : ''}`;
        if (isShuffling && isInc) { btn.classList.add('shuffling'); btn.style.animationDelay = (Math.random() * 0.2) + "s"; }
        btn.innerHTML = `${p.name}${onCD ? ' (J)' : ''}`;
        btn.disabled = isLocked || isShuffling;
        btn.onclick = () => toggleParticipant(taskId, p.name);
        grid.appendChild(btn);
    });
}

function renderScoringArea(taskId, results, isHeroTask, heroId) {
    const sArea = document.getElementById(`scoring-${taskId}`);
    if(!sArea) return; sArea.innerHTML = '';
    
    if (isHeroTask) {
        if (heroId === null) { sArea.innerHTML = '<p style="color:red; font-size:0.6rem;">VALITSE SANKARI ADMINISTA!</p>'; return; }
        const heroName = allPlayers[heroId].name;
        // Sankaritehtävissä käytetään osallistujalistassa yhtä alkiota tilan seuraamiseen (Win/Fail)
        db.ref(`gameState/activeTasks/${taskId}/participants`).once('value', snap => {
            const parts = snap.val() || [{ name: heroName, win: true }];
            const isWin = parts[0].win !== false;
            sArea.innerHTML = `
                <div class="player-row success-fail-toggle" style="background: rgba(255,215,0,0.1); border: 1px solid gold; border-radius: 5px; margin-bottom:10px;">
                    <span style="font-weight:bold; color:gold;">${heroName}</span>
                    <button class="btn" style="width:80px; background:${isWin ? 'var(--success)' : 'var(--danger)'}" onclick="toggleHeroWin('${taskId}')">${isWin ? 'SUCCESS' : 'FAIL'}</button>
                </div>`;
        });
    } else {
        results.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'player-row'; row.style.padding = '5px';
            row.innerHTML = `<span>${r.name}</span><button class="btn" style="width:60px; padding:4px; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin("${taskId}", ${i})'>${r.win?'WIN':'FAIL'}</button>`;
            sArea.appendChild(row);
        });
    }
}

function toggleHeroWin(taskId) {
    db.ref(`gameState/activeTasks/${taskId}/participants`).transaction(p => {
        if (!p || p.length === 0) return [{ win: false }];
        p[0].win = !p[0].win;
        return p;
    });
}

function toggleGMSpy(taskId) { localSpyState[taskId] = !localSpyState[taskId]; db.ref('gameState/activeTasks').once('value', s => renderActiveTasks(s.val() || {}, {})); }

function setRole(r) {
    document.body.className = r + '-mode';
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
}

// GM-tilan aktivointi pitkällä painalluksella
let gmHoldTimer;
const gmBtn = document.getElementById('btnGM');
if(gmBtn) {
    const startP = () => { gmHoldTimer = setTimeout(() => { setRole('gm'); if(navigator.vibrate) navigator.vibrate(80); }, 1000); };
    const endP = () => clearTimeout(gmHoldTimer);
    gmBtn.addEventListener('mousedown', startP); gmBtn.addEventListener('mouseup', endP);
    gmBtn.addEventListener('touchstart', startP); gmBtn.addEventListener('touchend', endP);
}

function claimIdentity() {
    const n = document.getElementById('playerNameInput').value.trim();
    if(!n) return; myName = n; localStorage.setItem('appro_name', n);
    db.ref('gameState/players').transaction(p => {
        p = p || []; if(!p.find(x => x.name === n)) p.push({ name: n, score: 0, cooldown: false });
        return p;
    });
}

function volunteer(taskId) {
    if(!myName) return;
    db.ref('gameState').once('value', snap => {
        const data = snap.val();
        if (data.config?.useCooldowns && (data.players.find(p => p.name === myName)?.cooldown)) return;
        db.ref(`gameState/activeTasks/${taskId}/participants`).transaction(list => {
            list = list || []; const idx = list.findIndex(r => r.name === myName);
            if(idx > -1) list.splice(idx, 1); else list.push({ name: myName, win: true });
            return list;
        });
    });
}

function toggleParticipant(taskId, name) {
    db.ref(`gameState/activeTasks/${taskId}/participants`).transaction(list => {
        list = list || []; const idx = list.findIndex(r => r.name === name);
        if(idx > -1) list.splice(idx, 1); else list.push({ name: name, win: true });
        return list;
    });
}

function lockParticipants(taskId) { 
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        if (d.config?.useCooldowns) {
            const winners = (d.activeTasks[taskId].participants || []).filter(r => r.win).map(r => r.name);
            const updated = allPlayers.map(p => { if (winners.includes(p.name)) p.cooldown = true; return p; });
            db.ref('gameState/players').set(updated);
        }
        db.ref(`gameState/activeTasks/${taskId}/locked`).set(true); 
    });
}

function showScoring(taskId) {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const task = d.activeTasks[taskId];
        const res = task.participants || [];
        const heroId = d.config?.bdayHero;
        let used = d.usedTaskIds || [];
        used.push(task.id);

        const updatedPlayers = allPlayers.map((p, idx) => {
            let earned = 0;
            if (task.isHero) {
                if (idx === heroId) {
                    const isWin = res[0] ? res[0].win !== false : true;
                    earned = isWin ? task.p : -task.p;
                }
            } else {
                const part = res.find(r => r.name === p.name);
                if(part && part.win) earned += task.p;
                if(task.b && idx === heroId && !part) earned += task.p;
            }
            p.score = Math.max(0, (p.score || 0) + earned);
            return p;
        });

        db.ref('gameState/history').push({ taskName: task.n, timestamp: new Date().toLocaleTimeString('fi-FI') });
        const newActive = { ...d.activeTasks }; delete newActive[taskId];
        db.ref('gameState').update({ players: updatedPlayers, activeTasks: newActive, usedTaskIds: used });
        logEvent(`Valmis: ${task.n}`);
    });
}

function updateDrawCountSelect(taskId, task) {
    const sel = document.getElementById(`drawCount-${taskId}`);
    if (!sel || sel.options.length > 0) return;
    for (let i = 1; i <= 10; i++) {
        const opt = document.createElement('option'); opt.value = i; opt.innerText = i;
        if(i === (task.r || 1)) opt.selected = true;
        sel.appendChild(opt);
    }
}

function toggleWin(taskId, i) { db.ref(`gameState/activeTasks/${taskId}/participants/${i}/win`).transaction(w => !w); }

function confirmRandomize() {
    const drawCount = parseInt(document.getElementById('drawCountSlider').value) || 1;
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        if (d.config?.useCooldowns) {
            const cleared = allPlayers.map(p => ({ ...p, cooldown: false }));
            db.ref('gameState/players').set(cleared);
        }
        const used = d.usedTaskIds || [];
        let pool = taskLibrary.filter(t => !used.includes(t.id));
        if(pool.length === 0) { db.ref('gameState/usedTaskIds').set([]); pool = taskLibrary; }
        const t = pool[Math.floor(Math.random() * pool.length)];
        // Asetetaan suositeltu pelaajamäärä sliderista
        t.r = drawCount;
        db.ref(`gameState/activeTasks/t_${Date.now()}`).set({ ...t, locked: false, participants: [] });
    });
}

function selectManualTask(idx) {
    if (idx === "") return;
    db.ref('gameState').once('value', snap => {
        const t = taskLibrary[idx];
        db.ref(`gameState/activeTasks/t_${Date.now()}`).set({ ...t, locked: false, participants: [] });
    });
}

function renderHistory() {
    const container = document.getElementById('taskHistoryList');
    if(!container) return; container.innerHTML = "";
    taskHistory.forEach(h => {
        const div = document.createElement('div'); div.className = 'history-item';
        div.innerHTML = `<span>${h.taskName}</span><span style="opacity:0.5">${h.timestamp}</span>`;
        container.appendChild(div);
    });
}

// --- ADMIN TOIMINNOT ---
function adminAddPlayer() {
    const input = document.getElementById('adminNewPlayerName');
    const n = input.value.trim(); if(!n) return;
    db.ref('gameState/players').once('value', snap => {
        let p = snap.val() || [];
        if(!p.find(x => x.name === n)) { p.push({ name: n, score: 0, cooldown: false }); db.ref('gameState/players').set(p); input.value = ''; }
    });
}

function adjustScore(idx, amt) { db.ref(`gameState/players/${idx}/score`).transaction(s => Math.max(0, (s || 0) + amt)); }
function removePlayer(idx) { if(confirm("Poista?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }
function setBdayHero(idx) { db.ref('gameState/config/bdayHero').set(idx); }
function adminToggleCooldown(idx) { db.ref(`gameState/players/${idx}/cooldown`).set(!allPlayers[idx].cooldown); }
function updateConfig(key, val) { db.ref(`gameState/config/${key}`).set(val); }
function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(confirm("Poista?")) { taskLibrary.splice(idx, 1); db.ref('gameState/tasks').set(taskLibrary); } }

function adminCreateTask() {
    const n = document.getElementById('newTaskName').value;
    const d = document.getElementById('newTaskDesc').value;
    const p = parseInt(document.getElementById('newTaskPoints').value);
    const m = document.getElementById('newTaskMinus').checked;
    const b = document.getElementById('newTaskBday').checked;
    const hero = document.getElementById('newTaskIsHero').checked;
    const r = parseInt(document.getElementById('newTaskRecommendedPlayers').value) || 1;
    if(!n || !d) return;
    const newTask = { id: Date.now(), n, d, p, m, b, r, isHero: hero };
    db.ref('gameState/tasks').transaction(list => { list = list || []; list.push(newTask); return list; });
    document.getElementById('newTaskName').value = ''; document.getElementById('newTaskDesc').value = '';
}

function renderLeaderboard(showCD, heroId) {
    const list = document.getElementById('playerList');
    list.innerHTML = '';
    [...allPlayers].sort((a,b) => b.score - a.score).forEach((p) => {
        const pIdx = allPlayers.findIndex(x => x.name === p.name);
        const isHero = pIdx === heroId;
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''} ${isHero ? 'is-hero' : ''} ${p.cooldown ? 'on-cooldown' : ''}`;
        div.innerHTML = `<span>${isHero?'🎂 ':''}${p.name}</span><span class="xp-badge">${p.score} XP</span>`;
        list.appendChild(div);
    });
}

function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    if(!list) return; list.innerHTML = "";
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row'; div.style.padding = '5px';
        div.innerHTML = `
            <span style="font-size:0.7rem;">${p.name} (${p.score})</span>
            <div style="display:flex; gap:2px;">
                <button class="btn" style="padding:4px; background:${i===heroId?'var(--gm-accent)':'#333'}" onclick="setBdayHero(${i})">🎂</button>
                <button class="btn" style="padding:4px;" onclick="adjustScore(${i}, 1)">+</button>
                <button class="btn btn-danger" style="padding:4px;" onclick="removePlayer(${i})">X</button>
            </div>`;
        list.appendChild(div);
    });
}

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor');
    if(!lib) return; lib.innerHTML = '';
    taskLibrary.forEach((t, i) => {
        const div = document.createElement('div');
        div.className = 'compact-task-item';
        div.style.borderBottom = "1px solid #222"; div.style.padding = "5px 0";
        div.innerHTML = `
            <div style="font-size:0.7rem; font-weight:bold;">${t.n}</div>
            <div class="checkbox-align-row" style="font-size:0.6rem;">
                <label>Sankari:</label><input type="checkbox" ${t.isHero?'checked':''} onchange="updateTaskInLib(${i}, 'isHero', this.checked)">
                <label>XP:</label><input type="number" style="width:30px" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))">
                <button class="btn btn-danger" style="padding:2px 5px; margin-left:10px;" onclick="removeTask(${i})">X</button>
            </div>`;
        lib.appendChild(div);
    });
}

function renderEventLog(logData) {
    const container = document.getElementById('adminEventLog');
    if(!container) return; container.innerHTML = "";
    Object.values(logData || {}).reverse().slice(0, 15).forEach(l => {
        container.innerHTML += `<div><span style="color:var(--gm-accent)">[${l.time}]</span> ${l.msg}</div>`;
    });
}

function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if (!sel) return; sel.innerHTML = '<option value="">VALITSE...</option>';
    taskLibrary.forEach((t, i) => { sel.innerHTML += `<option value="${i}">${t.n}</option>`; });
}

function updateIdentityUI() { document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; }

function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    if(!pop || points === 0) return;
    pop.style.display = 'block'; pop.style.color = points > 0 ? "var(--success)" : "var(--danger)";
    pop.innerText = (points > 0 ? "+" : "") + points + " XP";
    pop.classList.remove('xp-animate'); void pop.offsetWidth; pop.classList.add('xp-animate');
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}

function triggerWinnerOverlay(taskName) {
    const overlay = document.getElementById('lotteryWinner');
    if(!overlay) return;
    document.getElementById('winnerTaskName').innerText = taskName; 
    overlay.style.display = 'flex';
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
    setTimeout(() => { overlay.style.display = 'none'; }, 3000); 
}

function toggleAdminPanel() { 
    const p = document.getElementById('adminPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none'; 
}
