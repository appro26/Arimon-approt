// ============================================
// RPG XP QUEST - SCRIPT.JS (OSA 1/3)
// Perusrakenne + LocalStorage + Pelaajan toiminnot
// ============================================

const STORAGE_KEY = 'rpgXpQuest_gameData';
const PLAYER_KEY = 'rpgXpQuest_playerId';

// GLOBAALIT MUUTTUJAT
let gameData = {
    players: {},
    currentTask: null,
    taskHistory: [],
    rewards: [
        { id: 1, name: '☕ Kahvitauko', cost: 100 },
        { id: 2, name: '🍕 Pizzalounaspäivä', cost: 300 },
        { id: 3, name: '🎮 Pelipäivä', cost: 500 }
    ],
    nextPlayerId: 1,
    nextTaskId: 1,
    nextRewardId: 4
};

let currentPlayerId = null;
let currentRole = 'player';
let timerInterval = null;

// ============================================
// LOCALSTORAGE HALLINTA
// ============================================

function saveGame() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
        console.log('✅ Peli tallennettu');
    } catch (e) {
        console.error('❌ Tallennusvirhe:', e);
    }
}

function loadGame() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            gameData = JSON.parse(saved);
            console.log('✅ Peli ladattu');
        }
    } catch (e) {
        console.error('❌ Latausvirhe:', e);
    }
}

function loadPlayerId() {
    const saved = localStorage.getItem(PLAYER_KEY);
    if (saved) {
        currentPlayerId = saved;
        return true;
    }
    return false;
}

function savePlayerId(id) {
    localStorage.setItem(PLAYER_KEY, id);
    currentPlayerId = id;
}

// ============================================
// PELAAJAN REKISTERÖINTI
// ============================================

function registerPlayer(name) {
    if (!name || name.trim().length < 2) {
        alert('❌ Anna vähintään 2 merkin mittainen nimi');
        return false;
    }

    const playerId = 'p' + gameData.nextPlayerId++;
    gameData.players[playerId] = {
        id: playerId,
        name: name.trim(),
        xp: 0,
        tasksCompleted: 0,
        heroTasksCompleted: 0,
        joinedAt: Date.now()
    };

    savePlayerId(playerId);
    saveGame();
    console.log('✅ Pelaaja rekisteröity:', name);
    return true;
}

// ============================================
// PELAAJAN XP-PÄIVITYS
// ============================================

function addXP(playerId, amount, reason = '') {
    if (!gameData.players[playerId]) return;

    gameData.players[playerId].xp += amount;
    saveGame();

    // Näytä XP-popup
    showXPPopup(amount);

    console.log(`✅ +${amount} XP pelaajalle ${gameData.players[playerId].name} (${reason})`);
}

function showXPPopup(amount) {
    const popup = document.getElementById('xpPopup');
    if (!popup) return;

    popup.textContent = `+${amount} XP`;
    popup.classList.add('show');

    setTimeout(() => {
        popup.classList.remove('show');
    }, 2000);
}

// ============================================
// TEHTÄVÄN SUORITUS (Pelaajan näkökulmasta)
// ============================================

function completeTask() {
    if (!gameData.currentTask || !currentPlayerId) return;

    const task = gameData.currentTask;
    const player = gameData.players[currentPlayerId];

    // Tarkista onko pelaaja osallistuja
    if (!task.participants.includes(currentPlayerId)) {
        alert('❌ Et ole tämän tehtävän osallistuja');
        return;
    }

    // Tarkista onko jo suorittanut
    if (task.completed.includes(currentPlayerId)) {
        alert('✅ Olet jo suorittanut tämän tehtävän');
        return;
    }

    // Merkitse suoritetuksi
    task.completed.push(currentPlayerId);
    player.tasksCompleted++;

    // Lisää XP
    addXP(currentPlayerId, task.xpReward, 'Tehtävän suoritus');

    // Tarkista onko kaikki suorittaneet
    if (task.completed.length === task.participants.length) {
        endTask();
    } else {
        saveGame();
        updateUI();
    }
}

// ============================================
// UI PÄIVITYKSET (Pelaajan näkymä)
// ============================================

function updatePlayerUI() {
    const player = gameData.players[currentPlayerId];
    if (!player) return;

    // Päivitä Leaderboard
    updateLeaderboard();

    // Päivitä Historia
    updateHistory();

    // Päivitä Palkintokauppa
    updateRewardShop();

    // Päivitä Aktiivinen tehtävä
    updateActiveTaskUI();
}

function updateLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    const sorted = Object.values(gameData.players).sort((a, b) => b.xp - a.xp);

    list.innerHTML = sorted.map((p, index) => `
        <div class="leaderboard-item ${p.id === currentPlayerId ? 'highlight' : ''}">
            <span class="rank">#${index + 1}</span>
            <span class="player-name">${p.name}</span>
            <span class="xp-badge">${p.xp} XP</span>
        </div>
    `).join('');
}

function updateHistory() {
    const list = document.getElementById('taskHistoryList');
    if (!list) return;

    if (gameData.taskHistory.length === 0) {
        list.innerHTML = '<p style="color: var(--muted); text-align: center;">Ei vielä historiaa</p>';
        return;
    }

    list.innerHTML = gameData.taskHistory.slice(-10).reverse().map(task => `
        <div class="history-item">
            <div class="history-title">${task.name}</div>
            <div class="history-participants">
                Osallistujat: ${task.participants.map(id => gameData.players[id]?.name || 'Tuntematon').join(', ')}
            </div>
            <div class="history-xp">+${task.xpReward} XP</div>
        </div>
    `).join('');
}

function updateRewardShop() {
    const list = document.getElementById('rewardShopList');
    const xpDisplay = document.getElementById('playerCurrentXP');
    
    if (!list || !currentPlayerId) return;

    const player = gameData.players[currentPlayerId];
    if (xpDisplay) xpDisplay.textContent = `${player.xp} XP`;

    list.innerHTML = gameData.rewards.map(reward => {
        const canAfford = player.xp >= reward.cost;
        return `
            <div class="reward-item ${canAfford ? '' : 'disabled'}">
                <div class="reward-name">${reward.name}</div>
                <div class="reward-cost">${reward.cost} XP</div>
                ${canAfford ? `<button class="btn btn-small btn-primary" onclick="claimReward(${reward.id})">🎁 Lunasta</button>` : '<span style="color: var(--muted); font-size: 0.75rem;">Ei tarpeeksi XP</span>'}
            </div>
        `;
    }).join('');
}

function claimReward(rewardId) {
    const reward = gameData.rewards.find(r => r.id === rewardId);
    const player = gameData.players[currentPlayerId];

    if (!reward || !player) return;

    if (player.xp < reward.cost) {
        alert('❌ Sinulla ei ole tarpeeksi XP:tä');
        return;
    }

    if (confirm(`Haluatko lunastaa "${reward.name}" hintaan ${reward.cost} XP?`)) {
        player.xp -= reward.cost;
        saveGame();
        alert(`✅ Lunastanut: ${reward.name}! Kerro GM:lle.`);
        updateUI();
    }
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    
    if (loadPlayerId() && gameData.players[currentPlayerId]) {
        showPlayerView();
    } else {
        showRegisterView();
    }

    updateUI();
});
// ============================================
// RPG XP QUEST - SCRIPT.JS (OSA 2/3)
// GM-toiminnot + Tehtävänhallinta
// ============================================

// ============================================
// NÄKYMIEN VAIHTO
// ============================================

function showRegisterView() {
    hideAllViews();
    document.getElementById('registerView').classList.add('active');
}

function showPlayerView() {
    hideAllViews();
    currentRole = 'player';
    document.getElementById('playerView').classList.add('active');
    document.getElementById('playerNameDisplay').textContent = gameData.players[currentPlayerId]?.name || '';
    updatePlayerUI();
}

function showGMView() {
    hideAllViews();
    currentRole = 'gm';
    document.getElementById('gmView').classList.add('active');
    updateGMUI();
}

function hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

function switchToGM() {
    const password = prompt('🔐 Syötä GM-salasana:');
    if (password === 'gm123') {
        showGMView();
    } else {
        alert('❌ Väärä salasana');
    }
}

function switchToPlayer() {
    if (currentPlayerId && gameData.players[currentPlayerId]) {
        showPlayerView();
    } else {
        showRegisterView();
    }
}

// ============================================
// GM: TEHTÄVÄN LUONTI
// ============================================

function createTask() {
    const nameInput = document.getElementById('gmTaskName');
    const typeSelect = document.getElementById('gmTaskType');
    const xpInput = document.getElementById('gmTaskXP');
    const durationInput = document.getElementById('gmTaskDuration');

    const name = nameInput.value.trim();
    const type = typeSelect.value;
    const xp = parseInt(xpInput.value);
    const duration = parseInt(durationInput.value);

    if (!name || xp < 1 || duration < 1) {
        alert('❌ Täytä kaikki kentät oikein');
        return;
    }

    if (gameData.currentTask) {
        alert('❌ Tehtävä on jo käynnissä. Lopeta ensin nykyinen.');
        return;
    }

    const taskId = 't' + gameData.nextTaskId++;
    
    gameData.currentTask = {
        id: taskId,
        name: name,
        type: type,
        xpReward: xp,
        duration: duration,
        startTime: Date.now(),
        endTime: Date.now() + (duration * 60 * 1000),
        participants: [],
        completed: [],
        isHeroTask: type === 'hero'
    };

    // Tyhjennä kentät
    nameInput.value = '';
    xpInput.value = '50';
    durationInput.value = '30';

    saveGame();
    startTaskTimer();
    updateUI();

    alert(`✅ Tehtävä "${name}" luotu!`);
}

function startTaskTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (!gameData.currentTask) {
            clearInterval(timerInterval);
            return;
        }

        const remaining = gameData.currentTask.endTime - Date.now();

        if (remaining <= 0) {
            clearInterval(timerInterval);
            autoEndTask();
        } else {
            updateTaskTimer(remaining);
        }
    }, 1000);
}

function updateTaskTimer(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    const timerGM = document.getElementById('gmTaskTimer');
    const timerPlayer = document.getElementById('taskTimer');

    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timerGM) timerGM.textContent = timeString;
    if (timerPlayer) timerPlayer.textContent = timeString;
}

function autoEndTask() {
    if (!gameData.currentTask) return;

    // Epäonnistuneet pelaajat
    const failed = gameData.currentTask.participants.filter(
        pid => !gameData.currentTask.completed.includes(pid)
    );

    if (failed.length > 0) {
        alert(`⏰ Aika loppui! Epäonnistuneet: ${failed.map(id => gameData.players[id]?.name).join(', ')}`);
    }

    endTask();
}

function endTask() {
    if (!gameData.currentTask) return;

    const task = gameData.currentTask;

    // Hero-tehtävä: Tarkista että kaikki suorittivat
    if (task.isHeroTask) {
        const allCompleted = task.participants.every(pid => task.completed.includes(pid));
        
        if (allCompleted) {
            // Bonukset kaikille
            task.participants.forEach(pid => {
                addXP(pid, 50, 'Hero-tehtävä bonusXP');
                gameData.players[pid].heroTasksCompleted++;
            });
            alert('🏆 HERO-TEHTÄVÄ SUORITETTU! +50 XP bonusta kaikille!');
        } else {
            alert('❌ Hero-tehtävä epäonnistui - kaikki eivät suorittaneet');
        }
    }

    // Siirrä historiaan
    gameData.taskHistory.push({
        ...task,
        completedAt: Date.now()
    });

    gameData.currentTask = null;
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    saveGame();
    updateUI();
}

// ============================================
// GM: PELAAJIEN HALLINTA
// ============================================

function addParticipant() {
    if (!gameData.currentTask) {
        alert('❌ Ei aktiivista tehtävää');
        return;
    }

    const select = document.getElementById('gmPlayerSelect');
    const playerId = select.value;

    if (!playerId) {
        alert('❌ Valitse pelaaja');
        return;
    }

    if (gameData.currentTask.participants.includes(playerId)) {
        alert('❌ Pelaaja on jo lisätty');
        return;
    }

    gameData.currentTask.participants.push(playerId);
    saveGame();
    updateUI();
}

function removeParticipant(playerId) {
    if (!gameData.currentTask) return;

    const index = gameData.currentTask.participants.indexOf(playerId);
    if (index > -1) {
        gameData.currentTask.participants.splice(index, 1);
        
        // Poista myös suoritettujen listasta jos siellä
        const completedIndex = gameData.currentTask.completed.indexOf(playerId);
        if (completedIndex > -1) {
            gameData.currentTask.completed.splice(completedIndex, 1);
        }

        saveGame();
        updateUI();
    }
}

function manualAddXP() {
    const select = document.getElementById('gmXPPlayerSelect');
    const input = document.getElementById('gmXPAmount');

    const playerId = select.value;
    const amount = parseInt(input.value);

    if (!playerId || amount < 1) {
        alert('❌ Valitse pelaaja ja syötä XP-määrä');
        return;
    }

    addXP(playerId, amount, 'GM manuaalinen lisäys');
    input.value = '10';
    updateUI();
}

// ============================================
// GM: UI PÄIVITYKSET
// ============================================

function updateGMUI() {
    updateGMPlayerList();
    updateGMActiveTask();
    updateGMStats();
}

function updateGMPlayerList() {
    const participantSelect = document.getElementById('gmPlayerSelect');
    const xpSelect = document.getElementById('gmXPPlayerSelect');

    if (!participantSelect || !xpSelect) return;

    const playerOptions = Object.values(gameData.players).map(p => 
        `<option value="${p.id}">${p.name} (${p.xp} XP)</option>`
    ).join('');

    participantSelect.innerHTML = '<option value="">-- Valitse pelaaja --</option>' + playerOptions;
    xpSelect.innerHTML = '<option value="">-- Valitse pelaaja --</option>' + playerOptions;
}

function updateGMActiveTask() {
    const container = document.getElementById('gmActiveTaskContainer');
    if (!container) return;

    if (!gameData.currentTask) {
        container.innerHTML = '<p style="color: var(--muted); text-align: center;">Ei aktiivista tehtävää</p>';
        return;
    }

    const task = gameData.currentTask;
    const completedCount = task.completed.length;
    const totalCount = task.participants.length;

    container.innerHTML = `
        <div class="task-card ${task.isHeroTask ? 'hero' : ''}">
            <div class="task-header">
                <h3>${task.name}</h3>
                ${task.isHeroTask ? '<span class="hero-badge">🏆 HERO</span>' : ''}
            </div>
            <div class="task-info">
                <span>⭐ ${task.xpReward} XP</span>
                <span id="gmTaskTimer">--:--</span>
            </div>
            <div class="task-progress">
                <div>Suoritettu: ${completedCount}/${totalCount}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${totalCount > 0 ? (completedCount/totalCount*100) : 0}%"></div>
                </div>
            </div>
            <div class="task-participants">
                <strong>Osallistujat:</strong>
                ${task.participants.map(pid => {
                    const player = gameData.players[pid];
                    const isDone = task.completed.includes(pid);
                    return `
                        <div class="participant-item">
                            <span>${player?.name || 'Tuntematon'} ${isDone ? '✅' : '⏳'}</span>
                            <button class="btn btn-small btn-danger" onclick="removeParticipant('${pid}')">Poista</button>
                        </div>
                    `;
                }).join('')}
            </div>
            <button class="btn btn-danger" onclick="endTask()" style="margin-top: 1rem;">🛑 Lopeta tehtävä</button>
        </div>
    `;

    if (task.endTime > Date.now()) {
        startTaskTimer();
    }
}

function updateGMStats() {
    const container = document.getElementById('gmStatsContainer');
    if (!container) return;

    const totalPlayers = Object.keys(gameData.players).length;
    const totalTasks = gameData.taskHistory.length;
    const totalXPGiven = Object.values(gameData.players).reduce((sum, p) => sum + p.xp, 0);

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalPlayers}</div>
            <div class="stat-label">Pelaajia</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalTasks}</div>
            <div class="stat-label">Tehtäviä suoritettu</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalXPGiven}</div>
            <div class="stat-label">XP jaettu</div>
        </div>
    `;
}
// ============================================
// RPG XP QUEST - SCRIPT.JS (OSA 3/3)
// Aktiivinen tehtävä UI + Event Listenerit + Yleiset funktiot
// ============================================

// ============================================
// AKTIIVINEN TEHTÄVÄ (Pelaajan näkymä)
// ============================================

function updateActiveTaskUI() {
    const container = document.getElementById('activeTaskContainer');
    if (!container) return;

    if (!gameData.currentTask) {
        container.innerHTML = '<p style="color: var(--muted); text-align: center;">Ei aktiivista tehtävää</p>';
        return;
    }

    const task = gameData.currentTask;
    const isParticipant = task.participants.includes(currentPlayerId);
    const hasCompleted = task.completed.includes(currentPlayerId);

    if (!isParticipant) {
        container.innerHTML = '<p style="color: var(--muted); text-align: center;">Et ole tämän tehtävän osallistuja</p>';
        return;
    }

    container.innerHTML = `
        <div class="task-card ${task.isHeroTask ? 'hero' : ''}">
            <div class="task-header">
                <h3>${task.name}</h3>
                ${task.isHeroTask ? '<span class="hero-badge">🏆 HERO</span>' : ''}
            </div>
            <div class="task-info">
                <span>⭐ ${task.xpReward} XP</span>
                <span id="taskTimer">--:--</span>
            </div>
            ${hasCompleted ? 
                '<div class="task-completed">✅ Suoritettu!</div>' : 
                '<button class="btn btn-primary btn-large" onclick="completeTask()">✅ Merkitse suoritetuksi</button>'
            }
        </div>
    `;

    if (task.endTime > Date.now()) {
        startTaskTimer();
    }
}

// ============================================
// YLEINEN UI-PÄIVITYS
// ============================================

function updateUI() {
    if (currentRole === 'player') {
        updatePlayerUI();
    } else if (currentRole === 'gm') {
        updateGMUI();
    }
}

// ============================================
// EVENT LISTENERIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Rekisteröinti
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('playerNameInput');
            if (registerPlayer(nameInput.value)) {
                showPlayerView();
            }
        });
    }

    // Enter-näppäin rekisteröinnissä
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (registerPlayer(nameInput.value)) {
                    showPlayerView();
                }
            }
        });
    }

    // GM-näppäimet
    const createTaskBtn = document.getElementById('createTaskBtn');
    if (createTaskBtn) {
        createTaskBtn.addEventListener('click', createTask);
    }

    const addParticipantBtn = document.getElementById('addParticipantBtn');
    if (addParticipantBtn) {
        addParticipantBtn.addEventListener('click', addParticipant);
    }

    const addXPBtn = document.getElementById('manualAddXPBtn');
    if (addXPBtn) {
        addXPBtn.addEventListener('click', manualAddXP);
    }

    // Enter-näppäin XP-kentässä
    const xpInput = document.getElementById('gmXPAmount');
    if (xpInput) {
        xpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                manualAddXP();
            }
        });
    }

    // Navigaatio
    const toGMBtn = document.getElementById('toGMBtn');
    if (toGMBtn) {
        toGMBtn.addEventListener('click', switchToGM);
    }

    const toPlayerBtn = document.getElementById('toPlayerBtn');
    if (toPlayerBtn) {
        toPlayerBtn.addEventListener('click', switchToPlayer);
    }

    // Uloskirjautuminen
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Datan nollaus
    const resetBtn = document.getElementById('resetDataBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllData);
    }
});

// ============================================
// YLEISET TOIMINNOT
// ============================================

function logout() {
    if (confirm('Haluatko varmasti kirjautua ulos?')) {
        localStorage.removeItem(PLAYER_KEY);
        currentPlayerId = null;
        showRegisterView();
    }
}

function resetAllData() {
    const password = prompt('⚠️ VAROITUS: Tämä poistaa KAIKEN datan!\n\nSyötä GM-salasana jatkaaksesi:');
    
    if (password !== 'gm123') {
        alert('❌ Väärä salasana');
        return;
    }

    if (confirm('Oletko TÄYSIN VARMA? Tämä ei ole peruutettavissa!')) {
        localStorage.clear();
        
        gameData = {
            players: {},
            currentTask: null,
            taskHistory: [],
            rewards: [
                { id: 1, name: '☕ Kahvitauko', cost: 100 },
                { id: 2, name: '🍕 Pizzalounaspäivä', cost: 300 },
                { id: 3, name: '🎮 Pelipäivä', cost: 500 }
            ],
            nextPlayerId: 1,
            nextTaskId: 1,
            nextRewardId: 4
        };

        currentPlayerId = null;
        
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        saveGame();
        alert('✅ Kaikki data poistettu!');
        location.reload();
    }
}

// ============================================
// DEBUGGAUS (vain konsoliin)
// ============================================

function debugInfo() {
    console.log('=== RPG XP QUEST DEBUG ===');
    console.log('Pelaajat:', gameData.players);
    console.log('Nykyinen tehtävä:', gameData.currentTask);
    console.log('Historia:', gameData.taskHistory);
    console.log('Nykyinen pelaaja:', currentPlayerId);
    console.log('Rooli:', currentRole);
}

// Tee debug-funktio saataville konsolissa
window.debugInfo = debugInfo;

// ============================================
// VALMIS!
// ============================================
