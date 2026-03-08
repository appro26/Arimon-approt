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
    { id: 9, n: "Trivia-haaste", p: 2, d: "Kysymys sankarista." },
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

db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) {
        db.ref('gameState').set({ tasks: initialPlaybook, players: [], resetId: Date.now().toString() });
        return;
    }

    if (currentResetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    const oldPlayerCount = allPlayers.length;
    allPlayers = data.players || [];
    
    // Päivitetään GM:n arvontamäärä-valikko jos pelaajamäärä muuttuu
    if (oldPlayerCount !== allPlayers.length) {
        updateDrawCountSelect();
    }

    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score > lastMyScore) {
            showXPAnimation(me.score - lastMyScore);
        }
        lastMyScore = me.score;
    }

    if (currentTasks.length !== (data.tasks || []).length) {
        currentTasks = data.tasks || [];
        updateManualTaskSelect();
    }
    
    updateIdentityUI();
    renderLeaderboard();
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList();
        renderTaskLibrary();
    }

    // ARVONTA-LOGIIKKA
    const lotteryOverlay = document.getElementById('lotteryOverlay');
    const winnerOverlay = document.getElementById('lotteryWinner');
    
    if (data.isLotteryRunning) {
        lotteryOverlay.style.display = 'flex';
        winnerOverlay.style.display = 'none'; // Piilota vanha voittoilmoitus uuden tieltä
    } else {
        lotteryOverlay.style.display = 'none';
        
        // Jos arvonta loppui ja peli on lukittu, tarkista olenko voittaja
        if (data.locked && data.activeTask) {
            const results = data.participants || [];
            const amIChosen = results.some(r => r.name === myName);
            if (amIChosen && !isTaskActive) { // Näytä vain kerran tehtävän alussa
                winnerOverlay.style.display = 'flex';
                setTimeout(() => { winnerOverlay.style.display = 'none'; }, 3000);
            }
        }
    }

    const live = data.activeTask;
    const taskBox = document.getElementById('liveTask');
    
    if(!isTaskActive && live) {
        playTaskSound();
        document.getElementById('liveTaskName').classList.add('flash-effect');
        setTimeout(() => document.getElementById('liveTaskName').classList.remove('flash-effect'), 1000);
    }

    isTaskActive = !!live;
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
        
        // Korostetaan tehtävänantoa pelaajalle
        if (isLocked && isMePart) {
            document.getElementById('instructionBox').classList.add('flash-effect');
        }

        document.getElementById('taskPhaseTitle').innerText = isLocked ? "VAIHE: SUORITUS" : "VAIHE: ILMOITTAUTUMINEN";
        document.getElementById('joinAction').style.display = isLocked ? 'none' : 'block';

        const vBtn = document.getElementById('btnVolu');
        const myD = allPlayers.find(p => p.name === myName);
        if(myD && myD.cooldown && !isMePart) {
            vBtn.style.display = 'none'; document.getElementById('cooldownWarning').style.display = 'block';
        } else {
            vBtn.style.display = 'block'; document.getElementById('cooldownWarning').style.display = 'none';
            vBtn.className = isMePart ? "btn btn-success" : "btn btn-primary";
            vBtn.innerText = isMePart ? "OLET MUKANA! ✓" : "OSALLISTUTKO?";
        }
        
        renderGMVolunteers(results, isLocked);
    } else { 
        taskBox.style.display = 'none'; 
        winnerOverlay.style.display = 'none';
    }
});

// UUSI: Päivittää arvontamäärän dynaamisesti pelaajien mukaan
function updateDrawCountSelect() {
    const sel = document.getElementById('drawCount');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    const max = allPlayers.length || 1;
    for (let i = 1; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = i;
        sel.appendChild(opt);
    }
    sel.value = Math.min(currentVal, max) || 1;
}

function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    pop.innerText = `+${points} XP`;
    pop.style.display = 'block';
    setTimeout(() => { pop.style.display = 'none'; }, 1500);
}

function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">TAI VALITSE...</option>';
    currentTasks.forEach((t, i) => {
        sel.innerHTML += `<option value="${i}">${t.n}</option>`;
    });
}

function selectManualTask(idx) {
    if (idx === "") return;
    const t = currentTasks[idx];
    db.ref('gameState').update({ activeTask: t, participants: null, locked: false });
    document.getElementById('manualTaskSelect').value = "";
}

function playTaskSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch(e) { console.log("Audio not supported"); }
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
    if (!name || !desc) return alert("Täytä kaikki kentät!");
    
    const newTask = { id: Date.now(), n: name, p: points, d: desc };
    db.ref('gameState/tasks').once('value', s => {
        let list = s.val() || [];
        list.push(newTask);
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
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <input type="number" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))" style="width:60px; margin:0;">
                <button class="btn btn-danger" style="width:auto; padding:5px 15px; margin:0;" onclick="removeTask(${i})">Poista</button>
            </div>
        </div>`;
    });
}

function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(!confirm("Poistetaanko tehtävä pysyvästi?")) return; currentTasks.splice(idx, 1); db.ref('gameState/tasks').set(currentTasks); }

function resetGame() {
    if(!confirm("HUOM: Tämä nollaa vain pelaajat ja pisteet. Tehtäväpankki säilyy. Jatka?")) return;
    db.ref('gameState').update({ players: [], activeTask: null, participants: null, locked: false, resetId: Date.now().toString() });
}

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
    const p = allPlayers.find(x => x.name === myName);
    if(p && p.cooldown) return;
    
    db.ref('gameState/participants').transaction(list => {
        list = list || []; 
        const idx = list.findIndex(r => r.name === myName);
        if(idx > -1) {
            list.splice(idx, 1);
        } else {
            list.push({ name: myName, win: true });
        }
        return list;
    });
}

function toggleParticipant(name) {
    db.ref('gameState/participants').transaction(list => {
        list = list || []; const idx = list.findIndex(r => r.name === name);
        if(idx > -1) list.splice(idx, 1); else list.push({ name: name, win: true });
        return list;
    });
}

// NOPEUTETTU ARVONTA
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
                locked: true // Arvonta lukitsee tilanteen automaattisesti
            });
        });
    }, 1200); 
}

function lockParticipants() { db.ref('gameState/locked').set(true); localSpyEnabled = false; updateSpyBtnText(); }
function toggleWin(i) { db.ref('gameState/participants/' + i + '/win').transaction(w => !w); }

function showScoring() { 
    db.ref('gameState').once('value', snap => { 
        const d = snap.val(); 
        const res = d.participants || []; 
        const updated = allPlayers.map(p => { 
            p.cooldown = false; 
            const part = res.find(r => r.name === p.name); 
            if(part) { if(part.win) p.score += d.activeTask.p; p.cooldown = true; } 
            return p; 
        }); 
        db.ref('gameState').update({ players: updated, activeTask: null, participants: null, locked: false }); 
    }); 
}

function toggleGMSpyLocal() { localSpyEnabled = !localSpyEnabled; updateSpyBtnText(); document.getElementById('instructionBox').style.display = localSpyEnabled ? 'block' : 'none'; }
function updateSpyBtnText() { const btn = document.getElementById('btnGMSpy'); if(btn) btn.innerText = localSpyEnabled ? "PIILOTA SPEKSIT" : "KATSO SPEKSIT"; }
function setRole(r) { document.body.className = r + '-mode'; document.getElementById('btnPlayer').classList.toggle('active', r==='player'); document.getElementById('btnGM').classList.toggle('active', r==='gm'); }

function toggleAdminPanel() { 
    const p = document.getElementById('adminPanel'); 
    p.style.display = p.style.display === 'none' ? 'block' : 'none'; 
    if(p.style.display === 'block') { renderAdminPlayerList(); renderTaskLibrary(); } 
}

function confirmRandomize() { 
    const t = currentTasks[Math.floor(Math.random()*currentTasks.length)]; 
    db.ref('gameState').update({ activeTask: t, participants: null, locked: false }); 
}

function adjustScore(idx, amt) { db.ref('gameState/players/' + idx + '/score').transaction(s => (s || 0) + amt); }
function removePlayer(idx) { if(confirm("Poista pelaaja?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }

function updateIdentityUI() { 
    document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; 
    document.getElementById('idTag').innerText = myName ? "PELAAJA: " + myName : "KIRJAUDU SISÄÄN"; 
}

function renderLeaderboard() {
    const list = document.getElementById('playerList'); list.innerHTML = '';
    [...allPlayers].sort((a,b) => b.score - a.score).forEach(p => {
        const cooldownTag = p.cooldown ? `<span class="on-cooldown-text">[JÄÄHY]</span>` : '';
        list.innerHTML += `<div class="player-row ${p.name === myName?'me':''}"><span>${p.name}${cooldownTag}</span><span class="xp-badge">${p.score} XP</span></div>`;
    });
}

function renderAdminPlayerList() {
    const list = document.getElementById('adminPlayerList'); list.innerHTML = '';
    allPlayers.forEach((p, i) => {
        list.innerHTML += `<div class="player-row" style="padding:10px;"><span>${p.name} (${p.score})</span><div style="display:flex; gap:5px;"><button class="btn btn-secondary" style="width:35px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button><button class="btn btn-secondary" style="width:35px; padding:5px; margin:0;" onclick="adjustScore(${i}, -1)">-</button><button class="btn btn-danger" style="width:35px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button></div></div>`;
    });
}

function renderGMVolunteers(results, isLocked) {
    const grid = document.getElementById('volunteerGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    allPlayers.forEach(p => {
        const isInc = results.some(r => r.name === p.name);
        const btn = document.createElement('button');
        // LISÄTTY: on-cooldown luokka jos pelaaja on jäähyllä
        btn.className = `btn ${isInc ? 'btn-primary' : 'btn-secondary'} ${p.cooldown ? 'on-cooldown' : ''}`;
        btn.style.margin = '0';
        btn.style.fontSize = '0.6rem';
        btn.innerText = p.name;
        btn.disabled = isLocked;
        btn.onclick = () => toggleParticipant(p.name);
        grid.appendChild(btn);
    });
    
    document.getElementById('btnLock').style.display = isLocked ? 'none' : 'block';
    document.getElementById('btnFinish').style.display = isLocked ? 'block' : 'none';
    const sArea = document.getElementById('scoringArea'); sArea.innerHTML = isLocked ? '<h3>Pisteytys</h3>' : '';
    if(isLocked) {
        results.forEach((r, i) => { sArea.innerHTML += `<div class="player-row" style="padding:10px;"><span>${r.name}</span><button class="btn" style="width:70px; margin:0; padding:8px; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin(${i})'>${r.win?'WIN':'FAIL'}</button></div>`; });
    }
}
