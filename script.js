window.allCards = window.allCards || [];
window.holeRules = window.holeRules || [];

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, push, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = { databaseURL: "https://fribamestari-default-rtdb.europe-west1.firebasedatabase.app/" };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const el = id => document.getElementById(id);

let myName = localStorage.getItem('friba_name') || null;
let currentRole = 'player';
let allPlayers = [];
let activeHole = null;
let currentCourse = null;
let currentHoleIndex = 1;
let lastPlayedCardTimestamp = Date.now();
window.gameHistory = []; 
window.gameDecks = { normal: [], premium: [], rules: [] };

window.gameSettings = { shopEnabled: true, handLimitEnabled: true, handLimit: 5, ptsWin: 3, ptsTask: 2, ptsLose: 0, ptsPassive: 2, costMinor: 2, costMajor: 5, costBuff: 3, rewardMajor: 5, sellReward: 1 };
window.pendingShopPurchase = null;

const postItColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff', '#a7f3d0'];
const getRandomColor = () => postItColors[Math.floor(Math.random() * postItColors.length)];

const penColors = [
    { c1: '#0284c7', c2: '#38bdf8' }, { c1: '#dc2626', c2: '#f87171' }, { c1: '#16a34a', c2: '#4ade80' },
    { c1: '#d97706', c2: '#fbbf24' }, { c1: '#9333ea', c2: '#c084fc' }, { c1: '#db2777', c2: '#f472b6' }, { c1: '#475569', c2: '#94a3b8' }
];
const getRandomPen = () => penColors[Math.floor(Math.random() * penColors.length)];

const pseudoRandom = (seed) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };

const insults = [
    "V*ttu mikä heitto, ootko sä koskaan edes pitänyt kiekkoa kädessä?",
    "P*rkele, mummonikin puttaa paremmin, ja se on ollut kuolleena 10 vuotta.",
    "S**tanan sirkkeli, puut tykkää susta enemmän ku sun omat vanhemmat.",
    "Ei h*lvetti, japa Jeesus itkee ton sun tekniikan takia.",
    "P*ska veto. Sun draivi on lyhyempi ku mun kärsivällisyys.",
    "V*tun hieno lay-up! Ai se olikin sun maksimidraivi?",
    "Mene s**tana takas rangelle, tää on noloa meille kaikille.",
    "P*rkeleen rystykääntö, kiekko lensi enemmän taakse ku eteen.",
    "Miten sä v*ttu onnistut missaamaan 2 metristä?",
    "H*lvetin hieno puuosuma! Tähtäsitkö sä siihen vai ootko vaan p*ska?"
];

const doodleSVGs = [
    "M 30 70 Q 20 70 20 60 Q 30 20 60 20 Q 80 20 80 50 Q 80 70 70 70 Z M 25 50 L 15 40 M 35 35 L 25 20 M 50 25 L 50 10 M 65 30 L 75 15 M 75 45 L 90 40", 
    "M 30 70 L 30 40 L 20 20 L 40 30 L 60 30 L 80 20 L 70 40 L 70 70 Z M 20 50 L 10 45 M 20 55 L 10 55 M 80 50 L 90 45 M 80 55 L 90 55",
    "M 25 70 C 10 70 10 30 35 30 C 35 20 45 20 50 30 C 55 20 65 20 65 30 C 90 30 90 70 75 70 Z",
    "M 50 70 C 20 70 30 40 50 30 C 70 40 80 70 50 70 M 50 30 L 45 20 L 50 25 L 55 20 Z"
];

// ==============================================
// PAKKA-LOGIIKKA (SHUFFLE & DRAW)
// ==============================================
window.drawFromDeck = function(type, count) {
    let drawn = [];
    let deck = window.gameDecks[type] || [];
    let pool = [];
    
    if(type === 'normal') pool = window.allCards.filter(c => c.tier === 'normal').map(c => c.id);
    if(type === 'premium') pool = window.allCards.filter(c => c.tier === 'premium').map(c => c.id);
    if(type === 'rules') pool = window.holeRules.map((_, i) => i);

    for(let i=0; i<count; i++) {
        if(deck.length === 0) deck = [...pool].sort(() => 0.5 - Math.random());
        drawn.push(deck.pop());
    }
    window.gameDecks[type] = deck; 
    return drawn;
};

// ==============================================
// VAPAA KAMERA & OPTIMOITU KESKITYS
// ==============================================
window.zoomToHole = function(hIndex) {
    if(!currentCourse || !currentCourse.pars) return;
    let totalHoles = currentCourse.pars.length;
    let cols = Math.min(9, totalHoles);
    let col = (hIndex - 1) % cols;
    let row = Math.floor((hIndex - 1) / cols);
    
    let cellX = 120 + col * 460; 
    let cellY = 120 + row * 1010; 
    
    // Keskittää sarakkeen (380px) täydellisesti näyttöön ilman reuna-clippausta
    let targetX = (window.innerWidth - 380) / 2 - cellX; 
    let targetY = 60 - cellY; 
    
    window.animateCameraTo(targetX, targetY, 1, 400);
};

window.zoomToCurrentHole = function() { window.zoomToHole(currentHoleIndex); };

window.showZoomModal = function(html) {
    html = html.replace(/transform:\s*rotate\([^)]+\);?/g, 'transform: none;');
    el('zoomModalContent').innerHTML = html;
    let scaleVal = Math.min(1.2, (window.innerWidth * 0.95) / 300);
    el('zoomModalContent').style.transform = `scale(${scaleVal})`;
    el('zoomModalContent').style.transformOrigin = `center center`;
    window.showModalSafe('zoomModal');
};

// ==============================================
// SWIPE TO CLOSE (SUOJATTU VALIKKOALUE)
// ==============================================
let swipeStartX = 0;
let swipeStartY = 0;
let isSwipeHandle = false;

window.addEventListener('touchstart', e => {
    if (e.target.closest('.binder-swipe-handle') || 
        e.target.closest('.fullscreen-modal-header') || 
        e.target.closest('.shop-tabs') ||
        e.target.tagName.toLowerCase() === 'h1' ||
        e.target.closest('.close-modal-btn')) {
        isSwipeHandle = true;
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
    } else {
        isSwipeHandle = false;
    }
}, {passive:true});

window.addEventListener('touchend', e => {
    if (isSwipeHandle && swipeStartY > 0) {
        let endX = e.changedTouches[0].clientX;
        let endY = e.changedTouches[0].clientY;
        let diffY = endY - swipeStartY;
        let diffX = Math.abs(endX - swipeStartX);
        
        if (diffY > 100 && diffY > diffX * 2) {
            if(el('shopModal') && el('shopModal').style.display !== 'none') window.closeShopModal();
            if(el('settingsModal') && el('settingsModal').style.display !== 'none') el('settingsModal').style.display='none';
            if(el('rulesModal') && el('rulesModal').style.display !== 'none') el('rulesModal').style.display='none';
            if(el('cardLibraryModal') && el('cardLibraryModal').style.display !== 'none') el('cardLibraryModal').style.display='none';
            if(el('createCardModal') && el('createCardModal').style.display !== 'none') el('createCardModal').style.display='none';
        }
        swipeStartY = 0;
        isSwipeHandle = false;
    }
}, {passive:true});

// ==============================================
// KORTTIEN APUFUNKTIOT & TARKISTUKSET
// ==============================================
window.getCardPlayCost = function(cId) {
    if (cId.startsWith('minor_')) return window.gameSettings.costMinor !== undefined ? window.gameSettings.costMinor : 2;
    if (cId.startsWith('major_')) return window.gameSettings.costMajor !== undefined ? window.gameSettings.costMajor : 5;
    if (cId.startsWith('buff_')) return window.gameSettings.costBuff !== undefined ? window.gameSettings.costBuff : 3;
    if (cId.startsWith('custom_')) {
        let cDef = window.allCards.find(c => c.id === cId);
        if(cDef && cDef.customType === 'minor_sabotage') return window.gameSettings.costMinor || 2;
        if(cDef && cDef.customType === 'major_sabotage') return window.gameSettings.costMajor || 5;
        if(cDef && cDef.customType === 'buff') return window.gameSettings.costBuff || 3;
    }
    return 0; 
};

window.getCardSortWeight = function(cId) {
    let cDef = window.allCards.find(c => c.id === cId);
    if(!cDef) return 5;
    if(cDef.tier === 'premium') return 1;
    if(cDef.type === 'buff') return 2;
    if(cId.startsWith('major_') || cDef.customType === 'major_sabotage') return 3;
    if(cId.startsWith('minor_') || cDef.customType === 'minor_sabotage') return 4;
    return 5;
};

window.getCardDesc = function(cDef, cId) {
    let desc = cDef.d;
    if ((cId && cId.startsWith('major_')) || cDef.customType === 'major_sabotage') {
        let diff = cDef.diff || 1;
        let rew = diff === 3 ? 8 : (diff === 2 ? 5 : 3);
        desc += `<br><br><b style="color:var(--warning);">SELÄTYSPALKKIO:</b> Jos suorittaja pelaa tuloksen PAR tai alle, hän tienaa ${rew} P!`;
    }
    return desc;
};

// ==============================================
// KORTTIEN PELUUN LIITTYVÄT NÄKYMÄT
// ==============================================
window.openTargetModal = function(cardId) {
    const cardDef = window.allCards.find(c => c && c.id === cardId);
    if (!cardDef) return;
    
    let cost = window.getCardPlayCost(cardId);
    const me = (allPlayers || []).find(p => p && p.name === myName);
    if (cost > 0 && (!me || me.score < cost)) {
        alert(`Ei riittävästi pelirahaa! Tarvitset ${cost} P pelataksesi tämän kortin.`);
        return;
    }

    let playedMinors = 0;
    let playedMajors = 0;
    if (activeHole && activeHole.playedCards) {
        Object.values(activeHole.playedCards).forEach(pc => {
            if (!pc) return;
            let pDef = window.allCards.find(c => c.id === pc.cardId);
            if ((pc.cardId.startsWith('minor_') || (pDef && pDef.customType === 'minor_sabotage')) && pc.type === 'sabotage') playedMinors++;
            if ((pc.cardId.startsWith('major_') || (pDef && pDef.customType === 'major_sabotage')) && pc.type === 'sabotage') playedMajors++;
        });
    }

    let isPlayingMinor = cardDef.id.startsWith('minor_') || cardDef.customType === 'minor_sabotage';
    let isPlayingMajor = cardDef.id.startsWith('major_') || cardDef.customType === 'major_sabotage';

    if (isPlayingMinor && playedMinors >= 2) {
        alert("⚠️ Väylän korttiraja täynnä! Väylällä on jo pelattu maksimimäärä (2) Pieniä Sabotaaseja.");
        return;
    }
    if (isPlayingMajor && playedMajors >= 1) {
        alert("⚠️ Väylän korttiraja täynnä! Väylällä on jo pelattu maksimimäärä (1) Iso Sabotaasi.");
        return;
    }

    window.pendingCardPlay = { id: cardId, def: cardDef, cost: cost };
    if(cardDef.type === 'buff' && !cardDef.aoe) { window.executeCardPlay(myName); return; }
    
    let opponents = (allPlayers || []).filter(p => p && p.name !== myName);
    if (opponents.length === 1 && !cardDef.aoe) { window.executeCardPlay(opponents[0].name); return; }
    
    if(el('targetCardName')) el('targetCardName').innerText = cardDef.n; 
    const list = el('targetPlayerList');
    if(!list) return; list.innerHTML = '';
    
    if (cardDef.aoe && el('targetAllContainer')) {
        el('targetAllContainer').style.display = 'block';
    } else if (el('targetAllContainer')) {
        el('targetAllContainer').style.display = 'none';
    }

    opponents.forEach(p => {
        let encodedName = p.name.replace(/"/g, '&quot;');
        list.innerHTML += `<button class="btn btn-secondary target-btn glass-card" data-name="${encodedName}" style="border:3px solid var(--border); color:var(--text-main); width:100%; padding:20px; border-radius:12px; margin-bottom:12px; font-weight:900; font-size:1.3rem; text-align:left;" onclick="window.executeCardPlay(this.getAttribute('data-name'))">${p.name}</button>`;
    });
    window.showModalSafe('targetModal');
};

window.executeCardPlay = function(targetName) {
    if(!window.pendingCardPlay) return; 
    const card = window.pendingCardPlay; const timestamp = Date.now();
    if(el('targetModal')) el('targetModal').style.display = 'none'; 
    window.closeShopModal();
    
    let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean);
    const me = nextPlayers.find(p => p && p.name === myName);
    
    if(me && me.cards) { 
        me.cards = Array.isArray(me.cards) ? me.cards : Object.values(me.cards);
        me.cards = me.cards.filter(Boolean);
        let actualIndex = me.cards.indexOf(card.id);
        if (actualIndex !== -1) me.cards.splice(actualIndex, 1); 
        
        if (card.cost > 0) {
            me.score -= card.cost;
            window.logScore(myName, -card.cost, `Pelasi kortin: ${card.def.n}`);
            window.showAppleToast(`-${card.cost} P (Kortti)`, '💸');
        }
    }
    
    let pCards = {};
    if(activeHole) {
        if (activeHole.playedCards) {
            let oldCards = Array.isArray(activeHole.playedCards) ? activeHole.playedCards : Object.values(activeHole.playedCards);
            oldCards.filter(Boolean).forEach((c, i) => { pCards['old_'+i] = c; });
        }
        let cKey = 'c_' + timestamp + '_' + Math.floor(Math.random()*1000);
        pCards[cKey] = { cardId: card.id, cardName: card.def.n, cardDesc: card.def.d, target: targetName, by: myName, type: card.def.type, tier: card.def.tier, customType: card.def.customType || null, mech: card.def.mech || null, timestamp: timestamp };
    }
    
    let updates = {};
    updates['gameState/players'] = window.cleanFirebaseData(nextPlayers);
    if(activeHole) updates['gameState/activeHole/playedCards'] = window.cleanFirebaseData(pCards); 
    
    update(ref(db), updates);
    window.logEvent(`${myName} pelasi kortin ${card.def.n} kohteelle ${targetName}.`);
    window.showNotification(`🃏 Pelasit kortin: ${card.def.n}`, card.def.type === 'buff' ? 'info' : 'debuff');
};

// ==============================================
// TULOSTEN TALLENNUS JA DYNAAMINEN PISTE-ERITTELY
// ==============================================
window.submitScores = function() {
    let par = currentCourse && currentCourse.pars ? (currentCourse.pars[currentHoleIndex - 1] || 3) : 3;
    let playerResults = {};
    (allPlayers || []).forEach(p => { if(p) playerResults[p.name] = { strokes: par, taskWon: false }; });
    
    const inputs = document.querySelectorAll('.score-input-data');
    if(inputs.length === 0) { alert("Virhe: Ei tulosrivejä löydetty!"); return; }
    
    inputs.forEach(input => { let attrName = input.getAttribute('data-name'); if(playerResults[attrName]) { playerResults[attrName].strokes = parseInt(input.value, 10) || par; } });
    document.querySelectorAll('.task-paper-checkbox:checked').forEach(cb => { let pName = cb.getAttribute('data-name'); if (playerResults[pName]) { playerResults[pName].taskWon = true; } });

    let majorTargets = []; let deniedPassive = []; let deniedWin = []; let deniedDraw = []; let forcePar = []; let doubleWin = []; let doubleTask = [];

    if (activeHole && activeHole.playedCards) {
        Object.values(activeHole.playedCards).forEach(pc => {
            if (!pc) return;
            let cDef = window.allCards.find(c => c.id === pc.cardId);
            let mech = cDef ? cDef.mech : pc.mech;
            let diff = cDef ? (cDef.diff || 1) : 1;
            let targets = pc.target === 'KAIKKI VASTUSTAJAT' ? allPlayers.filter(p => p.name !== pc.by).map(p => p.name) : [pc.target];

            targets.forEach(t => {
                if (pc.cardId.startsWith('major_') || (cDef && cDef.customType === 'major_sabotage')) majorTargets.push({ name: t, diff: diff });
                if (mech === 'deny_passive') deniedPassive.push(t);
                if (mech === 'deny_win') deniedWin.push(t);
                if (mech === 'deny_draw') deniedDraw.push(t);
                if (mech === 'force_par' && t === pc.by) forcePar.push(t); 
                if (mech === 'double_win' && t === pc.by) doubleWin.push(t);
                if (mech === 'double_task' && t === pc.by) doubleTask.push(t);
            });
        });
    }

    forcePar.forEach(pName => { if (playerResults[pName] && playerResults[pName].strokes > par) { playerResults[pName].strokes = par; } });

    let minStrokes = 9999; let maxStrokes = -9999;
    for (let key in playerResults) { let s = playerResults[key].strokes; if (s < minStrokes) minStrokes = s; if (s > maxStrokes) maxStrokes = s; }

    let holeWinners = []; let holeLosers = []; let allGotBirdie = true; 
    for (let key in playerResults) { 
        if (playerResults[key].strokes === minStrokes) holeWinners.push(key); 
        if (playerResults[key].strokes === maxStrokes) holeLosers.push(key); 
        if (playerResults[key].strokes > par - 1) allGotBirdie = false;
    }
    
    if (allGotBirdie) window.logEvent(`🏆 BIRDIE-ALLIANSSI ONNISTUI! Kaikille bonus!`);

    let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean);
    let ptsWin = window.gameSettings.ptsWin || 3;
    let ptsTask = window.gameSettings.ptsTask || 2;
    let ptsLose = window.gameSettings.ptsLose || 0;
    let ptsPassive = window.gameSettings.ptsPassive || 2;
    let limitEnabled = window.gameSettings.handLimitEnabled !== undefined ? window.gameSettings.handLimitEnabled : true;
    let limit = window.gameSettings.handLimit || 5;

    nextPlayers.forEach(p => {
        if (!p) return; let res = playerResults[p.name]; if (!res) return; 
        let oldPoints = parseInt(p.score, 10) || 0;
        let currentPoints = oldPoints;
        let breakdown = [];

        p.dgScore = (parseInt(p.dgScore, 10) || 0) + (res.strokes - par);
        
        // Passiivinen tulo
        if (!deniedPassive.includes(p.name)) { currentPoints += ptsPassive; breakdown.push(`Passiivinen: +${ptsPassive}P`); } 
        else { breakdown.push(`Passiivinen evätty: 0P`); }
        
        // Birdie Allianssi
        if (allGotBirdie) { currentPoints += 2; breakdown.push(`Allianssi: +2P`); }

        // Väylävoitto
        if (holeWinners.includes(p.name)) {
            if (!deniedWin.includes(p.name)) {
                let winPts = (holeWinners.length > 1) ? Math.floor(ptsWin * 0.66) : ptsWin;
                winPts = Math.max(1, winPts);
                if (doubleWin.includes(p.name)) winPts *= 2;
                currentPoints += winPts; breakdown.push(`Voitto: +${winPts}P`);
            } else { breakdown.push(`Voitto evätty: 0P`); }
        }
        
        // Tehtävävoitto
        if (res.taskWon) { 
            let taskPts = doubleTask.includes(p.name) ? (ptsTask * 2) : ptsTask;
            currentPoints += taskPts; breakdown.push(`Tehtävä: +${taskPts}P`);
        }
        
        // Selätyspalkkio
        let majorDefeated = majorTargets.find(t => t.name === p.name);
        if (majorDefeated && res.strokes <= par) {
            let rew = majorDefeated.diff === 3 ? 8 : (majorDefeated.diff === 2 ? 5 : 3);
            currentPoints += rew; breakdown.push(`Selätys: +${rew}P`);
        }
        
        p.score = currentPoints; p.boughtThisHole = false; p.lastHoleSummary = breakdown.join(", ");
        let scoreDelta = currentPoints - oldPoints;
        if (scoreDelta !== 0) window.logScore(p.name, scoreDelta, `Väylä ${currentHoleIndex}: ${p.lastHoleSummary}`);

        // Korttien jako pakasta lennosta
        p.cards = p.cards ? (Array.isArray(p.cards) ? p.cards : Object.values(p.cards)) : []; p.cards = p.cards.filter(Boolean);
        if (!deniedDraw.includes(p.name)) {
            let cardsToGive = (holeLosers.includes(p.name) && minStrokes !== maxStrokes) ? 3 : 2;
            let drawn = window.drawFromDeck('normal', cardsToGive);
            drawn.forEach(cId => { if (!limitEnabled || p.cards.length < limit) p.cards.push(cId); });
        }
    });
    
    let nextHistory = JSON.parse(JSON.stringify(window.gameHistory || []));
    let holeStrokes = {}; for (let key in playerResults) { holeStrokes[key] = playerResults[key].strokes; }
    nextHistory.push({ rule: activeHole.rule, playedCards: activeHole.playedCards, color: activeHole.color || '#fef08a', holeResults: holeStrokes, players: JSON.parse(JSON.stringify(nextPlayers)) });
    
    let nextHoleIndex = currentHoleIndex + 1;
    let shopIds = window.drawFromDeck('premium', 5);
    let uniqueShop = shopIds.map(id => window.allCards.find(c => c.id === id)).filter(Boolean);
    let ruleIdx = window.drawFromDeck('rules', 1)[0];
    let randomRule = window.holeRules[ruleIdx] || {type:"rule", n:"Peli Jatkuu", d:""};
    
    update(ref(db), window.cleanFirebaseData({ 'gameState/players': nextPlayers, 'gameState/currentHoleIndex': nextHoleIndex, 'gameState/activeHole': { rule: randomRule, shop: uniqueShop, playedCards: {}, timestamp: Date.now(), color: getRandomColor(), penColor: getRandomPen() }, 'gameState/history': nextHistory, 'gameState/decks': window.gameDecks }));
    if(el('scoreModal')) el('scoreModal').style.display = 'none'; 
    setTimeout(() => { window.zoomToHole(nextHoleIndex); }, 400); 
};

// ==============================================
// REALAIKAINEN CUSTOM-RADAN LUONTI (KORJATTU VAKAAKSI)
// ==============================================
window.startCustomCourse = function() {
    let name = el('newCourseName').value.trim() || "Oma Rata";
    let holesCount = parseInt(el('newCourseHoles').value, 10) || 18;
    let nextCourse = { name: name, pars: Array(holesCount).fill(3) };
    
    let normalDeck = window.allCards.filter(c => c.tier === 'normal').map(c => c.id).sort(() => 0.5 - Math.random());
    let premiumDeck = window.allCards.filter(c => c.tier === 'premium').map(c => c.id).sort(() => 0.5 - Math.random());
    let rulesDeck = window.holeRules.map((_, i) => i).sort(() => 0.5 - Math.random());
    window.gameDecks = { normal: normalDeck, premium: premiumDeck, rules: rulesDeck };
    
    let shopIds = window.drawFromDeck('premium', 5);
    let uniqueShop = shopIds.map(id => window.allCards.find(c => c.id === id)).filter(Boolean);
    let ruleIdx = window.drawFromDeck('rules', 1)[0];
    let randomRule = window.holeRules[ruleIdx] || {type:"rule", n:"Peli Alkaa", d:""};

    let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean).map(p => {
        return { ...p, score: 3, dgScore: 0, cards: window.drawFromDeck('normal', 3), boughtThisHole: false };
    });

    set(ref(db, 'gameState'), window.cleanFirebaseData({ course: nextCourse, currentHoleIndex: 1, activeHole: { rule: randomRule, shop: uniqueShop, playedCards: {}, timestamp: Date.now(), color: getRandomColor(), penColor: getRandomPen() }, players: nextPlayers, history: [], customCards: window.customCards || [], decks: window.gameDecks }));
    if(el('courseModal')) el('courseModal').style.display = 'none';
};

// ==============================================
// MOBIILIKARUSELLI & RENDERÖINTIPÄIVITYKSET
// ==============================================
window.forceCarouselLayoutUpdate = function() {
    const container = el('cardCarousel'); if(!container) return;
    const cards = Array.from(container.querySelectorAll('.carousel-card-wrapper'));
    const scrollLeft = container.scrollLeft; const containerWidth = container.clientWidth || window.innerWidth;
    const paddingLeft = (containerWidth / 2) - 160; 
    
    cards.forEach((card, index) => {
        const cardCenter = paddingLeft + (index * 320) + 160 - scrollLeft;
        const diff = (cardCenter - (containerWidth / 2)) / 160; 
        card.style.transform = `translate3d(${diff * -40}px, ${Math.abs(diff) * 20}px, ${Math.abs(diff) * -150}px) rotateZ(${diff * 5}deg) scale(${Math.max(0.85, 1 - Math.abs(diff) * 0.15)})`;
        card.style.zIndex = 100 - Math.floor(Math.abs(diff)*10);
    });
};

window.flipCard = function(index) {
    if(window.isFlipping) return; window.isFlipping = true;
    let cId = window.carouselCards[index]; let isFlippingDown = !window.flippedCards.has(cId);
    if (isFlippingDown) window.flippedCards.add(cId); else window.flippedCards.delete(cId);
    
    let inner = el(`card3d-inner-${index}`); if(inner) inner.classList.toggle('flipped');
    
    setTimeout(() => {
        if (window.carouselCurrentMode === 'hand' || window.carouselCurrentMode === 'sell') {
            let targetCardId = isFlippingDown ? window.carouselCards.find((id, i) => i > index && !window.flippedCards.has(id)) || window.carouselCards.find(id => !window.flippedCards.has(id)) : cId;
            window.carouselCards.sort((a,b) => (window.flippedCards.has(a)?1:0) - (window.flippedCards.has(b)?1:0) || window.getCardSortWeight(a) - window.getCardSortWeight(b));
            window.carouselCurrentIndex = Math.max(0, window.carouselCards.indexOf(targetCardId));
            
            window.renderCarousel(); window.initNativeCarousel();
            const container = el('cardCarousel'); if(container) container.scrollLeft = (window.carouselCurrentIndex * 320);
        }
        window.isFlipping = false;
    }, 300); 
};

window.renderCarousel = function() {
    const container = el('cardCarousel'); if(!container) return;
    let html = '';
    window.carouselCards.forEach((cId, i) => {
        let cDef = window.allCards.find(c => c && c.id === cId); if(!cDef) return;
        let typeClass = cDef.type === 'buff' ? 'buff-card' : 'debuff-card'; if(cDef.tier === 'premium') typeClass = 'premium-card';
        let tagTxt = cDef.tier === 'premium' ? '💎 PREMIUM' : (cDef.type === 'buff' ? '🛡️ HELPOTUS' : '🚫 SABOTAASI');
        let playCost = window.getCardPlayCost(cId);
        let costHtml = playCost > 0 ? `<div style="background:var(--warning); color:#000; font-weight:900; font-size:0.9rem; padding:4px 8px; border-radius:4px; margin-bottom:8px; width:fit-content;">HINTA: ${playCost} P</div>` : `<div style="background:#22c55e; color:#fff; font-weight:900; font-size:0.9rem; padding:4px 8px; border-radius:4px; margin-bottom:8px; width:fit-content;">ILMAINEN PELATA</div>`;
        let descHtml = window.getCardDesc(cDef, cId);
        
        html += `
            <div class="carousel-card-wrapper" data-id="${cId}" id="carousel-wrapper-${i}" onclick="window.flipCard(${i})">
                <div class="card-3d-inner ${window.flippedCards.has(cId)?'flipped':''}" id="card3d-inner-${i}">
                    <div class="card-face card-front ${typeClass}">
                        <div style="text-align:left; display:flex; flex-direction:column; height:100%; position:relative; z-index:20;">
                            ${costHtml}
                            <div class="card-type-tag" style="font-size:1.3rem; margin-bottom:12px;">${tagTxt}</div>
                            <h3 style="font-size:2.4rem; margin-bottom:20px; line-height:1.1;">${cDef.n}</h3>
                            <p style="font-size:${descHtml.length>150?'1.1rem':'1.4rem'}; font-weight:800; line-height:1.35; overflow-y:auto;">${descHtml}</p>
                        </div>
                    </div>
                    <div class="card-face card-back ${cDef.tier==='premium'?'card-back-premium':(cDef.type==='buff'?'card-back-buff':'card-back-sabotage')}"><div class="card-back-icon">🎲</div></div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

window.initNativeCarousel = function() {
    const container = el('cardCarousel'); if(!container) return;
    window.forceCarouselLayoutUpdate(); container.addEventListener('scroll', () => { requestAnimationFrame(window.forceCarouselLayoutUpdate); }, {passive: true});
};

// ==============================================
// CUSTOM-LOGIKKA JA ALUSTUKSET
// ==============================================
window.createNewCard = function() {
    let name = el('newCardName').value.trim(); let desc = el('newCardDesc').value.trim(); let type = el('newCardType').value;
    let diff = parseInt(el('newCardDiff').value) || 1; let price = parseInt(el('newCardPrice').value) || 20;
    if (!name || !desc) return alert("Täytä kentät!");

    let cId = 'custom_' + Date.now();
    let newCard = { id: cId, n: name, d: desc, tier: type==='monster'?'premium':'normal', type: type==='monster'?'buff':(type.includes('sabotage')?'sabotage':'buff'), customType: type, diff: diff, price: price };
    let nextCustoms = JSON.parse(JSON.stringify(window.customCards || [])); nextCustoms.push(newCard);
    
    if (window.gameDecks) { if (type === 'monster') window.gameDecks.premium.push(cId); else window.gameDecks.normal.push(cId); }
    update(ref(db), { 'gameState/customCards': nextCustoms, 'gameState/decks': window.gameDecks || [] });
    el('newCardName').value = ''; el('newCardDesc').value = ''; el('createCardModal').style.display = 'none';
};

window.renderCardLibrary = function() {
    let container = el('cardLibraryContainer'); if(!container) return; let html = '';
    const categories = [{ id: 'minor_sabotage', name: 'Pienet Sabotaasit (Taso 1)' }, { id: 'major_sabotage', name: 'Isot Sabotaasit (Taso 2)' }, { id: 'buff', name: 'Helpotukset' }, { id: 'premium', name: 'Monsterikortit (Premium)' }];
    categories.forEach(cat => {
        let cards = window.allCards.filter(c => cat.id === 'premium' ? c.tier === 'premium' : (cat.id === 'buff' ? c.tier === 'normal' && c.type === 'buff' : (cat.id === 'minor_sabotage' ? c.id.startsWith('minor_') || c.customType === 'minor_sabotage' : c.id.startsWith('major_') || c.customType === 'major_sabotage')));
        html += `<h3 style="color:var(--warning); margin-top:15px; border-bottom:1px solid rgba(255,255,255,0.2);">${cat.name}</h3>`;
        cards.forEach(c => { html += `<div style="background:rgba(255,255,255,0.05); padding:8px; margin-top:5px; border-radius:6px;"><b>${c.n}</b><br><span style="font-size:0.85rem; color:#ccc;">${c.d}</span></div>`; });
    });
    container.innerHTML = html;
};

window.openCardDetail = function(cId, mode, arg1, arg2, arg3) {
    if (mode === 'hand' || mode === 'sell') {
        const me = (allPlayers || []).find(p => p && p.name === myName); window.flippedCards = new Set();
        window.carouselCards = me && me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)).filter(Boolean) : [];
        window.carouselCards.sort((a,b) => window.getCardSortWeight(a) - window.getCardSortWeight(b));
    } else if (mode === 'shop') { window.carouselCards = activeHole && activeHole.shop ? (activeHole.shop || []).map(c => c.id) : []; } 
    else { window.carouselCards = [cId]; }
    window.carouselCurrentMode = mode; window.carouselArgs = [arg1, arg2, arg3]; window.carouselCurrentIndex = Math.max(0, window.carouselCards.indexOf(cId));
    window.renderCarousel(); window.showModalSafe('cardDetailModal');
    setTimeout(() => { window.initNativeCarousel(); const container = el('cardCarousel'); if(container) { container.scrollLeft = (window.carouselCurrentIndex * 320); window.forceCarouselLayoutUpdate(); } }, 50);
};

window.updateCarouselButtons = function() {
    if(window.carouselCards.length === 0) return; let cId = window.carouselCards[window.carouselCurrentIndex]; let cDef = window.allCards.find(c => c && c.id === cId); if(!cDef) return;
    let btnHtml = '';
    if (window.carouselCurrentMode === 'hand' || window.carouselCurrentMode === 'sell') {
        let playCost = window.getCardPlayCost(cId); let me = (allPlayers || []).find(p => p && p.name === myName);
        let canAffordPlay = (me ? me.score : 0) >= playCost;
        btnHtml = `<button class="btn ${canAffordPlay?'btn-success':'btn-secondary'}" ${canAffordPlay?'':'disabled'} onclick="document.getElementById('cardDetailModal').style.display='none'; window.openTargetModal('${cId}')">PELAA KORTTI</button>`;
        if (cDef.tier === 'normal') btnHtml += `<button class="btn btn-danger" style="margin-top:5px;" onclick="document.getElementById('cardDetailModal').style.display='none'; window.forceDiscard('${cId}', true)">Myy kortti</button>`;
    } else if (window.carouselCurrentMode === 'shop') {
        let me = (allPlayers || []).find(p => p && p.name === myName); let item = activeHole && activeHole.shop ? activeHole.shop.find(s=>s.id===cId) : null;
        let canAfford = me && item && me.score >= item.price && !me.boughtThisHole;
        btnHtml = `<button class="btn ${canAfford?'btn-warning':'btn-secondary'}" ${canAfford?'':'disabled'} onclick="document.getElementById('cardDetailModal').style.display='none'; window.buyShopItem('${cId}', '${cDef.n}', ${item?item.price:99})">OSTA ETU</button>`;
    } else if (window.carouselCurrentMode === 'event') {
        btnHtml = `<div style="background:var(--danger); color:#fff; padding:15px; border-radius:8px; text-align:center;">MÄÄRÄTTY: <b>${window.carouselArgs[0]}</b> (Tekijä: ${window.carouselArgs[1]})</div>`;
    }
    el('cardDetailActionArea').innerHTML = btnHtml;
};

window.gmChangeHole = function() { let sel = el('gmSetCurrentHole'); if(!sel || !sel.value) return; if(confirm("Vaihda väylä?")) { update(ref(db), { 'gameState/currentHoleIndex': parseInt(sel.value) }); el('settingsModal').style.display = 'none'; } };
window.gmRemoveCurrentHole = function() { if(confirm("Poista väylä pituudesta?")) { let nextCourse = JSON.parse(JSON.stringify(currentCourse)); nextCourse.pars.pop(); update(ref(db), { 'gameState/course': nextCourse }); el('settingsModal').style.display = 'none'; } };
window.populateHoleSelect = function() { let sel = el('gmSetCurrentHole'); if(!sel || !currentCourse || !currentCourse.pars) return; sel.innerHTML = currentCourse.pars.map((p, i) => `<option value="${i+1}">Väylä ${i+1}</option>`).join(''); sel.value = currentHoleIndex; };

window.startMeilahti = function() {
    let nextCourse = { name: "Meilahti", pars: Array(16).fill(3) };
    let normalDeck = window.allCards.filter(c => c.tier === 'normal').map(c => c.id).sort(() => 0.5 - Math.random());
    let premiumDeck = window.allCards.filter(c => c.tier === 'premium').map(c => c.id).sort(() => 0.5 - Math.random());
    let rulesDeck = window.holeRules.map((_, i) => i).sort(() => 0.5 - Math.random());
    window.gameDecks = { normal: normalDeck, premium: premiumDeck, rules: rulesDeck };
    let shopIds = window.drawFromDeck('premium', 5); let uniqueShop = shopIds.map(id => window.allCards.find(c => c.id === id)).filter(Boolean);
    let ruleIdx = window.drawFromDeck('rules', 1)[0];
    update(ref(db, 'gameState'), window.cleanFirebaseData({ course: nextCourse, currentHoleIndex: 1, activeHole: { rule: window.holeRules[ruleIdx] || {type:"rule", n:"Alku", d:""}, shop: uniqueShop, playedCards: {}, timestamp: Date.now(), color: getRandomColor(), penColor: getRandomPen() }, players: JSON.parse(JSON.stringify(allPlayers)).filter(Boolean).map(p => ({ ...p, score: 3, dgScore: 0, cards: window.drawFromDeck('normal', 3), boughtThisHole: false })), history: [], customCards: [], decks: window.gameDecks }));
};

window.cancelCourse = function() { if (confirm("Keskeytä peli?")) { update(ref(db, 'gameState'), window.cleanFirebaseData({ course: null, activeHole: null, currentHoleIndex: 1, players: allPlayers.filter(Boolean), history: [] })); } };
window.resetGame = function() { if (confirm("Pyyhi kaikki tiedot?")) { set(ref(db, 'gameState'), window.cleanFirebaseData({ settings: { shopEnabled: true, handLimitEnabled: true, handLimit: 5, ptsWin: 3, ptsTask: 2, ptsLose: 0, ptsPassive: 2, costMinor: 2, costMajor: 5, costBuff: 3, rewardMajor: 5, sellReward: 1 }, players: [], activeHole: null, currentHoleIndex: 1, course: null, history: [], customCards: [], decks: {normal:[], premium:[], rules:[]} })).then(() => { localStorage.clear(); location.reload(); }); } };
window.saveGameSettings = function() { set(ref(db, 'gameState/settings'), { shopEnabled: el('gmSetShop').checked, handLimitEnabled: el('gmSetLimitCheck').checked, handLimit: parseInt(el('gmSetLimitCount').value, 10)||5, ptsWin: parseInt(el('gmSetPtsWin').value, 10)||3, ptsTask: parseInt(el('gmSetPtsTask').value, 10)||2, ptsLose: parseInt(el('gmSetPtsLose').value, 10)||0, ptsPassive: parseInt(el('gmSetPtsPassive').value, 10)||2, sellReward: parseInt(el('gmSetSellReward').value, 10)||1, costMinor: parseInt(el('gmSetCostMinor').value, 10)||2, costMajor: parseInt(el('gmSetCostMajor').value, 10)||5, costBuff: parseInt(el('gmSetCostBuff').value, 10)||3 }); el('settingsModal').style.display = 'none'; };

window.logEvent = function(msg) { push(ref(db, 'gameState/eventLog'), window.cleanFirebaseData({ time: new Date().toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'}), msg: msg })); };
window.logScore = function(playerName, delta, reason) { push(ref(db, 'gameState/scoreLog'), window.cleanFirebaseData({ time: new Date().toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'}), playerName: playerName, delta: delta, msg: reason })); };
window.showNotification = function(message, type = 'info') { const container = el('notificationContainer'); if(!container) return; const toast = document.createElement('div'); toast.className = `notification ${type}`; toast.innerHTML = `<span>${message}</span>`; container.appendChild(toast); setTimeout(() => { toast.remove(); }, 4000); };
window.claimIdentity = function() { let n = el('playerNameInput').value.trim(); if(!n) return; myName = n; localStorage.setItem('friba_name', n); window.updateIdentityUI(); if(!allPlayers.find(x => x && x.name === n)) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); nextPlayers.push({ name: n, score: 3, dgScore: 0, cards: [], boughtThisHole: false }); set(ref(db, 'gameState/players'), window.cleanFirebaseData(nextPlayers)); } };
window.updateIdentityUI = function() { if(el('identityCard')) el('identityCard').style.display = myName ? 'none' : 'block'; };

window.adminAddPlayer = function() { const input = el('adminNewPlayerName'); if(!input) return; const name = input.value.trim(); if(!name) return; let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); nextPlayers.push({ name: name, score: 3, dgScore: 0, cards: [], boughtThisHole: false }); update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); input.value = ''; };
window.removePlayer = function(index) { if(confirm("Poista pelaaja?")) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); nextPlayers.splice(index, 1); update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); } };
window.adjustScore = function(index, delta) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); if(nextPlayers[index]) { nextPlayers[index].score = (parseInt(nextPlayers[index].score) || 0) + delta; window.logScore(nextPlayers[index].name, delta, "GM Korjaus"); update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); } };
window.adjustDgScore = function(index, delta) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); if(nextPlayers[index]) { nextPlayers[index].dgScore = (parseInt(nextPlayers[index].dgScore) || 0) + delta; update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); } };
window.gmSetRule = function() { if(!activeHole) return; const sel = el('gmRuleSelect'); const ruleDef = window.holeRules[sel.value]; if(ruleDef) { set(ref(db, 'gameState/activeHole/rule'), window.cleanFirebaseData(ruleDef)); document.getElementById('settingsModal').style.display='none'; } };

// =============================================
// REAALIAIKAINEN DATABASE KUUNTELIJA
// =============================================
onValue(ref(db, 'gameState'), (snap) => {
    const data = snap.val();
    if(!data) { if(myName) { myName = null; localStorage.removeItem('friba_name'); window.updateIdentityUI(); } currentCourse = null; return; }

    window.gameSettings = data.settings || { shopEnabled: true, handLimitEnabled: true, handLimit: 5, ptsWin: 3, ptsTask: 2, ptsLose: 0, ptsPassive: 2, costMinor: 2, costMajor: 5, costBuff: 3, rewardMajor: 5, sellReward: 1 };
    window.gameHistory = data.history ? (Array.isArray(data.history) ? data.history : Object.values(data.history)) : [];
    window.gameDecks = data.decks || { normal: [], premium: [], rules: [] };

    if (!window.baseCardsSaved) { window.baseCardsSaved = true; window.baseCards = [...window.allCards]; }
    window.customCards = data.customCards || [];
    let baseIds = new Set(window.baseCards.map(c => c.id)); window.allCards = [...window.baseCards];
    window.customCards.forEach(cc => { if(!baseIds.has(cc.id)) window.allCards.push(cc); });
    window.renderCardLibrary();

    allPlayers = data.players ? (Array.isArray(data.players) ? data.players : Object.values(data.players)) : [];
    activeHole = data.activeHole || null; currentCourse = data.course || null; currentHoleIndex = data.currentHoleIndex || 1;
    window.populateHoleSelect(); window.updateIdentityUI();
    
    if(el('lobbyContainer')) el('lobbyContainer').style.display = myName ? 'none' : 'block';
    if(el('gameSetupArea')) el('gameSetupArea').style.display = (myName && !currentCourse) ? 'block' : 'none';
    if(el('corkboard-viewport')) el('corkboard-viewport').style.display = (myName && currentCourse) ? 'block' : 'none';
    if(el('settingsToggleBtn')) el('settingsToggleBtn').style.display = myName ? 'flex' : 'none';
    if(el('rulesToggleBtn')) el('rulesToggleBtn').style.display = (myName && currentCourse) ? 'flex' : 'none';
    if(el('pocketContainer')) el('pocketContainer').style.display = (myName && currentCourse) ? 'flex' : 'none';

    window.renderBoard(); window.renderReceipt();
    
    if (myName) {
        const me = allPlayers.find(p => p && p.name === myName);
        if (me) {
            let currentPoints = parseInt(me.score, 10) || 0;
            if (typeof window.myLastHoleIndex === 'undefined') { window.myLastHoleIndex = currentHoleIndex; window.myLastScore = currentPoints; } 
            else if (window.myLastHoleIndex !== currentHoleIndex) {
                let diff = currentPoints - window.myLastScore;
                let summary = me.lastHoleSummary ? me.lastHoleSummary : "Ei tuloja";
                if (currentCourse && currentHoleIndex > currentCourse.pars.length) { window.showNotification(`Kierros päättynyt!`, 'warning'); } 
                else { window.showNotification(`<b>VÄYLÄ ${window.myLastHoleIndex} PELATTU!</b><br>Tulos: ${summary}<br><b>Yhteensä: ${diff > 0 ? '+' : ''}${diff} P</b>`, diff >= 0 ? 'info' : 'debuff'); }
                window.myLastHoleIndex = currentHoleIndex; window.myLastScore = currentPoints;
            } else { window.myLastScore = currentPoints; }

            let myCards = me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)).filter(Boolean) : [];
            window.renderShop(activeHole ? activeHole.shop : null, me.score || 0, me.boughtThisHole);
            if (window.gameSettings.handLimitEnabled && myCards.length > window.gameSettings.handLimit) { window.showHandLimitModal(myCards); }
            if(el('myResPointsBtn')) el('myResPointsBtn').innerText = `${me.score || 0} P`;
            if(el('handCountBadge')) el('handCountBadge').innerText = myCards.length;
        }
    }
    window.renderAdminPlayerList(); window.renderEventLog(data.eventLog); window.renderScoreLog(data.scoreLog);
});
