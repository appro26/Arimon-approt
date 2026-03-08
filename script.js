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

const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

// UUSI OPTIMOITU TEHTÄVÄLISTA (Korvattu kokonaan)
// n=nimi, d=kuvaus, s=suorittajien määrä, p=pisteet, m=miinus käytössä, b=sankarin pisteet
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
        if (lastMyScore !== null && me.score !== lastMyScore) { showXPAnimation(me.score - lastMyScore); }
        lastMyScore = me.score;
    }

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, heroId);
    updateDrawCountSelect(data.activeTask?.s); // Päivitetty: lukee tehtävän suorittajamäärän
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
        if(winnerOverlay) winnerOverlay.style.display = 'none';
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
                descEl.style.opacity = "1.0";
            } else {
                descEl.style.display = 'block';
                descEl.innerText = "Tehtävä paljastetaan valituille pelaajille...";
                descEl.style.opacity = "0.5";
            }
            instrBox.style.display = 'none';
        }

        const notSelectedEl = document.getElementById('notParticipatingMsg');
        if(notSelectedEl) notSelectedEl.style.display = (isLocked && !isMePart && !isGM) ? 'block' : 'none';
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
        if(taskBox) taskBox.style.display = 'none'; 
    }
});

function setRole(r) {
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
        const pIdx = allPlayers.findIndex(x => x.name === p.name);
        const isHero = heroId !== null && pIdx === heroId;
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

function setBdayHero(idx) { 
    db.ref('gameState/config/bdayHero').once('value', snap => {
        const currentHero = snap.val();
        db.ref('gameState/config/bdayHero').set(currentHero === idx ? null : idx);
    });
}

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
                // Sankarin pisteet (b-kenttä) lisätään sankarille jos hän ei itse ollut suorittamassa
                if(task.b && idx === heroId) earned += task.b;
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

function updateDrawCountSelect(suggestedCount) {
    const sel = document.getElementById('drawCount');
    if (!sel) return;
    const currentVal = suggestedCount || sel.value || 1;
    sel.innerHTML = '';
    for (let i = 1; i <= Math.max(allPlayers.length, 1); i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = i; sel.appendChild(opt);
    }
    sel.value = currentVal;
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
    const s = parseInt(document.getElementById('newTaskPlayers')?.value) || 1; // Lisätty suorittajamäärä
    const m = document.getElementById('newTaskMinus')?.checked || false;
    const b = parseInt(document.getElementById('newTaskBday')?.value) || 0; // Sankarin pisteet
    if (!n || !d) return alert("Täytä nimi ja ohjeet!");
    const newTask = { id: Date.now(), n, d, p, s, m, b };
    db.ref('gameState/tasks').once('value', s => {
        let list = s.val() || []; list.push(newTask);
        db.ref('gameState/tasks').set(list).then(() => {
            document.getElementById('newTaskName').value = ''; 
            document.getElementById('newTaskDesc').value = '';
        });
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
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                <label style="font-size:0.6rem;">Pist: <input type="number" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))" style="width:35px;"></label>
                <label style="font-size:0.6rem;">Kpl: <input type="number" value="${t.s||1}" onchange="updateTaskInLib(${i}, 's', parseInt(this.value))" style="width:35px;"></label>
                <label style="font-size:0.6rem;"><input type="checkbox" ${t.m?'checked':''} onchange="updateTaskInLib(${i}, 'm', this.checked)"> Miinus</label>
                <label style="font-size:0.6rem; color:var(--gm-accent);">🎂 <input type="number" value="${t.b||0}" onchange="updateTaskInLib(${i}, 'b', parseInt(this.value))" style="width:35px;"></label>
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
        if (!isLocked) { if(descEl) descEl.style.display = localSpyEnabled ? 'block' : 'none'; } 
        else { if(instrBox) instrBox.style.display = localSpyEnabled ? 'block' : 'none'; }
    }
}

function updateSpyBtnText() { const btn = document.getElementById('btnGMSpy'); if(btn) btn.innerText = localSpyEnabled ? "PIILOTA SPEKSIT" : "KATSO SPEKSIT"; }
function toggleAdminPanel() { const p = document.getElementById('adminPanel'); if(!p) return; p.style.display = p.style.display === 'none' ? 'block' : 'none'; if(p.style.display === 'block') { renderAdminPlayerList(); renderTaskLibrary(); } }
function adjustScore(idx, amt) { db.ref('gameState/players/' + idx + '/score').transaction(s => Math.max(0, (s || 0) + amt)); }
function removePlayer(idx) { if(confirm("Poista?")) { allPlayers.splice(idx, 1); db.ref('gameState/players').set(allPlayers); } }
function updateIdentityUI() { 
    const card = document.getElementById('identityCard');
    if(card) card.style.display = myName ? 'none' : 'block'; 
    const tag = document.getElementById('idTag');
    if(tag) tag.innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; 
}

// GM-roolin vaihto pitkällä painalluksella
const gmBtn = document.getElementById('btnGM');
let holdTimer;
const HOLD_TIME = 1500;

if (gmBtn) {
    gmBtn.onclick = (e) => { e.preventDefault(); };
    gmBtn.addEventListener('touchstart', (e) => {
        holdTimer = setTimeout(() => {
            setRole('gm');
            if ("vibrate" in navigator) navigator.vibrate(60);
        }, HOLD_TIME);
    });
    gmBtn.addEventListener('touchend', () => clearTimeout(holdTimer));
    gmBtn.addEventListener('mousedown', () => { holdTimer = setTimeout(() => { setRole('gm'); }, HOLD_TIME); });
    gmBtn.addEventListener('mouseup', () => clearTimeout(holdTimer));
    gmBtn.addEventListener('mouseleave', () => clearTimeout(holdTimer));
}
