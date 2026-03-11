// --- KONFIGURAATIO ---
const firebaseConfig = { databaseURL: "https://approplaybook-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- PWA ASENNUSLOGIIKKA ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; checkInstallStatus();
});

function checkInstallStatus() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const installCard = document.getElementById('installCard');
    const instructionText = document.getElementById('installInstruction');
    const installBtn = document.getElementById('installBtn');

    const isDismissed = localStorage.getItem('appro_install_dismissed') === 'true';

    if (isStandalone || isDismissed) {
        if (installCard) installCard.style.display = 'none'; return; 
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (installCard) installCard.style.display = 'block';

    if (isIOS) {
        instructionText.innerHTML = 'Saat pelin koko ruudulle: Paina selaimen alareunasta <b>Jaa</b>-kuvaketta (neliö ja nuoli ylös) ja valitse <b>"Lisää koti-valikkoon"</b>.';
        installBtn.style.display = 'none';
    } else {
        instructionText.innerHTML = 'Asenna peli puhelimeesi, jotta se toimii nopeammin ja ilman selaimen yläpalkkia!';
        installBtn.style.display = 'block';
        installBtn.onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') { installCard.style.display = 'none'; }
                deferredPrompt = null;
            } else { alert("Asennus ei onnistu suoraan tästä selaimesta. Käytä Chromea tai valitse valikosta 'Asenna sovellus'."); }
        };
    }
}

window.dismissInstallPrompt = function() {
    localStorage.setItem('appro_install_dismissed', 'true');
    const installCard = document.getElementById('installCard');
    if (installCard) installCard.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => { checkInstallStatus(); });

// --- GLOBAALIT MUUTTUJAT ---
let myName = localStorage.getItem('appro_name') || null;
let currentResetId = localStorage.getItem('appro_reset_id') || null;
let allPlayers = [];
let taskLibrary = [];
let localSpyState = {}; 
let lastMyScore = null;
let lastKnownTasks = {}; 
let taskHistory = [];
let wasInGame = false; 

// KORJAUS 3: Pidetään sankarin ID muistissa
let currentHeroId = null;

let isPlayerCompactMode = false;
let isGMCompactMode = false;
window.localTaskCompactState = {}; 

let pendingWinnerTasks = [];
let winnerTimeout = null;
let pendingXP = 0;
let xpTimeout = null;

let leaderboardScoresStr = "";
let leaderboardPrevRanks = {};
let leaderboardDirections = {};

const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

function logEvent(msg) {
    const time = new Date().toLocaleTimeString('fi-FI');
    db.ref('gameState/eventLog').push({ time, msg });
}

function logScoreChange(playerName, oldScore, delta, newScore, reason) {
    const time = new Date().toLocaleTimeString('fi-FI');
    db.ref('gameState/scoreLog').push({ time, playerName, oldScore, delta, newScore, reason });
}

window.toggleTaskHold = function(taskId) {
    db.ref(`gameState/activeTasks/${taskId}`).transaction(t => {
        if(t) { t.onHold = !t.onHold; }
        return t;
    });
};

window.toggleIndividualTask = function(taskId) {
    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!card) return;
    const isCompact = card.classList.contains('compact-view-card');
    
    window.localTaskCompactState[taskId] = !isCompact;
    
    if (isCompact) {
        card.classList.remove('compact-view-card');
        const tBtn = card.querySelector('.btn-toggle-compact');
        if(tBtn) tBtn.innerText = '➖ SUPISTA';
    } else {
        card.classList.add('compact-view-card');
        const tBtn = card.querySelector('.btn-toggle-compact');
        if(tBtn) tBtn.innerText = '⬜ LAAJENNA';
    }
};

window.toggleGMCompactMode = function() {
    isGMCompactMode = !isGMCompactMode;
    window.localTaskCompactState = {}; 
    const btn = document.getElementById('gmCompactToggleBtn');
    if (btn) btn.innerText = isGMCompactMode ? 'LAAJENNA NÄKYMÄ KAIKISTA' : 'SUPISTA NÄKYMÄ KAIKISTA';
    
    document.querySelectorAll('.active-task-item').forEach(card => {
        const tBtn = card.querySelector('.btn-toggle-compact');
        if (isGMCompactMode) {
            card.classList.add('compact-view-card');
            if(tBtn) tBtn.innerText = '⬜ LAAJENNA';
        } else {
            card.classList.remove('compact-view-card');
            if(tBtn) tBtn.innerText = '➖ SUPISTA';
        }
    });
};

window.togglePlayerCompactMode = function() {
    isPlayerCompactMode = !isPlayerCompactMode;
    window.localTaskCompactState = {}; 
    const btn = document.getElementById('playerCompactToggleBtn');
    if (btn) btn.innerText = isPlayerCompactMode ? 'LAAJENNA NÄKYMÄ' : 'SUPISTA NÄKYMÄ';
    
    document.querySelectorAll('.active-task-item').forEach(card => {
        if (isPlayerCompactMode) {
            card.classList.add('compact-view-card');
        } else {
            card.classList.remove('compact-view-card');
        }
    });
};

window.resetGame = function() {
    if (confirm("VAROITUS: Tämä poistaa kaikki tiedot. Jatketaanko?")) {
        const newResetId = Date.now().toString();
        db.ref('gameState').set({
            players: [], tasks: defaultTasks, usedTaskIds: [], activeTasks: {}, history: {}, eventLog: {}, scoreLog: {}, resetId: newResetId,
            config: { 
                useCooldowns: true, strictVolunteer: false, excludeUsedTasks: true, bdayHero: null,
                visibility: { title: true, points: true, category: true, drawCount: false, desc: false, minus: true, bday: true },
                heroDraw: { include: true, weighted: false, interval: 4, drawCount: 0 },
                disableHeroBonus: false, forceSinglePlayer: false, alwaysMinusOne: true 
            }
        }).then(() => { localStorage.clear(); location.reload(); });
    }
};

db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) return;

    if (currentResetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    allPlayers = data.players || [];
    const config = data.config || {};
    
    currentHeroId = config.bdayHero !== undefined ? config.bdayHero : null;
    
    const me = allPlayers.find(p => p.name === myName);
    if (myName) {
        if (me) {
            wasInGame = true;
            if (lastMyScore !== null && me.score !== lastMyScore) { 
                showXPAnimation(me.score - lastMyScore); 
            }
            lastMyScore = me.score;
        } else {
            if (wasInGame) {
                myName = null;
                localStorage.removeItem('appro_name');
                wasInGame = false;
                lastMyScore = null;
                alert("Game Master on poistanut sinut pelistä. Voit kirjautua sisään uudelleen.");
            } else {
                myName = null;
                localStorage.removeItem('appro_name');
            }
            updateIdentityUI();
        }
    }
    
    taskLibrary = (data.tasks || []).map(t => {
        if (t.id >= 83 && t.id <= 102) return { ...t, isHero: true, p: 1 }; 
        return t;
    });

    taskHistory = Object.values(data.history || {}).reverse().slice(0, 10);
    const vis = config.visibility || { title: true, points: true, category: true, drawCount: false, desc: false, minus: true, bday: true };
    const heroDrawConfig = config.heroDraw || { include: true, weighted: false, interval: 4, drawCount: 0 };
    const totalCompleted = (data.usedTaskIds || []).length;

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, currentHeroId, data.activeTasks || {});
    updateManualTaskSelect();
    
    const historyTitle = document.getElementById('historyTitle');
    if (historyTitle) historyTitle.innerText = `Aiemmat tehtävät (Suoritettu: ${totalCompleted})`;
    renderHistory();
    
    if (document.getElementById('useCooldowns')) {
        document.getElementById('useCooldowns').checked = !!config.useCooldowns;
        document.getElementById('strictVolunteer').checked = !!config.strictVolunteer;
        document.getElementById('excludeUsedTasks').checked = !!config.excludeUsedTasks;
        
        document.getElementById('visTitle').checked = !!vis.title;
        document.getElementById('visPoints').checked = !!vis.points;
        document.getElementById('visCategory').checked = !!vis.category; 
        document.getElementById('visDrawCount').checked = !!vis.drawCount;
        document.getElementById('visDesc').checked = !!vis.desc;
        document.getElementById('visMinus').checked = !!vis.minus;
        document.getElementById('visBday').checked = !!vis.bday;
        
        document.getElementById('incHero').checked = !!heroDrawConfig.include;
        document.getElementById('weightHero').checked = !!heroDrawConfig.weighted;
        document.getElementById('heroInterval').value = heroDrawConfig.interval || 4;

        if(document.getElementById('disableHeroBonus')) document.getElementById('disableHeroBonus').checked = !!config.disableHeroBonus;
        if(document.getElementById('forceSinglePlayer')) document.getElementById('forceSinglePlayer').checked = !!config.forceSinglePlayer;
        if(document.getElementById('alwaysMinusOne')) document.getElementById('alwaysMinusOne').checked = config.alwaysMinusOne !== false;
    }

    if(document.getElementById('adminPanel').style.display === 'block') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
            renderAdminPlayerList(data.activeTasks || {});
            renderTaskLibrary();
        }
        renderEventLog(data.eventLog);
        renderScoreLog(data.scoreLog);
    }

    checkForNewWinnerPopups(data.activeTasks || {});
    renderActiveTasks(data.activeTasks || {}, config);
    lastKnownTasks = JSON.parse(JSON.stringify(data.activeTasks || {}));
});

function checkForNewWinnerPopups(newTasks) {
    if (!myName) return;
    let addedNew = false;
    let seenPopups = JSON.parse(localStorage.getItem('appro_seen_popups') || '[]');
    
    Object.keys(newTasks).forEach(taskId => {
        const newTask = newTasks[taskId];
        const oldTask = lastKnownTasks[taskId];
        const wasJustLocked = newTask.locked && (!oldTask || !oldTask.locked);
        
        if (wasJustLocked && !newTask.isHero) {
            const isMeSelected = (newTask.participants || []).some(r => r.name === myName);
            if (isMeSelected && !seenPopups.includes(taskId)) {
                pendingWinnerTasks.push(newTask.n);
                seenPopups.push(taskId); 
                addedNew = true;
            }
        }
    });
    
    if (addedNew) {
        localStorage.setItem('appro_seen_popups', JSON.stringify(seenPopups)); 
        if (winnerTimeout) clearTimeout(winnerTimeout);
        winnerTimeout = setTimeout(() => {
            const html = pendingWinnerTasks.map(n => `<div class="winner-task-box">${n}</div>`).join('');
            triggerWinnerOverlay(html);
            pendingWinnerTasks = []; 
        }, 500);
    }
}

function triggerWinnerOverlay(tasksHtml) {
    const overlay = document.getElementById('lotteryWinner');
    if(!overlay) return;
    document.getElementById('winnerTaskNames').innerHTML = tasksHtml; 
    overlay.style.display = 'flex';
    
    const bar = overlay.querySelector('.timer-bar');
    if (bar) {
        bar.style.animation = 'none';
        void bar.offsetWidth; 
        bar.style.animation = 'shrink 2.2s linear forwards';
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
    setTimeout(() => { overlay.style.display = 'none'; }, 2500); 
}

function showXPAnimation(points) {
    if (points === 0) return;
    pendingXP += points;
    if (xpTimeout) clearTimeout(xpTimeout);
    
    xpTimeout = setTimeout(() => {
        const pop = document.getElementById('xpPopUp');
        if(!pop) return;
        pop.style.display = 'block';
        
        if (pendingXP > 0) {
            pop.className = 'xp-popup success xp-animate';
            pop.innerText = `+${pendingXP} XP`;
        } else {
            pop.className = 'xp-popup danger xp-animate';
            pop.innerText = `${pendingXP} XP`;
        }
        
        pendingXP = 0;
        setTimeout(() => { 
            pop.style.display = 'none'; 
            pop.className = 'xp-popup'; 
        }, 2000);
    }, 400);
}

window.changeTaskXP = function(taskId, delta) {
    db.ref(`gameState/activeTasks/${taskId}/p`).transaction(currentXP => {
        let newXP = (currentXP || 0) + delta;
        return newXP < 0 ? 0 : newXP;
    });
};

window.updateTaskDrawCount = function(taskId, val) {
    db.ref(`gameState/activeTasks/${taskId}/r`).set(parseInt(val));
};

function renderActiveTasks(tasksObj, config) {
    const container = document.getElementById('activeTasksContainer');
    const isGM = document.body.className.includes('gm');
    const vis = config.visibility || { title: true, points: true, category: true, drawCount: false, desc: false, minus: true, bday: true };
    
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    
    const globalControls = document.getElementById('gmGlobalControls');
    if (globalControls) {
        globalControls.style.display = (isGM && Object.keys(tasksObj).length > 0) ? 'block' : 'none';
    }
    
    let currentIds = Object.keys(tasksObj);

    const existingIds = Array.from(container.querySelectorAll('.active-task-item')).map(el => el.getAttribute('data-task-id'));
    existingIds.forEach(id => {
        if (!currentIds.includes(id)) {
            const el = container.querySelector(`[data-task-id="${id}"]`);
            if (el) el.remove();
        }
    });

    const heroName = (config.bdayHero !== null && allPlayers[config.bdayHero]) ? allPlayers[config.bdayHero].name : null;
    const amIHero = (myName && heroName === myName);
    
    const meObj = allPlayers.find(p => p.name === myName);
    const isBannedGlobally = meObj && meObj.isBanned;

    currentIds.forEach((taskId) => {
        const taskData = tasksObj[taskId];
        const isLocked = !!taskData.locked;
        const results = taskData.participants || [];
        const isMePart = results.some(r => r.name === myName);
        const isHeroTask = !!taskData.isHero; 
        const isOnHold = !!taskData.onHold;
        
        const isSpying = (isGM && localSpyState[taskId]);
        const showFull = isLocked || isHeroTask || isSpying;
        
        let taskIsCompact = isGM ? isGMCompactMode : isPlayerCompactMode;
        if (isGM && window.localTaskCompactState && window.localTaskCompactState[taskId] !== undefined) {
            taskIsCompact = window.localTaskCompactState[taskId];
        }
        
        let card = container.querySelector(`[data-task-id="${taskId}"]`);
        
        if (!card) {
            card = document.createElement('div');
            card.setAttribute('data-task-id', taskId);
            card.innerHTML = `
                <div class="t-status"></div>
                <div class="t-header"></div>
                <div class="compact-participants-text"></div>
                <div class="smooth-collapse">
                    <div class="collapse-inner">
                        <div class="blur-reveal-area" ontouchstart="">
                            <div class="t-desc"></div>
                        </div>
                        <div class="t-action"></div>
                        <div class="t-gm gm-only"></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        }

        const blurArea = card.querySelector('.blur-reveal-area');
        if (blurArea) {
            if (isSpying) blurArea.classList.add('blur-removed');
            else blurArea.classList.remove('blur-removed');
        }

        card.className = `card task-box active-task-item ${taskIsCompact ? 'compact-view-card' : ''} ${isGM && isLocked && !isSpying ? 'is-scoring' : ''} ${isOnHold ? 'task-on-hold' : ''}`;
        card.classList.toggle('hero-task-gold', isHeroTask);
        card.classList.toggle('participating', !isGM && !isHeroTask && isLocked && isMePart);
        card.classList.toggle('not-participating', !isGM && !isHeroTask && isLocked && !isMePart);

        let flexOrder = 10;
        if (!isGM && myName) {
            if (isHeroTask && amIHero) flexOrder = 0; 
            else if (isLocked && isMePart && !isHeroTask) flexOrder = 1;
            else if (!isLocked && !isHeroTask) flexOrder = 2;
            else flexOrder = 3;
        } else {
            flexOrder = parseInt(taskId.split('_')[1] || 10);
        }
        card.style.order = flexOrder;

        // --- STATUS ---
        let statusHtml = '';
        if (isGM) {
            let stageText = ''; let stageBg = ''; let textColor = '#ffffff'; let pulseClass = '';
            
            if (isHeroTask) {
                stageText = '3. PISTEYTÄ SANKARI'; stageBg = 'var(--success)'; pulseClass = 'stage-pulse'; 
            } else {
                if (isLocked) { stageText = '3. PISTEYTÄ SUORITUKSET'; stageBg = 'var(--success)'; pulseClass = 'stage-pulse'; } 
                else if (taskData.drawn) { stageText = '2. LUKITSE TEHTÄVÄT'; stageBg = 'var(--accent)'; } 
                else { stageText = '1. ARVO PELAAJAT'; stageBg = '#a36114'; }
            }

            statusHtml += `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">`;
            statusHtml += `<div><span class="task-status-tag ${pulseClass}" style="background: ${stageBg}; color: ${textColor}; margin:0; border: 1px solid rgba(0,0,0,0.5);">${stageText}</span></div>`;
            
            const toggleIcon = taskIsCompact ? '⬜ LAAJENNA' : '➖ SUPISTA';
            statusHtml += `<div style="display:flex; gap:6px;">`;
            
            const holdIcon = isOnHold ? '▶️ JATKA' : '⏸️ HOLD';
            const holdColor = isOnHold ? 'var(--gm-accent)' : 'rgba(255,255,255,0.08)';
            statusHtml += `<button class="btn" style="width:auto; margin:0; padding:6px 10px; font-size:0.55rem; background:${holdColor}; border:1px solid rgba(255,255,255,0.2); color:#fff;" onclick="toggleTaskHold('${taskId}')">${holdIcon}</button>`;
            
            statusHtml += `<button class="btn btn-secondary btn-toggle-compact" style="width:auto; margin:0; padding:6px 10px; font-size:0.55rem;" onclick="toggleIndividualTask('${taskId}')">${toggleIcon}</button>`;
            statusHtml += `<button class="btn btn-danger" style="width:auto; margin:0; padding:6px 10px; font-size:0.55rem;" onclick="deleteActiveTask('${taskId}')">X POISTA</button>`;
            statusHtml += `</div></div>`;
        } else {
            if (isHeroTask) { statusHtml += `<div class="task-status-tag" style="background: var(--hero-gold); color: black; font-weight: 900;">✨ SANKARITEHTÄVÄ ✨</div>`; } 
            else if (isLocked) { statusHtml += `<div class="task-status-tag ${isMePart ? '' : 'muted'}">${isMePart ? '🎉 SINUN TEHTÄVÄSI' : '👀 SEURAA MUIDEN SUORITUSTA'}</div>`; } 
            else if (taskData.drawn) { statusHtml += `<div class="task-status-tag" style="background: var(--gm-accent); color: #fff;">⌛ ARVONTA SUORITETTU</div>`; } 
            else { statusHtml += `<h2>VAIHE: ILMOITTAUTUMINEN</h2>`; }
        }

        let headerHtml = '';
        const displayTitle = (showFull || vis.title) ? taskData.n : "??? (Salainen tehtävä)";
        headerHtml += `<h1 style="margin:5px 0;">${displayTitle}</h1>`;

        let tagsHtml = '';
        if (showFull || vis.points) { tagsHtml += `<div class="xp-badge" style="margin-bottom:10px; margin-right:5px;">${taskData.p} XP</div>`; }
        
        if (taskData.k && (showFull || vis.category)) {
            let catName = '', catClass = '';
            if (taskData.k === 'pokka') { catName = '🗣️ POKKA'; catClass = 'badge-pokka'; }
            if (taskData.k === 'liikunta') { catName = '🏃 TOIMINTA'; catClass = 'badge-liikunta'; }
            if (taskData.k === 'juoma') { catName = '🍻 JUOMA'; catClass = 'badge-juoma'; }
            if (taskData.k === 'kilpailu') { catName = '⚔️ KILPAILU'; catClass = 'badge-kilpailu'; }
            tagsHtml += `<div class="xp-badge ${catClass}" style="margin-bottom:10px; margin-right:5px;">${catName}</div>`;
        }

        if (!isHeroTask && (showFull || vis.drawCount)) { tagsHtml += `<div class="xp-badge" style="margin-bottom:10px; margin-right:5px;">👥 MAX ${taskData.r || 1} SUORITTAJAA</div>`; }
        if ((showFull || vis.minus) && taskData.m) { tagsHtml += `<div class="xp-badge" style="margin-bottom:10px; background:rgba(185,50,50,0.15); color:var(--danger); border-color:var(--danger); margin-right:5px;">⚠️ MIINUS-UHKA</div>`; }
        
        if (!config.disableHeroBonus && (showFull || vis.bday) && taskData.b) { 
            tagsHtml += `<div class="xp-badge" style="margin-bottom:10px; background:rgba(194,120,33,0.15); color:var(--gm-accent); border-color:var(--gm-accent); margin-right:5px;">🎂 SANKARIBONUS</div>`; 
        }
        
        headerHtml += `<div style="margin-top:10px;">${tagsHtml}</div>`;

        let compactNamesHtml = "";
        if (isGM && !isHeroTask) {
            if (isLocked) {
                if (results.length > 0) {
                    let details = results.map(r => {
                        let st = r.win ? '<span style="color:var(--success)">WIN</span>' : '<span style="color:var(--danger)">FAIL</span>';
                        return `${r.name}: ${st}`;
                    }).join(' | ');
                    compactNamesHtml = `<div class="compact-inner-text" style="background:rgba(0,0,0,0.5); padding:6px 10px; border-radius:6px;"><b>SUORITUKSET:</b> ${details}</div>`;
                } else {
                    compactNamesHtml = `<div class="compact-inner-text" style="color:var(--muted);">Ei suorittajia.</div>`;
                }
            } else {
                let allVols = [...results.map(r => r.name), ...(taskData.lateVolunteers || [])];
                if (allVols.length > 0) {
                    let label = taskData.drawn ? "ARVOTTU:" : "ILMOITTAUTUNEET:";
                    let color = taskData.drawn ? "var(--success)" : "var(--accent)";
                    compactNamesHtml = `<div class="compact-inner-text"><span style="color:${color}; font-weight:bold;">${label}</span> <span style="color:#fff;">${allVols.join(', ')}</span></div>`;
                } else {
                    compactNamesHtml = `<div class="compact-inner-text" style="color:var(--muted);">Ei ilmoittautuneita vielä.</div>`;
                }
            }
        } else if (isGM && isHeroTask) {
            if (isLocked) {
                let hw = (taskData.heroWin !== false);
                let st = hw ? '<span style="color:var(--success)">WIN</span>' : '<span style="color:var(--danger)">FAIL</span>';
                compactNamesHtml = `<div class="compact-inner-text" style="background:rgba(0,0,0,0.5); padding:6px 10px; border-radius:6px;"><b>SANKARI:</b> ${st}</div>`;
            }
        }

        let descHtml = '';
        const shouldShowDesc = showFull || vis.desc;
        if (shouldShowDesc) {
            const displayDesc = (taskData.d && taskData.d.trim() !== "") ? taskData.d : "Ei ohjeita.";
            descHtml += `<div class="instruction-area">
                            <div class="instruction-label">TEHTÄVÄN KUVAUS</div>
                            <p class="instruction-text">${displayDesc}</p>
                         </div>`;
            if (isLocked && !isHeroTask) {
                const drawnPlayers = results.map(r => r.name);
                if (drawnPlayers.length > 0) {
                    descHtml += `<div style="margin-top:15px; font-weight:900; color:var(--accent); font-size:0.8rem; text-transform: uppercase;">SUORITTAJAT: <span style="color:#ffffff;">${drawnPlayers.join(', ')}</span></div>`;
                }
            }
        } else {
            descHtml += `<p class="task-description" style="opacity:0.5; font-size:1.1rem;">Tehtävä paljastetaan valituille pelaajille...</p>`;
        }

        let actionHtml = '';
        if (!isGM && !isLocked && !isHeroTask) {
            const isBannedFromThis = config.useCooldowns && taskData.bannedPlayers && taskData.bannedPlayers.includes(myName);
            const amIIn = results.some(r => r.name === myName) || (taskData.lateVolunteers || []).includes(myName);

            actionHtml += `<div class="join-action-area" style="margin-top:15px;">`;
            if (isBannedGlobally) {
                actionHtml += `<p style="color:var(--danger); font-weight:800; text-align:center;">OLET PELIKIELLOSSA!</p>`;
            } else if (isBannedFromThis && !amIIn) {
                actionHtml += `<p style="color:var(--danger); font-weight:800; text-align:center;">OLET JÄÄHYLLÄ TÄSTÄ TEHTÄVÄSTÄ!</p>`;
            } else if (taskData.drawn && !amIIn) {
                actionHtml += `<p style="color:var(--muted); font-weight:800; text-align:center; font-size: 0.8rem;">ARVONTA ON PÄÄTTYNYT</p>`;
            } else {
                let btnText = amIIn ? 'ILMOITTAUDUTTU ✓' : 'HALUAN ILMOITTAUTUA';
                actionHtml += `<button class="btn ${amIIn ? 'btn-success' : 'btn-primary'}" onclick="volunteer('${taskId}')">${btnText}</button>`;
            }
            actionHtml += `</div>`;
        } else if (!isGM && isHeroTask) {
            actionHtml += `<p style="font-size: 0.7rem; color: var(--hero-gold); text-align: center; margin-top: 10px; font-weight: 700;">GM MERKITSEE PISTEET SUORITUKSEN JÄLKEEN</p>`;
        }

        let gmHtml = '';
        if (isGM) {
            gmHtml += `<div style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">`;
            
            if (!isHeroTask && !isLocked) {
                const hasParticipants = results.length > 0 || (taskData.lateVolunteers && taskData.lateVolunteers.length > 0);
                const isDrawn = taskData.drawn;
                const drawOpacity = isDrawn ? '0.4' : '1';
                const lockOpacity = (results.length > 0 && isDrawn) ? '1' : '0.4';
                const lockPulse = (results.length > 0 && isDrawn) ? 'box-shadow: 0 0 15px var(--accent); transform: scale(1.02);' : '';

                // KORJAUS Z-INDEX LOKAALISTI: Pakotetaan ruudukko z-index tasolle 50 ERIKSEEN ja napit tasolle 5
                gmHtml += `
                    <div class="volunteer-selector-grid" id="grid-${taskId}" style="position:relative; z-index:50;"></div>
                    <div class="admin-row-stack" style="position:relative; z-index:5;">
                        <div style="display:flex; gap:8px; flex:1; opacity:${drawOpacity}; transition:all 0.3s; position:relative; z-index:1;">
                            <select id="drawCount-${taskId}" style="flex:1; margin:0;" onchange="updateTaskDrawCount('${taskId}', this.value)"></select>
                            <button class="btn btn-arvo" style="flex:2; margin:0;" onclick="drawRandom('${taskId}')">${isDrawn ? 'ARVO UUDELLEEN' : 'ARVO PELAAJAT'}</button>
                        </div>
                        <button class="btn btn-primary" style="margin:0; font-size:0.75rem; padding:12px; opacity:${lockOpacity}; ${lockPulse} transition:all 0.3s; position:relative; z-index:1;" onclick="lockParticipants('${taskId}')">LUKITSE VALINNAT</button>
                    </div>
                `;
            }
            
            gmHtml += `<div id="scoring-${taskId}" style="display:${isLocked || isHeroTask ? 'block' : 'none'};"></div>`;
            
            gmHtml += `
                <div class="admin-row-stack" style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-top:10px; justify-content:space-between; position:relative; z-index:1;">
                    <span style="font-size:0.65rem; color:var(--muted); font-weight:bold;">TEHTÄVÄN XP-ARVO:</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button class="btn btn-secondary" style="width:28px; height:28px; padding:0; margin:0; min-height:0;" onclick="changeTaskXP('${taskId}', -1)">-</button>
                        <span style="font-weight:900; font-size:0.9rem; color:var(--accent); width:20px; text-align:center;">${taskData.p}</span>
                        <button class="btn btn-secondary" style="width:28px; height:28px; padding:0; margin:0; min-height:0;" onclick="changeTaskXP('${taskId}', 1)">+</button>
                    </div>
                </div>
            `;

            gmHtml += `<div style="display:flex; gap:10px; margin-top:8px;">
                            <button class="btn btn-success" id="finish-${taskId}" style="display:${(isLocked || isHeroTask) ? 'block' : 'none'}; flex:2; margin:0;" onclick="showScoring('${taskId}')">MERKITSE VALMIIKSI</button>
                            <button class="btn btn-secondary" style="flex:1; font-size:0.6rem; padding:8px; margin:0;" onclick="toggleGMSpy('${taskId}')">${isSpying ? 'PIILOTA' : 'SPEKSIT'}</button>
                       </div>`;
            gmHtml += `</div>`;
        }

        const updateNode = (selector, newHtml) => {
            const node = card.querySelector(selector);
            if (node && node.innerHTML !== newHtml) node.innerHTML = newHtml;
        };

        updateNode('.t-status', statusHtml);
        updateNode('.t-header', headerHtml);
        updateNode('.compact-participants-text', compactNamesHtml);
        updateNode('.t-desc', descHtml);
        updateNode('.t-action', actionHtml);
        updateNode('.t-gm', gmHtml);

        if (isGM) {
            if (!isHeroTask && !isLocked) {
                renderGMGrid(taskId, results, isLocked, taskData.isLotteryRunning, config.useCooldowns, taskData);
                updateDrawCountSelect(taskId, taskData, config.forceSinglePlayer);
            }
            if (isLocked || isHeroTask) {
                renderScoringArea(taskId, results, isHeroTask, taskData.heroWin, taskData.heroReviewed);
            }
        }
    });
}

function drawAllTasks() {
    db.ref('gameState/activeTasks').once('value', snap => {
        const tasks = snap.val() || {};
        let drawsTriggered = 0;
        let updatesStart = {};

        Object.keys(tasks).forEach(taskId => {
            const taskData = tasks[taskId];
            
            // Kilpailun minimitarkistus
            let pool = (taskData.participants || []).map(p => p.name).concat(taskData.lateVolunteers || []);
            pool = [...new Set(pool)];
            let isValid = pool.length > 0;
            if (taskData.k === 'kilpailu' && pool.length < 2) isValid = false;

            if (!taskData.onHold && !taskData.locked && !taskData.isHero && isValid && !taskData.drawn) {
                updatesStart[`${taskId}/isLotteryRunning`] = true;
                drawsTriggered++;
            }
        });

        if (drawsTriggered === 0) { alert("Ei arvottavia tehtäviä (tai kilpailuihin ei ole tarpeeksi ilmoittautuneita)."); return; }

        const adminName = myName || 'Tuntematon';
        logEvent(`Admin (${adminName}) / Massatoiminto: Arvonta käynnistetty ${drawsTriggered} tehtävään!`);
        db.ref('gameState/activeTasks').update(updatesStart);

        setTimeout(() => {
            let updatesFinish = {};
            Object.keys(tasks).forEach(taskId => {
                if (updatesStart[`${taskId}/isLotteryRunning`]) {
                    const taskData = tasks[taskId];
                    const sel = document.getElementById(`drawCount-${taskId}`);
                    const count = sel ? (parseInt(sel.value) || 1) : 1;
                    
                    let pool = (taskData.participants || []).map(p => p.name).concat(taskData.lateVolunteers || []);
                    pool = [...new Set(pool)];

                    let shuffled = [...pool].sort(() => 0.5 - Math.random());
                    let winners = shuffled.slice(0, count).map(name => ({ name, win: true, reviewed: false }));

                    updatesFinish[`${taskId}/participants`] = winners;
                    updatesFinish[`${taskId}/lateVolunteers`] = [];
                    updatesFinish[`${taskId}/isLotteryRunning`] = false;
                    updatesFinish[`${taskId}/drawn`] = true;
                }
            });
            db.ref('gameState/activeTasks').update(updatesFinish);
        }, 1000);
    });
}

function lockAllTasks() {
    db.ref('gameState/activeTasks').once('value', snap => {
        const tasks = snap.val() || {};
        let count = 0;
        Object.keys(tasks).forEach(taskId => {
            const taskData = tasks[taskId];
            // KORJAUS 2: Vain arvotut (drawn === true) lukitaan massana
            if (!taskData.onHold && !taskData.locked && !taskData.isHero && taskData.drawn && (taskData.participants || []).length > 0) {
                lockParticipants(taskId, true);
                count++;
            }
        });
        const adminName = myName || 'Tuntematon';
        if (count > 0) logEvent(`Admin (${adminName}) / Massatoiminto: Lukitsi ${count} tehtävää.`);
        else alert("Ei lukittavia tehtäviä. Varmista, että olet arponut suorittajat ensin (Vaihe 1).");
    });
}

function finishAllTasks() {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const tasks = d.activeTasks || {};
        const config = d.config || {};
        let finishTriggered = 0;
        
        Object.keys(tasks).forEach(taskId => {
            const taskData = tasks[taskId];
            if (!taskData.onHold && (taskData.locked || taskData.isHero)) {
                let canScore = true;
                if (taskData.k === 'kilpailu') {
                    const winnersCount = (taskData.participants || []).filter(r => r.win).length;
                    if (winnersCount > 1) canScore = false;
                }
                if (canScore) {
                    showScoring(taskId, true, config); 
                    finishTriggered++;
                }
            }
        });
        const adminName = myName || 'Tuntematon';
        if (finishTriggered > 0) logEvent(`Admin (${adminName}) / Massatoiminto: Merkitsi ${finishTriggered} tehtävää valmiiksi.`);
        else alert("Ei valmiita tehtäviä odottamassa pisteytystä (Tai kilpailuissa oli tuplavoittajia).");
    });
}

function deleteActiveTask(taskId) {
    if (confirm("Haluatko varmasti poistaa tämän aktiivisen tehtävän?")) {
        db.ref('gameState/activeTasks/' + taskId).remove();
        const adminName = myName || 'Tuntematon';
        logEvent(`Admin (${adminName}): Aktiivinen tehtävä poistettu manuaalisesti.`);
    }
}

function drawRandom(taskId, isMassAction = false) {
    const sel = document.getElementById(`drawCount-${taskId}`);
    const count = sel ? (parseInt(sel.value) || 1) : 1;
    
    db.ref(`gameState/activeTasks/${taskId}`).once('value', s => {
        const taskData = s.val();
        let pool = (taskData.participants || []).map(p => p.name).concat(taskData.lateVolunteers || []);
        pool = [...new Set(pool)]; 
        
        if (taskData.k === 'kilpailu' && pool.length < 2) {
            if (!isMassAction) alert("Kilpailutehtävään vaaditaan vähintään 2 ilmoittautujaa, jotta arvonta voidaan suorittaa.");
            return;
        }
        
        if(pool.length === 0) return;

        db.ref(`gameState/activeTasks/${taskId}`).update({ isLotteryRunning: true });
        
        setTimeout(() => {
            let shuffled = [...pool].sort(() => 0.5 - Math.random());
            let winners = shuffled.slice(0, count).map(name => ({ name, win: true, reviewed: false })); 
            
            db.ref(`gameState/activeTasks/${taskId}`).update({ 
                participants: winners, 
                lateVolunteers: [], 
                isLotteryRunning: false, 
                drawn: true 
            });
            
            if (!isMassAction) {
                const adminName = myName || 'Tuntematon';
                logEvent(`Admin (${adminName}): Arvottu ${count} suorittajaa tehtävään: ${taskData.n}`);
            }
        }, 1000); 
    });
}

function renderGMGrid(taskId, results, isLocked, isShuffling, showCD, taskData) {
    const grid = document.getElementById(`grid-${taskId}`);
    if(!grid) return;

    if (grid.children.length !== allPlayers.length) {
        grid.innerHTML = '';
        allPlayers.forEach(p => {
            const btn = document.createElement('button');
            grid.appendChild(btn);
        });
    }

    allPlayers.forEach((p, index) => {
        const btn = grid.children[index];
        const isInc = results.some(r => r.name === p.name);
        const isLate = (taskData.lateVolunteers || []).includes(p.name);
        const isBannedFromThis = showCD && taskData.bannedPlayers && taskData.bannedPlayers.includes(p.name);
        
        let btnClass = 'btn-secondary';
        if (isInc) btnClass = 'btn-primary selected-participant';
        else if (isLate) btnClass = 'btn-secondary late-volunteer'; 
        
        btn.className = `btn ${btnClass} ${isBannedFromThis ? 'on-cooldown' : ''}`;
        btn.disabled = isLocked || isShuffling; 
        btn.innerHTML = `${p.name}${isLate ? ' <small>(MYÖHÄSSÄ)</small>' : ''}${isBannedFromThis ? ' <small>(J)</small>' : ''}`;
        btn.onclick = () => toggleParticipant(taskId, p.name);
    });

    if (isShuffling) {
        if (!window.rouletteTimers) window.rouletteTimers = {};
        if (!window.rouletteTimers[taskId]) {
            window.rouletteTimers[taskId] = setInterval(() => {
                Array.from(grid.children).forEach(b => b.classList.remove('roulette-focus'));
                const validBtns = Array.from(grid.children).filter(b => b.className.includes('selected-participant') || b.className.includes('late-volunteer'));
                if(validBtns.length > 0) {
                    const randomBtn = validBtns[Math.floor(Math.random() * validBtns.length)];
                    randomBtn.classList.add('roulette-focus');
                }
            }, 80); 
        }
    } else {
        if (window.rouletteTimers && window.rouletteTimers[taskId]) {
            clearInterval(window.rouletteTimers[taskId]);
            delete window.rouletteTimers[taskId];
        }
        Array.from(grid.children).forEach(b => b.classList.remove('roulette-focus'));
    }
}

function toggleGMSpy(taskId) {
    localSpyState[taskId] = !localSpyState[taskId];
    db.ref('gameState').once('value', snap => {
        renderActiveTasks(snap.val().activeTasks || {}, snap.val().config || {});
    });
}

function setRole(r) {
    document.body.className = r + '-mode';
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
    db.ref('gameState').once('value', snap => {
        renderActiveTasks(snap.val().activeTasks || {}, snap.val().config || {});
    });
}

let gmHoldTimer;
const gmBtn = document.getElementById('btnGM');
if(gmBtn) {
    const startPress = () => { gmHoldTimer = setTimeout(() => { setRole('gm'); if(navigator.vibrate) navigator.vibrate(80); }, 800); };
    const endPress = () => clearTimeout(gmHoldTimer);
    gmBtn.addEventListener('mousedown', startPress);
    gmBtn.addEventListener('mouseup', endPress);
    gmBtn.addEventListener('touchstart', startPress);
    gmBtn.addEventListener('touchend', endPress);
}

// NIMEN PITUUDEN PAKOTUS JS-PUOLELLA
function claimIdentity() {
    let n = document.getElementById('playerNameInput').value.trim();
    if(!n) return; 
    if(n.length > 15) n = n.substring(0, 15); // JS varmistus pituusrajalle
    
    myName = n; 
    localStorage.setItem('appro_name', n);
    updateIdentityUI(); 

    db.ref('gameState/players').transaction(p => {
        p = p || []; 
        if(!p.find(x => x.name === n)) {
            p.push({ name: n, score: 0, cooldown: 0, isBanned: false }); 
        }
        return p;
    }).then(() => {
        logEvent(`Pelaaja kirjautui: ${n}`);
    });
}

function volunteer(taskId) {
    if(!myName) return;
    
    const localTask = lastKnownTasks[taskId];
    if (!localTask || localTask.locked) return;
    
    const meObj = allPlayers.find(p => p.name === myName);
    if (meObj && meObj.isBanned) {
        alert("Olet pelikiellossa! Et voi ilmoittautua."); return;
    }

    const strictVol = document.getElementById('strictVolunteer')?.checked;
    const useCd = document.getElementById('useCooldowns')?.checked;

    if (useCd && localTask.bannedPlayers && localTask.bannedPlayers.includes(myName)) {
        alert("Olet jäähyllä tästä tehtävästä!"); return;
    }
    
    if (strictVol) {
        let inOther = Object.keys(lastKnownTasks).some(id => {
            if (id === taskId) return false;
            const t = lastKnownTasks[id];
            const inPart = !t.locked && (t.participants || []).some(r => r.name === myName);
            const inLate = !t.locked && (t.lateVolunteers || []).includes(myName);
            return inPart || inLate;
        });
        if (inOther) {
            alert("Jäähy: Olet jo ilmoittautunut toiseen avoimeen tehtävään!"); return;
        }
    }

    const taskName = localTask.n;

    db.ref(`gameState/activeTasks/${taskId}`).transaction(t => {
        if (!t || t.locked) return t; 
        
        t.participants = t.participants || [];
        t.lateVolunteers = t.lateVolunteers || [];
        
        if (t.drawn) {
            let inParts = t.participants.findIndex(r => r.name === myName);
            if (inParts > -1) {
                t.participants.splice(inParts, 1); 
            } else {
                return; 
            }
        } else {
            let pIdx = t.participants.findIndex(r => r.name === myName);
            if (pIdx > -1) t.participants.splice(pIdx, 1);
            else t.participants.push({name: myName, win: true, reviewed: false});
        }
        return t;
    }).then((res) => {
        if(res && res.committed) {
            logEvent(`${myName} muutti osallistumistaan: ${taskName}`);
        }
    });
}

function toggleParticipant(taskId, name) {
    const taskName = lastKnownTasks[taskId] ? lastKnownTasks[taskId].n : "Tehtävä";
    
    db.ref(`gameState/activeTasks/${taskId}`).transaction(t => {
        if(!t) return t;
        t.participants = t.participants || [];
        t.lateVolunteers = t.lateVolunteers || [];
        
        const pIdx = t.participants.findIndex(r => r.name === name);
        const lIdx = t.lateVolunteers.indexOf(name);
        
        if (pIdx > -1) {
            t.participants.splice(pIdx, 1); 
        } else if (lIdx > -1) {
            t.lateVolunteers.splice(lIdx, 1); 
            t.participants.push({ name: name, win: true, reviewed: false }); 
        } else {
            t.participants.push({ name: name, win: true, reviewed: false }); 
        }
        return t;
    }).then((res) => {
        if(res.committed) {
            const adminName = myName || 'Tuntematon';
            logEvent(`Admin (${adminName}) muokkasi pelaajan ${name} tilaa: ${taskName}`);
        }
    });
}

function lockParticipants(taskId, isMassAction = false) { 
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const taskInstance = d.activeTasks[taskId];
        const res = taskInstance.participants || [];
        const drawnNames = res.map(r => r.name);
        
        if (d.config?.useCooldowns) {
            const updatedPlayers = allPlayers.map(p => {
                if (drawnNames.includes(p.name)) p.cooldown = true; 
                return p;
            });
            db.ref('gameState/players').set(updatedPlayers);
        }
        db.ref(`gameState/activeTasks/${taskId}/locked`).set(true); 
        localSpyState[taskId] = false;
        
        if (!isMassAction) {
            const adminName = myName || 'Tuntematon';
            logEvent(`Admin (${adminName}) lukitsi suorittajat tehtävään ${taskInstance.n}: ${drawnNames.join(', ')}`);
        }
    });
}

function showScoring(taskId, isMassAction = false, extConfig = null) {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const config = extConfig || d.config || {}; 
        const disableBonus = !!config.disableHeroBonus; 
        const alwaysMinusOne = config.alwaysMinusOne !== false; 
        
        const taskInstance = d.activeTasks[taskId];
        if(!taskInstance) return;
        
        if (taskInstance.k === 'kilpailu' && !isMassAction) {
            const winnersCount = (taskInstance.participants || []).filter(r => r.win).length;
            if (winnersCount > 1) {
                if (!confirm("HUOM! Kilpailutehtävässä on merkitty useampi voittaja.\nHaluatko varmasti jatkaa ja antaa kaikille plussaa?")) {
                    return; 
                }
            }
        }
        
        const res = taskInstance.participants || [];
        const heroId = config.bdayHero;
        let used = d.usedTaskIds || [];
        used.push(taskInstance.id);
        
        let winnersNames = [];
        let taskCompletedBySomeone = res.some(r => r.win);
        
        const updatedPlayers = allPlayers.map((p, idx) => {
            let earned = 0;
            if (taskInstance.isHero) {
                if (idx === heroId) {
                    const heroWon = taskInstance.heroWin !== false;
                    if (heroWon) {
                        earned += taskInstance.p;
                    } else if (taskInstance.m) {
                        earned -= alwaysMinusOne ? 1 : taskInstance.p;
                    }
                    winnersNames.push(p.name);
                }
            } else {
                const part = res.find(r => r.name === p.name);
                if(part) {
                    if(part.win) { 
                        earned += taskInstance.p; 
                        winnersNames.push(p.name); 
                    } else if(taskInstance.m) {
                        earned -= alwaysMinusOne ? 1 : taskInstance.p;
                    }
                } else if (idx === heroId && taskInstance.b && !disableBonus) {
                    if (taskCompletedBySomeone) earned += 1; 
                }
            }
            
            let oldScore = p.score || 0;
            let newScore = Math.max(0, oldScore + earned);
            if (earned !== 0) {
                logScoreChange(p.name, oldScore, newScore - oldScore, newScore, taskInstance.n);
            }
            p.score = newScore;
            return p;
        });

        db.ref('gameState/history').push({
            taskName: taskInstance.n,
            winners: winnersNames.length > 0 ? winnersNames : ["Ei onnistujia"],
            timestamp: new Date().toLocaleTimeString('fi-FI')
        });

        const newActiveTasks = { ...d.activeTasks };
        delete newActiveTasks[taskId];
        db.ref('gameState').update({ players: updatedPlayers, activeTasks: newActiveTasks, usedTaskIds: used });
        
        if (!isMassAction) {
            const adminName = myName || 'Tuntematon';
            logEvent(`Admin (${adminName}) päätti tehtävän: ${taskInstance.n}. Pisteet jaettu.`);
        }
    });
}

window.setHeroResult = function(taskId, isWin) {
    db.ref(`gameState/activeTasks/${taskId}`).transaction(t => {
        if(t) {
            t.heroWin = isWin;
            t.heroReviewed = true;
        }
        return t;
    });
};

window.setParticipantResult = function(taskId, i, isWin) {
    db.ref(`gameState/activeTasks/${taskId}/participants/${i}`).transaction(p => {
        if(p) {
            p.win = isWin;
            p.reviewed = true;
        }
        return p;
    });
};

function renderScoringArea(taskId, results, isHeroTask, heroWinState, heroReviewed) {
    const sArea = document.getElementById(`scoring-${taskId}`);
    if(!sArea) return; 
    
    sArea.innerHTML = '';
    
    const box = document.createElement('div');
    box.className = "scoring-box"; 
    
    if (isHeroTask) {
        box.innerHTML = `<p style="font-size:0.75rem; color:var(--hero-gold); margin:0 0 12px 0; text-align:center; font-weight:900; letter-spacing:1px;">⚠️ PISTEYTÄ SANKARIN SUORITUS ⚠️</p>`;
        
        let isWin = heroWinState !== false;
        let winClass = (heroReviewed && isWin) ? 'score-btn-win' : 'score-btn-default';
        let winText = (heroReviewed && isWin) ? 'WIN' : 'WIN (Oletus)';
        let failClass = (heroReviewed && !isWin) ? 'score-btn-fail' : 'score-btn-default';

        const row = document.createElement('div');
        row.className = 'player-row is-hero'; 
        row.style.padding = '8px';
        row.innerHTML = `
            <span style="flex:1;">🎂 SYNTTÄRISANKARI</span>
            <div style="display:flex; gap:5px;">
                <button class="btn ${winClass}" style="width:auto; padding:8px; margin:0; font-size:0.7rem;" onclick='setHeroResult("${taskId}", true)'>${winText}</button>
                <button class="btn ${failClass}" style="width:auto; padding:8px; margin:0; font-size:0.7rem;" onclick='setHeroResult("${taskId}", false)'>FAIL</button>
            </div>
        `;
        box.appendChild(row);
    } else {
        box.innerHTML = `<p style="font-size:0.75rem; color:var(--hero-gold); margin:0 0 12px 0; text-align:center; font-weight:900; letter-spacing:1px;">⚠️ PISTEYTÄ SUORITUKSET ⚠️</p>`;
        if (results.length === 0) box.innerHTML += `<p style="font-size:0.6rem; color:var(--muted); text-align:center;">Ei suorittajia.</p>`;
        
        results.forEach((r, i) => {
            let isWin = r.win;
            let isReviewed = r.reviewed;
            
            let winClass = (isReviewed && isWin) ? 'score-btn-win' : 'score-btn-default';
            let winText = (isReviewed && isWin) ? 'WIN' : 'WIN (Oletus)';
            let failClass = (isReviewed && !isWin) ? 'score-btn-fail' : 'score-btn-default';

            const row = document.createElement('div');
            row.className = 'player-row'; row.style.padding = '8px';
            row.innerHTML = `
                <span style="flex:1;">${r.name}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn ${winClass}" style="width:auto; padding:8px; margin:0; font-size:0.7rem;" onclick='setParticipantResult("${taskId}", ${i}, true)'>${winText}</button>
                    <button class="btn ${failClass}" style="width:auto; padding:8px; margin:0; font-size:0.7rem;" onclick='setParticipantResult("${taskId}", ${i}, false)'>FAIL</button>
                </div>
            `;
            box.appendChild(row);
        });
    }
    sArea.appendChild(box);
}

function updateDrawCountSelect(taskId, task, forceSinglePlayer) {
    const sel = document.getElementById(`drawCount-${taskId}`);
    if (!sel || sel.options.length > 0) return; 
    
    const max = forceSinglePlayer ? 1 : Math.max(allPlayers.length, 1);
    for (let i = 1; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = i;
        if(i === (task.r || 1)) opt.selected = true;
        sel.appendChild(opt);
    }
}

function confirmRandomize() {
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        const config = d.config || {};
        const heroDraw = config.heroDraw || { include: true, weighted: false, interval: 4, drawCount: 0 };
        const used = d.usedTaskIds || [];

        let bannedFromThisTask = [];
        
        if (config.useCooldowns) {
            const updatedPlayers = allPlayers.map(p => {
                let cd = p.cooldown === true ? 1 : (p.cooldown || 0); 
                if (cd > 0) bannedFromThisTask.push(p.name);
                if (cd > 0) cd--; 
                return { ...p, cooldown: cd }; 
            });
            db.ref('gameState/players').set(updatedPlayers);
        }

        let newDrawCount = heroDraw.drawCount || 0;
        let isForcedHero = false;

        if (heroDraw.weighted) {
            newDrawCount++;
            if (newDrawCount >= (heroDraw.interval || 4)) {
                isForcedHero = true;
                newDrawCount = 0; 
            }
        }

        let pool = [];
        const normalTasks = taskLibrary.filter(t => !t.isHero && !used.includes(t.id));
        const heroTasks = taskLibrary.filter(t => t.isHero && !used.includes(t.id));
        
        let finalNormal = normalTasks.length > 0 ? normalTasks : taskLibrary.filter(t => !t.isHero);
        let finalHero = heroTasks.length > 0 ? heroTasks : taskLibrary.filter(t => t.isHero);

        if (isForcedHero && finalHero.length > 0) {
            pool = finalHero;
        } else if (heroDraw.include && !heroDraw.weighted) {
            pool = finalNormal.concat(finalHero); 
        } else {
            pool = finalNormal; 
        }

        if(pool.length === 0) pool = finalHero; 

        const t = { ...pool[Math.floor(Math.random() * pool.length)] };
        
        if (config.forceSinglePlayer) t.r = 1;

        const instanceId = "t_" + Date.now();
        
        let updates = {};
        updates[`gameState/activeTasks/${instanceId}`] = { 
            ...t, 
            locked: t.isHero ? true : false, 
            participants: [], 
            drawn: false,
            bannedPlayers: bannedFromThisTask 
        };
        if (heroDraw.weighted) updates[`gameState/config/heroDraw/drawCount`] = newDrawCount;

        db.ref().update(updates).then(() => {
            const adminName = myName || 'Tuntematon';
            logEvent(`Admin (${adminName}) arpoi uuden tehtävän: ${t.n}`);
        });
    });
}

function selectManualTask(idx) {
    if (idx === "") return;
    db.ref('gameState').once('value', snap => {
        const d = snap.val();
        
        let bannedFromThisTask = [];
        if (d.config?.useCooldowns) {
            const updatedPlayers = allPlayers.map(p => {
                let cd = p.cooldown === true ? 1 : (p.cooldown || 0); 
                if (cd > 0) bannedFromThisTask.push(p.name);
                if (cd > 0) cd--; 
                return { ...p, cooldown: cd }; 
            });
            db.ref('gameState/players').set(updatedPlayers);
        }
        
        const t = { ...taskLibrary[idx] };
        
        if (d.config?.forceSinglePlayer) t.r = 1;

        const instanceId = "t_" + Date.now();
        db.ref(`gameState/activeTasks/${instanceId}`).set({ 
            ...t, 
            locked: t.isHero ? true : false, 
            participants: [], 
            drawn: false,
            bannedPlayers: bannedFromThisTask 
        });
        const adminName = myName || 'Tuntematon';
        logEvent(`Admin (${adminName}) valitsi manuaalisen tehtävän: ${t.n}`);
        document.getElementById('manualTaskSelect').value = ""; 
    });
}

function renderEventLog(logData) {
    const container = document.getElementById('adminEventLog');
    if(!container) return;
    container.innerHTML = "";
    const logs = Object.values(logData || {}).reverse().slice(0, 30);
    logs.forEach(l => {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerHTML = `<span class="time">[${l.time}]</span> ${l.msg}`;
        container.appendChild(div);
    });
}

function renderScoreLog(logData) {
    const container = document.getElementById('adminScoreLog');
    if(!container) return;
    container.innerHTML = "";
    const logs = Object.values(logData || {}).reverse().slice(0, 50);
    logs.forEach(l => {
        const div = document.createElement('div');
        div.className = 'log-entry';
        let sign = l.delta > 0 ? '+' : '';
        let color = l.delta >= 0 ? 'var(--success)' : 'var(--danger)';
        div.innerHTML = `<span class="time">[${l.time}]</span> <b>${l.playerName}</b>: <span style="color:${color}; font-weight:bold;">${sign}${l.delta} XP</span> (${l.oldScore} ➔ ${l.newScore})<br><span style="color:var(--muted); font-size:0.85em;">Syy: ${l.reason}</span>`;
        container.appendChild(div);
    });
}

function renderHistory() {
    const container = document.getElementById('taskHistoryList');
    if(!container) return;
    container.innerHTML = taskHistory.length === 0 ? '<p style="font-size:0.7rem; color:var(--muted);">Ei vielä historiaa...</p>' : "";
    taskHistory.forEach(h => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div>
                <span class="task-name" style="display:block;">${h.taskName}</span>
                <span style="font-size:0.65rem; color:var(--success); font-weight:700;">${h.winners.join(', ')}</span>
            </div>
            <span class="task-time">${h.timestamp}</span>
        `;
        container.appendChild(div);
    });
}

// NIMEN PITUUDEN PAKOTUS JS-PUOLELLA (ADMIN TYÖKALU)
function adminAddPlayer() {
    const input = document.getElementById('adminNewPlayerName');
    let n = input.value.trim();
    if(!n) return;
    if(n.length > 15) n = n.substring(0, 15); // JS varmistus pituusrajalle
    
    db.ref('gameState/players').once('value', snap => {
        let p = snap.val() || [];
        if(!p.find(x => x.name === n)) { 
            p.push({ name: n, score: 0, cooldown: 0, isBanned: false }); 
            db.ref('gameState/players').set(p); 
            input.value = ''; 
            const adminName = myName || 'Tuntematon';
            logEvent(`Admin (${adminName}) lisäsi pelaajan: ${n}`);
        } else { alert("Pelaaja on jo listalla!"); }
    });
}

function adjustScore(idx, amt) { 
    db.ref(`gameState/players/${idx}`).transaction(p => {
        if(p) {
            const oldS = p.score || 0;
            p.score = Math.max(0, oldS + amt);
            logScoreChange(p.name, oldS, p.score - oldS, p.score, "GM Manuaalinen muutos");
        }
        return p;
    }).then(() => {
        const adminName = myName || 'Tuntematon';
        logEvent(`Admin (${adminName}) muutti pelaajan ${allPlayers[idx].name} pisteitä: ${amt > 0 ? '+' : ''}${amt} XP`);
    });
}

function removePlayer(idx) { 
    if(confirm("Poista pelaaja?")) { 
        const adminName = myName || 'Tuntematon';
        logEvent(`Admin (${adminName}) poisti pelaajan: ${allPlayers[idx].name}`);
        allPlayers.splice(idx, 1); 
        db.ref('gameState/players').set(allPlayers); 
    } 
}

function setBdayHero(idx) { 
    db.ref('gameState/config/bdayHero').transaction(curr => {
        const newVal = curr === idx ? null : idx;
        const adminName = myName || 'Tuntematon';
        if(newVal !== null) logEvent(`Admin (${adminName}) asetti synttärisankarin: ${allPlayers[newVal].name}`);
        return newVal;
    }); 
}

window.adminToggleCooldown = function(idx) { 
    db.ref('gameState').once('value', snap => {
        let d = snap.val();
        if(!d || !d.players || !d.players[idx]) return;
        
        let p = d.players[idx];
        
        let isCurrentlyBanned = p.cooldown > 0;
        if (d.activeTasks) {
            Object.values(d.activeTasks).forEach(t => {
                if (t.bannedPlayers && t.bannedPlayers.includes(p.name)) isCurrentlyBanned = true;
            });
        }
        
        let newState = isCurrentlyBanned ? 0 : 1;
        
        let updates = {};
        updates[`gameState/players/${idx}/cooldown`] = newState;
        
        if (newState === 0 && d.activeTasks) {
            Object.keys(d.activeTasks).forEach(taskId => {
                let t = d.activeTasks[taskId];
                if (t.bannedPlayers && t.bannedPlayers.includes(p.name)) {
                    let newBanned = t.bannedPlayers.filter(name => name !== p.name);
                    updates[`gameState/activeTasks/${taskId}/bannedPlayers`] = newBanned;
                }
            });
        }
        
        db.ref().update(updates);
    });
}

window.adminToggleBan = function(idx) {
    const newState = !allPlayers[idx].isBanned;
    db.ref(`gameState/players/${idx}/isBanned`).set(newState);
    const adminName = myName || 'Tuntematon';
    logEvent(`Admin (${adminName}) asetti pelikiellon pelaajalle ${allPlayers[idx].name}: ${newState ? 'PÄÄLLÄ' : 'POIS'}`);
};

function updateConfig(key, val) { db.ref(`gameState/config/${key}`).set(val); }
function updateVisConfig(key, val) { db.ref(`gameState/config/visibility/${key}`).set(val); }
window.updateHeroConfig = function(key, val) { db.ref(`gameState/config/heroDraw/${key}`).set(val); };

function updateTaskInLib(idx, field, val) { db.ref(`gameState/tasks/${idx}/${field}`).set(val); }
function removeTask(idx) { if(confirm("Poista tehtävä kirjastosta?")) { taskLibrary.splice(idx, 1); db.ref('gameState/tasks').set(taskLibrary); } }

window.toggleLibraryVisibility = function() {
    const lib = document.getElementById('taskLibraryEditor');
    lib.style.display = lib.style.display === 'none' ? 'block' : 'none';
};

function adminCreateTask() {
    const n = document.getElementById('newTaskName').value;
    const d = document.getElementById('newTaskDesc').value;
    const p = parseInt(document.getElementById('newTaskPoints').value) || 0;
    const m = document.getElementById('newTaskMinus').checked;
    const b = document.getElementById('newTaskBday').checked;
    const hero = document.getElementById('newTaskIsHero').checked; 
    const r = parseInt(document.getElementById('newTaskRecommendedPlayers').value) || 1;
    const k = document.getElementById('newTaskCategory').value;
    
    if(!n || !d) return;
    const newTask = { id: Date.now(), n, d, p, m, b, r, isHero: hero, k: k };
    db.ref('gameState/tasks').transaction(list => { list = list || []; list.push(newTask); return list; });
    
    document.getElementById('newTaskName').value = ''; 
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('newTaskIsHero').checked = false;
    const adminName = myName || 'Tuntematon';
    logEvent(`Admin (${adminName}) loi uuden tehtävän kirjastoon: ${n}`);
}

function renderLeaderboard(showCD, heroId, activeTasksObj = {}) {
    const list = document.getElementById('playerList');
    if(!list) return;
    
    let sortedPlayers = [...allPlayers].sort((a,b) => b.score - a.score);
    const newScoresStr = sortedPlayers.map(p => p.name + p.score).join('|');
    
    if (newScoresStr !== leaderboardScoresStr) {
        let currentRanks = {};
        let currentRank = 1;
        let prevScore = -1;
        
        sortedPlayers.forEach((p, index) => {
            if (p.score !== prevScore) {
                currentRank = index + 1; 
                prevScore = p.score;
            }
            currentRanks[p.name] = currentRank;
        });

        sortedPlayers.forEach(p => {
            if (leaderboardPrevRanks[p.name] !== undefined) {
                if (currentRanks[p.name] < leaderboardPrevRanks[p.name]) leaderboardDirections[p.name] = 'up';
                else if (currentRanks[p.name] > leaderboardPrevRanks[p.name]) leaderboardDirections[p.name] = 'down';
                else leaderboardDirections[p.name] = 'same';
            } else {
                leaderboardDirections[p.name] = 'same';
            }
        });
        
        leaderboardPrevRanks = currentRanks;
        leaderboardScoresStr = newScoresStr;
    }

    list.innerHTML = '';
    sortedPlayers.forEach((p) => {
        const pIdx = allPlayers.findIndex(x => x.name === p.name);
        const isHero = heroId !== null && pIdx === heroId;
        
        let isBanned = p.cooldown > 0;
        Object.values(activeTasksObj).forEach(t => {
            if (t.bannedPlayers && t.bannedPlayers.includes(p.name)) isBanned = true;
        });
        
        const cdText = (showCD && isBanned) ? ' <small style="color:var(--danger); margin-left:5px;">[JÄÄHY]</small>' : '';
        const banText = p.isBanned ? ' <small style="color:var(--danger); margin-left:5px;">[⛔]</small>' : '';
        
        let dirIcon = '';
        if (leaderboardDirections[p.name] === 'up') dirIcon = ' <span style="color:var(--success); font-size:0.8rem; font-weight:900;">▲</span>';
        else if (leaderboardDirections[p.name] === 'down') dirIcon = ' <span style="color:var(--danger); font-size:0.8rem; font-weight:900;">▼</span>';

        const rankStr = `<span style="color:var(--muted); font-size:0.8rem; margin-right:12px; font-weight:900;">${leaderboardPrevRanks[p.name]}.</span>`;
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''} ${isHero ? 'is-hero' : ''}`;
        div.innerHTML = `<div style="display:flex; align-items:center;">${rankStr}<span>${isHero?'🎂 ':''}${p.name}${cdText}${banText}${dirIcon}</span></div><span class="xp-badge">${p.score} XP</span>`;
        list.appendChild(div);
    });
}

function renderAdminPlayerList(activeTasksObj = {}) {
    const list = document.getElementById('adminPlayerList');
    if(!list) return; list.innerHTML = "";
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row'; div.style.padding = '8px';
        
        const isHero = i === currentHeroId; 
        const heroBg = isHero ? 'var(--hero-gold)' : 'transparent';
        const heroColor = isHero ? '#000' : 'inherit';
        const heroBorder = isHero ? 'var(--hero-gold)' : 'rgba(255,255,255,0.2)';
        const banStyle = p.isBanned ? 'background:var(--danger); color:#fff; border-color:var(--danger);' : '';
        
        let isCurrentlyBanned = p.cooldown > 0;
        Object.values(activeTasksObj).forEach(t => {
            if (t.bannedPlayers && t.bannedPlayers.includes(p.name)) isCurrentlyBanned = true;
        });

        div.innerHTML = `
            <div style="width:100%">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; font-weight:bold;">${p.name} (${p.score})</span>
                    <div style="display:flex; gap:4px;">
                        <button class="btn" style="width:32px; padding:5px; margin:0; background:${heroBg}; color:${heroColor}; border:1px solid ${heroBorder};" onclick="setBdayHero(${i})" title="Synttärisankari">🎂</button>
                        <button class="btn ${p.isBanned ? 'btn-danger' : 'btn-secondary'}" style="width:auto; font-size:0.5rem; padding:5px; margin:0; ${banStyle}" onclick="adminToggleBan(${i})" title="Pelikielto">⛔</button>
                        <button class="btn ${isCurrentlyBanned ? 'btn-success' : 'btn-secondary'}" style="width:auto; font-size:0.5rem; padding:5px; margin:0;" onclick="adminToggleCooldown(${i})" title="Jäähy">${isCurrentlyBanned ? 'VAP' : 'J'}</button>
                        <button class="btn btn-secondary" style="width:28px; padding:5px; margin:0;" onclick="adjustScore(${i}, 1)">+</button>
                        <button class="btn btn-secondary" style="width:28px; padding:5px; margin:0;" onclick="adjustScore(${i}, -1)">-</button>
                        <button class="btn btn-danger" style="width:28px; padding:5px; margin:0;" onclick="removePlayer(${i})">X</button>
                    </div>
                </div>
            </div>`;
        list.appendChild(div);
    });
}

function renderTaskLibrary() {
    const lib = document.getElementById('taskLibraryEditor');
    if(!lib) return; lib.innerHTML = '';
    taskLibrary.forEach((t, i) => {
        const div = document.createElement('div');
        div.className = 'admin-settings-list'; 
        div.style.marginBottom = "10px";
        div.innerHTML = `
            <input type="text" value="${t.n}" placeholder="Nimi" onchange="updateTaskInLib(${i}, 'n', this.value)">
            <textarea placeholder="Kuvaus" onchange="updateTaskInLib(${i}, 'd', this.value)">${t.d}</textarea>
            
            <div style="display:flex; gap:10px; margin-top:5px;">
                <div style="flex:1;">
                    <label style="font-size:0.6rem; color:var(--muted);">XP:</label>
                    <input type="number" value="${t.p}" onchange="updateTaskInLib(${i}, 'p', parseInt(this.value))">
                </div>
                <div style="flex:1;">
                    <label style="font-size:0.6rem; color:var(--muted);">Suositus:</label>
                    <input type="number" value="${t.r||1}" onchange="updateTaskInLib(${i}, 'r', parseInt(this.value))">
                </div>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:5px; margin-bottom: 10px;">
                <label style="font-size:0.7rem; display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" style="width:16px;height:16px;" ${t.m?'checked':''} onchange="updateTaskInLib(${i}, 'm', this.checked)"> Miinus
                </label>
                <label style="font-size:0.7rem; color:var(--gm-accent); display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" style="width:16px;height:16px;" ${t.b?'checked':''} onchange="updateTaskInLib(${i}, 'b', this.checked)"> Sankari XP
                </label>
                <label style="font-size:0.7rem; color:var(--hero-gold); display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" style="width:16px;height:16px;" ${t.isHero?'checked':''} onchange="updateTaskInLib(${i}, 'isHero', this.checked)"> ✨ Hero
                </label>
            </div>
            
            <button class="btn btn-danger" style="width:100%; padding:8px; margin:0;" onclick="removeTask(${i})">POISTA TEHTÄVÄ</button>
        `;
        lib.appendChild(div);
    });
}

function updateManualTaskSelect() {
    const sel = document.getElementById('manualTaskSelect');
    if (!sel) return; sel.innerHTML = '<option value="">VALITSE TEHTÄVÄ...</option>';
    taskLibrary.forEach((t, i) => { sel.innerHTML += `<option value="${i}">${t.n}</option>`; });
}

function updateIdentityUI() { document.getElementById('identityCard').style.display = myName ? 'none' : 'block'; document.getElementById('idTag').innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; }

function toggleAdminPanel() { 
    const p = document.getElementById('adminPanel'); const isOpening = p.style.display === 'none'; p.style.display = isOpening ? 'block' : 'none'; 
    if(isOpening) { renderAdminPlayerList(lastKnownTasks); renderTaskLibrary(); }
}
