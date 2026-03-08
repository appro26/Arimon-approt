const firebaseConfig = { databaseURL: "https://approplaybook-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let myName = localStorage.getItem('appro_name') || null;
let currentResetId = localStorage.getItem('appro_reset_id') || null;
let allPlayers = [];
let currentTasks = [];
let isTaskActive = false;
let localSpyEnabled = false;
let lastMyScore = null;

// --- MUUTOS: Pelin nimi ---
const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

const initialPlaybook = [
    { id: 0, n: "Keittiömestarin Battle Royale", p: 3, d: "Nopeuskisa tyhjentämisessä.", m: false, b: false },
    { id: 1, n: "Supply Drop", p: 2, d: "Tarjoa sankarille juoma.", m: false, b: true },
    { id: 2, n: "Lore-selostus", p: 2, d: "30s puhe historiasta.", m: false, b: false },
    { id: 3, n: "Root-tason Admin", p: 2, d: "Sankari pitää kiitospuheen yhdelle.", m: false, b: true },
    { id: 4, n: "Blue Zone", p: 1, d: "Yhteisajo! Kaikki juovat.", m: false, b: false },
    { id: 5, n: "Skini-vaihto", p: 2, d: "Vaihda asuste kaverin kanssa.", m: false, b: false },
    { id: 6, n: "Vesijäähdytys", p: 1, d: "Kaikki juovat lasin vettä.", m: false, b: false },
    { id: 7, n: "Season Reset", p: 2, d: "Seuraava synttärisankari saa pisteet.", m: false, b: false },
    { id: 8, n: "Makustelu-makro", p: 1, d: "Uusi kippistysrutiini.", m: false, b: false },
    { id: 9, n: "Trivia-haaste", p: 2, d: "KYSYMYS SANKARISTA.", m: false, b: true },
    { id: 10, n: "AFK-vartti", p: 1, d: "15 min ilman puhelimia.", m: false, b: false },
    { id: 11, n: "Ryhmä-emote", p: 1, d: "Yhteiskuva tietyssä asennossa.", m: false, b: false },
    { id: 12, n: "Dev-blogi", p: 1, d: "Kirjoita tervehdys sankarille.", m: false, b: true },
    { id: 13, n: "Lokalisointitesti", p: 1, d: "Tilaa juoma murteella.", m: false, b: false },
    { id: 14, n: "RNG-Loot", p: 2, d: "Yksi onnekas saa pisteet.", m: false, b: false },
    { id: 15, n: "Meta-analyysi", p: 2, d: "30s analyysi koodista.", m: false, b: false },
    { id: 16, n: "Protokolla-kamppailu", p: 3, d: "KPS-turnaus.", m: false, b: false },
    { id: 17, n: "Coaching-rangaistus", p: 2, d: "Sankari antaa haasteen.", m: false, b: true },
    { id: 18, n: "Käyttäjätestaus", p: 2, d: "Sankari tenttaa vierasta.", m: false, b: true },
    { id: 19, n: "Experimental Build", p: 2, d: "Tilaa baarimikon yllätys.", m: false, b: false },
    { id: 20, n: "Bug Bounty", p: 2, d: "Etsi esine joka muistuttaa kiekkoa.", m: false, b: false },
    { id: 21, n: "Red Zone", p: 1, d: "Juomat alle 3 minuutissa.", m: false, b: false },
    { id: 22, n: "Fore-huuto", p: 2, d: "Huuda kovaa FORE!", m: false, b: false },
    { id: 23, n: "Legacy-tuki", p: 2, d: "Kysy tuntemattomalta elämänohje.", m: false, b: false },
    { id: 24, n: "Loot-kraten haku", p: 2, d: "Hae pöytään vettä/snacksia.", m: false, b: false },
    { id: 25, n: "Antsautus", p: 2, d: "Juotava heikommalla kädellä.", m: false, b: false },
    { id: 26, n: "Ping-testi", p: 1, d: "PING -> PONG.", m: false, b: false },
    { id: 27, n: "Keittiön suositus", p: 2, d: "Keksi uusi drinkki.", m: false, b: false },
    { id: 28, n: "Caddy-palvelu", p: 2, d: "Huolehdi sankarin tavaroista.", m: false, b: true },
    { id: 29, n: "Final Circle", p: 1, d: "Viimeinen kuva ja tuuletus.", m: false, b: false }
];

db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) {
        db.ref('gameState').set({ 
            tasks: initialPlaybook, 
            usedTaskIds: [], 
            players: [], 
            resetId: Date.now().toString(),
            config: { useCooldowns: true, excludeUsedTasks: true, bdayHero: null }
        });
        return;
    }

    if (currentResetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    allPlayers = data.players || [];
    currentTasks = data.tasks || [];
    const config = data.config || {};
    const heroId = config.bdayHero;

    if(document.getElementById('useCooldowns')) document.getElementById('useCooldowns').checked = !!config.useCooldowns;
    if(document.getElementById('excludeUsedTasks')) document.getElementById('excludeUsedTasks').checked = !!config.excludeUsedTasks;

    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score !== lastMyScore) { 
            showXPAnimation(me.score - lastMyScore); 
        }
        lastMyScore = me.score;
    }

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, heroId);
    updateDrawCountSelect();
    updateManualTaskSelect();
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList(heroId);
        renderTaskLibrary();
    }

    const winnerOverlay = document.getElementById('lotteryWinner');
    const isLocked = !!data.locked;
    const results = data.participants || [];
    const isMePart = results.some(r => r.name === myName);
    const isGM = document.body.className.includes('gm');

    if (isLocked && data.activeTask) {
        if (isMePart && !isTaskActive) {
            document.getElementById('winnerTaskName').innerText = data.activeTask.n;
            winnerOverlay.style.display = 'flex';
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
            setTimeout(() => { winnerOverlay.style.display = 'none'; }, 1500);
        }
    } else {
        winnerOverlay.style.display = 'none';
    }

    isTaskActive = isLocked;
    const live = data.activeTask;
    const taskBox = document.getElementById('liveTask');
    
    if(live) {
        taskBox.style.display = 'block';
        document.getElementById('liveTaskName').innerText = live.n;
        document.getElementById('liveTaskPoints').innerText = live.p + " XP";
        const descEl = document.getElementById('liveTaskDesc');
        const instrBox = document.getElementById('instructionBox');
        const winnerDesc = document.getElementById('winnerTaskDesc');

        if (isLocked) {
            descEl.style.display = 'none';
            if (isMePart || isGM || localSpyEnabled) {
                instrBox.style.display = 'block';
                winnerDesc.innerText = live.d;
            } else {
                instrBox.style.display = 'none';
            }
        } else {
            if (isGM) {
                descEl.style.display = localSpyEnabled ? 'block' : 'none';
                descEl.innerText = live.d;
            } else {
                descEl.style.display = 'block';
                descEl.innerText = "Tehtävä paljastetaan valituille pelaajille...";
                descEl.style.opacity = "0.5";
            }
            instrBox.style.display = 'none';
        }

        const notSelectedEl = document.getElementById('notParticipatingMsg');
        notSelectedEl.style.display = (isLocked && !isMePart && !isGM) ? 'block' : 'none';
        document.getElementById('taskPhaseTitle').innerText = isLocked ? "VAIHE: SUORITUS" : "VAIHE: ILMOITTAUTUMINEN";
        document.getElementById('joinAction').style.display = isLocked ? 'none' : 'block';

        const vBtn = document.getElementById('btnVolu');
        const myD = allPlayers.find(p => p.name === myName);
        const onCooldown = config.useCooldowns && myD && myD.cooldown;

        if(onCooldown && !isMePart) {
            vBtn.style.display = 'none'; 
            document.getElementById('cooldownWarning').style.display = 'block';
        } else {
            vBtn.style.display = 'block'; 
            document.getElementById('cooldownWarning').style.display = 'none';
            vBtn.className = isMePart ? "btn btn-success" : "btn btn-primary";
            vBtn.innerText = isMePart ? "OSALLISTUT! ✓" : "HALUAN OSALLISTUA";
        }
        renderGMVolunteers(results, isLocked, data.isLotteryRunning, config.useCooldowns);
    } else { 
        taskBox.style.display = 'none'; 
    }
});

function setRole(r, force = false) {
    if (r === 'gm' && !force) {
        const pass = prompt("Syötä GM-salasana:");
        if (pass !== "3030") {
            alert("Väärä salasana!");
            return;
        }
    }
    document.body.className = r + '-mode';
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
}

function drawRandom() {
    const count = parseInt(document.getElementById('drawCount').value) || 1;
    db.ref('gameState/isLotteryRunning').set(true);
    setTimeout(() => {
        db.ref('gameState/participants').once('value', s => {
            let list = s.val() || [];
            if(list.length > 0) {
                let shuffled = [...list].sort(() => 0.5 - Math.random());
                let selected = shuffled.slice(0, Math.min(count, list.length));
                db.ref('gameState').update({ participants: selected, isLotteryRunning: false });
            } else {
                db.ref('gameState/isLotteryRunning').set(false);
                alert("Ei ilmoittautuneita!");
            }
        });
    }, 1200); 
}

function lockParticipants() { 
    db.ref('gameState/locked').set(true); 
    localSpyEnabled = false; 
    updateSpyBtnText(); 
}

function renderLeaderboard(showCD, heroId) {
    const list = document.getElementById('playerList');
    const fragment = document.createDocumentFragment();
    [...allPlayers].sort((a,b) => b.score - a.score).forEach((p) => {
        const isHero = allPlayers.findIndex(x => x.name === p.name) === heroId;
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''} ${isHero ? 'is-hero' : ''}`;
        const cdTag = (showCD && p.cooldown) ? `<span class="on-cooldown-text">[JÄÄHY]</span>` : '';
        const heroTag = isHero ? `<span style="margin-left:5px;">🎂</span>` : '';
        div.innerHTML = `<span>${p.name}${heroTag}${cdTag}</span><span class="xp-badge">${p.score} XP</span>`;
        fragment.appendChild(div);
    });
    list.innerHTML = ''; list.appendChild(fragment);
}

function renderGMVolunteers(results, isLocked, isShuffling, showCD) {
    const grid = document.getElementById('volunteerGrid');
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    allPlayers.forEach((p) => {
        const isInc = results.some(r => r.name === p.name);
        const btn = document.createElement('button');
        const onCD = showCD && p.cooldown;
        btn.className = `btn ${isInc ? 'btn-primary' : 'btn-secondary'} ${onCD ? 'on-cooldown' : ''}`;
        if (isShuffling && isInc) {
            btn.classList.add('shuffling');
            btn.style.animationDelay = (Math.random() * 0.3).toFixed(2) + "s";
        }
        btn.style.margin = '0'; btn.style.fontSize = '0.6rem';
        btn.innerText = p.name;
        btn.disabled = isLocked || isShuffling;
        btn.onclick = () => toggleParticipant(p.name);
        fragment.appendChild(btn);
    });
    grid.innerHTML = ''; grid.appendChild(fragment);
    document.getElementById('btnFinish').style.display = isLocked ? 'block' : 'none';
    const sArea = document.getElementById('scoringArea');
    sArea.innerHTML = isLocked ? '<p style="font-size:0.7rem; color:var(--muted); margin-top:10px; text-align:center;">ONNISTUIKO TEHTÄVÄ?</p>' : '';
    if(isLocked) {
        results.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            row.style.padding = '10px';
            row.innerHTML = `<span>${r.name}</span><button class="btn" style="width:75px; margin:0; padding:8px; font-size:0.7rem; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin(${i})'>${r.win?'WIN':'FAIL'}</button>`;
            sArea.appendChild(row);
        });
    }
}

function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    list.innerHTML = "";
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row';
        div.style.padding = '8px';
        div.innerHTML = `
            <span style="font-size:0.8rem;">${p.name} (${p.score})</span>
            <div style="display:flex; gap:4px;">
                <button class="btn" style="width:32px; padding:5px; margin:0; background:${i===heroId?'var(--gm-accent)':'#333'}" onclick="setBdayHero(${i})">🎂</button>
                <button class="btn ${p.cooldown ? 'btn-success' : 'btn-secondary'}" style="width:auto; font-size:0.5rem; padding:5px; margin:0;" onclick="adminToggleCooldown(${i})">${p.cooldown ? 'VAP' : 'J'}</button>
                <button class="btn btn-secondary" style="width:28px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button>
                <button class="btn btn-secondary" style="width:28px; padding:5px; margin:0;" onclick="adjustScore(${i}, -1)">-</button>
                <button class="btn btn-danger" style="width:28px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button>
            </div>`;
        list.appendChild(div);
    });
}

function setBdayHero(idx) { db.ref('gameState/config/bdayHero').set(idx); }
function adminToggleCooldown(idx) { db.ref(`gameState/players/${idx}/cooldown`).set(!allPlayers[idx].cooldown); }
function updateConfig(key, val) { db.ref(`gameState/config/${key}`).set(val); }

function confirmRandomize() {
    db.ref('gameState').once('value', snap => {
        const data = snap.val();
        const usedIds = data.usedTaskIds || [];
        const config = data.config || {};
        let pool = currentTasks;
        if(config.excludeUsedTasks) {
            pool = currentTasks.filter(t => !usedIds.includes(t.id));
            if(pool.length === 0) { db.ref('gameState/usedTaskIds').set([]); pool = currentTasks; }
        }
        const t = pool[Math.floor(Math.random() * pool.length)];
        db.ref('gameState').update({ activeTask: t, participants: null, locked: false, isLotteryRunning: false });
    });
}

function showScoring() { 
    db.ref('gameState').once('value', snap => { 
        const d = snap.val(); 
        const res = d.participants || []; 
        const task = d.activeTask;
        const usedIds = d.usedTaskIds || [];
        const heroId = d.config?.bdayHero;
        if(task && !usedIds.includes(task.id)) usedIds.push(task.id);
        const updated = allPlayers.map((p, idx) => { 
            const part = res.find(r => r.name === p.name); 
            let earned = 0;
            if(part) { 
                if(part.win) earned += task.p; 
                else if(task.m) earned -= task.p; 
                if(d.config?.useCooldowns) p.cooldown = true; 
            } else {
                p.cooldown = false;
                if(task.b && idx === heroId) earned += task.p;
            }
            p.score = Math.max(0, (p.score || 0) + earned);
            return p; 
        }); 
        db.ref('gameState').update({ players: updated, activeTask: null, participants: null, locked: false, usedTaskIds: usedIds }); 
    }); 
}

function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    if(!pop || points === 0) return;
    pop.style.display = 'block';
    pop.style.color = points > 0 ? "var(--success)" : "var(--danger)";
    pop.innerText = (points > 0 ? "+" : "") + points + " XP";
    pop.classList.remove('xp-animate');
    void pop.offsetWidth;
    pop.classList.add('xp-animate');
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}

function updateDrawCountSelect() {
    const sel = document.getElementById('drawCount');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    for (let i = 1; i <= (allPlayers.length || 1); i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = i; sel.appendChild(opt);
    }
    sel.value = currentVal || 1;
}

function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">VALITSE TEHTÄVÄ...</option>';
    currentTasks.forEach((t, i) => { sel.innerHTML += `<option value="${i}">${t.n}</option>`; });
}

function selectManualTask(idx) {
    if (idx === "") return;
    db.ref('gameState').update({ activeTask: currentTasks[idx], participants: null, locked: false });
    document.getElementById('manualTaskSelect').value = "";
}

function adminAddPlayer() {
    const n = document.getElementById('adminNewPlayerName').value.trim();
    if(!n) return;
    db.ref('gameState/players').transaction(p => {
        p = p || []; if(!p.find(x => x.name === n)) p.push({ name: n, score: 0, cooldown: false });
        return p;
    });
    document.getElementById('adminNewPlayerName').value = ''; 
}

function adminCreateTask() {
    const n = document.getElementById('newTaskName').value.trim();
    const d = document.getElementById('newTaskDesc').value.trim();
    const p = parseInt(document.getElementById('newTaskPoints').value) || 2;
    const m = document.getElementById('newTaskMinus')?.checked || false;
    const b = document.getElementById('newTaskBday')?.checked || false;
    if (!n || !d) return alert("Täytä nimi ja ohjeet!");
    const newTask = { id: Date.now(), n, d, p, m, b };
    db.ref('gameState/tasks').once('value', s => {
        let list = s.val() || []; list.push(newTask);
        db.ref('gameState/tasks').set(list).then(() => {
            document.getElementById('newTaskName').value = ''; 
            document.getElementById('newTaskDesc').value = '';
        });
    });
}

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor'); lib.innerHTML = '';
    currentTasks.forEach((t, i) => {
        const div = document.createElement('div');
        div.style.borderBottom = "1px solid #333"; div.style.padding = "10px 0";
        div.innerHTML = `
            <input type="text" value="${t.n}" onchange="updateTaskInLib(${i}, 'n', this.value)">
            <textarea onchange="updateTaskInLib(${i}, 'd', this.value)">${t.d}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <input type="number" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))" style="width:45px; margin:0;">
                <label style="font-size:0.6rem;"><input type="checkbox" ${t.m?'checked':''} onchange="updateTaskInLib(${i}, 'm', this.checked)"> Miinus</label>
                <label style="font-size:0.6rem; color:var(--gm-accent);"><input type="checkbox" ${t.b?'checked':''} onchange="updateTaskInLib(${i}, 'b', this.checked)"> 🎂</label>
                <button class="btn btn-danger" style="width:auto; padding:5px; margin:0;" onclick="removeTask(${i})">X</button>
            </div>`;
        lib.appendChild(div);
    });
}

function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(confirm("Poista?")) { currentTasks.splice(idx, 1); db.ref('gameState/tasks').set(currentTasks); } }
function resetGame() { if(!confirm("Nollaa peli?")) return; db.ref('gameState').update({ players: [], activeTask: null, participants: null, locked: false, usedTaskIds: [], resetId: Date.now().toString() }); }

function claimIdentity() {
    const n = document.getElementById('playerNameInput').value.trim();
    if(!n) return; myName = n; localStorage.setItem('appro_name', n);
    db.ref('gameState/players').transaction(p => {
        p = p || []; if(!p.find(x => x.name === n)) p.push({ name: n, score: 0, cooldown: false });
        return p;
    });
}

function volunteer() {
    if(!myName) return;
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        if(d.locked) return;
        const p = (d.players || []).find(x => x.name === myName);
        if(d.config?.useCooldowns && p && p.cooldown) return;
        db.ref('gameState/participants').transaction(list => {
            list = list || []; const idx = list.findIndex(r => r.name === myName);
            if(idx > -1) list.splice(idx, 1); else list.push({ name: myName, win: true });
            return list;
        });
    });
}

function toggleParticipant(name) {
    db.ref('gameState/participants').transaction(list => {
        list = list || []; const idx = list.findIndex(r => r.name === name);
        if(idx > -1) list.splice(idx, 1); else list.push({ name: name, win: true });
        return list;
    });
}

function toggleWin(i) { db.ref('gameState/participants/' + i + '/win').transaction(w => !w); }

function toggleGMSpyLocal() { 
    localSpyEnabled = !localSpyEnabled; 
    updateSpyBtnText(); 
    const isGM = document.body.className.includes('gm');
    const isLocked = isTaskActive;
    const descEl = document.getElementById('liveTaskDesc');
    const instrBox = document.getElementById('instructionBox');
    if (isGM) {
        if (!isLocked) { descEl.style.display = localSpyEnabled ? 'block' : 'none'; } 
        else { instrBox.style.display = localSpyEnabled ? 'block' : 'none'; }
    }
}

function updateSpyBtnText() { const btn = document.getElementById('btnGMSpy'); if(btn) btn.innerText = localSpyEnabled ? "PIILOTA SPEKSIT" : "KATSO SPEKSIT"; }
function toggleAdminPanel() { const p = document.getElementById('adminPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; if(p.style.display === 'block') { renderAdminPlayerList(); renderTaskLibrary(); } }
function adjustScore(idx, amt) { db.ref('gameState/players/' + idx + '/score').transaction(s => Math.max(0, (s || 0) + amt)); }
function removePlayer(idx) { if(confirm("Poista?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }
function updateIdentityUI() { 
    const card = document.getElementById('identityCard');
    if(card) card.style.display = myName ? 'none' : 'block'; 
    const tag = document.getElementById('idTag');
    if(tag) tag.innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; 
}

// --- GM-TILAN AKTIVOINTI (Salasana tai 2s painallus) ---
const gmBtn = document.getElementById('btnGM');
let holdTimer;

if (gmBtn) {
    gmBtn.addEventListener('click', () => {
        // Tavallinen klikkaus kysyy salasanaa
        setRole('gm');
    });

    gmBtn.addEventListener('touchstart', (e) => {
        holdTimer = setTimeout(() => {
            setRole('gm', true); // Ohittaa salasanan
            if ("vibrate" in navigator) navigator.vibrate(60);
        }, 2000);
    });
    gmBtn.addEventListener('touchend', () => clearTimeout(holdTimer));

    gmBtn.addEventListener('mousedown', () => {
        holdTimer = setTimeout(() => {
            setRole('gm', true); // Ohittaa salasanan
        }, 2000);
    });
    gmBtn.addEventListener('mouseup', () => clearTimeout(holdTimer));
}
