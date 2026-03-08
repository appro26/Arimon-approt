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
    { id: 1, n: "Mise en place", d: "Varmista, että kaikilla seurueen jäsenillä on lasissa juotavaa (myös vettä). Jos jollain on tyhjää, täytä se.", s: 2, p: 2, m: true, b: 0 },
    { id: 2, n: "Uudelleenkäynnistys (Reboot)", d: "Kaikkien suorittajien on juotava lasi vettä yhdeltä istumalta 'järjestelmän vakauttamiseksi'.", s: 3, p: 1, m: false, b: 0 },
    { id: 3, n: "Holari-yritys", d: "Heitä lasinalunen tyhjään tuoppiin tai lasiin 2 metrin etäisyydeltä. Kolme yritystä.", s: 2, p: 2, m: true, b: 0 },
    { id: 4, n: "Air Drop saapuu", d: "Tilaa synttärisankarille juoma (mieto tai alkoholiton käy).", s: 1, p: 3, m: false, b: 2 },
    { id: 5, n: "Gordon Ramsay -palaute", d: "Kehu nykyisen baarin miljöötä tai juomavalikoimaa yhdelle tuntemattomalle asiakkaalle ammattilaisen otteella.", s: 1, p: 2, m: true, b: 0 },
    { id: 6, n: "Tikettijärjestelmän ruuhka", d: "Kuuntele sankarin valitsema muisto keskeyttämättä. Lopuksi analysoi 'ratkaisu'.", s: 2, p: 1, m: false, b: 1 },
    { id: 7, n: "Spotterin rooli", d: "Seuraa sankarin lasia 5 min. Jos hän laskee sen ilman alusta, estä se tai aseta alunen alle.", s: 1, p: 2, m: true, b: 0 },
    { id: 8, n: "Level 3 -kypärä", d: "Pidä mukanasi jotain outoa esinettä (esim. tyhjä tölkki tai pilli) seuraavaan baariin asti.", s: 2, p: 2, m: true, b: 0 },
    { id: 9, n: "Uunilohi palaa pohjaan", d: "Suorittajien on poistuttava välittömästi ulos 'tuulettumaan' 2 minuutiksi ilman puhelimia.", s: 4, p: 1, m: true, b: 0 },
    { id: 10, n: "BIOS-päivitys", d: "Kerro synttärisankarille yksi asia, jota hän ei vielä tiennyt sinusta.", s: 1, p: 1, m: false, b: 0 },
    { id: 11, n: "Caddy-palvelu", d: "Kanna synttärisankarin takkia tai laukkua seuraavaan siirtymään asti.", s: 1, p: 2, m: false, b: 1 },
    { id: 12, n: "Pochinki Loot", d: "Hae koko seurueelle nippu ilmaisia servettejä tai pillejä tiskiltä ja jaa ne.", s: 1, p: 1, m: true, b: 0 },
    { id: 13, n: "Sous-chefin suositus", d: "Valitse sankarille seuraava juoma listalta (hän maksaa itse).", s: 1, p: 1, m: false, b: 1 },
    { id: 14, n: "Palomuuri (Firewall)", d: "Seiso sankarin ja muiden asiakkaiden välissä 'suojana' 3 minuutin ajan.", s: 2, p: 2, m: true, b: 0 },
    { id: 15, n: "OB-linja (Out of Bounds)", d: "Käy koskettamassa baarin kaukaisinta seinää ja palaa takaisin sanomatta sanaakaan.", s: 3, p: 1, m: true, b: 0 },
    { id: 16, n: "Red Zone", d: "Kukaan suorittajista ei saa käyttää sanaa 'joo' tai 'ei' seuraavan 5 minuutin aikana.", s: 5, p: 2, m: true, b: 0 },
    { id: 17, n: "Lautasliina-origami", d: "Taittele lautasliinasta jokin tunnistettava hahmo ja lahjoita se sankarille.", s: 1, p: 1, m: true, b: 0 },
    { id: 18, n: "Ping-testi", d: "Heitä yläfemma kaikkien muiden seurueen jäsenten kanssa alle 10 sekunnissa.", s: 1, p: 1, m: true, b: 0 },
    { id: 19, n: "Mandatory-kierto", d: "Ennen kuin istut alas, sinun on kierrettävä valittu pöytä tai tuoli myötäpäivään ympäri.", s: 4, p: 1, m: true, b: 0 },
    { id: 20, n: "Pan Melee Only", d: "Pitele kädessäsi pyöreää alusta (kilpi) koko seuraavan puheen ajan.", s: 1, p: 1, m: false, b: 0 },
    { id: 21, n: "Keittiön tervehdys", d: "Tarjoa sankarille pieni suolainen välipala (pähkinöitä, sipsejä tms. baarista).", s: 1, p: 3, m: false, b: 1 },
    { id: 22, n: "Etätuki-istunto", d: "Selitä sankarille monimutkaisesti, miten jokin esine (esim. kynä) toimii.", s: 1, p: 1, m: false, b: 0 },
    { id: 23, n: "Putterin tarkkuus", d: "Liu'uta kolikko pöytää pitkin mahdollisimman lähelle reunaa tippumatta.", s: 2, p: 2, m: true, b: 0 },
    { id: 24, n: "Med Kit -huolto", d: "Käy ostamassa sankarille jotain nesteyttävää tai särkylääkettä valmiiksi laukkuun.", s: 1, p: 3, m: false, b: 1 },
    { id: 25, n: "Jälkiruokalista", d: "Lue ääneen keksitty ylistyspuhe sankarille käyttäen ruoka-aiheisia sanoja.", s: 1, p: 2, m: false, b: 2 },
    { id: 26, n: "Käyttäjävirhe (User Error)", d: "Sano 'Olen pahoillani, kyseessä oli käyttäjävirhe' aina kun joku mokaa 10 min aikana.", s: 1, p: 2, m: true, b: 0 },
    { id: 27, n: "Fore!", d: "Huuda 'FORE!' aina kun joku seurueesta nousee seisomaan. Kesto 5 minuuttia.", s: 2, p: 1, m: true, b: 0 },
    { id: 28, n: "Blue Zone -siirtymä", d: "Baaria vaihdettaessa kulje viimeisenä ja varmista, ettei ketään jää jälkeen.", s: 2, p: 1, m: true, b: 0 },
    { id: 29, n: "Raaka-aineanalyysi", d: "Tunnista sokkona (silmät kiinni) mitä juomaa sankarisi lasissa on hajun perusteella.", s: 1, p: 2, m: true, b: 0 },
    { id: 30, n: "Varmuuskopio", d: "Ota yhteisselfie koko porukasta ja varmista, että se on tallessa.", s: 1, p: 1, m: false, b: 1 },
    { id: 31, n: "Tree Kick -epäonni", d: "Matki puuta (seiso yhdellä jalalla) 30 sekuntia kesken keskustelun.", s: 2, p: 2, m: true, b: 0 },
    { id: 32, n: "Winner Winner Dinner", d: "Tilaa sankarille pientä syötävää, kuten kanansiipiä tai vastaavaa.", s: 1, p: 3, m: false, b: 2 }
];

// --- NOLLAUS-FUNKTIO (TÄRKEÄ: Määritelty globaalisti) ---
window.resetGame = function() {
    if (confirm("VAROITUS: Tämä poistaa kaikki pelaajat ja lataa uudet 32 tehtävää. Jatketaanko?")) {
        const newResetId = Date.now().toString();
        const initialState = {
            players: [],
            tasks: defaultTasks,
            usedTaskIds: [],
            participants: null,
            activeTask: null,
            locked: false,
            isLotteryRunning: false,
            resetId: newResetId,
            config: { useCooldowns: true, excludeUsedTasks: true, bdayHero: null }
        };

        db.ref('gameState').set(initialState)
            .then(() => {
                localStorage.clear();
                alert("Peli nollattu onnistuneesti!");
                location.reload();
            })
            .catch(err => alert("Virhe nollauksessa: " + err));
    }
};

// --- PÄÄKUUNTELIJA ---
db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    
    // Automaattinen alustus jos kanta on tyhjä
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

    // Pakotettu refresh jos resetId muuttuu
    if (currentResetId && data.resetId !== currentResetId) {
        localStorage.clear();
        location.reload();
        return;
    }
    if (!currentResetId) {
        currentResetId = data.resetId;
        localStorage.setItem('appro_reset_id', data.resetId);
    }

    allPlayers = data.players || [];
    currentTasks = data.tasks || [];
    const config = data.config || {};
    const heroId = config.bdayHero;

    // XP-animaatio tarkistus
    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score !== lastMyScore) { showXPAnimation(me.score - lastMyScore); }
        lastMyScore = me.score;
    }

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, heroId);
    
    const live = data.activeTask;
    updateDrawCountSelect(live ? live.s : 1);
    updateManualTaskSelect();
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList(heroId);
        renderTaskLibrary();
    }

    // Tehtävän hallinta
    const isLocked = !!data.locked;
    const results = data.participants || [];
    const isMePart = results.some(r => r.name === myName);
    const isGM = document.body.className.includes('gm');

    // Voittaja-overlay
    if (isLocked && live && isMePart && !isTaskActive) {
        const overlay = document.getElementById('lotteryWinner');
        document.getElementById('winnerTaskName').innerText = live.n;
        overlay.style.display = 'flex';
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        setTimeout(() => { overlay.style.display = 'none'; }, 2000);
    }
    isTaskActive = isLocked;

    const taskBox = document.getElementById('liveTask');
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

        document.getElementById('notParticipatingMsg').style.display = (isLocked && !isMePart && !isGM) ? 'block' : 'none';
        document.getElementById('joinAction').style.display = isLocked ? 'none' : 'block';
        renderGMVolunteers(results, isLocked, data.isLotteryRunning, config.useCooldowns);
    } else { taskBox.style.display = 'none'; }
});

// --- APUFUNKTIOT ---

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
                if(task.b && idx === heroId) earned += task.b;
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
        div.innerHTML = `<span>${p.name}${isHero?'🎂':''}${(showCD&&p.cooldown)?'<small> [J]</small>':''}</span><span class="xp-badge">${p.score} XP</span>`;
        list.appendChild(div);
    });
}

function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    list.innerHTML = "";
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row';
        div.innerHTML = `<span>${p.name}</span>
            <div style="display:flex; gap:4px;">
                <button class="btn" style="width:30px; padding:5px; margin:0; background:${i===heroId?'var(--gm-accent)':'#333'}" onclick="setBdayHero(${i})">🎂</button>
                <button class="btn btn-secondary" style="width:30px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button>
                <button class="btn btn-danger" style="width:30px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button>
            </div>`;
        list.appendChild(div);
    });
}

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor');
    lib.innerHTML = '';
    currentTasks.forEach((t, i) => {
        const div = document.createElement('div');
        div.style.borderBottom = "1px solid #333"; div.style.padding = "10px 0";
        div.innerHTML = `<strong>${t.n}</strong> (S:${t.s}, P:${t.p}, B:${t.b||0}) <button onclick="removeTask(${i})">POISTA</button>`;
        lib.appendChild(div);
    });
}

// --- LISÄFUNKTIOT ---
function lockParticipants() { db.ref('gameState/locked').set(true); localSpyEnabled = false; updateSpyBtnText(); }
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
function toggleParticipant(name) {
    db.ref('gameState/participants').transaction(list => {
        list = list || []; const idx = list.findIndex(r => r.name === name);
        if(idx > -1) list.splice(idx, 1); else list.push({ name: name, win: true });
        return list;
    });
}
function renderGMVolunteers(results, isLocked, isShuffling, showCD) {
    const grid = document.getElementById('volunteerGrid');
    grid.innerHTML = '';
    allPlayers.forEach((p) => {
        const isInc = results.some(r => r.name === p.name);
        const btn = document.createElement('button');
        btn.className = `btn ${isInc ? 'btn-primary' : 'btn-secondary'} ${isShuffling && isInc ? 'shuffling' : ''}`;
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
            row.innerHTML = `<span>${r.name}</span><button class="btn" style="width:70px; margin:0; padding:5px; background:${r.win?'var(--success)':'var(--danger)'}" onclick='toggleWin(${i})'>${r.win?'WIN':'FAIL'}</button>`;
            sArea.appendChild(row);
        });
    }
}
function showXPAnimation(pts) {
    const pop = document.getElementById('xpPopUp');
    if(!pop || pts === 0) return;
    pop.style.display = 'block';
    pop.style.color = pts > 0 ? "var(--success)" : "var(--danger)";
    pop.innerText = (pts > 0 ? "+" : "") + pts + " XP";
    pop.classList.remove('xp-animate'); void pop.offsetWidth; pop.classList.add('xp-animate');
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}
function updateDrawCountSelect(val) {
    const sel = document.getElementById('drawCount');
    if(!sel) return;
    sel.innerHTML = '';
    for (let i = 1; i <= Math.max(allPlayers.length, 1); i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = i; sel.appendChild(opt);
    }
    sel.value = val || 1;
}
function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if(!sel) return;
    sel.innerHTML = '<option value="">VALITSE TEHTÄVÄ...</option>';
    currentTasks.forEach((t, i) => { sel.innerHTML += `<option value="${i}">${t.n}</option>`; });
}
function selectManualTask(idx) { if(idx!=="") db.ref('gameState').update({activeTask:currentTasks[idx], participants:null, locked:false}); }
function updateTaskInLib(idx, f, v) { db.ref(`gameState/tasks/${idx}/${f}`).set(v); }
function removeTask(idx) { if(confirm("Poista?")) { currentTasks.splice(idx, 1); db.ref('gameState/tasks').set(currentTasks); } }
function setBdayHero(idx) { db.ref('gameState/config/bdayHero').set(idx); }
function adjustScore(i, a) { db.ref(`gameState/players/${i}/score`).transaction(s => Math.max(0, (s||0)+a)); }
function removePlayer(i) { if(confirm("Poista pelaaja?")) { allPlayers.splice(i,1); db.ref('gameState/players').set(allPlayers); } }
function toggleWin(i) { db.ref(`gameState/participants/${i}/win`).transaction(w => !w); }
function toggleGMSpyLocal() { localSpyEnabled = !localSpyEnabled; updateSpyBtnText(); }
function updateSpyBtnText() { const b = document.getElementById('btnGMSpy'); if(b) b.innerText = localSpyEnabled ? "PIILOTA SPEKSIT" : "KATSO SPEKSIT"; }
function toggleAdminPanel() { const p = document.getElementById('adminPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
function updateIdentityUI() { 
    document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; 
    document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; 
}

// GM-pito
const gmBtn = document.getElementById('btnGM');
let holdTimer;
if (gmBtn) {
    gmBtn.addEventListener('touchstart', () => holdTimer = setTimeout(() => { setRole('gm'); if(navigator.vibrate) navigator.vibrate(60); }, 1500));
    gmBtn.addEventListener('touchend', () => clearTimeout(holdTimer));
    gmBtn.addEventListener('mousedown', () => holdTimer = setTimeout(() => setRole('gm'), 1500));
    gmBtn.addEventListener('mouseup', () => clearTimeout(holdTimer));
}
