// --- KONFIGURAATIO ---
const firebaseConfig = { databaseURL: "https://approplaybook-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- GLOBAALIT MUUTTUJAT ---
let myName = localStorage.getItem('appro_name') || null;
let currentResetId = localStorage.getItem('appro_reset_id') || null;
let allPlayers = [];
let currentTasks = [];
let isTaskActive = false;
let localSpyEnabled = false;
let lastMyScore = null;

const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

// --- UUSI 32 TEHTÄVÄN PAKKA ---
const defaultTasks = [
    { id: 1, n: "Mise en place", d: "Varmista, että kaikilla seurueen jäsenillä on lasissa juotavaa (myös vettä). Jos jollain on tyhjää, täytä se.", p: 2, m: true, b: false },
    { id: 2, n: "Uudelleenkäynnistys (Reboot)", d: "Kaikkien suorittajien on juotava lasi vettä yhdeltä istumalta 'järjestelmän vakauttamiseksi'.", p: 1, m: false, b: false },
    { id: 3, n: "Holari-yritys", d: "Heitä lasinalunen tyhjään tuoppiin tai lasiin 2 metrin etäisyydeltä. Kolme yritystä.", p: 2, m: true, b: false },
    { id: 4, n: "Air Drop saapuu", d: "Tilaa synttärisankarille juoma (mieto tai alkoholiton käy).", p: 3, m: false, b: true },
    { id: 5, n: "Gordon Ramsay -palaute", d: "Kehu nykyisen baarin miljöötä tai juomavalikoimaa yhdelle tuntemattomalle asiakkaalle ammattilaisen otteella.", p: 2, m: true, b: false },
    { id: 6, n: "Tikettijärjestelmän ruuhka", d: "Kuuntele sankarin valitsema muisto keskeyttämättä. Lopuksi analysoi 'ratkaisu'.", p: 1, m: false, b: true },
    { id: 7, n: "Spotterin rooli", d: "Seuraa sankarin lasia 5 min. Jos hän laskee sen ilman alusta, estä se tai aseta alunen alle.", p: 2, m: true, b: false },
    { id: 8, n: "Level 3 -kypärä", d: "Pidä mukanasi jotain outoa esinettä (esim. tyhjä tölkki tai pilli) seuraavaan baariin asti.", p: 2, m: true, b: false },
    { id: 9, n: "Uunilohi palaa pohjaan", d: "Suorittajien on poistuttava välittömästi ulos 'tuulettumaan' 2 minuutiksi ilman puhelimia.", p: 1, m: true, b: false },
    { id: 10, n: "BIOS-päivitys", d: "Kerro synttärisankarille yksi asia, jota hän ei vielä tiennyt sinusta.", p: 1, m: false, b: false },
    { id: 11, n: "Caddy-palvelu", d: "Kanna synttärisankarin takkia tai laukkua seuraavaan siirtymään asti.", p: 2, m: false, b: true },
    { id: 12, n: "Pochinki Loot", d: "Hae koko seurueelle nippu ilmaisia servettejä tai pillejä tiskiltä ja jaa ne.", p: 1, m: true, b: false },
    { id: 13, n: "Sous-chefin suositus", d: "Valitse sankarille seuraava juoma listalta (hän maksaa itse).", p: 1, m: false, b: true },
    { id: 14, n: "Palomuuri (Firewall)", d: "Seiso sankarin ja muiden asiakkaiden välissä 'suojana' 3 minuutin ajan.", p: 2, m: true, b: false },
    { id: 15, n: "OB-linja (Out of Bounds)", d: "Käy koskettamassa baarin kaukaisinta seinää ja palaa takaisin sanomatta sanaakaan.", p: 1, m: true, b: false },
    { id: 16, n: "Red Zone", d: "Kukaan suorittajista ei saa käyttää sanaa 'joo' tai 'ei' seuraavan 5 minuutin aikana.", p: 2, m: true, b: false },
    { id: 17, n: "Lautasliina-origami", d: "Taittele lautasliinasta jokin tunnistettava hahmo ja lahjoita se sankarille.", p: 1, m: true, b: false },
    { id: 18, n: "Ping-testi", d: "Heitä yläfemma kaikkien muiden seurueen jäsenten kanssa alle 10 sekunnissa.", p: 1, m: true, b: false },
    { id: 19, n: "Mandatory-kierto", d: "Ennen kuin istut alas, sinun on kierrettävä valittu pöytä tai tuoli myötäpäivään ympäri.", p: 1, m: true, b: false },
    { id: 20, n: "Pan Melee Only", d: "Pitele kädessäsi pyöreää alusta (kilpi) koko seuraavan puheen ajan.", p: 1, m: false, b: false },
    { id: 21, n: "Keittiön tervehdys", d: "Tarjoa sankarille pieni suolainen välipala (pähkinöitä, sipsejä tms. baarista).", p: 3, m: false, b: true },
    { id: 22, n: "Etätuki-istunto", d: "Selitä sankarille monimutkaisesti, miten jokin esine (esim. kynä) toimii.", p: 1, m: false, b: false },
    { id: 23, n: "Putterin tarkkuus", d: "Liu'uta kolikko pöytää pitkin mahdollisimman lähelle reunaa tippumatta.", p: 2, m: true, b: false },
    { id: 24, n: "Med Kit -huolto", d: "Käy ostamassa sankarille jotain nesteyttävää tai särkylääkettä valmiiksi laukkuun.", p: 3, m: false, b: true },
    { id: 25, n: "Jälkiruokalista", d: "Lue ääneen keksitty ylistyspuhe sankarille käyttäen ruoka-aiheisia sanoja.", p: 2, m: false, b: true },
    { id: 26, n: "Käyttäjävirhe (User Error)", d: "Sano 'Olen pahoillani, kyseessä oli käyttäjävirhe' aina kun joku mokaa 10 min aikana.", p: 2, m: true, b: false },
    { id: 27, n: "Fore!", d: "Huuda 'FORE!' aina kun joku seurueesta nousee seisomaan. Kesto 5 minuuttia.", p: 1, m: true, b: false },
    { id: 28, n: "Blue Zone -siirtymä", d: "Baaria vaihdettaessa kulje viimeisenä ja varmista, ettei ketään jää jälkeen.", p: 1, m: true, b: false },
    { id: 29, n: "Raaka-aineanalyysi", d: "Tunnista sokkona (silmät kiinni) mitä juomaa sankarisi lasissa on hajun perusteella.", p: 2, m: true, b: false },
    { id: 30, n: "Varmuuskopio", d: "Ota yhteisselfie koko porukasta ja varmista, että se on tallessa.", p: 1, m: false, b: true },
    { id: 31, n: "Tree Kick -epäonni", d: "Matki puuta (seiso yhdellä jalalla) 30 sekuntia kesken keskustelun.", p: 2, m: true, b: false },
    { id: 32, n: "Winner Winner Dinner", d: "Tilaa sankarille pientä syötävää, kuten kanansiipiä tai vastaavaa.", p: 3, m: false, b: true }
];

// --- NOLLAUS-FUNKTIO ---
window.resetGame = function() {
    if (confirm("VAROITUS: Tämä poistaa kaikki pelaajat ja lataa uudet 32 tehtävää. Jatketaanko?")) {
        const newResetId = Date.now().toString();
        db.ref('gameState').set({
            players: [],
            tasks: defaultTasks,
            usedTaskIds: [],
            participants: null,
            activeTask: null,
            locked: false,
            isLotteryRunning: false,
            resetId: newResetId,
            config: { useCooldowns: true, excludeUsedTasks: true, bdayHero: null }
        }).then(() => {
            localStorage.clear();
            location.reload();
        });
    }
};

// --- PÄÄKUUNTELIJA ---
db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) {
        db.ref('gameState').set({ 
            tasks: defaultTasks, 
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

    // Päivitetään Admin-asetukset UI:hin
    if(document.getElementById('useCooldowns')) document.getElementById('useCooldowns').checked = !!config.useCooldowns;
    if(document.getElementById('excludeUsedTasks')) document.getElementById('excludeUsedTasks').checked = !!config.excludeUsedTasks;

    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score !== lastMyScore) { showXPAnimation(me.score - lastMyScore); }
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

    const live = data.activeTask;
    const taskBox = document.getElementById('liveTask');
    const isLocked = !!data.locked;
    const results = data.participants || [];
    const isMePart = results.some(r => r.name === myName);
    const isGM = document.body.className.includes('gm');

    // Winner Overlay
    if (isLocked && live && isMePart && !isTaskActive) {
        const overlay = document.getElementById('lotteryWinner');
        document.getElementById('winnerTaskName').innerText = live.n;
        overlay.style.display = 'flex';
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        setTimeout(() => { overlay.style.display = 'none'; }, 2000);
    }
    isTaskActive = isLocked;

    if(live) {
        taskBox.style.display = 'block';
        document.getElementById('liveTaskName').innerText = live.n;
        document.getElementById('liveTaskPoints').innerText = live.p + " XP";
        
        const descEl = document.getElementById('liveTaskDesc');
        const instrBox = document.getElementById('instructionBox');
        
        if (isLocked) {
            descEl.style.display = 'none';
            if (isMePart || isGM || localSpyEnabled) {
                instrBox.style.display = 'block';
                document.getElementById('winnerTaskDesc').innerText = live.d;
            } else { instrBox.style.display = 'none'; }
        } else {
            descEl.style.display = 'block';
            descEl.innerText = (isGM || localSpyEnabled) ? live.d : "Tehtävä paljastetaan valituille pelaajille...";
            descEl.style.opacity = (isGM || localSpyEnabled) ? "1.0" : "0.5";
            instrBox.style.display = 'none';
        }

        document.getElementById('taskPhaseTitle').innerText = isLocked ? "VAIHE: SUORITUS" : "VAIHE: ILMOITTAUTUMINEN";
        document.getElementById('notParticipatingMsg').style.display = (isLocked && !isMePart && !isGM) ? 'block' : 'none';
        document.getElementById('joinAction').style.display = isLocked ? 'none' : 'block';

        // Osallistumisnappi ja Jäähy-viesti
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
    } else { taskBox.style.display = 'none'; }
});

// --- TOIMINNALLISUUDET ---

function setRole(r) {
    document.body.className = r + '-mode';
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
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
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        if(d.locked) return;
        db.ref('gameState/participants').transaction(list => {
            list = list || []; const idx = list.findIndex(r => r.name === myName);
            if(idx > -1) list.splice(idx, 1); else list.push({ name: myName, win: true });
            return list;
        });
    });
}

function drawRandom() {
    const count = parseInt(document.getElementById('drawCount').value) || 1;
    db.ref('gameState/isLotteryRunning').set(true);
    setTimeout(() => {
        db.ref('gameState/participants').once('value', s => {
            let list = s.val() || [];
            if(list.length > 0) {
                let shuffled = [...list].sort(() => 0.5 - Math.random());
                db.ref('gameState').update({ participants: shuffled.slice(0, count), isLotteryRunning: false });
            } else { db.ref('gameState/isLotteryRunning').set(false); alert("Ei ilmoittautuneita!"); }
        });
    }, 1200); 
}

function lockParticipants() { db.ref('gameState/locked').set(true); localSpyEnabled = false; updateSpyBtnText(); }

function showScoring() { 
    db.ref('gameState').once('value', snap => { 
        const d = snap.val(); 
        const res = d.participants || []; 
        const task = d.activeTask;
        const heroId = d.config?.bdayHero;
        let used = d.usedTaskIds || [];
        if(task) used.push(task.id);

        const updated = allPlayers.map((p, idx) => { 
            const part = res.find(r => r.name === p.name); 
            let earned = 0;
            if(part) { 
                if(part.win) earned += task.p; 
                else if(task.m) earned -= task.p; 
                if(d.config?.useCooldowns) p.cooldown = true; 
            } else {
                p.cooldown = false;
                if(task.b && idx === heroId) earned += task.p; // Bday bonus
            }
            p.score = Math.max(0, (p.score || 0) + earned);
            return p; 
        }); 
        db.ref('gameState').update({ players: updated, activeTask: null, participants: null, locked: false, usedTaskIds: used }); 
    }); 
}

// --- RENDERÖINTI ---

function renderLeaderboard(showCD, heroId) {
    const list = document.getElementById('playerList');
    list.innerHTML = '';
    [...allPlayers].sort((a,b) => b.score - a.score).forEach((p) => {
        const pIdx = allPlayers.findIndex(x => x.name === p.name);
        const isHero = heroId !== null && pIdx === heroId;
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''} ${isHero ? 'is-hero' : ''}`;
        div.innerHTML = `<span>${p.name}${isHero?'🎂':''}${(showCD&&p.cooldown)?' <small style="color:var(--danger)">[J]</small>':''}</span><span class="xp-badge">${p.score} XP</span>`;
        list.appendChild(div);
    });
}

function renderGMVolunteers(results, isLocked, isShuffling, showCD) {
    const grid = document.getElementById('volunteerGrid');
    grid.innerHTML = '';
    allPlayers.forEach((p) => {
        const isInc = results.some(r => r.name === p.name);
        const btn = document.createElement('button');
        const onCD = showCD && p.cooldown;
        btn.className = `btn ${isInc ? 'btn-primary' : 'btn-secondary'} ${onCD ? 'on-cooldown' : ''} ${isShuffling && isInc ? 'shuffling' : ''}`;
        btn.innerText = p.name;
        btn.disabled = isLocked || isShuffling;
        btn.onclick = () => toggleParticipant(p.name);
        grid.appendChild(btn);
    });
    document.getElementById('btnFinish').style.display = isLocked ? 'block' : 'none';
    const sArea = document.getElementById('scoringArea');
    sArea.innerHTML = isLocked ? '<p style="font-size:0.7rem; color:var(--muted); margin-top:10px; text-align:center;">ONNISTUIKO TEHTÄVÄ?</p>' : '';
    if(isLocked) {
        results.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            row.style.padding = '8px';
            row.innerHTML = `<span>${r.name}</span><button class="btn" style="width:70px; margin:0; padding:5px; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin(${i})'>${r.win?'WIN':'FAIL'}</button>`;
            sArea.appendChild(row);
        });
    }
}

function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    if(!list) return;
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

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor');
    if(!lib) return;
    lib.innerHTML = '';
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

// --- APUFUNKTIOT ---
function confirmRandomize() {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const used = d.usedTaskIds || [];
        let pool = currentTasks.filter(t => !used.includes(t.id));
        if(pool.length === 0) { db.ref('gameState/usedTaskIds').set([]); pool = currentTasks; }
        const t = pool[Math.floor(Math.random() * pool.length)];
        db.ref('gameState').update({ activeTask: t, participants: null, locked: false, isLotteryRunning: false });
    });
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
        db.ref('gameState/tasks').set(list);
        document.getElementById('newTaskName').value = ''; 
        document.getElementById('newTaskDesc').value = '';
    });
}
function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    if(!pop || points === 0) return;
    pop.style.display = 'block';
    pop.style.color = points > 0 ? "var(--success)" : "var(--danger)";
    pop.innerText = (points > 0 ? "+" : "") + points + " XP";
    pop.classList.remove('xp-animate'); void pop.offsetWidth; pop.classList.add('xp-animate');
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}
function updateDrawCountSelect() {
    const sel = document.getElementById('drawCount');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    for (let i = 1; i <= Math.max(allPlayers.length, 1); i++) {
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
}
function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(confirm("Poista?")) { currentTasks.splice(idx, 1); db.ref('gameState/tasks').set(currentTasks); } }
function setBdayHero(idx) { 
    db.ref('gameState/config/bdayHero').once('value', snap => {
        const currentHero = snap.val();
        db.ref('gameState/config/bdayHero').set(currentHero === idx ? null : idx);
    });
}
function adminToggleCooldown(idx) { db.ref(`gameState/players/${idx}/cooldown`).set(!allPlayers[idx].cooldown); }
function updateConfig(key, val) { db.ref(`gameState/config/${key}`).set(val); }
function adjustScore(idx, amt) { db.ref('gameState/players/' + idx + '/score').transaction(s => Math.max(0, (s || 0) + amt)); }
function removePlayer(idx) { if(confirm("Poista?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }
function toggleParticipant(name) {
    db.ref('gameState/participants').transaction(list => {
        list = list || []; const idx = list.findIndex(r => r.name === name);
        if(idx > -1) list.splice(idx, 1); else list.push({ name: name, win: true });
        return list;
    });
}
function toggleWin(i) { db.ref('gameState/participants/' + i + '/win').transaction(w => !w); }
function toggleGMSpyLocal() { localSpyEnabled = !localSpyEnabled; updateSpyBtnText(); }
function updateSpyBtnText() { const btn = document.getElementById('btnGMSpy'); if(btn) btn.innerText = localSpyEnabled ? "PIILOTA SPEKSIT" : "KATSO SPEKSIT"; }
function toggleAdminPanel() { const p = document.getElementById('adminPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
function updateIdentityUI() { 
    document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; 
    document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; 
}

// GM-pito (Hold to enter GM mode)
const gmBtn = document.getElementById('btnGM');
let holdTimer;
if (gmBtn) {
    gmBtn.addEventListener('touchstart', () => { holdTimer = setTimeout(() => { setRole('gm'); if(navigator.vibrate) navigator.vibrate(60); }, 1500); });
    gmBtn.addEventListener('touchend', () => clearTimeout(holdTimer));
    gmBtn.addEventListener('mousedown', () => { holdTimer = setTimeout(() => setRole('gm'), 1500); });
    gmBtn.addEventListener('mouseup', () => clearTimeout(holdTimer));
}
