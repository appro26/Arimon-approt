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
let lastKnownTasks = {}; // UUSI: Reaaliaikaista pop-up seurantaa varten

const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

// --- TEHTÄVÄPAKKA ---
const defaultTasks = [
    { id: 1, n: "Mise en place", d: "Varmista, että kaikilla seurueen jäsenillä on lasissa juotavaa (myös vettä). Jos jollain on tyhjää, täytä se.", p: 2, m: 1, b: false, r: 1 },
    { id: 2, n: "Uudelleenkäynnistys (Reboot)", d: "Kaikkien suorittajien on juotava lasi vettä yhdeltä istumalta 'järjestelmän vakauttamiseksi'.", p: 1, m: 2, b: false, r: 2 },
    { id: 3, n: "Holari-yritys", d: "Heitä lasinalunen tyhjään tuoppiin tai lasiin 2 metrin etäisyydeltä. Kolme yritystä.", p: 2, m: 1, b: false, r: 1 },
    { id: 4, n: "Air Drop saapuu", d: "Tilaa synttärisankarille juoma (mieto tai alkoholiton käy).", p: 3, m: 1, b: true, r: 1 },
    { id: 5, n: "Gordon Ramsay -palaute", d: "Kehu nykyisen baarin miljöötä tai juomavalikoimaa yhdelle tuntemattomalle asiakkaalle ammattilaisen otteella.", p: 2, m: 1, b: false, r: 1 },
    { id: 6, n: "Tikettijärjestelmän ruuhka", d: "Kuuntele sankarin valitsema muisto keskeyttämättä. Lopuksi analysoi 'ratkaisu'.", p: 1, m: 1, b: true, r: 1 },
    { id: 7, n: "Spotterin rooli", d: "Seuraa sankarin lasia 5 min. Jos hän laskee sen ilman alusta, estä se tai aseta alunen alle.", p: 2, m: 1, b: false, r: 1 },
    { id: 8, n: "Level 3 -kypärä", d: "Pidä mukanasi jotain outoa esinettä (esim. tyhjä tölkki tai pilli) seuraavaan baariin asti.", p: 2, m: 1, b: false, r: 1 },
    { id: 9, n: "Uunilohi palaa pohjaan", d: "Suorittajien on poistuttava välittömästi ulos 'tuulettumaan' 2 minuutiksi ilman puhelimia.", p: 1, m: 2, b: false, r: 2 },
    { id: 10, n: "BIOS-päivitys", d: "Kerro synttärisankarille yksi asia, jota hän ei vielä tiennyt sinusta.", p: 1, m: 1, b: false, r: 1 },
    { id: 11, n: "Caddy-palvelu", d: "Kanna synttärisankarin takkia tai laukkua seuraavaan siirtymään asti.", p: 2, m: 1, b: true, r: 1 },
    { id: 12, n: "Pochinki Loot", d: "Hae koko seurueelle nippu ilmaisia servettejä tai pillejä tiskiltä ja jaa ne.", p: 1, m: 1, b: false, r: 1 },
    { id: 13, n: "Sous-chefin suositus", d: "Valitse sankarille seuraava juoma listalta (hän maksaa itse).", p: 1, m: 1, b: true, r: 1 },
    { id: 14, n: "Palomuuri (Firewall)", d: "Seiso sankarin ja muiden asiakkaiden välissä 'suojana' 3 minuutin ajan.", p: 2, m: 1, b: false, r: 1 },
    { id: 15, n: "OB-linja (Out of Bounds)", d: "Käy koskettamassa baarin kaukaisinta seinää ja palaa takaisin sanomatta sanaakaan.", p: 1, m: 1, b: false, r: 1 },
    { id: 16, n: "Red Zone", d: "Kukaan suorittajista ei saa käyttää sanaa 'joo' tai 'ei' seuraavan 5 minuutin aikana.", p: 2, m: 3, b: false, r: 3 },
    { id: 17, n: "Lautasliina-origami", d: "Taittele lautasliinasta jokin tunnistettava hahmo ja lahjoita se sankarille.", p: 1, m: 1, b: false, r: 1 },
    { id: 18, n: "Ping-testi", d: "Heitä yläfemma kaikkien muiden seurueen jäsenten kanssa alle 10 sekunnissa.", p: 1, m: 1, b: false, r: 1 },
    { id: 19, n: "Mandatory-kierto", d: "Ennen kuin istut alas, sinun on kierrettävä valittu pöytä tai tuoli myötäpäivään ympäri.", p: 1, m: 1, b: false, r: 1 },
    { id: 20, n: "Pan Melee Only", d: "Pitele kädessäsi pyöreää alusta (kilpi) koko seuraavan puheen ajan.", p: 1, m: 1, b: false, r: 1 },
    { id: 21, n: "Keittiön tervehdys", d: "Tarjoa sankarille pieni suolainen välipala (pähkinöitä, sipsejä tms. baarista).", p: 3, m: 1, b: true, r: 1 },
    { id: 22, n: "Etätuki-istunto", d: "Selitä sankarille monimutkaisesti, miten jokin esine (esim. kynä) toimii.", p: 1, m: 1, b: false, r: 1 },
    { id: 23, n: "Putterin tarkkuus", d: "Liu'uta kolikko pöytää pitkin mahdollisimman lähelle reunaa tippumatta.", p: 2, m: 1, b: false, r: 1 },
    { id: 24, n: "Med Kit -huolto", d: "Käy ostamassa sankarille jotain nesteyttävää tai särkylääkettä valmiiksi laukkuun.", p: 3, m: 1, b: true, r: 1 },
    { id: 25, n: "Jälkiruokalista", d: "Lue ääneen keksitty ylistyspuhe sankarille käyttäen ruoka-aiheisia sanoja.", p: 2, m: 1, b: true, r: 1 },
    { id: 26, n: "Käyttäjävirhe (User Error)", d: "Sano 'Olen pahoillani, kyseessä oli käyttäjävirhe' aina kun joku mokaa 10 min aikana.", p: 2, m: 1, b: false, r: 1 },
    { id: 27, n: "Fore!", d: "Huuda 'FORE!' aina kun joku seurueesta nousee seisomaan. Kesto 5 minuuttia.", p: 1, m: 1, b: false, r: 1 },
    { id: 28, n: "Blue Zone -siirtymä", d: "Baaria vaihdettaessa kulje viimeisenä ja varmista, ettei ketään jää jälkeen.", p: 1, m: 1, b: false, r: 1 },
    { id: 29, n: "Raaka-aineanalyysi", d: "Tunnista sokkona (silmät kiinni) mitä juomaa sankarisi lasissa on hajun perusteella.", p: 2, m: 1, b: false, r: 1 },
    { id: 30, n: "Varmuuskopio", d: "Ota yhteisselfie koko porukasta ja varmista, ettei ketään jää jälkeen.", p: 1, m: 1, b: true, r: 1 },
    { id: 31, n: "Tree Kick -epäonni", d: "Matki puuta (seiso yhdellä jalalla) 30 sekuntia kesken keskustelun.", p: 2, m: 1, b: false, r: 1 },
    { id: 32, n: "Winner Winner Dinner", d: "Tilaa sankarille pientä syötävää, kuten kanansiipiä tai vastaavaa.", p: 3, m: 1, b: true, r: 1 }
];

// --- NOLLAUS ---
window.resetGame = function() {
    if (confirm("VAROITUS: Tämä poistaa kaikki tiedot. Jatketaanko?")) {
        const newResetId = Date.now().toString();
        db.ref('gameState').set({
            players: [],
            tasks: defaultTasks,
            usedTaskIds: [],
            activeTasks: {},
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
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList(heroId);
        renderTaskLibrary();
    }

    // UUSI: Tarkistetaan tuliko uusia lukittuja tehtäviä voittajailmoitusta varten
    checkForNewWinnerPopups(data.activeTasks || {});
    
    renderActiveTasks(data.activeTasks || {}, config);
    
    // Päivitetään muistiin nykyinen tila vertailua varten
    lastKnownTasks = JSON.parse(JSON.stringify(data.activeTasks || {}));
});

// --- UUSI: POP-UP TARKISTUS ---
function checkForNewWinnerPopups(newTasks) {
    if (!myName) return;
    Object.keys(newTasks).forEach(taskId => {
        const newTask = newTasks[taskId];
        const oldTask = lastKnownTasks[taskId];
        
        // Jos tehtävä on juuri lukittu
        const wasJustLocked = newTask.locked && (!oldTask || !oldTask.locked);
        
        if (wasJustLocked) {
            const results = newTask.participants || [];
            const isMeSelected = results.some(r => r.name === myName && r.win);
            if (isMeSelected) {
                triggerWinnerOverlay(newTask.n);
            }
        }
    });
}

// --- RENDERÖINTI: AKTIIVISET TEHTÄVÄT ---
function renderActiveTasks(tasksObj, config) {
    const container = document.getElementById('activeTasksContainer');
    const isGM = document.body.className.includes('gm');
    
    const currentIds = Object.keys(tasksObj);
    const existingIds = Array.from(container.querySelectorAll('.active-task-item')).map(el => el.getAttribute('data-task-id'));

    existingIds.forEach(id => {
        if (!currentIds.includes(id)) {
            const el = container.querySelector(`[data-task-id="${id}"]`);
            if (el) el.remove();
        }
    });

    currentIds.forEach(taskId => {
        const taskData = tasksObj[taskId];
        const isLocked = !!taskData.locked;
        const results = taskData.participants || [];
        const isMePart = results.some(r => r.name === myName && r.win);
        
        let card = container.querySelector(`[data-task-id="${taskId}"]`);
        if (!card) {
            card = document.createElement('div');
            card.className = 'card task-box active-task-item';
            card.setAttribute('data-task-id', taskId);
            container.appendChild(card);
        }

        card.classList.toggle('participating', !isGM && isLocked && isMePart);

        let html = `
            <h2>${isLocked ? 'VAIHE: SUORITUS' : 'VAIHE: ILMOITTAUTUMINEN'}</h2>
            <h1 style="margin:5px 0;">${taskData.n}</h1>
            <div class="xp-badge" style="display:inline-block; margin-bottom:10px;">${taskData.p} XP</div>
        `;

        const showDesc = isLocked && (isMePart || isGM || localSpyState[taskId]);
        const gmPeeking = !isLocked && (isGM && localSpyState[taskId]);

        if (showDesc || gmPeeking) {
            html += `<div class="instruction-card"><p><strong>OHJEET:</strong><br>${taskData.d}</p></div>`;
        } else {
            html += `<p class="task-description" style="opacity:0.5; font-size:1.1rem;">Tehtävä paljastetaan valituille pelaajille...</p>`;
        }

        if (isLocked && !isMePart && !isGM) {
            html += `<div class="not-selected-banner">ET OSALLISTU TÄHÄN TEHTÄVÄÄN</div>`;
        }

        if (!isLocked) {
            const myD = allPlayers.find(p => p.name === myName);
            const onCD = config.useCooldowns && myD && myD.cooldown;
            const amIIn = results.some(r => r.name === myName);

            html += `<div class="join-action-area" style="margin-top:15px;">`;
            if (onCD && !amIIn) {
                html += `<p style="color:var(--danger); font-weight:800;">OLET JÄÄHYLLÄ!</p>`;
            } else {
                html += `<button class="btn ${amIIn ? 'btn-success' : 'btn-primary'}" onclick="volunteer('${taskId}')">${amIIn ? 'OSALLISTUT! ✓' : 'HALUAN OSALLISTUA'}</button>`;
            }
            html += `</div>`;
        }

        if (isGM) {
            html += `
                <div class="gm-only" style="margin-top:20px; border-top:1px solid #333; padding-top:15px; display:block;">
                    <div class="volunteer-selector-grid" id="grid-${taskId}"></div>
                    <div class="admin-row-stack">
                        <div style="display:flex; gap:10px;">
                            <select id="drawCount-${taskId}" style="flex:1; margin:0;"></select>
                            <button class="btn btn-gm" style="flex:2; margin:0;" onclick="drawRandom('${taskId}')">ARVO PELAAJAT</button>
                        </div>
                        <button class="btn btn-success" style="margin:0; font-size:0.75rem; padding:12px;" onclick="lockParticipants('${taskId}')">LUKITSE VALINNAT</button>
                    </div>
                    <div id="scoring-${taskId}"></div>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button class="btn btn-success" id="finish-${taskId}" style="display:${isLocked ? 'block' : 'none'}; flex:2; margin:0;" onclick="showScoring('${taskId}')">MERKITSE VALMIIKSI</button>
                        <button class="btn btn-secondary" style="flex:1; font-size:0.6rem; padding:8px; margin:0;" onclick="toggleGMSpy('${taskId}')">SPEKSIT</button>
                    </div>
                </div>
            `;
        }

        if (card.innerHTML !== html) card.innerHTML = html;

        if (isGM) {
            renderGMGrid(taskId, results, isLocked, taskData.isLotteryRunning, config.useCooldowns);
            updateDrawCountSelect(taskId, taskData);
            if(isLocked) renderScoringArea(taskId, results);
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
        if(list.length === 0) { alert("Ei osallistujia arvottavaksi!"); return; }

        db.ref(`gameState/activeTasks/${taskId}/isLotteryRunning`).set(true);
        const gridItems = document.querySelectorAll(`#grid-${taskId} button.btn-primary`);
        gridItems.forEach(btn => { btn.classList.add('shuffling'); });

        setTimeout(() => {
            let winners = [...list].sort(() => 0.5 - Math.random()).slice(0, count).map(p => ({ ...p, win: true }));
            db.ref(`gameState/activeTasks/${taskId}`).update({ participants: winners, isLotteryRunning: false });
        }, 1500);
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
        
        btn.className = `btn ${isInc ? 'btn-primary selected-participant' : 'btn-secondary'} ${onCD ? 'on-cooldown' : ''} ${isShuffling && isInc ? 'shuffling' : ''}`;
        btn.innerHTML = `${p.name}${onCD ? ' <small>(J)</small>' : ''}`;
        btn.disabled = isLocked || isShuffling;
        btn.onclick = () => toggleParticipant(taskId, p.name);
        grid.appendChild(btn);
    });
}

// --- KORJATTU: SPEKSIT (REAAALIAIKAINEN) ---
function toggleGMSpy(taskId) {
    localSpyState[taskId] = !localSpyState[taskId];
    // Pakotetaan käyttöliittymän uudelleenpiirto paikallisesti heti
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        renderActiveTasks(d.activeTasks || {}, d.config || {});
    });
}

// --- KORJATTU: ROOLIN VAIHTO (REAALIAIKAINEN) ---
function setRole(r) {
    document.body.className = r + '-mode';
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
    // Päivitetään näkymä heti uusimmalla datalla
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        renderActiveTasks(d.activeTasks || {}, d.config || {});
    });
}

let gmHoldTimer;
const gmBtn = document.getElementById('btnGM');
if(gmBtn) {
    const startPress = () => { gmHoldTimer = setTimeout(() => { setRole('gm'); if(navigator.vibrate) navigator.vibrate(80); }, 1200); };
    const endPress = () => clearTimeout(gmHoldTimer);
    gmBtn.addEventListener('mousedown', startPress);
    gmBtn.addEventListener('mouseup', endPress);
    gmBtn.addEventListener('touchstart', startPress);
    gmBtn.addEventListener('touchend', endPress);
}

function claimIdentity() {
    const n = document.getElementById('playerNameInput').value.trim();
    if(!n) return; myName = n; localStorage.setItem('appro_name', n);
    db.ref('gameState/players').transaction(p => {
        p = p || []; if(!p.find(x => x.name === n)) p.push({ name: n, score: 0, cooldown: false });
        return p;
    });
}

// --- KORJATTU: VOLUNTEER (JÄÄHY-ESTO) ---
function volunteer(taskId) {
    if(!myName) return;
    
    db.ref('gameState').once('value', snap => {
        const data = snap.val();
        const meData = (data.players || []).find(p => p.name === myName);
        
        // Estetään jos jäähyllä
        if (data.config?.useCooldowns && meData?.cooldown) {
            alert("Olet jäähyllä! Odota seuraavaa tehtävää.");
            return;
        }

        if(data.activeTasks[taskId].locked) return;

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
    db.ref(`gameState/activeTasks/${taskId}/locked`).set(true); 
    localSpyState[taskId] = false;
}

function showScoring(taskId) {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const taskInstance = d.activeTasks[taskId];
        const res = taskInstance.participants || [];
        const heroId = d.config?.bdayHero;
        let used = d.usedTaskIds || [];
        used.push(taskInstance.id);
        const updatedPlayers = allPlayers.map((p, idx) => {
            const part = res.find(r => r.name === p.name);
            let earned = 0;
            if(part) {
                if(part.win) earned += taskInstance.p;
                else if(taskInstance.m) earned -= taskInstance.p;
                if(d.config?.useCooldowns) p.cooldown = true;
            } else { if(taskInstance.b && idx === heroId) earned += taskInstance.p; }
            p.score = Math.max(0, (p.score || 0) + earned);
            return p;
        });
        const newActiveTasks = { ...d.activeTasks };
        delete newActiveTasks[taskId];
        db.ref('gameState').update({ players: updatedPlayers, activeTasks: newActiveTasks, usedTaskIds: used });
    });
}

function renderScoringArea(taskId, results) {
    const sArea = document.getElementById(`scoring-${taskId}`);
    if(!sArea) return; sArea.innerHTML = '<p style="font-size:0.7rem; color:var(--muted); margin:10px 0; text-align:center;">ONNISTUIKO TEHTÄVÄ?</p>';
    results.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'player-row'; row.style.padding = '8px';
        row.innerHTML = `<span>${r.name}</span><button class="btn" style="width:70px; margin:0; padding:5px; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin("${taskId}", ${i})'>${r.win?'WIN':'FAIL'}</button>`;
        sArea.appendChild(row);
    });
}

function updateDrawCountSelect(taskId, task) {
    const sel = document.getElementById(`drawCount-${taskId}`);
    if (!sel || sel.options.length > 0) return;
    const max = Math.max(allPlayers.length, 1);
    for (let i = 1; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = i;
        if(i === (task.r || 1)) opt.selected = true;
        sel.appendChild(opt);
    }
}

function toggleWin(taskId, i) { db.ref(`gameState/activeTasks/${taskId}/participants/${i}/win`).transaction(w => !w); }

function confirmRandomize() {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const used = d.usedTaskIds || [];
        let pool = taskLibrary.filter(t => !used.includes(t.id));
        if(pool.length === 0) { db.ref('gameState/usedTaskIds').set([]); pool = taskLibrary; }
        const t = pool[Math.floor(Math.random() * pool.length)];
        const instanceId = "t_" + Date.now();
        db.ref(`gameState/activeTasks/${instanceId}`).set({ ...t, locked: false, participants: [] });
    });
}

function selectManualTask(idx) {
    if (idx === "") return;
    const t = taskLibrary[idx];
    const instanceId = "t_" + Date.now();
    db.ref(`gameState/activeTasks/${instanceId}`).set({ ...t, locked: false, participants: [] });
}

function adminAddPlayer() {
    const input = document.getElementById('adminNewPlayerName');
    const n = input.value.trim();
    if(!n) return;
    db.ref('gameState/players').once('value', snap => {
        let p = snap.val() || [];
        if(!p.find(x => x.name === n)) { p.push({ name: n, score: 0, cooldown: false }); db.ref('gameState/players').set(p); input.value = ''; } else { alert("Pelaaja on jo listalla!"); }
    });
}

function adjustScore(idx, amt) { db.ref('gameState/players/' + idx + '/score').transaction(s => Math.max(0, (s || 0) + amt)); }
function removePlayer(idx) { if(confirm("Poista pelaaja?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }
function setBdayHero(idx) { db.ref('gameState/config/bdayHero').transaction(curr => curr === idx ? null : idx); }
function adminToggleCooldown(idx) { db.ref(`gameState/players/${idx}/cooldown`).set(!allPlayers[idx].cooldown); }
function updateConfig(key, val) { db.ref(`gameState/config/${key}`).set(val); }
function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(confirm("Poista tehtävä kirjastosta?")) { taskLibrary.splice(idx, 1); db.ref('gameState/tasks').set(taskLibrary); } }

function adminCreateTask() {
    const n = document.getElementById('newTaskName').value;
    const d = document.getElementById('newTaskDesc').value;
    const p = parseInt(document.getElementById('newTaskPoints').value);
    const m = document.getElementById('newTaskMinus').checked;
    const b = document.getElementById('newTaskBday').checked;
    const r = parseInt(document.getElementById('newTaskRecommendedPlayers').value) || 1;
    if(!n || !d) return;
    const newTask = { id: Date.now(), n, d, p, m, b, r };
    db.ref('gameState/tasks').transaction(list => { list = list || []; list.push(newTask); return list; });
    document.getElementById('newTaskName').value = ''; document.getElementById('newTaskDesc').value = '';
}

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

function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    if(!list) return; list.innerHTML = "";
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row'; div.style.padding = '8px';
        div.innerHTML = `<span style="font-size:0.8rem;">${p.name} (${p.score})</span><div style="display:flex; gap:4px;"><button class="btn" style="width:32px; padding:5px; margin:0; background:${i===heroId?'var(--gm-accent)':'#333'}" onclick="setBdayHero(${i})">🎂</button><button class="btn ${p.cooldown ? 'btn-success' : 'btn-secondary'}" style="width:auto; font-size:0.5rem; padding:5px; margin:0;" onclick="adminToggleCooldown(${i})">${p.cooldown ? 'VAP' : 'J'}</button><button class="btn btn-secondary" style="width:28px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button><button class="btn btn-secondary" style="width:28px; padding:5px; margin:0;" onclick="adjustScore(${i}, -1)">-</button><button class="btn btn-danger" style="width:28px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button></div>`;
        list.appendChild(div);
    });
}

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor');
    if(!lib) return; lib.innerHTML = '';
    taskLibrary.forEach((t, i) => {
        const div = document.createElement('div');
        div.style.borderBottom = "1px solid #333"; div.style.padding = "10px 0";
        div.innerHTML = `<input type="text" value="${t.n}" onchange="updateTaskInLib(${i}, 'n', this.value)"><textarea onchange="updateTaskInLib(${i}, 'd', this.value)">${t.d}</textarea><div class="admin-task-controls" style="background:none; padding:0;"><div class="point-input-group"><input type="number" style="width:40px" title="XP" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))"><input type="number" style="width:40px" title="Suositus" value="${t.r||1}" onchange="updateTaskInLib(${i}, 'r', parseInt(this.value))"><label class="minus-label"><input type="checkbox" ${t.m?'checked':''} onchange="updateTaskInLib(${i}, 'm', this.checked)"> MIINUS</label><label class="minus-label" style="color:var(--gm-accent);"><input type="checkbox" ${t.b?'checked':''} onchange="updateTaskInLib(${i}, 'b', this.checked)"> 🎂</label></div><button class="btn btn-danger" style="width:auto; padding:5px 10px; margin:0;" onclick="removeTask(${i})">POISTA</button></div>`;
        lib.appendChild(div);
    });
}

function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if (!sel) return; sel.innerHTML = '<option value="">VALITSE TEHTÄVÄ...</option>';
    taskLibrary.forEach((t, i) => { sel.innerHTML += `<option value="${i}">${t.n}</option>`; });
}

function updateIdentityUI() { document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; }

function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    if(!pop || points === 0) return; pop.style.display = 'block'; pop.style.color = points > 0 ? "var(--success)" : "var(--danger)"; pop.innerText = (points > 0 ? "+" : "") + points + " XP"; pop.classList.remove('xp-animate'); void pop.offsetWidth; pop.classList.add('xp-animate');
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}

function triggerWinnerOverlay(taskName) {
    const overlay = document.getElementById('lotteryWinner');
    if(!overlay) return;
    document.getElementById('winnerTaskName').innerText = taskName; 
    overlay.style.display = 'flex';
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
    setTimeout(() => { overlay.style.display = 'none'; }, 3000); // Pidennetty kestoa hieman
}

function toggleAdminPanel() { 
    const p = document.getElementById('adminPanel'); const isOpening = p.style.display === 'none'; p.style.display = isOpening ? 'block' : 'none'; 
    if(isOpening) { renderAdminPlayerList(null); renderTaskLibrary(); }
}
