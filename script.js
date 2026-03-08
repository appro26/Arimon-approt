/**
 * ARIMON APPROT - CORE ENGINE v2.0
 * Optimized for Firebase Realtime Database
 */

const firebaseConfig = { databaseURL: "https://approplaybook-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE MANAGEMENT ---
let myName = localStorage.getItem('appro_name') || null;
let currentResetId = localStorage.getItem('appro_reset_id') || null;
let allPlayers = [];
let taskLibrary = [];
let localSpyEnabled = false;
let lastMyScore = null;
let gmHoldTimer;

// --- UUSI TEHTÄVÄPAKKA (32 TEHTÄVÄÄ) ---
// n: nimi, d: kuvaus, s: suorittajien määrä, p: pisteet, m: miinuspisteet, b: sankarin pisteet
const initialPlaybook = [
    { id: 1, n: "Mise en place", d: "Varmista, että kaikilla pöytäseurueen jäsenillä on lasissa juotavaa (myös vettä). Jos jollain on tyhjää, täytä se.", s: 2, p: 2, m: true, b: 0 },
    { id: 2, n: "Uudelleenkäynnistys (Reboot)", d: "Kaikkien suorittajien on juotava lasi vettä yhdeltä istumalta 'järjestelmän vakauttamiseksi'.", s: 3, p: 1, m: false, b: 0 },
    { id: 3, n: "Holari-yritys", d: "Heitä lasinalunen tyhjään tuoppiin tai lasiin 2 metrin etäisyydeltä. Kolme yritystä.", s: 2, p: 2, m: true, b: 0 },
    { id: 4, n: "Air Drop saapuu", d: "Tilaa synttärisankarille juoma (mieto tai alkoholiton käy).", s: 1, p: 3, m: false, b: 1 },
    { id: 5, n: "Gordon Ramsay -palautekierros", d: "Kehu nykyisen baarin miljöötä tai juomavalikoimaa yhdelle tuntemattomalle asiakkaalle 'ammattilaisen otteella'.", s: 1, p: 2, m: true, b: 0 },
    { id: 6, n: "Tikettijärjestelmän ruuhka", d: "Kuuntele synttärisankarin yksi valitsema muisto menneisyydestä keskeyttämättä. Lopuksi analysoi 'ratkaisu'.", s: 2, p: 1, m: false, b: 1 },
    { id: 7, n: "Spotterin rooli", d: "Seuraa synttärisankarin lasia 5 minuutin ajan. Jos hän aikoo laskea sen pöydälle ilman alusta, estä se tai aseta alunen alle.", s: 1, p: 2, m: true, b: 0 },
    { id: 8, n: "Level 3 -kypärä", d: "Pidä mukanasi jotain outoa esinettä (esim. tyhjä tölkki tai pilli) seuraavaan baariin asti hukkaamatta sitä.", s: 2, p: 2, m: true, b: 0 },
    { id: 9, n: "Uunilohi palaa pohjaan", d: "Suorittajien on poistuttava välittömästi ulos 'tuulettumaan' 2 minuutiksi ilman puhelimia.", s: 4, p: 1, m: true, b: 0 },
    { id: 10, n: "BIOS-päivitys", d: "Kerro synttärisankarille yksi asia, jota hän ei vielä tiennyt sinusta (IT-salaisuus).", s: 1, p: 1, m: false, b: 0 },
    { id: 11, n: "Caddy-palvelu", d: "Kanna synttärisankarin takkia tai laukkua seuraavaan siirtymään (tai baarin sisällä siirtyessä).", s: 1, p: 2, m: false, b: 1 },
    { id: 12, n: "Pochinki Loot", d: "Hae koko seurueelle nippu ilmaisia servettejä tai pillejä tiskiltä ja jaa ne tasaisesti.", s: 1, p: 1, m: true, b: 0 },
    { id: 13, n: "Sous-chefin suositus", d: "Valitse synttärisankarille seuraava juoma listalta (hän maksaa itse, jos tehtävä ei vaadi ostamista).", s: 1, p: 1, m: false, b: 1 },
    { id: 14, n: "Palomuuri (Firewall)", d: "Seiso synttärisankarin ja muiden asiakkaiden välissä 'suojana' 3 minuutin ajan.", s: 2, p: 2, m: true, b: 0 },
    { id: 15, n: "OB-linja (Out of Bounds)", d: "Käy koskettamassa baarin kaukaisinta seinää ja palaa takaisin sanomatta sanaakaan matkalla.", s: 3, p: 1, m: true, b: 0 },
    { id: 16, n: "Red Zone", d: "Kukaan suorittajista ei saa käyttää sanaa 'joo' tai 'ei' seuraavan 5 minuutin aikana.", s: 5, p: 2, m: true, b: 0 },
    { id: 17, n: "Lautasliina-origami", d: "Taittele lautasliinasta jokin tunnistettava hahmo tai esine ja lahjoita se sankarille.", s: 1, p: 1, m: true, b: 0 },
    { id: 18, n: "Ping-testi", d: "Heitä yläfemma kaikkien muiden seurueen jäsenten kanssa mahdollisimman nopeasti (alle 10 sekuntia).", s: 1, p: 1, m: true, b: 0 },
    { id: 19, n: "Mandatory-kierto", d: "Ennen kuin istut alas, sinun on kierrettävä valittu pöytä tai tuoli myötäpäivään ympäri.", s: 4, p: 1, m: true, b: 0 },
    { id: 20, n: "Pan Melee Only", d: "Pitele kädessäsi paistinpannua muistuttavaa esinettä (esim. lautanen tai pyöreä alunen) koko seuraavan puheen ajan.", s: 1, p: 1, m: false, b: 0 },
    { id: 21, n: "Keittiömestarin tervehdys", d: "Tarjoa sankarille pieni suolainen välipala (pähkinöitä, sipsejä tms. baarista).", s: 1, p: 3, m: false, b: 1 },
    { id: 22, n: "Etätuki-istunto", d: "Selitä synttärisankarille mahdollisimman monimutkaisesti, miten jokin arkipäiväinen esine (esim. kynä) toimii.", s: 1, p: 1, m: false, b: 0 },
    { id: 23, n: "Putterin tarkkuus", d: "Liu'uta kolikko pöytää pitkin mahdollisimman lähelle reunaa tippumatta. Kolme yritystä.", s: 2, p: 2, m: true, b: 0 },
    { id: 24, n: "Med Kit -huolto", d: "Käy ostamassa sankarille jotain nesteyttävää tai särkylääkettä 'valmiiksi' kaappiin/laukkuun.", s: 1, p: 3, m: false, b: 1 },
    { id: 25, n: "Jälkiruokalista", d: "Lue ääneen keksitty 'ylistyspuhe' synttärisankarille käyttäen mahdollisimman monta ruoka-aiheista sanaa.", s: 1, p: 2, m: false, b: 1 },
    { id: 26, n: "Käyttäjävirhe (User Error)", d: "Sano 'Olen pahoillani, kyseessä oli käyttäjävirhe' aina kun joku seurueesta tekee jotain kömpelöä seuraavan 10 min aikana.", s: 1, p: 2, m: true, b: 0 },
    { id: 27, n: "Fore!", d: "Huuda 'FORE!' (kohtuullisella volyymilla) aina kun joku seurueesta nousee seisomaan. Kesto 5 minuuttia.", s: 2, p: 1, m: true, b: 0 },
    { id: 28, n: "Blue Zone -siirtymä", d: "Seuraavaan baariin siirryttäessä suorittajien on kuljettava viimeisenä ja varmistettava, ettei ketään jää jälkeen.", s: 2, p: 1, m: true, b: 0 },
    { id: 29, n: "Raaka-aineanalyysi", d: "Tunnista sokkona (silmät kiinni) mitä juomaa sankarisi lasissa on hajun perusteella.", s: 1, p: 2, m: true, b: 0 },
    { id: 30, n: "Pilvipalvelun varmuuskopio", d: "Ota yhteisselfie koko porukasta (tai mahdollisimman monesta) ja varmista, että se on 'tallessa'.", s: 1, p: 1, m: false, b: 1 },
    { id: 31, n: "Tree Kick -epäonni", d: "Matki puuta (seiso yhdellä jalalla kädet sivuilla) 30 sekuntia kesken keskustelun.", s: 2, p: 2, m: true, b: 0 },
    { id: 32, n: "Winner Winner Chicken Dinner", d: "Tilaa sankarille (ja itsellesi jos haluat) pientä syötävää, kuten kanansiipiä tai vastaavaa.", s: 1, p: 3, m: false, b: 1 }
];

// --- FIREBASE SYNC ---
db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) {
        db.ref('gameState').set({ 
            tasks: initialPlaybook, 
            activeTasks: {},
            usedTaskIds: [], 
            players: [], 
            resetId: Date.now().toString(),
            config: { useCooldowns: true, excludeUsedTasks: true, bdayHero: null }
        });
        return;
    }

    // Pakotettu selaimen nollaus, jos GM painaa "Reset"
    if (currentResetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    allPlayers = data.players || [];
    taskLibrary = data.tasks || [];
    const config = data.config || {};
    const activeTasks = data.activeTasks || {};

    // Päivitä profiilin XP-animaatio
    const me = allPlayers.find(p => p.name === myName);
    if (me) {
        if (lastMyScore !== null && me.score !== lastMyScore) showXPAnimation(me.score - lastMyScore);
        lastMyScore = me.score;
    }

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, config.bdayHero);
    renderActiveTasks(activeTasks, config);
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList(config.bdayHero);
        renderTaskLibrary();
    }

    updateManualTaskSelect();
});

// --- UI RENDERING (CORE) ---
function renderActiveTasks(tasks, config) {
    const container = document.getElementById('activeTasksContainer');
    container.innerHTML = '';
    const taskIds = Object.keys(tasks);

    if (taskIds.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; color:var(--muted);">Ei aktiivisia tehtäviä. GM:n tulee arpoa uusi tehtävä.</div>`;
        return;
    }

    taskIds.forEach(tId => {
        const taskObj = tasks[tId];
        const isLocked = !!taskObj.locked;
        const participants = taskObj.participants || [];
        const isMePart = participants.some(p => p.name === myName);
        const isGM = document.body.classList.contains('gm-mode');
        
        const card = document.createElement('div');
        card.className = `card task-box ${isLocked ? 'phase-execution' : 'phase-signup'}`;
        
        // Tehtävän otsikkotiedot
        card.innerHTML = `
            <span class="task-phase-tag">${isLocked ? 'VAIHE: SUORITUS' : 'VAIHE: ILMOITTAUTUMINEN'}</span>
            <h1 class="task-title">${taskObj.n}</h1>
            <div class="xp-badge">${taskObj.p} XP</div>
            <p class="task-description">${isLocked ? (isMePart || isGM || localSpyEnabled ? taskObj.d : 'Tehtävä on käynnissä...') : 'Pelaajia haetaan...'}</p>
        `;

        // Pelaajailmoitus
        if (isLocked && !isMePart && !isGM) {
            const banner = document.createElement('div');
            banner.className = 'not-selected-banner';
            banner.innerText = 'ET OSALLISTU TÄHÄN TEHTÄVÄÄN';
            card.appendChild(banner);
        }

        // Ilmoittautumispainike (Pelaaja)
        if (!isLocked) {
            const joinDiv = document.createElement('div');
            joinDiv.style.marginTop = '15px';
            const meData = allPlayers.find(p => p.name === myName);
            const onCooldown = config.useCooldowns && meData?.cooldown;

            if (onCooldown && !isMePart) {
                joinDiv.innerHTML = `<p class="on-cooldown-text">OLET JÄÄHYLLÄ!</p>`;
            } else {
                const btn = document.createElement('button');
                btn.className = isMePart ? "btn btn-success" : "btn btn-primary";
                btn.innerText = isMePart ? "OSALLISTUT! ✓" : "HALUAN OSALLISTUA";
                btn.onclick = () => volunteer(tId);
                joinDiv.appendChild(btn);
            }
            card.appendChild(joinDiv);
        }

        // GM TYÖKALUT (Tehtäväkohtaiset)
        if (isGM) {
            const gmDiv = document.createElement('div');
            gmDiv.style.marginTop = '20px';
            gmDiv.style.borderTop = '1px solid #333';
            gmDiv.style.paddingTop = '15px';

            // Osallistujien valintaruudukko
            const grid = document.createElement('div');
            grid.className = 'volunteer-selector-grid';
            allPlayers.forEach(p => {
                const isSelected = participants.some(rp => rp.name === p.name);
                const pBtn = document.createElement('button');
                pBtn.className = `volu-btn ${isSelected ? 'active' : ''}`;
                pBtn.innerText = p.name;
                pBtn.disabled = isLocked;
                pBtn.onclick = () => toggleParticipant(tId, p.name);
                grid.appendChild(pBtn);
            });
            gmDiv.appendChild(grid);

            if (!isLocked) {
                // Arvontatyökalut
                const drawArea = document.createElement('div');
                drawArea.style.display = 'flex';
                drawArea.style.gap = '10px';
                drawArea.innerHTML = `
                    <div style="flex:1">
                        <span class="p-count-info">Ehdotus: ${taskObj.s}</span>
                        <input type="number" id="count_${tId}" value="${taskObj.s}" min="1" style="margin:0;">
                    </div>
                    <button class="btn btn-gm" style="flex:2; margin:0;" onclick="drawRandom('${tId}')">ARVO</button>
                `;
                gmDiv.appendChild(drawArea);
                
                const lockBtn = document.createElement('button');
                lockBtn.className = "btn btn-success";
                lockBtn.style.marginTop = "10px";
                lockBtn.innerText = "LUKITSE JA PALJASTA";
                lockBtn.onclick = () => lockTask(tId);
                gmDiv.appendChild(lockBtn);
            } else {
                // Pisteytys (Suorituksen aikana)
                const scoreTitle = document.createElement('p');
                scoreTitle.style.fontSize = '0.7rem';
                scoreTitle.innerText = "ONNISTUIKO?";
                gmDiv.appendChild(scoreTitle);

                participants.forEach((p, pIdx) => {
                    const row = document.createElement('div');
                    row.className = 'player-row';
                    row.style.padding = '8px';
                    row.innerHTML = `
                        <span>${p.name}</span>
                        <button class="btn" style="width:70px; margin:0; padding:5px; background:${p.win ? 'var(--success)' : 'var(--danger)'}" 
                        onclick="toggleWin('${tId}', ${pIdx})">${p.win ? 'WIN' : 'FAIL'}</button>
                    `;
                    gmDiv.appendChild(row);
                });

                const finishBtn = document.createElement('button');
                finishBtn.className = "btn btn-success";
                finishBtn.style.marginTop = "10px";
                finishBtn.innerText = "MERKITSE VALMIIKSI";
                finishBtn.onclick = () => finalizeTask(tId);
                gmDiv.appendChild(finishBtn);
            }
            card.appendChild(gmDiv);
        }

        container.appendChild(card);
    });
}

// --- GAME LOGIC FUNCTIONS ---

function volunteer(taskId) {
    if(!myName) return;
    db.ref(`gameState/activeTasks/${taskId}`).once('value', snap => {
        const task = snap.val();
        if(task.locked) return;
        db.ref(`gameState/activeTasks/${taskId}/participants`).transaction(list => {
            list = list || [];
            const idx = list.findIndex(p => p.name === myName);
            if(idx > -1) list.splice(idx, 1);
            else list.push({ name: myName, win: true });
            return list;
        });
    });
}

function toggleParticipant(taskId, name) {
    db.ref(`gameState/activeTasks/${taskId}/participants`).transaction(list => {
        list = list || [];
        const idx = list.findIndex(p => p.name === name);
        if(idx > -1) list.splice(idx, 1);
        else list.push({ name: name, win: true });
        return list;
    });
}

function drawRandom(taskId) {
    const count = parseInt(document.getElementById(`count_${taskId}`).value) || 1;
    db.ref(`gameState/activeTasks/${taskId}/participants`).once('value', snap => {
        const currentVolunteers = snap.val() || [];
        if (currentVolunteers.length === 0) return alert("Ei ilmoittautuneita!");
        
        let shuffled = [...currentVolunteers].sort(() => 0.5 - Math.random());
        let selected = shuffled.slice(0, Math.min(count, shuffled.length));
        db.ref(`gameState/activeTasks/${taskId}/participants`).set(selected);
    });
}

function lockTask(taskId) {
    db.ref(`gameState/activeTasks/${taskId}/locked`).set(true);
}

function finalizeTask(taskId) {
    db.ref('gameState').once('value', snap => {
        const data = snap.val();
        const task = data.activeTasks[taskId];
        const participants = task.participants || [];
        const heroId = data.config.bdayHero;
        const useCooldowns = data.config.useCooldowns;

        const updatedPlayers = allPlayers.map((p, idx) => {
            const part = participants.find(partici => partici.name === p.name);
            let earned = 0;

            if (part) {
                if (part.win) earned += task.p;
                else if (task.m) earned -= task.p;
                if (useCooldowns) p.cooldown = true;
            } else {
                // Jos ei osallistu, jäähy poistuu (ellei sovellus ole pitkäkestoisessa tilassa, mutta peruslogiikka säilytetty)
                p.cooldown = false;
                // Synttärisankarin bonus-XP (jos määritelty tehtävässä)
                if (task.b > 0 && idx === heroId) earned += task.b;
            }
            p.score = Math.max(0, (p.score || 0) + earned);
            return p;
        });

        // Päivitä käytetyt ja poista aktiivinen
        const usedIds = data.usedTaskIds || [];
        if (!usedIds.includes(task.id)) usedIds.push(task.id);

        const newActiveTasks = { ...data.activeTasks };
        delete newActiveTasks[taskId];

        db.ref('gameState').update({
            players: updatedPlayers,
            activeTasks: newActiveTasks,
            usedTaskIds: usedIds
        });
    });
}

function confirmRandomize() {
    db.ref('gameState').once('value', snap => {
        const data = snap.val();
        const config = data.config || {};
        const usedIds = data.usedTaskIds || [];
        
        let pool = taskLibrary;
        if(config.excludeUsedTasks) {
            pool = taskLibrary.filter(t => !usedIds.includes(t.id));
            if(pool.length === 0) {
                db.ref('gameState/usedTaskIds').set([]);
                pool = taskLibrary;
            }
        }
        
        const task = pool[Math.floor(Math.random() * pool.length)];
        const newTaskKey = db.ref('gameState/activeTasks').push().key;
        
        db.ref(`gameState/activeTasks/${newTaskKey}`).set({
            ...task,
            locked: false,
            participants: []
        });
    });
}

function toggleWin(taskId, pIdx) {
    db.ref(`gameState/activeTasks/${taskId}/participants/${pIdx}/win`).transaction(w => !w);
}

// --- GM ACCESS (1.5s HOLD) ---
const gmBtn = document.getElementById('btnGM');
if (gmBtn) {
    const startHold = (e) => {
        gmHoldTimer = setTimeout(() => {
            setRole('gm');
            if ("vibrate" in navigator) navigator.vibrate(60);
        }, 1500);
    };
    const cancelHold = () => clearTimeout(gmHoldTimer);

    gmBtn.addEventListener('mousedown', startHold);
    gmBtn.addEventListener('mouseup', cancelHold);
    gmBtn.addEventListener('touchstart', startHold);
    gmBtn.addEventListener('touchend', cancelHold);
}

function setRole(r) {
    document.body.classList.toggle('gm-mode', r === 'gm');
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
}

// --- UTILS & ADMIN ---
function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    if(!pop || points === 0) return;
    pop.style.display = 'block';
    pop.style.color = points > 0 ? "var(--success)" : "var(--danger)";
    pop.innerText = (points > 0 ? "+" : "") + points + " XP";
    pop.classList.remove('xp-animate');
    void pop.offsetWidth; // Trigger reflow
    pop.classList.add('xp-animate');
    setTimeout(() => { pop.style.display = 'none'; }, 1800);
}

function renderLeaderboard(showCD, heroId) {
    const list = document.getElementById('playerList');
    list.innerHTML = '';
    [...allPlayers].sort((a,b) => b.score - a.score).forEach((p, idx) => {
        const isHero = allPlayers.findIndex(orig => orig.name === p.name) === heroId;
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''} ${isHero ? 'is-hero' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${isHero ? '🎂' : ''} ${showCD && p.cooldown ? '<span class="on-cooldown-text">[JÄÄHY]</span>' : ''}</span>
            <span class="xp-badge">${p.score} XP</span>
        `;
        list.appendChild(div);
    });
}

function claimIdentity() {
    const n = document.getElementById('playerNameInput').value.trim();
    if(!n) return;
    myName = n;
    localStorage.setItem('appro_name', n);
    db.ref('gameState/players').transaction(p => {
        p = p || [];
        if(!p.find(x => x.name === n)) p.push({ name: n, score: 0, cooldown: false });
        return p;
    });
}

function updateIdentityUI() {
    document.getElementById('identityCard').style.display = myName ? 'none' : 'block';
    document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN";
}

function toggleAdminPanel() {
    const p = document.getElementById('adminPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function resetGame() {
    if(!confirm("Haluatko varmasti nollata koko pelin? Kaikki pisteet ja tehtävät häviävät.")) return;
    db.ref('gameState').update({
        players: [],
        activeTasks: {},
        usedTaskIds: [],
        resetId: Date.now().toString()
    });
}

// Admin-apuvalinnat
function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if(!sel) return;
    sel.innerHTML = '<option value="">VALITSE TEHTÄVÄ MANUAALISESTI...</option>';
    taskLibrary.forEach((t, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = t.n;
        sel.appendChild(opt);
    });
}

function selectManualTask(idx) {
    if(idx === "") return;
    const task = taskLibrary[idx];
    const newTaskKey = db.ref('gameState/activeTasks').push().key;
    db.ref(`gameState/activeTasks/${newTaskKey}`).set({ ...task, locked: false, participants: [] });
}

// Pelaajien hallinta (Admin)
function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    list.innerHTML = '';
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row';
        div.innerHTML = `
            <span>${p.name} (${p.score})</span>
            <div style="display:flex; gap:4px;">
                <button class="btn" style="width:30px; padding:5px; margin:0; background:${i===heroId?'var(--gm-accent)':'#333'}" onclick="setBdayHero(${i})">🎂</button>
                <button class="btn btn-secondary" style="width:auto; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button>
                <button class="btn btn-danger" style="width:30px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function setBdayHero(idx) {
    db.ref('gameState/config/bdayHero').once('value', s => {
        db.ref('gameState/config/bdayHero').set(s.val() === idx ? null : idx);
    });
}

function adjustScore(idx, amt) {
    db.ref(`gameState/players/${idx}/score`).transaction(s => Math.max(0, (s || 0) + amt));
}

function removePlayer(idx) {
    if(confirm("Poistetaanko pelaaja?")) {
        const updated = [...allPlayers];
        updated.splice(idx, 1);
        db.ref('gameState/players').set(updated);
    }
}

// Tehtävän luonti (Admin)
function adminCreateTask() {
    const n = document.getElementById('newTaskName').value.trim();
    const d = document.getElementById('newTaskDesc').value.trim();
    const p = parseInt(document.getElementById('newTaskPoints').value) || 2;
    const s = parseInt(document.getElementById('newTaskPCount').value) || 1;
    const m = document.getElementById('newTaskMinus').checked;
    const b = document.getElementById('newTaskBday').checked ? 1 : 0;

    if(!n || !d) return alert("Nimi ja kuvaus puuttuvat!");

    const newTask = { id: Date.now(), n, d, p, s, m, b };
    db.ref('gameState/tasks').once('value', snap => {
        const list = snap.val() || [];
        list.push(newTask);
        db.ref('gameState/tasks').set(list);
    });
}
