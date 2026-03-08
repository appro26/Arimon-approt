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

const initialPlaybook = [
    { id: 0, n: "Keittiömestarin Battle Royale", p: 3, d: "Nopeuskisa tyhjentämisessä." },
    { id: 1, n: "Supply Drop", p: 2, d: "Tarjoa sankarille juoma." },
    { id: 2, n: "Lore-selostus", p: 2, d: "30s puhe historiasta." },
    { id: 3, n: "Root-tason Admin", p: 2, d: "Sankari pitää kiitospuheen yhdelle." },
    { id: 4, n: "Blue Zone", p: 1, d: "Yhteisajo! Kaikki juovat." },
    { id: 5, n: "Skini-vaihto", p: 2, d: "Vaihda asuste kaverin kanssa." },
    { id: 6, n: "Vesijäähdytys", p: 1, d: "Kaikki juovat lasin vettä." },
    { id: 7, n: "Season Reset", p: 2, d: "Seuraava synttärisankari saa pisteet." },
    { id: 8, n: "Makustelu-makro", p: 1, d: "Uusi kippistysrutiini." },
    { id: 9, n: "Trivia-haaste", p: 2, d: "KYSYMYS SANKARISTA." },
    { id: 10, n: "AFK-vartti", p: 1, d: "15 min ilman puhelimia." },
    { id: 11, n: "Ryhmä-emote", p: 1, d: "Yhteiskuva tietyssä asennossa." },
    { id: 12, n: "Dev-blogi", p: 1, d: "Kirjoita tervehdys sankarille." },
    { id: 13, n: "Lokalisointitesti", p: 1, d: "Tilaa juoma murteella." },
    { id: 14, n: "RNG-Loot", p: 2, d: "Yksi onnekas saa pisteet." },
    { id: 15, n: "Meta-analyysi", p: 2, d: "30s analyysi koodista." },
    { id: 16, n: "Protokolla-kamppailu", p: 3, d: "KPS-turnaus." },
    { id: 17, n: "Coaching-rangaistus", p: 2, d: "Sankari antaa haasteen." },
    { id: 18, n: "Käyttäjätestaus", p: 2, d: "Sankari tenttaa vierasta." },
    { id: 19, n: "Experimental Build", p: 2, d: "Tilaa baarimikon yllätys." },
    { id: 20, n: "Bug Bounty", p: 2, d: "Etsi esine joka muistuttaa kiekkoa." },
    { id: 21, n: "Red Zone", p: 1, d: "Juomat alle 3 minuutissa." },
    { id: 22, n: "Fore-huuto", p: 2, d: "Huuda kovaa FORE!" },
    { id: 23, n: "Legacy-tuki", p: 2, d: "Kysy tuntemattomalta elämänohje." },
    { id: 24, n: "Loot-kraten haku", p: 2, d: "Hae pöytään vettä/snacksia." },
    { id: 25, n: "Antsautus", p: 2, d: "Juotava heikommalla kädellä." },
    { id: 26, n: "Ping-testi", p: 1, d: "PING -> PONG." },
    { id: 27, n: "Keittiön suositus", p: 2, d: "Keksi uusi drinkki." },
    { id: 28, n: "Caddy-palvelu", p: 2, d: "Huolehdi sankarin tavaroista." },
    { id: 29, n: "Final Circle", p: 1, d: "Viimeinen kuva ja tuuletus." }
];

// KUUNTELIJA
db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) {
        db.ref('gameState').set({ 
            tasks: initialPlaybook, 
            usedTaskIds: [], 
            players: [], 
            resetId: Date.now().toString(),
            config: { useCooldowns: true, excludeUsedTasks: true }
        });
        return;
    }

    if (currentResetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    allPlayers = data.players || [];
    currentTasks = data.tasks || [];
    const config = data.config || { useCooldowns: true, excludeUsedTasks: true };

    // Synkronoi Admin-asetukset
    const cdCheck = document.getElementById('useCooldowns');
    const usedCheck = document.getElementById('excludeUsedTasks');
    if(cdCheck) cdCheck.checked = config.useCooldowns;
    if(usedCheck) usedCheck.checked = config.excludeUsedTasks;

    // XP-POPUP logiikka (Hienompi animaatio)
    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score !== lastMyScore) { 
            showXPAnimation(me.score - lastMyScore); 
        }
        lastMyScore = me.score;
    }

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns);
    updateDrawCountSelect();
    updateManualTaskSelect();
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList();
        renderTaskLibrary();
    }

    // VOITTO-ILMOITUS (Vain voittajalle)
    const winnerOverlay = document.getElementById('lotteryWinner');
    if (data.locked && data.activeTask) {
        const results = data.participants || [];
        const amIChosen = results.some(r => r.name === myName);
        // Tarkistetaan onko isTaskActive vielä false, jotta ilmoitus näytetään vain kerran lukitushetkellä
        if (amIChosen && !isTaskActive) {
            document.getElementById('winnerTaskName').innerText = data.activeTask.n;
            document.getElementById('winnerTaskDesc').innerText = data.activeTask.d;
            winnerOverlay.style.display = 'flex';
            if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
            setTimeout(() => { winnerOverlay.style.display = 'none'; }, 6000);
        }
    } else {
        winnerOverlay.style.display = 'none';
    }

    // TEHTÄVÄN TILA
    const live = data.activeTask;
    const taskBox = document.getElementById('liveTask');
    
    // Ääni poistettu arvonnan alusta pyynnöstä
    if(!isTaskActive && live) {
        document.getElementById('liveTaskName').classList.add('flash-effect');
        setTimeout(() => document.getElementById('liveTaskName').classList.remove('flash-effect'), 1000);
    }

    isTaskActive = !!live && !!data.locked;
    
    if(live) {
        taskBox.style.display = 'block';
        const results = data.participants || [];
        const isLocked = !!data.locked;
        const isGM = document.body.className.includes('gm');
        const isMePart = results.some(r => r.name === myName);
        
        document.getElementById('liveTaskName').innerText = live.n;
        document.getElementById('liveTaskPoints').innerText = live.p + " XP";
        document.getElementById('liveTaskDesc').innerText = live.d;

        const shouldSeeSpecs = (isLocked && (isMePart || isGM)) || (isGM && localSpyEnabled);
        document.getElementById('instructionBox').style.display = shouldSeeSpecs ? 'block' : 'none';
        
        document.getElementById('taskPhaseTitle').innerText = isLocked ? "VAIHE: SUORITUS" : "VAIHE: ILMOITTAUTUMINEN";
        document.getElementById('joinAction').style.display = isLocked ? 'none' : 'block';

        const vBtn = document.getElementById('btnVolu');
        const myD = allPlayers.find(p => p.name === myName);
        
        const onCooldown = config.useCooldowns && myD && myD.cooldown;

        if(onCooldown && !isMePart) {
            vBtn.style.display = 'none'; document.getElementById('cooldownWarning').style.display = 'block';
        } else {
            vBtn.style.display = 'block'; document.getElementById('cooldownWarning').style.display = 'none';
            vBtn.className = isMePart ? "btn btn-success" : "btn btn-primary";
            vBtn.innerText = isMePart ? "OSALLISTUT! ✓" : "HALUAN OSALLISTUA";
        }
        
        renderGMVolunteers(results, isLocked, data.isLotteryRunning, config.useCooldowns);
    } else { 
        taskBox.style.display = 'none'; 
    }
});

// --- ARVONTA ---
function drawRandom() {
    const count = parseInt(document.getElementById('drawCount').value) || 1;
    db.ref('gameState/isLotteryRunning').set(true);
    
    setTimeout(() => {
        db.ref('gameState/participants').once('value', s => {
            let list = s.val() || [];
            if(list.length > count) {
                let shuffled = list.sort(() => 0.5 - Math.random());
                list = shuffled.slice(0, count);
            }
            db.ref('gameState').update({ 
                participants: list,
                isLotteryRunning: false,
                locked: true 
            });
        });
    }, 2000); // Hieman pidempi arvonta-aika kiihtyvälle animaatiolle
}

// --- RENDEROINTI ---
function renderLeaderboard(showCD) {
    const list = document.getElementById('playerList');
    const fragment = document.createDocumentFragment();
    
    [...allPlayers].sort((a,b) => b.score - a.score).forEach(p => {
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''}`;
        const cdTag = (showCD && p.cooldown) ? `<span class="on-cooldown-text">[JÄÄHY]</span>` : '';
        div.innerHTML = `<span>${p.name}${cdTag}</span><span class="xp-badge">${p.score} XP</span>`;
        fragment.appendChild(div);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
}

function renderGMVolunteers(results, isLocked, isShuffling, showCD) {
    const grid = document.getElementById('volunteerGrid');
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    
    allPlayers.forEach((p, idx) => {
        const isInc = results.some(r => r.name === p.name);
        const btn = document.createElement('button');
        const onCD = showCD && p.cooldown;
        
        btn.className = `btn ${isInc ? 'btn-primary' : 'btn-secondary'} ${onCD ? 'on-cooldown' : ''}`;
        
        if (isShuffling && isInc) {
            btn.classList.add('shuffling');
            // Asetetaan jokaiselle satunnainen delay jotta vilkkuvat eritahtia
            btn.style.animationDelay = (Math.random() * 0.4) + "s";
        }
        
        btn.style.margin = '0';
        btn.style.fontSize = '0.6rem';
        btn.innerText = p.name;
        btn.disabled = isLocked || isShuffling;
        btn.onclick = () => toggleParticipant(p.name);
        fragment.appendChild(btn);
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
    
    document.getElementById('btnLock').style.display = isLocked ? 'none' : 'block';
    document.getElementById('btnFinish').style.display = isLocked ? 'block' : 'none';
    
    const sArea = document.getElementById('scoringArea');
    sArea.innerHTML = isLocked ? '<p style="font-size:0.7rem; color:var(--muted); margin-top:10px; text-align:center;">ONNISTUIKO TEHTÄVÄ? VALITSE WIN/FAIL</p><h3>Pisteytys</h3>' : '';
    if(isLocked) {
        results.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            row.style.padding = '10px';
            row.innerHTML = `<span>${r.name}</span><button class="btn" style="width:70px; margin:0; padding:8px; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin(${i})'>${r.win?'WIN':'FAIL'}</button>`;
            sArea.appendChild(row);
        });
    }
}

function renderAdminPlayerList() {
    const list = document.getElementById('adminPlayerList');
    const fragment = document.createDocumentFragment();
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row';
        div.style.padding = '10px';
        div.innerHTML = `
            <span>${p.name} (${p.score})</span>
            <div style="display:flex; gap:5px;">
                <button class="btn ${p.cooldown ? 'btn-success' : 'btn-secondary'}" style="width:auto; font-size:0.5rem; padding:5px; margin:0;" onclick="adminToggleCooldown(${i})">
                    ${p.cooldown ? 'VAPAUTA' : 'JÄÄHYLLE'}
                </button>
                <button class="btn btn-secondary" style="width:30px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button>
                <button class="btn btn-secondary" style="width:30px; padding:5px; margin:0;" onclick="adjustScore(${i}, -1)">-</button>
                <button class="btn btn-danger" style="width:30px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button>
            </div>`;
        fragment.appendChild(div);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
}

// --- ADMIN TOIMINNOT ---
function adminToggleCooldown(idx) {
    const newVal = !allPlayers[idx].cooldown;
    db.ref(`gameState/players/${idx}/cooldown`).set(newVal);
}

function updateConfig(key, val) { db.ref(`gameState/config/${key}`).set(val); }

function confirmRandomize() {
    db.ref('gameState').once('value', snap => {
        const data = snap.val();
        const usedIds = data.usedTaskIds || [];
        const config = data.config || {};
        
        let pool = currentTasks;
        if(config.excludeUsedTasks) {
            pool = currentTasks.filter(t => !usedIds.includes(t.id));
            if(pool.length === 0) {
                alert("Kaikki tehtävät suoritettu! Nollataan pakka.");
                db.ref('gameState/usedTaskIds').set([]);
                pool = currentTasks;
            }
        }
        
        const t = pool[Math.floor(Math.random() * pool.length)];
        db.ref('gameState').update({ activeTask: t, participants: null, locked: false });
    });
}

function showScoring() { 
    db.ref('gameState').once('value', snap => { 
        const d = snap.val(); 
        const res = d.participants || []; 
        const config = d.config || { useCooldowns: true };
        const usedIds = d.usedTaskIds || [];
        const task = d.activeTask;
        
        if(task && !usedIds.includes(task.id)) {
            usedIds.push(task.id);
        }

        const updated = allPlayers.map(p => { 
            const part = res.find(r => r.name === p.name); 
            if(part) { 
                if(part.win) {
                    p.score += task.p; 
                } else if(task.minusOnFail) {
                    p.score = Math.max(0, p.score - task.p); // Pistevähennys jos asetettu
                }
                if(config.useCooldowns) p.cooldown = true; 
            } else {
                p.cooldown = false; 
            }
            return p; 
        }); 
        db.ref('gameState').update({ players: updated, activeTask: null, participants: null, locked: false, usedTaskIds: usedIds }); 
    }); 
}

// --- APUFUNKTIOT ---
function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    if(!pop) return;
    
    pop.style.display = 'block';
    pop.style.color = points > 0 ? "var(--success)" : "var(--danger)";
    pop.innerText = (points > 0 ? "+" : "") + points + " XP";
    
    // Uusi hienompi animaatio luokan vaihdolla
    pop.classList.remove('xp-animate');
    void pop.offsetWidth; // trigger reflow
    pop.classList.add('xp-animate');
    
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}

function updateDrawCountSelect() {
    const sel = document.getElementById('drawCount');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    const max = allPlayers.length || 1;
    for (let i = 1; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = i;
        sel.appendChild(opt);
    }
    sel.value = Math.min(currentVal, max) || 1;
}

function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">VALITSE TEHTÄVÄ...</option>';
    currentTasks.forEach((t, i) => { sel.innerHTML += `<option value="${i}">${t.n}</option>`; });
}

function selectManualTask(idx) {
    if (idx === "") return;
    const t = currentTasks[idx];
    db.ref('gameState').update({ activeTask: t, participants: null, locked: false });
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
    const name = document.getElementById('newTaskName').value.trim();
    const desc = document.getElementById('newTaskDesc').value.trim();
    const points = parseInt(document.getElementById('newTaskPoints').value) || 2;
    const minus = document.getElementById('newTaskMinus')?.checked || false;
    
    if (!name || !desc) return alert("Täytä nimi ja kuvaus!");
    
    const newTask = { id: Date.now(), n: name, p: points, d: desc, minusOnFail: minus };
    db.ref('gameState/tasks').once('value', s => {
        let list = s.val() || []; list.push(newTask);
        db.ref('gameState/tasks').set(list).then(() => {
            document.getElementById('newTaskName').value = ''; 
            document.getElementById('newTaskDesc').value = '';
            renderTaskLibrary();
        });
    });
}

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor'); lib.innerHTML = '';
    currentTasks.forEach((t, i) => {
        lib.innerHTML += `<div style="border-bottom:1px solid #333; padding:10px 0;">
            <input type="text" value="${t.n}" onchange="updateTaskInLib(${i}, 'n', this.value)">
            <textarea onchange="updateTaskInLib(${i}, 'd', this.value)">${t.d}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <input type="number" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))" style="width:60px; margin:0;">
                <label style="font-size:0.6rem; color:var(--muted);"><input type="checkbox" ${t.minusOnFail?'checked':''} onchange="updateTaskInLib(${i}, 'minusOnFail', this.checked)"> Miinus-FAIL</label>
                <button class="btn btn-danger" style="width:auto; padding:5px 15px; margin:0;" onclick="removeTask(${i})">X</button>
            </div>
        </div>`;
    });
}

function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(!confirm("Poista?")) return; currentTasks.splice(idx, 1); db.ref('gameState/tasks').set(currentTasks); }
function resetGame() { if(!confirm("Nollaa pisteet ja pelaajat?")) return; db.ref('gameState').update({ players: [], activeTask: null, participants: null, locked: false, usedTaskIds: [], resetId: Date.now().toString() }); }

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

function lockParticipants() { db.ref('gameState/locked').set(true); localSpyEnabled = false; updateSpyBtnText(); }
function toggleWin(i) { db.ref('gameState/participants/' + i + '/win').transaction(w => !w); }
function toggleGMSpyLocal() { localSpyEnabled = !localSpyEnabled; updateSpyBtnText(); document.getElementById('instructionBox').style.display = localSpyEnabled ? 'block' : 'none'; }
function updateSpyBtnText() { const btn = document.getElementById('btnGMSpy'); if(btn) btn.innerText = localSpyEnabled ? "PIILOTA SPEKSIT" : "KATSO SPEKSIT"; }
function setRole(r) { document.body.className = r + '-mode'; document.getElementById('btnPlayer').classList.toggle('active', r==='player'); document.getElementById('btnGM').classList.toggle('active', r==='gm'); }
function toggleAdminPanel() { const p = document.getElementById('adminPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; if(p.style.display === 'block') { renderAdminPlayerList(); renderTaskLibrary(); } }
function adjustScore(idx, amt) { db.ref('gameState/players/' + idx + '/score').transaction(s => Math.max(0, (s || 0) + amt)); }
function removePlayer(idx) { if(confirm("Poista?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }
function updateIdentityUI() { 
    document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; 
    document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; 
}
