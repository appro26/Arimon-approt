// ... (Firebase konfiguraatio ja initialPlaybook pysyvät samoina) ...

db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) return; // Alustuslogiikka pidetty ennallaan

    allPlayers = data.players || [];
    currentTasks = data.tasks || [];
    const config = data.config || { useCooldowns: true, excludeUsedTasks: true };

    // 1. VOITTO-ILMOITUKSEN KORJAUS & VÄRINÄ
    const winnerOverlay = document.getElementById('lotteryWinner');
    if (data.locked && data.activeTask) {
        const results = data.participants || [];
        const amIChosen = results.some(r => r.name === myName);
        
        // Näytetään ilmoitus vain jos tehtävä on juuri lukittu (eikä se ollut jo aktiivinen)
        if (amIChosen && !isTaskActive) {
            document.getElementById('winnerTaskName').innerText = data.activeTask.n;
            document.getElementById('winnerTaskDesc').innerText = data.activeTask.d;
            winnerOverlay.style.display = 'flex';
            
            // Pieni värinä (jos tuettu)
            if ("vibrate" in navigator) navigator.vibrate(200);
            
            setTimeout(() => { winnerOverlay.style.display = 'none'; }, 6000);
        }
    }

    // 2. XP-POPUP LOGIIKKA (UUDISTETULLA ANIMAATIOLLA)
    const me = allPlayers.find(p => p.name === myName);
    if (me && lastMyScore !== null && me.score !== lastMyScore) {
        showXPAnimation(me.score - lastMyScore);
    }
    lastMyScore = me ? me.score : null;

    isTaskActive = !!data.activeTask && data.locked; // Päivitetään tila

    // Päivitetään UI elementit
    renderLeaderboard(config.useCooldowns);
    if(data.activeTask) {
        renderTaskUI(data, config);
    } else {
        document.getElementById('liveTask').style.display = 'none';
    }
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        renderAdminPlayerList();
        renderTaskLibrary();
    }
});

// KIIHTYVÄ ARVONTA -FUNKTIO
function renderGMVolunteers(results, isLocked, isShuffling, showCD) {
    const grid = document.getElementById('volunteerGrid');
    const fragment = document.createDocumentFragment();
    
    allPlayers.forEach(p => {
        const isInc = results.some(r => r.name === p.name);
        const btn = document.createElement('button');
        btn.className = `btn ${isInc ? 'btn-primary' : 'btn-secondary'} ${showCD && p.cooldown ? 'on-cooldown' : ''}`;
        
        if (isShuffling && isInc) {
            btn.classList.add('shuffling');
            // Asetetaan jokaiselle uniikki satunnainen viive eritahtisuuteen
            btn.style.animationDelay = (Math.random() * 0.5) + "s";
        }
        
        btn.innerText = p.name;
        btn.onclick = () => toggleParticipant(p.name);
        btn.disabled = isLocked || isShuffling;
        fragment.appendChild(btn);
    });
    grid.innerHTML = '';
    grid.appendChild(fragment);
}

// ADMIN: PISTEIDEN VÄHENNYS & JÄÄHYN HALLINTA
function renderAdminPlayerList() {
    const list = document.getElementById('adminPlayerList');
    list.innerHTML = '';
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row';
        div.innerHTML = `
            <span>${p.name} (${p.score})</span>
            <div style="display:flex; gap:5px;">
                <button class="btn ${p.cooldown ? 'btn-danger' : 'btn-success'}" style="width:auto; font-size:0.5rem; padding:5px;" onclick="toggleCooldownAdmin(${i})">
                    ${p.cooldown ? 'POISTA JÄÄHY' : 'ASETA JÄÄHY'}
                </button>
                <button class="btn btn-secondary" style="width:30px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button>
                <button class="btn btn-secondary" style="width:30px; padding:5px; margin:0;" onclick="adjustScore(${i}, -1)">-</button>
                <button class="btn btn-danger" style="width:30px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button>
            </div>`;
        list.appendChild(div);
    });
}

function toggleCooldownAdmin(idx) {
    const current = allPlayers[idx].cooldown || false;
    db.ref(`gameState/players/${idx}/cooldown`).set(!current);
}

// PISTEYTYS LOGIIKKA (VÄHENNYS FAILISTA)
function showScoring() { 
    db.ref('gameState').once('value', snap => { 
        const d = snap.val(); 
        const res = d.participants || []; 
        const task = d.activeTask;

        const updated = allPlayers.map(p => { 
            const part = res.find(r => r.name === p.name); 
            if(part) { 
                if(part.win) {
                    p.score += task.p; 
                } else if(task.minusOnFail) {
                    p.score = Math.max(0, p.score - task.p); // Vähennetään pisteet (ei alle nollan)
                }
                if(d.config.useCooldowns) p.cooldown = true; 
            } else {
                p.cooldown = false; 
            }
            return p; 
        }); 
        db.ref('gameState').update({ players: updated, activeTask: null, participants: null, locked: false }); 
    }); 
}

// UUSI XP-ANIMAATIO
function showXPAnimation(points) {
    const pop = document.getElementById('xpPopUp');
    const color = points > 0 ? 'var(--success)' : 'var(--danger)';
    pop.style.color = color;
    pop.innerText = (points > 0 ? "+" : "") + points + " XP";
    pop.style.display = 'block';
    
    // Luodaan hiukkasefekti (CSS hoitaa loput)
    pop.classList.remove('animate-xp');
    void pop.offsetWidth; // Trigger reflow
    pop.classList.add('animate-xp');
    
    setTimeout(() => { pop.style.display = 'none'; }, 2000);
}

// ... (Muut apufunktiot kuten adminCreateTask päivitettynä index.html:n id-kentillä) ...
