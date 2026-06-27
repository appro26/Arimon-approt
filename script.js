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
    "Ei h*lvetti, jopa Jeesus itkee ton sun tekniikan takia.",
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
// PAKKA-LOGIIKKA (DRAW CARDS)
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
// NATIIVIN TAKAISIN-NAPIN HALLINTA (ROUTER)
// ==============================================
window.addEventListener('load', () => { 
    history.pushState({ fribaApp: true }, ''); 
    setTimeout(window.checkInstallPrompt, 1500); 
});

window.addEventListener('popstate', (e) => {
    const modals = [
        'cardDetailModal', 'targetModal', 'scoreModal', 'gmGiveCardModal',
        'receiptModal', 'zoomModal', 'handLimitModal', 'shopModal', 'settingsModal', 'courseModal', 'rulesModal', 'cardLibraryModal', 'createCardModal'
    ];
    let closedAny = false;
    for (let i = 0; i < modals.length; i++) {
        let m = el(modals[i]);
        if (m && m.style.display !== 'none' && m.style.display !== '') {
            m.style.display = 'none';
            closedAny = true;
            if (modals[i] === 'shopModal') window.pendingShopPurchase = null;
            break; 
        }
    }
    if (closedAny) {
        history.pushState({ fribaApp: true }, ''); 
    }
});

window.showModalSafe = function(id, displayType = 'flex') {
    if(el(id)) {
        el(id).style.display = displayType;
        history.pushState({ fribaApp: true }, '');
    }
};

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (!localStorage.getItem('friba_browser_mode') && el('installPromptModal')) {
        el('installInstructions').innerHTML = "Tämä peli toimii parhaiten puhelimen omana sovelluksena. Asenna se nyt yhdellä painalluksella!";
        el('nativeInstallBtn').style.display = 'block';
        window.showModalSafe('installPromptModal');
    }
});

window.triggerNativeInstall = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted' && el('installPromptModal')) el('installPromptModal').style.display = 'none';
        deferredPrompt = null;
    }
};

window.checkInstallPrompt = function() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
    if (isStandalone || localStorage.getItem('friba_browser_mode')) return;
    if (!deferredPrompt && el('installPromptModal')) {
        const os = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "iOS" : (/android/i.test(navigator.userAgent) ? "Android" : "Other");
        let instText = os === "iOS" ? "Paina selaimen alalaidasta <b>Jaa-kuvaketta</b> ja valitse <b>'Lisää kotivalikkoon'</b>." : 
                       (os === "Android" ? "Paina selaimen <b>valikkoa</b> ja valitse <b>'Asenna sovellus'</b>." : "Asenna peli selaimesi valikosta.");
        el('installInstructions').innerHTML = instText;
        el('nativeInstallBtn').style.display = 'none'; 
        window.showModalSafe('installPromptModal');
    }
};

window.dismissInstallPrompt = function() {
    localStorage.setItem('friba_browser_mode', 'true');
    if(el('installPromptModal')) el('installPromptModal').style.display = 'none';
};

// ==============================================
// VAPAA KAMERA & SULAVA JS-LIIKU
// ==============================================
let boardState = { scale: 1, x: 0, y: 0 };
let isDraggingBoard = false;
let lastBoardTouch = null;
let initialPinchDist = 0;
let camAnim = null; 
let boardEl = null;
let isRendering = false;

window.applyBoardTransform = function() {
    if(!boardEl) boardEl = el('corkboard-surface');
    if(boardEl) {
        if(boardEl.style.willChange !== 'transform') boardEl.style.willChange = 'transform';
        
        const vpWidth = window.innerWidth; const vpHeight = window.innerHeight;
        const bWidth = parseFloat(boardEl.style.width) || 3000;
        const bHeight = parseFloat(boardEl.style.height) || 3000;
        
        const marginX = vpWidth * 0.5; const marginY = vpHeight * 0.5;
        const minX = vpWidth - (bWidth * boardState.scale) - marginX;
        const maxX = marginX;
        const minY = vpHeight - (bHeight * boardState.scale) - marginY;
        const maxY = marginY;

        if (boardState.x > maxX) boardState.x = maxX;
        if (boardState.x < minX) boardState.x = minX;
        if (boardState.y > maxY) boardState.y = maxY;
        if (boardState.y < minY) boardState.y = minY;

        boardEl.style.transform = `translate3d(${boardState.x}px, ${boardState.y}px, 0) scale(${boardState.scale})`;
    }
    isRendering = false;
};

window.animateCameraTo = function(tX, tY, tScale, duration=350) {
    if (camAnim) cancelAnimationFrame(camAnim);
    let sX = boardState.x; let sY = boardState.y; let sScale = boardState.scale;
    let startT = performance.now();
    
    function step(time) {
        let p = (time - startT) / duration;
        if (p >= 1) p = 1;
        let ease = 1 - Math.pow(1 - p, 3);
        boardState.x = sX + (tX - sX) * ease;
        boardState.y = sY + (tY - sY) * ease;
        boardState.scale = sScale + (tScale - sScale) * ease;
        window.applyBoardTransform();
        if (p < 1) camAnim = requestAnimationFrame(step); else camAnim = null;
    }
    camAnim = requestAnimationFrame(step);
};

const vp = el('corkboard-viewport');
if(vp) {
    vp.addEventListener('touchstart', e => {
        if(camAnim) { cancelAnimationFrame(camAnim); camAnim = null; }
        if(e.touches.length === 1) {
            isDraggingBoard = true;
            lastBoardTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            isDraggingBoard = true;
        }
    }, {passive: false});

    vp.addEventListener('touchmove', e => {
        if(!isDraggingBoard) return;
        e.preventDefault(); 
        if(e.touches.length === 1 && lastBoardTouch) {
            let panSpeed = 1 / Math.max(0.5, boardState.scale);
            boardState.x += (e.touches[0].clientX - lastBoardTouch.x) * panSpeed;
            boardState.y += (e.touches[0].clientY - lastBoardTouch.y) * panSpeed;
            lastBoardTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            let dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            let scaleDiff = dist / initialPinchDist;
            let pinchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            let pinchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            boardState.x -= (pinchX - boardState.x) * (scaleDiff - 1);
            boardState.y -= (pinchY - boardState.y) * (scaleDiff - 1);
            boardState.scale *= scaleDiff;
            
            if(boardState.scale < 0.35) boardState.scale = 0.35;
            if(boardState.scale > 1.8) boardState.scale = 1.8;
            initialPinchDist = dist;
        }
        if (!isRendering) { isRendering = true; requestAnimationFrame(window.applyBoardTransform); }
    }, {passive: false});

    vp.addEventListener('touchend', e => {
        if(e.touches.length < 1) {
            isDraggingBoard = false; lastBoardTouch = null;
            if (!isRendering) { isRendering = true; requestAnimationFrame(window.applyBoardTransform); }
        } else if (e.touches.length === 1) { lastBoardTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    }, {passive: true});
}

// Kameran keskityskoordinaatteja säädetty uuden pyynnön mukaisesti
window.zoomToHole = function(hIndex) {
    if(!currentCourse || !currentCourse.pars) return;
    let totalHoles = currentCourse.pars.length;
    let cols = Math.min(9, totalHoles);
    let col = (hIndex - 1) % cols;
    let row = Math.floor((hIndex - 1) / cols);
    
    let cellX = 120 + col * 460; 
    let cellY = 120 + row * 1010; 
    
    let targetX = (window.innerWidth / 2) - cellX - 60; 
    let targetY = 120 - cellY; 
    
    window.animateCameraTo(targetX, targetY, 1, 400);
};

window.zoomToCurrentHole = function() { window.zoomToHole(currentHoleIndex); };

window.showZoomModal = function(html) {
    html = html.replace(/transform:\s*rotate\([^)]+\);?/g, 'transform: none;');
    let scaleVal = Math.min(1.15, (window.innerWidth * 0.9) / 340);
    el('zoomModalContent').innerHTML = html;
    el('zoomModalContent').style.transform = `scale(${scaleVal})`;
    window.showModalSafe('zoomModal');
};

// ==============================================
// SWIPE TO CLOSE (TÄYDELLISESTI SUOJATTU)
// ==============================================
let swipeStartX = 0;
let swipeStartY = 0;
let isSwipeHandle = false;

window.addEventListener('touchstart', e => {
    // Sallitaan alas-swaippaus VAIN jos sormi aloittaa kansion/modaalin otsikkoalueelta
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
        
        // Varmistetaan että liike on selkeästi alas eikä sivulle
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
// KORTTIEN LAJITTELU JA HINTALOGIIKKA
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
// TAULUN PIIRTÄMINEN JA TAPAHTUMAT
// ==============================================
window.showEventCard = function(cId, target, by) {
    window.carouselCards = [cId];
    window.carouselCurrentMode = 'event';
    window.carouselCurrentIndex = 0;
    window.renderCarousel();
    
    let targetStr = target ? `<div style="background:var(--danger); color:#fff; padding:15px; border-radius:8px; font-weight:900; font-size:1.2rem; text-align:center; box-shadow:0 4px 10px rgba(0,0,0,0.4); margin-bottom:10px;">SUORITTAJA:<br><span style="font-size:1.8rem; font-family:'Kalam', cursive;">${target}</span><div style="font-size:0.85rem; margin-top:5px; opacity:0.9;">(Määrääjä: ${by})</div></div>` : '';
    
    el('cardDetailActionArea').innerHTML = targetStr;
    window.showModalSafe('cardDetailModal');
    setTimeout(() => { window.initNativeCarousel(); }, 100);
};

window.getHoleCellHTML = function(hData, hIndex, isActive, isHistory) {
    let clickAttr = `onclick="window.zoomToHole(${hIndex})" style="cursor:pointer;"`;
    let html = `<div class="hole-cell" ${clickAttr}>`;
    let par = currentCourse.pars ? (currentCourse.pars[hIndex - 1] || 3) : 3;
    
    let rot1 = (pseudoRandom(hIndex * 1.1) * 6 - 3).toFixed(1);
    let rot2 = (pseudoRandom(hIndex * 2.2) * 6 - 3).toFixed(1);
    let rot3 = (pseudoRandom(hIndex * 3.3) * 6 - 3).toFixed(1);

    let activeStyle = isActive ? `z-index: 25;` : `z-index: 5;`;
    html += `<div class="index-card" style="transform: rotate(${rot1}deg); position: relative; ${activeStyle}">`;
    html += `<div class="banner-subtitle">${currentCourse.name}</div><div class="banner-title">VÄYLÄ <span>${hIndex}</span></div><div style="margin-top: 5px;"><span class="banner-par">PAR <span>${par}</span></span></div>`;
    
    if (isActive && hData.penColor) {
        html += `
        <div class="pen-container" onclick="event.stopPropagation(); window.openScoreModal();">
            <div class="pen-string"></div>
            <div class="pen-body" style="background: linear-gradient(to right, ${hData.penColor.c1}, ${hData.penColor.c2}, ${hData.penColor.c1});">
                <span class="pen-text">MERKKAA</span>
            </div>
        </div>`;
    }
    html += `</div>`;

    if (hData.rule) {
        let bTxt = hData.rule.type === 'bounty' ? `🏆 TEHTÄVÄ` : '🎲 VÄYLÄSÄÄNTÖ';
        let bgCol = hData.color || '#fef08a';
        let ruleLen = hData.rule.d.length;
        let pSize = ruleLen > 80 ? '0.95rem' : '1.15rem';
        let pLh = ruleLen > 80 ? '1.25' : '1.4';

        html += `
        <div class="post-it-note" style="background:${bgCol}; transform: rotate(${rot2}deg);" onclick="event.stopPropagation(); window.showZoomModal(this.outerHTML)">
            <div style="font-weight:900; font-size:0.85rem; margin-bottom:8px; text-transform:uppercase; color:#666;">📌 ${bTxt}</div>
            <div style="font-size:1.6rem; margin-bottom: 8px; font-weight: 900; line-height: 1.1; color:#111;">${hData.rule.n}</div>
            <div style="font-size: ${pSize}; line-height: ${pLh}; font-weight:700; color:#222;">${hData.rule.d}</div>
        </div>`;
    }

    let playedCards = Object.values(hData.playedCards || {}).filter(Boolean);
    if(playedCards.length > 0) {
        let myCards = [];
        let otherCards = [];
        playedCards.forEach(pc => { if (pc.target === myName || pc.target === 'KAIKKI VASTUSTAJAT') myCards.push(pc); else otherCards.push(pc); });

        if (myCards.length > 0) {
            html += `<div style="width: 100%; max-width:340px; margin-bottom: 15px; display:flex; flex-wrap:wrap; justify-content:center; gap:10px;">`;
            myCards.forEach((pc, idx) => {
                let typeClass = pc.type === 'buff' ? 'buff-card' : 'debuff-card';
                if(pc.tier === 'premium') typeClass = 'premium-card';
                let tagTxt = pc.tier === 'premium' ? '💎 PREMIUM' : (pc.type === 'buff' ? '🛡️ HELPOTUS' : '🚫 SABOTAASI');
                let playCost = window.getCardPlayCost(pc.cardId);
                let costHtml = playCost > 0 ? `<div style="background:var(--warning); color:#000; font-weight:900; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-bottom:4px; width:fit-content;">HINTA: ${playCost} P</div>` : `<div style="background:#22c55e; color:#fff; font-weight:900; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-bottom:4px; width:fit-content;">ILMAINEN PELATA</div>`;
                
                let cRot = (pseudoRandom((hIndex + idx) * 4.4) * 10 - 5).toFixed(1); 
                let pinLeft = 50 + (Math.floor(pseudoRandom((hIndex + idx) * 5.5) * 20) - 10);
                
                let encodedBy = pc.by.replace(/"/g, '&quot;');
                let encodedTarget = pc.target.replace(/"/g, '&quot;');
                let cDef = window.allCards.find(c => c && c.id === pc.cardId) || {d: pc.cardDesc, customType: pc.customType, diff: pc.diff};
                let descHtml = window.getCardDesc(cDef, pc.cardId);
                
                let pLen = descHtml.length;
                let pSize = pLen > 100 ? '0.7rem' : '0.85rem';
                let pLineHeight = pLen > 100 ? '1.15' : '1.35';

                // Fyysisesti hieman isommat kortit ilmoitustaululla, jotta mahtuu lukemaan!
                html += `
                <div class="pinned-card-container" style="transform: rotate(${cRot}deg);" onclick="event.stopPropagation(); window.showEventCard('${pc.cardId}', '${encodedTarget}', '${encodedBy}')">
                    <div class="pushpin" style="left: ${pinLeft}%;"></div>
                    <div class="physical-card ${typeClass}" style="width: 155px; height: 215px;">
                        ${costHtml}
                        <div class="card-type-tag">${tagTxt}</div>
                        <h3>${pc.cardName}</h3><p style="font-size:${pSize}; line-height:${pLineHeight}; overflow-y:auto; margin-bottom:4px; flex:1;">${descHtml}</p>
                        <div style="background:rgba(0,0,0,0.05); padding:4px; border-radius:4px; font-size:0.75rem; text-align:center; font-weight:bold; margin-top:auto;">
                            Kohteelle: ${pc.target === 'KAIKKI VASTUSTAJAT' ? 'KAIKKI' : 'Sinuun!'}<br><span style="font-weight:normal;">(${pc.by})</span>
                        </div>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        if (otherCards.length > 0) {
            let pRot = (pseudoRandom(hIndex * 1.5) * 4 - 2).toFixed(1);
            html += `<div style="width: 100%; max-width:300px; margin-top: 15px; margin-bottom: 15px; position:relative; background:var(--paper-bg); padding:10px; box-shadow: 2px 4px 10px rgba(0,0,0,0.2); border-radius:2px; transform: rotate(${pRot}deg);">
                        <div class="tape tape-top" style="--rot:-2deg;"></div>
                        <h2 style="color:var(--text-main); font-size:0.95rem; margin-bottom:10px; border-bottom:2px dashed #ccc; padding-bottom:5px; font-family:'Kalam', cursive; text-align:center;">PELITAPAHTUMAT</h2>
                        <div style="display:flex; flex-direction:column; gap:6px;">`;
            otherCards.forEach((pc) => {
                let typeIcon = pc.type === 'buff' ? '🛡️' : '🚫';
                let typeColor = pc.type === 'buff' ? 'var(--info)' : 'var(--danger)';
                let encodedBy = pc.by.replace(/"/g, '&quot;');
                let encodedTarget = pc.target.replace(/"/g, '&quot;');
                
                html += `
                <div style="background:rgba(0,0,0,0.05); padding:6px; border-radius:4px; font-size:0.75rem; border-left: 4px solid ${typeColor}; cursor:pointer;" onclick="event.stopPropagation(); window.showEventCard('${pc.cardId}', '${encodedTarget}', '${encodedBy}')">
                    <b style="font-size:0.85rem;">${typeIcon} ${pc.cardName}</b><br>
                    <span style="color:#555;">Käyttäjä: <b>${pc.by}</b> ➡️ Kohde: <b style="color:${typeColor};">${pc.target}</b></span>
                </div>`;
            });
            html += `</div></div>`;
        }
    }

    let playersToRender = hData.players || allPlayers;
    let sortedPlayers = [...playersToRender].filter(p=>p).sort((a,b) => (a.dgScore || 0) - (b.dgScore || 0));
    
    html += `
    <div class="score-spiral-note" style="transform: rotate(${rot3}deg);">
        <div class="pin pin-blue" style="top: 15px; right: 20px;"></div>
        <div class="pin pin-red" style="bottom: 25px; right: 15px;"></div>
        <h2 style="color:var(--ink-blue); font-family: 'Kalam', cursive; font-size:1.6rem; text-decoration:underline;">🏆 Tulos</h2>`;
    
    let renderScoreDots = (strokes, p_par) => {
        if(!strokes) return '-';
        let diff = strokes - p_par;
        let cClass = diff === 0 ? 'even' : (diff < 0 ? 'green' : 'red');
        if (diff < -1) cClass = 'blue'; 
        return `<span class="receipt-circle ${cClass}">${strokes}</span>`;
    };

    sortedPlayers.forEach((p, i) => {
        let strokes = isHistory && hData.holeResults ? hData.holeResults[p.name] : null;
        let scoreHTML = renderScoreDots(strokes, par);
        html += `
        <div class="player-row-paper">
            <span class="paper-name" style="font-size:1.4rem;">${p.name}</span>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span style="font-size:1rem; color:var(--warning); font-weight:900;">${p.score || 0} P</span>
                <div class="score-display-paper" style="width:auto !important; min-width:34px; height:34px !important; font-size:1.2rem !important; margin-left:auto; padding:0 5px;">${scoreHTML}</div>
            </div>
        </div>`;
    });
    html += `</div>`;
    
    // ANIMOITU SOLVAUS 2. VÄYLÄSTÄ ALKAEN
    if (hIndex >= 2) {
        let insultIndex = Math.floor(pseudoRandom(hIndex * 8.8) * insults.length);
        let svgIndex = Math.floor(pseudoRandom(hIndex * 9.9) * doodleSVGs.length);
        let dText = insults[insultIndex]; let dSvg = doodleSVGs[svgIndex];
        let dRot = -15 + (pseudoRandom(hIndex * 3) * 30);
        
        let opacityClass = isHistory ? 'opacity: 0.8;' : 'opacity: 1;';
        let drawnClass = isHistory ? 'drawn' : 'drawn'; 
        
        let posRand = pseudoRandom(hIndex * 7); let posCss = ""; let offsetX = 160; let offsetY = 80; 
        if (posRand < 0.25) posCss = `top: -${offsetY}px; left: -${offsetX}px;`; else if (posRand < 0.5) posCss = `top: -${offsetY}px; right: -${offsetX}px;`; else if (posRand < 0.75) posCss = `bottom: -${offsetY}px; left: -${offsetX}px;`; else posCss = `bottom: -${offsetY}px; right: -${offsetX}px;`;

        html += `
        <div class="doodle-drawing ${drawnClass}" style="${posCss} ${opacityClass} transform: rotate(${dRot}deg) scale(1);">
            <div class="doodle-bubble">${dText}</div>
            <svg class="doodle-svg doodle-path" viewBox="0 0 100 100"><path d="${dSvg}"/></svg>
        </div>`;
    }
    html += `</div>`;
    return html;
};

window.renderBoard = function() {
    const board = el('corkboard-surface');
    if (!board) return;
    if (!currentCourse) { board.innerHTML = ''; return; }
    let totalHoles = currentCourse.pars.length; let cols = Math.min(9, totalHoles); let rows = Math.ceil(totalHoles / cols);
    let exactWidth = 240 + (cols * 380) + ((cols - 1) * 80); let exactHeight = 240 + (rows * 950) + ((rows - 1) * 60);
    
    board.style.width = `${exactWidth}px`; board.style.height = `${exactHeight}px`; board.style.gridTemplateColumns = `repeat(${cols}, 380px)`;
    let html = ``; window.gameHistory.forEach((h, index) => { html += window.getHoleCellHTML(h, index + 1, false, true); });
    
    if (currentHoleIndex > totalHoles) {
        let sortedPlayers = [...allPlayers].filter(p=>p).sort((a,b) => (a.dgScore || 0) - (b.dgScore || 0));
        let winner = sortedPlayers[0] || {name: "Tuntematon", dgScore: 0, score: 0};
        html += `
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-3deg); background:#fff; padding:50px; box-shadow:15px 30px 60px rgba(0,0,0,0.6); border:2px solid #ccc; z-index:100; text-align:center; min-width:350px; border-radius:4px;">
            <div class="tape tape-top" style="width:150px; top:-10px; height:25px;"></div>
            <h1 style="font-family:'Kalam', cursive; font-size:4rem; color:var(--primary); margin-bottom:10px; line-height:1;">🏆 PELI<br>PÄÄTTYNYT!</h1>
            <h2 style="font-size:1.5rem; margin-bottom:5px; color:#555;">VOITTAJA:</h2>
            <div style="font-size:3.5rem; font-weight:900; color:var(--ink-blue); margin-bottom:20px; font-family:'Kalam', cursive;">${winner.name}</div>
            <div style="background:#f1f5f9; padding:20px; border-radius:12px; border:2px dashed #94a3b8;">
                <p style="font-size:1.8rem; font-weight:900; color:#000; margin-bottom:10px;">Tulos: ${winner.dgScore > 0 ? '+' : ''}${winner.dgScore}</p>
                <p style="font-size:1.5rem; font-weight:800; color:var(--warning);">Lopulliset varat: ${winner.score} P</p>
            </div>
        </div>`;
    } else if (activeHole) { html += window.getHoleCellHTML({ rule: activeHole.rule, playedCards: activeHole.playedCards, color: activeHole.color, penColor: activeHole.penColor, players: allPlayers }, currentHoleIndex, true, false); }
    board.innerHTML = html;
};

window.renderReceipt = function() {
    if(!allPlayers || allPlayers.length === 0 || !currentCourse) { if(el('receipt-printer-container')) el('receipt-printer-container').style.display = 'none'; return; }
    if(el('receipt-printer-container')) el('receipt-printer-container').style.display = 'flex';
    let renderScoreDots = (strokes, p_par) => { if(!strokes) return '-'; let diff = strokes - p_par; let cClass = diff === 0 ? 'even' : (diff < 0 ? 'green' : 'red'); if (diff < -1) cClass = 'blue'; return `<span class="receipt-circle ${cClass}">${strokes}</span>`; };
    let generateHistoryLines = (isMini) => { let html = ``; let startIdx = isMini ? Math.max(0, window.gameHistory.length - 2) : 0; for(let i=startIdx; i<window.gameHistory.length; i++) { let h = window.gameHistory[i]; let par = currentCourse.pars ? (currentCourse.pars[i] || 3) : 3; if(!isMini) html += `<div class="r-hole-title">Väylä ${i+1} <span style="color:#666;">(PAR ${par})</span></div>`; if(h.holeResults && !isMini) { for(let pName in h.holeResults) { html += `<div class="r-row"><span>${pName.substring(0, 12)}</span>${renderScoreDots(h.holeResults[pName], par)}</div>`; } } } return html; };
    let generateTotals = (isMini) => { let html = ``; let sorted = [...allPlayers].filter(p=>p).sort((a,b) => (a.dgScore||0) - (b.dgScore||0)); sorted.forEach(p => { let dgStr = p.dgScore > 0 ? `+${p.dgScore}` : (p.dgScore === 0 ? 'E' : p.dgScore); let fSize = isMini ? '1.3rem' : '1.8rem'; html += `<div class="r-row" style="font-size:${fSize}; margin-bottom: 2px;"><span>${p.name.substring(0, isMini?6:12)}</span><span>${dgStr}</span></div>`; }); return html; };
    if(el('receipt-mini-totals')) el('receipt-mini-totals').innerHTML = generateTotals(true);
    if(el('receipt-full-content')) { el('receipt-full-content').innerHTML = `<div class="r-title" style="font-size:1.5rem; margin-bottom:15px;">TULOKSET</div>` + generateHistoryLines(false) + `<div class="r-tot-sec" style="margin-top:10px; border-top: 2px dashed #111; padding-top:10px;">${generateTotals(false)}</div>`; }
};

//==============================================
// KORTIN PELAAMINEN JA KAUPPA
//==============================================
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
            let checkTier = pc.tier;
            let checkType = pc.type;
            let checkCustom = pDef ? pDef.customType : null;
            
            if (checkTier === 'normal' && checkType === 'sabotage') {
                if (pc.cardId.startsWith('minor_') || checkCustom === 'minor_sabotage') playedMinors++;
                if (pc.cardId.startsWith('major_') || checkCustom === 'major_sabotage') playedMajors++;
            }
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
    window.logEvent(`${myName} pelasi kortin ${card.def.n} kohteelle ${targetName}. (Hinta: ${card.cost} P)`);
    window.showNotification(`🃏 Pelasit kortin: ${card.def.n}`, card.def.type === 'buff' ? 'info' : 'debuff');
};

window.forceDiscard = function(cId, isNormal) {
    let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean);
    const me = (nextPlayers || []).find(p => p && p.name === myName);
    if(!me) return;
    
    me.cards = Array.isArray(me.cards) ? me.cards : Object.values(me.cards);
    me.cards = me.cards.filter(Boolean);
    let idx = me.cards.indexOf(cId);
    
    if(idx !== -1) {
        me.cards.splice(idx, 1);
        if (isNormal) { 
            let sellReward = window.gameSettings.sellReward !== undefined ? window.gameSettings.sellReward : 1;
            me.score = (parseInt(me.score) || 0) + sellReward; 
            window.logScore(myName, sellReward, `Myi kortin kädestä`);
            window.showAppleToast(`+${sellReward} P (Myyty)`, '💰'); 
        }
        else { window.showAppleToast('Kortti poistettu', '🗑️'); }
    }
    
    if (window.pendingShopPurchase) {
        let pId = window.pendingShopPurchase.id; let pPrice = window.pendingShopPurchase.price;
        if (me.score >= pPrice) {
            me.score -= pPrice; me.boughtThisHole = true; me.cards.push(pId);
            window.logScore(myName, -pPrice, `Osti kortin kaupasta`);
            let nextShop = JSON.parse(JSON.stringify(activeHole.shop));
            const sIdx = (nextShop || []).findIndex(i => i && i.id === pId);
            if (sIdx !== -1) nextShop.splice(sIdx, 1);
            update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers), 'gameState/activeHole/shop': window.cleanFirebaseData(nextShop) });
            window.pendingShopPurchase = null; 
            window.switchShopTab('sell');
            window.showNotification(`🛒 Ostit edun!`, 'warning');
            return;
        } else { window.pendingShopPurchase = null; }
    }
    set(ref(db, 'gameState/players'), window.cleanFirebaseData(nextPlayers));
};

window.buyShopItem = function(idStr, nameStr, priceVal) {
    if (!activeHole || !activeHole.shop) return; 
    let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean);
    const me = (nextPlayers || []).find(p => p && p.name === myName);
    if (!me || me.score < priceVal || me.boughtThisHole) return; 

    let limit = window.gameSettings.handLimit || 5;
    let currentCards = me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)).filter(Boolean).length : 0;
    
    if (window.gameSettings.handLimitEnabled && currentCards >= limit) {
        window.pendingShopPurchase = { id: idStr, name: nameStr, price: priceVal };
        window.switchShopTab('sell');
        window.renderShop(activeHole.shop, me.score, me.boughtThisHole); 
        return;
    }

    const shopIndex = (activeHole.shop || []).findIndex(i => i && i.id === idStr);
    if (shopIndex !== -1) {
        me.score -= priceVal; me.boughtThisHole = true;
        window.logScore(myName, -priceVal, `Osti kortin: ${nameStr}`);
        let nextShop = JSON.parse(JSON.stringify(activeHole.shop)); nextShop.splice(shopIndex, 1);
        me.cards = me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)) : []; me.cards.push(idStr);
        update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers), 'gameState/activeHole/shop': window.cleanFirebaseData(nextShop) });
        
        window.switchShopTab('sell');
        window.logEvent(`${myName} osti edun: ${nameStr}.`); 
        window.showNotification(`🛒 Ostit edun: ${nameStr}`, 'warning');
    }
};

window.cancelShopPurchase = function() {
    window.pendingShopPurchase = null;
    const me = (allPlayers || []).find(p => p && p.name === myName);
    window.renderShop(activeHole ? activeHole.shop : null, me ? me.score : 0, me ? me.boughtThisHole : false);
    window.switchShopTab('buy');
};

window.openShop = function(tab) {
    window.showModalSafe('shopModal', 'block');
    if(window.switchShopTab) window.switchShopTab(tab);
};

window.closeShopModal = function() {
    window.pendingShopPurchase = null; 
    if(el('shopModal')) el('shopModal').style.display = 'none';
};

window.switchShopTab = function(tab) {
    const modalEl = document.querySelector('#shopModal .shop-binder-modal');
    if (tab === 'buy') {
        window.pendingShopPurchase = null; 
        el('shopBuyArea').style.display = 'block'; el('shopSellArea').style.display = 'none';
        if(el('shopTabBuyBtn')) el('shopTabBuyBtn').classList.add('active');
        if(el('shopTabSellBtn')) el('shopTabSellBtn').classList.remove('active');
        if(modalEl) { modalEl.classList.remove('theme-own'); modalEl.classList.add('theme-shop'); }
    } else {
        el('shopBuyArea').style.display = 'none'; el('shopSellArea').style.display = 'block';
        if(el('shopTabBuyBtn')) el('shopTabBuyBtn').classList.remove('active');
        if(el('shopTabSellBtn')) el('shopTabSellBtn').classList.add('active');
        if(modalEl) { modalEl.classList.remove('theme-shop'); modalEl.classList.add('theme-own'); }
    }
    let me = (allPlayers || []).find(p => p && p.name === myName);
    window.renderShop(activeHole ? activeHole.shop : null, me ? me.score : 0, me ? me.boughtThisHole : false);
};

window.renderShop = function(shopArray, myPoints, boughtThisHole) {
    const modalContainer = el('shopModalCards');
    const sellContainer = el('shopSellCardsContainer');
    
    if(!shopArray || shopArray.length === 0) { 
        if(modalContainer) modalContainer.innerHTML = '<p style="color:var(--text-muted); font-size:1.2rem; text-align:center; padding:20px; font-weight:bold; width:100%;">Kauppa on suljettu.</p>';
    } else {
        let html = '';
        shopArray.forEach(item => {
            if(!item) return; 
            const canAfford = myPoints >= item.price && !boughtThisHole;
            let btnText = boughtThisHole ? 'OSTETTU' : (canAfford ? 'OSTA ETU' : 'EI VARAA');
            let btnClass = canAfford && !boughtThisHole ? 'btn-warning' : 'btn-secondary';
            let dis = (!canAfford || boughtThisHole) ? 'disabled' : '';
            let descHtml = window.getCardDesc({d: item.d, customType: item.customType, diff: item.diff}, item.id);
            
            let cLen = descHtml.length;
            let pSize = cLen > 100 ? '0.65rem' : '0.85rem';
            let pLineHeight = cLen > 100 ? '1.15' : '1.35';
            
            // Fyysisesti hieman isommat kortit (155x215 base) kaupassakin mahtuvat paremmin
            html += `
                <div class="shop-item-wrapper">
                    <div class="physical-card premium-card" style="height: 260px; min-height: 260px;" onclick="window.openCardDetail('${item.id}', 'shop', ${item.price}, ${canAfford}, ${boughtThisHole})" style="cursor:pointer;">
                        <span class="card-price-tag">${item.price} P</span>
                        <div style="background:#22c55e; color:#fff; font-weight:900; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-bottom:4px; width:fit-content;">ILMAINEN PELATA</div>
                        <div class="card-type-tag">💎 KAUPPA</div><h3>${item.n}</h3><p style="font-size:${pSize}; line-height:${pLineHeight}; overflow-y:auto; margin-bottom:4px; flex:1;">${descHtml}</p>
                        <div style="text-align:center; font-weight:900; font-size:0.75rem; color:#94a3b8; padding-top:10px; margin-top:auto;">🔄 TARKASTELU</div>
                    </div>
                    <button class="shop-item-btn ${btnClass}" ${dis} onclick="window.buyShopItem('${item.id}', '${item.n}', ${item.price})">${btnText}</button>
                </div>`;
        });
        if(modalContainer) modalContainer.innerHTML = html; 
    }

    let me = (allPlayers || []).find(p => p && p.name === myName);
    let myCards = me && me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)).filter(Boolean) : [];
    myCards.sort((a,b) => window.getCardSortWeight(a) - window.getCardSortWeight(b));

    let sellHtml = '';
    if(myCards.length === 0) {
         sellHtml = '<p style="color:var(--text-muted); font-size:1.1rem; text-align:center; padding:20px; font-weight:bold; width:100%;">Kätesi on tyhjä.</p>';
    } else {
        myCards.forEach((cId, i) => {
            const cDef = window.allCards.find(sc => sc && sc.id === cId);
            if(!cDef) return; 
            let typeClass = cDef.type === 'buff' ? 'buff-card' : 'debuff-card';
            if(cDef.tier === 'premium') { typeClass = 'premium-card'; }
            let tagTxt = cDef.tier === 'premium' ? '💎 PREMIUM' : (cDef.type === 'buff' ? '🛡️ HELPOTUS' : '🚫 SABOTAASI');
            let isNormal = cDef.tier === 'normal';
            let sellBtnIcon = isNormal ? '♻️' : '🗑️';
            
            let playCost = window.getCardPlayCost(cId);
            let canAffordPlay = myPoints >= playCost;
            let playBtnClass = canAffordPlay ? 'btn-success' : 'btn-secondary';
            let playDisabled = canAffordPlay ? '' : 'disabled';
            let costHtml = playCost > 0 ? `<div style="background:var(--warning); color:#000; font-weight:900; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-bottom:4px; width:fit-content;">HINTA: ${playCost} P</div>` : `<div style="background:#22c55e; color:#fff; font-weight:900; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-bottom:4px; width:fit-content;">ILMAINEN PELATA</div>`;
            let descHtml = window.getCardDesc(cDef, cId);
            
            let pLen = descHtml.length;
            let pSize = pLen > 100 ? '0.65rem' : '0.85rem';
            let pLineHeight = pLen > 100 ? '1.15' : '1.35';

            sellHtml += `
            <div class="shop-item-wrapper">
                <div class="physical-card worn-card ${typeClass}" style="height: 260px; min-height: 260px;" onclick="window.openCardDetail('${cId}', 'sell')" style="cursor:pointer;">
                    ${costHtml}
                    <div class="card-type-tag">${tagTxt}</div><h3>${cDef.n}</h3><p style="font-size:${pSize}; line-height:${pLineHeight}; overflow-y:auto; margin-bottom:4px; flex:1;">${descHtml}</p>
                    <div style="text-align:center; font-weight:900; font-size:0.75rem; color:var(--text-muted); margin-top:auto; padding-top:10px;">🔄 TARKASTELU</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="shop-item-btn ${playBtnClass}" style="flex:1;" ${playDisabled} onclick="window.openTargetModal('${cId}')">PELAA</button>
                    <button class="shop-item-btn btn-danger" style="width:50px; font-size:1.2rem;" onclick="window.forceDiscard('${cId}', ${isNormal})">${sellBtnIcon}</button>
                </div>
            </div>`;
        });
    }
    if (sellContainer) sellContainer.innerHTML = sellHtml;
    
    let alertEl = el('pendingPurchaseAlert');
    if (alertEl) {
        let limitEnabled = window.gameSettings.handLimitEnabled !== undefined ? window.gameSettings.handLimitEnabled : true;
        let limit = window.gameSettings.handLimit !== undefined ? window.gameSettings.handLimit : 5;
        let isOverLimit = limitEnabled && myCards.length > limit;

        if (window.pendingShopPurchase) {
            alertEl.style.display = 'block';
            alertEl.innerHTML = `<div style="font-weight:900; font-size:1.2rem; margin-bottom:8px;">⚠️ KÄSI TÄYNNÄ!</div><div style="font-size:1.05rem; font-weight:700; margin-bottom:15px; line-height:1.4;">Haluat ostaa kortin <strong id="pendingCardName">${window.pendingShopPurchase.name}</strong>. Myy tai hävitä yksi kortti alta tehdäksesi tilaa, jolloin osto suoritetaan automaattisesti!</div><button class="btn btn-secondary" style="padding:12px; font-size:0.95rem; color:#000;" onclick="event.stopPropagation(); if(window.cancelShopPurchase) window.cancelShopPurchase()">PERUUTA OSTO</button>`;
        } else if (isOverLimit) {
            alertEl.style.display = 'block';
            alertEl.innerHTML = `<div style="font-weight:900; font-size:1.2rem; margin-bottom:8px;">⚠️ KÄSIRAJA YLITETTY!</div><div style="font-size:1.05rem; font-weight:700; line-height:1.4;">Sinulla on liikaa kortteja kädessäsi (${myCards.length}/${limit}). Myy tai hävitä kortteja päästäksesi takaisin sallittuun rajaan!</div>`;
        } else {
            alertEl.style.display = 'none';
        }
    }
};

window.showHandLimitModal = function(cards) {
    if(!el('handLimitModal')) return;
    let limit = window.gameSettings.handLimit || 5;
    el('handLimitCount').innerText = `${cards.length} / ${limit}`;
    let html = '';
    
    cards.sort((a,b) => window.getCardSortWeight(a) - window.getCardSortWeight(b));
    let sellReward = window.gameSettings.sellReward !== undefined ? window.gameSettings.sellReward : 1;

    cards.forEach(cId => {
        const cDef = window.allCards.find(c => c && c.id === cId);
        if(!cDef) return;
        let isNormal = cDef.tier === 'normal';
        let btnTxt = isNormal ? `♻️ MYY (+${sellReward} P)` : '🗑️ POISTA';
        let btnClass = isNormal ? 'btn-success' : 'btn-danger';
        html += `<div style="background:#fff; border-radius:12px; padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; color:#000;"><div style="text-align:left;"><div style="font-size:0.75rem; font-weight:900; color:var(--text-muted);">${isNormal ? 'NORMAALI' : '💎 PREMIUM'}</div><div style="font-size:1.1rem; font-weight:900; color:#000;">${cDef.n}</div></div><button class="btn ${btnClass}" style="width:auto; padding:10px 15px; font-size:0.85rem; margin:0;" onclick="window.forceDiscard('${cId}', ${isNormal})">${btnTxt}</button></div>`;
    });
    el('handLimitCards').innerHTML = html;
    window.showModalSafe('handLimitModal');
};

//==============================================
// TURVALLINEN KARUSELLI Z-PÄIVITYKSELLÄ (VÄLÄHTÄMÄTÖN)
//==============================================
window.isFlipping = false;
window.flippedCards = new Set();

window.forceCarouselLayoutUpdate = function() {
    const container = el('cardCarousel');
    if(!container) return;
    const cards = Array.from(container.querySelectorAll('.carousel-card-wrapper'));
    const scrollLeft = container.scrollLeft; 
    const containerWidth = container.clientWidth || window.innerWidth;
    const centerOffset = containerWidth / 2; 
    const cardWidth = 320; 
    const paddingLeft = centerOffset - (cardWidth / 2); 
    
    for (let index = 0; index < cards.length; index++) {
        const card = cards[index];
        const cardCenter = paddingLeft + (index * cardWidth) + (cardWidth / 2) - scrollLeft;
        const diff = (cardCenter - centerOffset) / 160; 
        const transX = diff * -40; 
        const transY = Math.abs(diff) * 20; 
        const transZ = Math.abs(diff) * -150; 
        const rotZ = diff * 5; 
        const scale = Math.max(0.85, 1 - Math.abs(diff) * 0.15); 
        card.style.transform = `translate3d(${transX}px, ${transY}px, ${transZ}px) rotateZ(${rotZ}deg) scale(${scale})`;
        card.style.zIndex = 100 - Math.floor(Math.abs(diff)*10);
    }
};

window.flipCard = function(index) {
    if(window.isFlipping) return;
    const inner = el(`card3d-inner-${index}`);
    if (!inner) return;
    
    window.isFlipping = true;
    let cId = window.carouselCards[index];
    let isFlippingDown = !window.flippedCards.has(cId);
    
    if (isFlippingDown) {
        window.flippedCards.add(cId);
        inner.classList.add('flipped');
    } else {
        window.flippedCards.delete(cId);
        inner.classList.remove('flipped');
    }
    
    setTimeout(() => {
        let currentMode = window.carouselCurrentMode;
        if (currentMode === 'hand' || currentMode === 'sell') {
            
            let targetCardIdToFocus = null;

            if (isFlippingDown) {
                for (let i = index + 1; i < window.carouselCards.length; i++) {
                    if (!window.flippedCards.has(window.carouselCards[i])) {
                        targetCardIdToFocus = window.carouselCards[i];
                        break;
                    }
                }
                if (!targetCardIdToFocus) {
                    for (let i = index - 1; i >= 0; i--) {
                         if (!window.flippedCards.has(window.carouselCards[i])) {
                            targetCardIdToFocus = window.carouselCards[i];
                            break;
                         }
                    }
                }
            } else {
                targetCardIdToFocus = cId;
            }

            window.carouselCards.sort((a,b) => {
                let fA = window.flippedCards.has(a) ? 1 : 0;
                let fB = window.flippedCards.has(b) ? 1 : 0;
                if (fA !== fB) return fB - fA; 
                return window.getCardSortWeight(a) - window.getCardSortWeight(b);
            });
            
            if(targetCardIdToFocus) {
                window.carouselCurrentIndex = window.carouselCards.indexOf(targetCardIdToFocus);
            } else {
                window.carouselCurrentIndex = 0;
            }
            
            const container = el('cardCarousel');
            if (container) {
                // Fyysinen DOM reorder ilman innerHTML renderiä (poistaa välähdyksen kokonaan)
                window.carouselCards.forEach(id => {
                    let node = container.querySelector(`[data-id="${id}"]`);
                    if (node) container.appendChild(node);
                });
                
                // Korjataan onclick-indeksit uudelle järjestykselle
                window.carouselCards.forEach((id, i) => {
                    let innerNode = container.querySelector(`[data-id="${id}"] .card-3d-inner`);
                    if (innerNode) {
                        innerNode.id = `card3d-inner-${i}`; 
                        if (window.flippedCards.has(id)) innerNode.classList.add('flipped');
                        else innerNode.classList.remove('flipped');
                    }
                    let wrapper = container.querySelector(`[data-id="${id}"]`);
                    if(wrapper) {
                        wrapper.setAttribute('onclick', `window.flipCard(${i})`);
                        wrapper.id = `carousel-wrapper-${i}`;
                    }
                });

                container.scrollLeft = (window.carouselCurrentIndex * 320);
                window.forceCarouselLayoutUpdate();
            }
            window.updateCarouselButtons();
        }
        window.isFlipping = false;
    }, 300); 
};

window.renderCarousel = function() {
    const container = el('cardCarousel');
    if(!container) return;
    
    let html = '';
    window.carouselCards.forEach((cId, i) => {
        let cDef = window.allCards.find(c => c && c.id === cId);
        if(!cDef) return;
        let typeClass = cDef.type === 'buff' ? 'buff-card' : 'debuff-card';
        if(cDef.tier === 'premium') typeClass = 'premium-card';
        let tagTxt = cDef.tier === 'premium' ? '💎 PREMIUM' : (cDef.type === 'buff' ? '🛡️ HELPOTUS' : '🚫 SABOTAASI');
        let backClass = cDef.tier === 'premium' ? 'card-back-premium' : (cDef.type === 'buff' ? 'card-back-buff' : 'card-back-sabotage');
        let backIcon = cDef.tier === 'premium' ? '💎' : (cDef.type === 'buff' ? '🛡️' : '🚫');
        
        let playCost = window.getCardPlayCost(cId);
        let costHtml = playCost > 0 ? `<div style="background:var(--warning); color:#000; font-weight:900; font-size:0.9rem; padding:4px 8px; border-radius:4px; margin-bottom:8px; width:fit-content; box-shadow:0 2px 4px rgba(0,0,0,0.3);">HINTA: ${playCost} P</div>` : `<div style="background:#22c55e; color:#fff; font-weight:900; font-size:0.9rem; padding:4px 8px; border-radius:4px; margin-bottom:8px; width:fit-content; box-shadow:0 2px 4px rgba(0,0,0,0.3);">ILMAINEN PELATA</div>`;
        let flippedClass = window.flippedCards.has(cId) ? 'flipped' : '';
        let descHtml = window.getCardDesc(cDef, cId);
        
        let cLen = descHtml.length;
        let cSize = cLen > 150 ? '1.1rem' : (cLen > 80 ? '1.3rem' : '1.6rem');
        let cLineHeight = cLen > 150 ? '1.2' : '1.4';
        
        html += `
            <div class="carousel-card-wrapper" data-id="${cId}" id="carousel-wrapper-${i}" onclick="window.flipCard(${i})">
                <div class="card-3d-inner ${flippedClass}" id="card3d-inner-${i}">
                    <div class="card-face card-front ${typeClass}">
                        <div style="text-align:left; display:flex; flex-direction:column; height:100%; position:relative; z-index:20;">
                            ${costHtml}
                            <div class="card-type-tag" style="font-size:1.3rem; margin-bottom:12px;">${tagTxt}</div>
                            <h3 style="font-size:2.4rem; margin-bottom:20px; word-break:break-word; hyphens:auto; line-height:1.1;">${cDef.n}</h3>
                            <p style="font-size:${cSize}; font-weight:800; line-height:${cLineHeight}; overflow-y:auto; padding-right:5px;">${descHtml}</p>
                        </div>
                    </div>
                    <div class="card-face card-back ${backClass}">
                        <div class="card-back-icon">${backIcon}</div>
                        <div style="color:#fff; font-weight:900; font-size:2rem; margin-top:20px; letter-spacing:3px;">FRIBAMESTARI</div>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

window.initNativeCarousel = function() {
    const container = el('cardCarousel');
    if(!container) return;
    window.forceCarouselLayoutUpdate();
    container.addEventListener('scroll', () => { requestAnimationFrame(window.forceCarouselLayoutUpdate); }, {passive: true});
};

window.openCardDetail = function(cId, mode, arg1, arg2, arg3) {
    if (mode === 'hand' || mode === 'sell') {
        const me = (allPlayers || []).find(p => p && p.name === myName);
        window.flippedCards = new Set();
        window.carouselCards = me && me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)).filter(Boolean) : [];
        window.carouselCards.sort((a,b) => window.getCardSortWeight(a) - window.getCardSortWeight(b));
    } else if (mode === 'shop') {
        window.carouselCards = activeHole && activeHole.shop ? (activeHole.shop || []).map(c => c.id) : [];
    } else if (mode === 'gm') { window.carouselCards = (window.allCards || []).map(c => c.id); } 
    else { window.carouselCards = [cId]; }
    
    window.carouselCurrentMode = mode; window.carouselArgs = [arg1, arg2, arg3];
    window.carouselCurrentIndex = window.carouselCards.indexOf(cId);
    if(window.carouselCurrentIndex === -1) window.carouselCurrentIndex = 0;
    
    window.renderCarousel(); 
    window.showModalSafe('cardDetailModal');
    
    setTimeout(() => {
        window.initNativeCarousel();
        window.updateCarouselButtons(); 
        const container = el('cardCarousel');
        if(container) {
            container.scrollLeft = (window.carouselCurrentIndex * 320); 
            window.forceCarouselLayoutUpdate();
        }
    }, 50);
};

window.updateCarouselButtons = function() {
    if(window.carouselCards.length === 0) return;
    let cId = window.carouselCards[window.carouselCurrentIndex];
    let cDef = window.allCards.find(c => c && c.id === cId);
    if(!cDef) return;
    
    let btnHtml = ''; let mode = window.carouselCurrentMode;
    if (mode === 'hand' || mode === 'sell') {
        let playCost = window.getCardPlayCost(cId);
        let myScore = 0;
        const me = (allPlayers || []).find(p => p && p.name === myName);
        if(me) myScore = me.score || 0;
        let canAffordPlay = myScore >= playCost;
        let playBtnClass = canAffordPlay ? 'btn-success' : 'btn-secondary';
        let playDisabled = canAffordPlay ? '' : 'disabled';
        let sellReward = window.gameSettings.sellReward !== undefined ? window.gameSettings.sellReward : 1;
        
        btnHtml = `<button class="btn ${playBtnClass}" ${playDisabled} style="font-size:1.1rem; padding:18px; box-shadow:0 10px 25px rgba(16,185,129,0.4);" onclick="document.getElementById('cardDetailModal').style.display='none'; window.openTargetModal('${cId}')">PELAA KORTTI</button>`;
        if (cDef.tier === 'normal') { btnHtml += `<button class="btn btn-danger" style="font-size:1.1rem; padding:18px; margin-top:5px; background:var(--danger); color:#fff; box-shadow:0 4px 15px rgba(220,38,38,0.5);" onclick="document.getElementById('cardDetailModal').style.display='none'; window.forceDiscard('${cId}', true)">♻️ MYY KORTTI (+${sellReward} P)</button>`; } 
        else { btnHtml += `<button class="btn btn-secondary glass-card" style="font-size:1.05rem; padding:16px; margin-top:5px; color:var(--danger);" onclick="document.getElementById('cardDetailModal').style.display='none'; window.forceDiscard('${cId}', false)">🗑️ HÄVITÄ KORTTI (0 P)</button>`; }
    } else if (mode === 'shop') {
        let myScore = 0; let bought = false;
        const me = (allPlayers || []).find(p => p && p.name === myName);
        if(me) { myScore = me.score || 0; bought = me.boughtThisHole; }
        let item = activeHole && activeHole.shop ? (activeHole.shop || []).find(s=>s.id===cId) : null;
        let price = item ? item.price : 99;
        let canAfford = myScore >= price && !bought;
        let btnText = bought ? 'OSTETTU' : (canAfford ? `OSTA ETU (${price} P)` : 'EI VARAA');
        let btnClass = canAfford && !bought ? 'btn-warning' : 'btn-secondary';
        let dis = (!canAfford || bought) ? 'disabled' : '';
        btnHtml = `<button class="btn ${btnClass}" ${dis} style="font-size:1.1rem; padding:18px; color:#000; box-shadow:0 10px 25px rgba(245,158,11,0.4);" onclick="document.getElementById('cardDetailModal').style.display='none'; window.buyShopItem('${cId}', '${cDef.n}', ${price})">${btnText}</button>`;
    } else if (mode === 'gm') {
        btnHtml = `<button class="btn btn-success" style="font-size:1.1rem; padding:18px;" onclick="document.getElementById('cardDetailModal').style.display='none'; window.giveCardToPlayer('${cId}')">ANNA TÄMÄ</button>`;
    } else if (mode === 'event') {
        let target = window.carouselArgs[0]; let by = window.carouselArgs[1];
        btnHtml = `<div style="background:var(--danger); color:#fff; padding:15px; border-radius:8px; font-weight:900; font-size:1.2rem; text-align:center; box-shadow:0 4px 10px rgba(0,0,0,0.4); margin-bottom:10px;">SUORITTAJA:<br><span style="font-size:1.8rem; font-family:'Kalam', cursive;">${target}</span><div style="font-size:0.85rem; margin-top:5px; opacity:0.9;">(Määrääjä: ${by})</div></div>`;
    }
    el('cardDetailActionArea').innerHTML = btnHtml;
};

//==============================================
// TULOSTEN SYÖTTÖ & PELIN KULKU
//==============================================
window.changeScore = function(safeId, par, delta) {
    let input = el(`scoreInput_${safeId}`);
    if(!input) return; 
    let val = parseInt(input.value) + delta;
    if(val < 1) val = 1; 
    input.value = val;
    let display = el(`scoreDisplay_${safeId}`);
    if(!display) return; display.innerText = val;
    display.className = 'score-display-paper';
    if(val < par) display.classList.add('score-birdie-paper'); 
    else if(val > par) display.classList.add('score-bogey-paper'); 
};

window.openScoreModal = function() {
    if((allPlayers || []).length === 0) return alert("Ei pelaajia radalla."); 
    let par = currentCourse && currentCourse.pars ? (currentCourse.pars[currentHoleIndex - 1] || 3) : 3;
    
    if(el('scoreModalHoleNum')) el('scoreModalHoleNum').innerText = currentHoleIndex; 
    if(el('scoreModalPar')) el('scoreModalPar').innerText = par; 
    
    const box = el('scoreModalRuleBox');
    if(box) {
        if(activeHole && activeHole.rule) {
            let bTxt = activeHole.rule.type === 'bounty' ? `🏆 TEHTÄVÄ` : '🎲 SÄÄNTÖ';
            box.className = 'post-it-note'; box.style.transform = 'none'; box.style.margin = '0 auto 20px auto'; box.style.width = '100%';
            let bgCol = activeHole.color || '#fef08a';
            box.style.background = bgCol;
            box.innerHTML = `<div style="font-weight:900; font-size:0.85rem; margin-bottom:8px; text-transform:uppercase; color:#666;">📌 ${bTxt}</div><div style="font-size:1.6rem; margin-bottom: 8px; font-weight: 900; line-height: 1.1; color:#111;">${activeHole.rule.n}</div><div style="font-size: 1.15rem; line-height: 1.4; font-weight:700; color:#222;">${activeHole.rule.d}</div>`;
            box.style.display = 'block';
        } else { box.style.display = 'none'; }
    }
    
    const container = el('scoreInputsContainer');
    if(!container) return; 
    let html = ''; let taskCheckboxes = '';
    
    (allPlayers || []).forEach((p, i) => {
        if(!p) return; 
        let encodedName = p.name.replace(/"/g, '&quot;');
        taskCheckboxes += `<label class="task-paper-label"><input type="checkbox" class="task-paper-checkbox" data-name="${encodedName}" /> ${p.name}</label>`;
        let safeId = "player_" + i; 
        html += `<div class="score-row-paper"><span class="score-name-paper">${p.name}</span><div class="score-controls-paper"><button class="btn-score-paper" onclick="window.changeScore('${safeId}', ${par}, -1)">-</button><div id="scoreDisplay_${safeId}" class="score-display-paper">${par}</div><button class="btn-score-paper" onclick="window.changeScore('${safeId}', ${par}, 1)">+</button><input type="hidden" class="score-input-data" data-name="${encodedName}" id="scoreInput_${safeId}" value="${par}" /></div></div>`;
    });
    container.innerHTML = html;
    if(el('taskWinnerContainer')) el('taskWinnerContainer').innerHTML = taskCheckboxes; 
    window.showModalSafe('scoreModal');
};

window.submitScores = function() {
    let par = currentCourse && currentCourse.pars ? (currentCourse.pars[currentHoleIndex - 1] || 3) : 3;
    let playerResults = {};
    (allPlayers || []).forEach(p => { if(p) playerResults[p.name] = { strokes: par, taskWon: false }; });
    
    const inputs = document.querySelectorAll('.score-input-data');
    if(inputs.length === 0) { alert("Virhe: Ei tulosrivejä löydetty! Yritä avata näkymä uudelleen."); if(el('scoreModal')) el('scoreModal').style.display = 'none'; return; }
    
    inputs.forEach(input => { let attrName = input.getAttribute('data-name'); if(playerResults[attrName]) { playerResults[attrName].strokes = parseInt(input.value, 10) || par; } });
    document.querySelectorAll('.task-paper-checkbox:checked').forEach(cb => { let pName = cb.getAttribute('data-name'); if (playerResults[pName]) { playerResults[pName].taskWon = true; } });

    // MEKANIIKAT (Mechanics)
    let majorTargets = [];
    let deniedPassive = [];
    let deniedWin = [];
    let deniedDraw = [];
    let forcePar = [];
    let doubleWin = [];
    let doubleTask = [];

    if (activeHole && activeHole.playedCards) {
        Object.values(activeHole.playedCards).forEach(pc => {
            if (!pc) return;
            let cDef = window.allCards.find(c => c.id === pc.cardId);
            let mech = cDef ? cDef.mech : pc.mech;
            let diff = cDef ? (cDef.diff || 1) : 1;
            
            let targets = pc.target === 'KAIKKI VASTUSTAJAT' ? allPlayers.filter(p => p.name !== pc.by).map(p => p.name) : [pc.target];

            targets.forEach(t => {
                if (pc.cardId.startsWith('major_') || (cDef && cDef.customType === 'major_sabotage')) {
                    majorTargets.push({ name: t, diff: diff });
                }
                if (mech === 'deny_passive') deniedPassive.push(t);
                if (mech === 'deny_win') deniedWin.push(t);
                if (mech === 'deny_draw') deniedDraw.push(t);
                if (mech === 'force_par' && t === pc.by) forcePar.push(t); 
                if (mech === 'double_win' && t === pc.by) doubleWin.push(t);
                if (mech === 'double_task' && t === pc.by) doubleTask.push(t);
            });
        });
    }

    forcePar.forEach(pName => {
        if (playerResults[pName] && playerResults[pName].strokes > par) {
            playerResults[pName].strokes = par;
            window.logEvent(`${pName} käytti Par-Varmistuksen! Tulos korjattiin Pariin.`);
        }
    });

    let minStrokes = 9999; let maxStrokes = -9999;
    for (let key in playerResults) { let s = playerResults[key].strokes; if (s < minStrokes) minStrokes = s; if (s > maxStrokes) maxStrokes = s; }

    let holeWinners = []; let holeLosers = [];
    let allGotBirdie = true; 
    
    for (let key in playerResults) { 
        if (playerResults[key].strokes === minStrokes) holeWinners.push(key); 
        if (playerResults[key].strokes === maxStrokes) holeLosers.push(key); 
        if (playerResults[key].strokes > par - 1) allGotBirdie = false;
    }
    
    if (allGotBirdie) window.logEvent(`🏆 KOKO RYHMÄ HEITTI BIRDIE-ALLIANSSIN! Kaikki saavat +2 P bonuksen!`);

    let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean);

    let ptsWin = window.gameSettings.ptsWin !== undefined ? window.gameSettings.ptsWin : 3;
    let ptsTask = window.gameSettings.ptsTask !== undefined ? window.gameSettings.ptsTask : 2;
    let ptsLose = window.gameSettings.ptsLose !== undefined ? window.gameSettings.ptsLose : 0;
    let ptsPassive = window.gameSettings.ptsPassive !== undefined ? window.gameSettings.ptsPassive : 2;
    let limitEnabled = window.gameSettings.handLimitEnabled !== undefined ? window.gameSettings.handLimitEnabled : true;
    let limit = window.gameSettings.handLimit !== undefined ? window.gameSettings.handLimit : 5;

    nextPlayers.forEach(p => {
        if (!p) return; let res = playerResults[p.name]; if (!res) return; 
        
        let oldPoints = parseInt(p.score, 10) || 0;
        let currentPoints = oldPoints;

        p.dgScore = (parseInt(p.dgScore, 10) || 0) + (res.strokes - par);
        
        if (!deniedPassive.includes(p.name)) {
            currentPoints += ptsPassive;
        } else {
            window.logEvent(`${p.name} menetti passiivisen tulon kortin takia.`);
        }
        
        if (allGotBirdie) currentPoints += 2; 

        if (holeWinners.includes(p.name)) {
            if (!deniedWin.includes(p.name)) {
                // Jaettu voitto (tasapeli) on oletuksena 2/3 voitosta, pyöristettynä alas.
                let actualWinPts = (holeWinners.length > 1) ? Math.floor(ptsWin * 0.66) : ptsWin;
                actualWinPts = Math.max(1, actualWinPts); // Aina vähintään 1 P jaetustakin
                if (doubleWin.includes(p.name)) actualWinPts *= 2;
                
                currentPoints += actualWinPts;
                if(doubleWin.includes(p.name)) window.logEvent(`${p.name} sai tuplapisteet väylävoitosta!`);
            } else {
                window.logEvent(`${p.name} voitti, mutta kortti epäsi voittopisteet!`);
            }
        }
        
        if (res.taskWon) { 
            let actualTaskPts = doubleTask.includes(p.name) ? (ptsTask * 2) : ptsTask;
            currentPoints += actualTaskPts; 
            if(doubleTask.includes(p.name)) window.logEvent(`${p.name} sai tuplapisteet tehtävävoitosta!`);
        }
        
        if (holeLosers.includes(p.name) && minStrokes !== maxStrokes) { 
            currentPoints -= Math.abs(ptsLose); currentPoints = Math.max(0, currentPoints); 
        }
        
        let majorDefeated = majorTargets.find(t => t.name === p.name);
        if (majorDefeated && res.strokes <= par) {
            let rew = majorDefeated.diff === 3 ? 8 : (majorDefeated.diff === 2 ? 5 : 3);
            currentPoints += rew;
            window.logEvent(`${p.name} selätti ison sabotaasin (⭐x${majorDefeated.diff}) ja ansaitsi +${rew} P!`);
        }
        
        p.score = currentPoints; 
        p.boughtThisHole = false; 

        let scoreDelta = currentPoints - oldPoints;
        if (scoreDelta !== 0) window.logScore(p.name, scoreDelta, `Väylän ${currentHoleIndex} tulos`);

        p.cards = p.cards ? (Array.isArray(p.cards) ? p.cards : Object.values(p.cards)) : []; p.cards = p.cards.filter(Boolean);
        if (!deniedDraw.includes(p.name)) {
            let cardsToGive = (holeLosers.includes(p.name) && minStrokes !== maxStrokes) ? 3 : 2;
            let drawn = window.drawFromDeck('normal', cardsToGive);
            drawn.forEach(cId => {
                if (!limitEnabled || p.cards.length < limit) p.cards.push(cId);
            });
        } else {
            window.logEvent(`${p.name} ei saanut nostaa uusia kortteja Korttikadon takia.`);
        }
        p.cards = p.cards.filter(Boolean);
    });
    
    let holeStrokes = {};
    for (let key in playerResults) { holeStrokes[key] = playerResults[key].strokes; }

    let nextHistory = JSON.parse(JSON.stringify(window.gameHistory || []));
    let pastHole = {
        rule: activeHole.rule,
        playedCards: activeHole.playedCards,
        color: activeHole.color || '#fef08a',
        holeResults: holeStrokes,
        players: JSON.parse(JSON.stringify(nextPlayers))
    };
    nextHistory.push(pastHole);
    
    let nextHoleIndex = currentHoleIndex + 1;
    
    let shopIds = window.drawFromDeck('premium', 5);
    let uniqueShop = shopIds.map(id => window.allCards.find(c => c.id === id)).filter(Boolean);
    
    let ruleIdx = window.drawFromDeck('rules', 1)[0];
    let randomRule = window.holeRules[ruleIdx] || {type:"rule", n:"Peli Jatkuu", d:""};
    
    let nextActiveHole = { rule: randomRule, shop: uniqueShop, playedCards: {}, timestamp: Date.now(), color: getRandomColor(), penColor: getRandomPen() };
    
    update(ref(db), window.cleanFirebaseData({
        'gameState/players': nextPlayers,
        'gameState/currentHoleIndex': nextHoleIndex,
        'gameState/activeHole': nextActiveHole,
        'gameState/history': nextHistory,
        'gameState/decks': window.gameDecks
    }));

    if(el('scoreModal')) el('scoreModal').style.display = 'none'; 
    window.logEvent(`${myName} syötti tulokset väylältä ${currentHoleIndex}.`);
    
    setTimeout(() => { window.zoomToHole(nextHoleIndex); }, 400); 
};

// ==============================================
// CUSTOM KORTTIEN LUONTI JA KIRJASTO (GM)
// ==============================================
window.createNewCard = function() {
    let name = el('newCardName').value.trim();
    let desc = el('newCardDesc').value.trim();
    let type = el('newCardType').value;
    let diff = parseInt(el('newCardDiff').value) || 1;
    let price = parseInt(el('newCardPrice').value) || 20;

    if (!name || !desc) return alert("Täytä nimi ja kuvaus!");

    let cId = 'custom_' + Date.now();
    let tier = type === 'monster' ? 'premium' : 'normal';
    let cType = type === 'monster' ? 'buff' : (type.includes('sabotage') ? 'sabotage' : 'buff');

    let newCard = { id: cId, n: name, d: desc, tier: tier, type: cType, customType: type, diff: diff, price: price };

    let nextCustoms = JSON.parse(JSON.stringify(window.customCards || []));
    nextCustoms.push(newCard);
    update(ref(db), { 'gameState/customCards': nextCustoms });
    
    el('newCardName').value = '';
    el('newCardDesc').value = '';
    alert("Kortti luotu onnistuneesti ja se on nyt mukana pelissä!");
    el('createCardModal').style.display = 'none';
};

window.renderCardLibrary = function() {
    let container = el('cardLibraryContainer');
    if(!container) return;
    let html = '';
    const categories = [
        { id: 'minor_sabotage', name: 'Pienet Sabotaasit (Taso 1)' },
        { id: 'major_sabotage', name: 'Isot Sabotaasit (Taso 2)' },
        { id: 'buff', name: 'Helpotukset' },
        { id: 'premium', name: 'Monsterikortit (Premium)' }
    ];
    
    categories.forEach(cat => {
        let cards = window.allCards.filter(c => {
            if (cat.id === 'premium') return c.tier === 'premium';
            if (cat.id === 'buff') return c.tier === 'normal' && c.type === 'buff';
            if (cat.id === 'minor_sabotage') return c.tier === 'normal' && c.type === 'sabotage' && (c.id.startsWith('minor_') || c.customType === 'minor_sabotage');
            if (cat.id === 'major_sabotage') return c.tier === 'normal' && c.type === 'sabotage' && (c.id.startsWith('major_') || c.customType === 'major_sabotage');
            return false;
        });
        
        html += `<h3 style="color:var(--warning); margin-top:20px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px;">${cat.name} (${cards.length} kpl)</h3>`;
        html += `<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">`;
        cards.forEach(c => {
            let diffStr = c.diff ? ` (⭐x${c.diff})` : '';
            let priceStr = c.price ? ` (${c.price} P)` : '';
            html += `<div style="background:rgba(255,255,255,0.1); padding:10px; border-radius:8px;"><b>${c.n}</b><span style="color:var(--warning);">${diffStr}${priceStr}</span><br><span style="font-size:0.85rem; color:#ccc;">${c.d}</span></div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
};

// ==============================================
// RADAN HALLINTA LENNOLTA (GM)
// ==============================================
window.gmChangeHole = function() {
    let sel = el('gmSetCurrentHole');
    if(!sel || !sel.value) return;
    let targetHole = parseInt(sel.value);
    if(confirm(`Haluatko varmasti siirtyä väylälle ${targetHole}? (Tämä ei pyyhi aiempia tuloksia, vaan pelkkä paikka vaihtuu).`)) {
        update(ref(db), { 'gameState/currentHoleIndex': targetHole });
        el('settingsModal').style.display = 'none';
    }
};

window.gmRemoveCurrentHole = function() {
    if(!currentCourse || !currentCourse.pars) return;
    if(confirm("Haluatko poistaa yhden väylän kokonaan radan pituudesta? (Esim. jos rata on 16 väylää, se on tämän jälkeen 15 väylää).")) {
        let nextCourse = JSON.parse(JSON.stringify(currentCourse));
        nextCourse.pars.pop(); 
        update(ref(db), { 'gameState/course': nextCourse });
        el('settingsModal').style.display = 'none';
    }
};

window.populateHoleSelect = function() {
    let sel = el('gmSetCurrentHole');
    if(!sel || !currentCourse || !currentCourse.pars) return;
    sel.innerHTML = currentCourse.pars.map((p, i) => `<option value="${i+1}">Väylä ${i+1}</option>`).join('');
    sel.value = currentHoleIndex;
};


window.startMeilahti = function() {
    let nextCourse = { name: "Meilahti", pars: Array(16).fill(3) };
    let nextHoleIndex = 1;
    
    // Alustetaan pakat
    let normalDeck = window.allCards.filter(c => c.tier === 'normal').map(c => c.id).sort(() => 0.5 - Math.random());
    let premiumDeck = window.allCards.filter(c => c.tier === 'premium').map(c => c.id).sort(() => 0.5 - Math.random());
    let rulesDeck = window.holeRules.map((_, i) => i).sort(() => 0.5 - Math.random());
    window.gameDecks = { normal: normalDeck, premium: premiumDeck, rules: rulesDeck };
    
    let shopIds = window.drawFromDeck('premium', 5);
    let uniqueShop = shopIds.map(id => window.allCards.find(c => c.id === id)).filter(Boolean);
    
    let ruleIdx = window.drawFromDeck('rules', 1)[0];
    let randomRule = window.holeRules[ruleIdx] || {type:"rule", n:"Peli Alkaa", d:""};
    
    let nextActiveHole = { rule: randomRule, shop: uniqueShop, playedCards: {}, timestamp: Date.now(), color: getRandomColor(), penColor: getRandomPen() };
    
    let nextPlayers = [];
    if(allPlayers) {
        nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean).map(p => {
            let pCards = window.drawFromDeck('normal', 3); // 3 aloituskorttia kaikille
            return { ...p, score: 3, dgScore: 0, cards: pCards, boughtThisHole: false };
        });
    }
    
    update(ref(db, 'gameState'), window.cleanFirebaseData({
        course: nextCourse, currentHoleIndex: nextHoleIndex, activeHole: nextActiveHole, players: nextPlayers, history: [], customCards: [], decks: window.gameDecks
    }));

    if(el('courseModal')) el('courseModal').style.display = 'none'; 
    window.logEvent(`${myName} aloitti uuden pelin radalla: ${nextCourse.name}.`);
};

window.cancelCourse = function() {
    if (confirm("Haluatko varmasti lopettaa nykyisen radan? Pelaajat säilyttävät rahansa ja korttinsa, mutta palaatte aulaan.")) {
        let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean);
        update(ref(db, 'gameState'), window.cleanFirebaseData({ course: null, activeHole: null, currentHoleIndex: 1, players: nextPlayers, history: [] }));
        window.logEvent(`${myName} (Asetukset) keskeytti radan.`);
    }
};

window.resetGame = function() {
    if (confirm("Haluatko varmasti nollata koko kierroksen tiedot? Kaikki kirjataan ulos ja peliasetukset palautuvat oletuksiin.")) {
        localStorage.removeItem('friba_browser_mode');
        const defaultSettings = { shopEnabled: true, handLimitEnabled: true, handLimit: 5, ptsWin: 3, ptsTask: 2, ptsLose: 0, ptsPassive: 2, costMinor: 2, costMajor: 5, costBuff: 3, rewardMajor: 5, sellReward: 1 };
        set(ref(db, 'gameState'), window.cleanFirebaseData({ settings: defaultSettings, players: [], activeHole: null, currentHoleIndex: 1, course: null, history: [], customCards: [], decks: {normal:[], premium:[], rules:[]} }))
        .then(() => { localStorage.clear(); location.reload(); });
    }
};

window.saveGameSettings = function() {
    set(ref(db, 'gameState/settings'), {
        shopEnabled: el('gmSetShop').checked, handLimitEnabled: el('gmSetLimitCheck').checked,
        handLimit: parseInt(el('gmSetLimitCount').value, 10) || 5, 
        ptsWin: parseInt(el('gmSetPtsWin').value, 10) || 0,
        ptsTask: parseInt(el('gmSetPtsTask').value, 10) || 0, 
        ptsLose: parseInt(el('gmSetPtsLose').value, 10) || 0, 
        ptsPassive: parseInt(el('gmSetPtsPassive').value, 10) || 0,
        sellReward: parseInt(el('gmSetSellReward').value, 10) || 0,
        costMinor: parseInt(el('gmSetCostMinor').value, 10) || 2, 
        costMajor: parseInt(el('gmSetCostMajor').value, 10) || 5, 
        costBuff: parseInt(el('gmSetCostBuff').value, 10) || 3, 
        rewardMajor: parseInt(el('gmSetRewardMajor').value, 10) || 5
    });
    window.showNotification("Asetukset tallennettu!", "info");
    el('settingsModal').style.display = 'none';
};

//==============================================
// HELPERIT JA UI PÄIVITYKSET
//==============================================
window.showAppleToast = function(msg, icon = '✨') {
    const toast = el('appleToast');
    if(!toast) return; el('appleToastIcon').innerText = icon; el('appleToastText').innerText = msg; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 2000); 
};
window.cleanFirebaseData = function(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => window.cleanFirebaseData(item)).filter(item => item !== null && item !== undefined);
    let cleaned = {}; for (let key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { let val = window.cleanFirebaseData(obj[key]); if (val !== null && val !== undefined && val !== "undefined") cleaned[key] = val; } } return cleaned;
};
window.logEvent = function(msg) { push(ref(db, 'gameState/eventLog'), window.cleanFirebaseData({ time: new Date().toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'}), msg: msg })); };
window.logScore = function(playerName, delta, reason) { push(ref(db, 'gameState/scoreLog'), window.cleanFirebaseData({ time: new Date().toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'}), playerName: playerName, delta: delta, msg: reason })); };

window.updateIdentityUI = function() { if(el('identityCard')) { el('identityCard').style.display = myName ? 'none' : 'block'; } };
window.showNotification = function(message, type = 'info') { const container = el('notificationContainer'); if(!container) return; const toast = document.createElement('div'); toast.className = `notification ${type}`; toast.innerHTML = `<span style="font-size:1.3rem;">${type === 'warning' ? '🛒' : (type === 'debuff' ? '💥' : 'ℹ️')}</span> <span>${message}</span>`; container.appendChild(toast); setTimeout(() => { toast.remove(); }, 3500); };
window.claimIdentity = function() { let n = el('playerNameInput').value.trim(); if(!n || n.length > 15) return alert("Syötä nimi!"); myName = n; localStorage.setItem('friba_name', n); window.updateIdentityUI(); if(!(allPlayers || []).find(x => x && x.name === n)) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); nextPlayers.push({ name: n, score: 3, dgScore: 0, cards: [], boughtThisHole: false }); set(ref(db, 'gameState/players'), window.cleanFirebaseData(nextPlayers)); window.logEvent(`${n} liittyi peliin.`); } };

window.adminAddPlayer = function() { const input = el('adminNewPlayerName'); if(!input) return; const name = input.value.trim(); if(!name || (allPlayers || []).find(p => p && p.name === name)) return; let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); nextPlayers.push({ name: name, score: 3, dgScore: 0, cards: [], boughtThisHole: false }); update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); input.value = ''; window.logEvent(`${myName} (Asetukset) lisäsi pelaajan: ${name}`); };
window.removePlayer = function(index) { if(confirm("Haluatko poistaa?")) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); nextPlayers.splice(index, 1); update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); } };
window.adjustScore = function(index, delta) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); if(nextPlayers[index]) { nextPlayers[index].score = (parseInt(nextPlayers[index].score) || 0) + delta; window.logScore(nextPlayers[index].name, delta, "GM Muokkaus"); update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); } };
window.adjustDgScore = function(index, delta) { let nextPlayers = JSON.parse(JSON.stringify(allPlayers)).filter(Boolean); if(nextPlayers[index]) { nextPlayers[index].dgScore = (parseInt(nextPlayers[index].dgScore) || 0) + delta; update(ref(db), { 'gameState/players': window.cleanFirebaseData(nextPlayers) }); } };
window.gmRollRule = function() { if(!activeHole || window.holeRules.length === 0) return; let ruleIdx = window.drawFromDeck('rules', 1)[0]; const randomRule = window.holeRules[ruleIdx]; set(ref(db, 'gameState/activeHole/rule'), window.cleanFirebaseData(randomRule)); document.getElementById('settingsModal').style.display='none';};
window.gmSetRule = function() { if(!activeHole) return; const sel = el('gmRuleSelect'); const ruleDef = window.holeRules[sel.value]; if(ruleDef) { set(ref(db, 'gameState/activeHole/rule'), window.cleanFirebaseData(ruleDef)); document.getElementById('settingsModal').style.display='none'; } };

window.renderAdminPlayerList = function() {
    const list = el('adminPlayerList'); if(!list) return; list.innerHTML = "";
    (allPlayers || []).forEach((p, i) => {
        if(!p) return; 
        list.innerHTML += `
            <div class="player-row glass-card" style="flex-direction:column; align-items:flex-start; gap:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding:15px; border-radius:12px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                    <span style="font-weight:900; font-size:1.1rem; color:#fff;">${p.name} (${p.score} P / DG: ${p.dgScore > 0 ? '+' : ''}${p.dgScore || 0})</span>
                    <div style="display:flex; gap: 8px;">
                        <button class="btn btn-danger" style="width:auto; padding:10px; font-size:0.85rem;" onclick="window.removePlayer(${i})">POISTA</button>
                    </div>
                </div>
                <div class="gm-score-adjust" style="display:flex; gap:10px; margin-top:10px; color:#fff;">
                    <span style="font-size:0.85rem; width:50px; font-weight:bold; align-self:center;">Raha</span>
                    <input type="number" id="gmScoreAdjust_${i}" value="1" style="width:60px; margin:0; padding:10px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.3);">
                    <button class="btn btn-primary" style="padding:10px;" onclick="if(window.adjustScore) { window.adjustScore(${i}, parseInt(document.getElementById('gmScoreAdjust_${i}').value) || 0); }">Lisää</button>
                    <button class="btn btn-danger" style="padding:10px;" onclick="if(window.adjustScore) { window.adjustScore(${i}, -(parseInt(document.getElementById('gmScoreAdjust_${i}').value) || 0)); }">Vähennä</button>
                </div>
                <div class="gm-score-adjust" style="display:flex; gap:10px; margin-top:5px; color:#fff;">
                    <span style="font-size:0.85rem; width:50px; font-weight:bold; align-self:center;">Tulos</span>
                    <button class="btn btn-secondary" style="padding:10px; background:rgba(255,255,255,0.8); color:#000;" onclick="if(window.adjustDgScore) { window.adjustDgScore(${i}, 1); }">+1 Heitto</button>
                    <button class="btn btn-secondary" style="padding:10px; background:rgba(255,255,255,0.8); color:#000;" onclick="if(window.adjustDgScore) { window.adjustDgScore(${i}, -1); }">-1 Heitto</button>
                </div>
            </div>`;
    });
};

window.renderEventLog = function(logData) { const container = el('adminEventLog'); if(!container) return; container.innerHTML = ""; Object.values(logData || {}).reverse().slice(0, 30).forEach(l => { container.innerHTML += `<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.2);"><span style="color:var(--primary); margin-right:8px; font-weight:900;">[${l.time}]</span>${l.msg}</div>`; }); };
window.renderScoreLog = function(logData) { 
    const container = el('adminScoreLog'); if(!container) return;  
    container.innerHTML = ""; 
    Object.values(logData || {}).reverse().slice(0, 50).forEach(l => { 
        let color = l.delta >= 0 ? '#22c55e' : '#ef4444'; 
        let sign = l.delta > 0 ? '+' : '';
        container.innerHTML += `<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.2);"><span style="color:var(--primary); margin-right:8px; font-weight:900;">[${l.time}]</span><b style="color:#fff;">${l.playerName}</b>: <span style="color:${color}; font-weight:900;">${sign}${l.delta} P</span> <span style="color:#94a3b8; font-size:0.85rem;">(${l.msg})</span></div>`; 
    }); 
};

// =============================================
// FIREBASE KUUNTELIJA
// =============================================
onValue(ref(db, 'gameState'), (snap) => {
    const data = snap.val();
    
    if(!data) {
        if(myName) { myName = null; localStorage.removeItem('friba_name'); window.updateIdentityUI(); window.closeShopModal(); }
        currentCourse = null;
        if(el('lobbyContainer')) el('lobbyContainer').style.display = 'block';
        if(el('corkboard-viewport')) el('corkboard-viewport').style.display = 'none';
        if(el('settingsToggleBtn')) el('settingsToggleBtn').style.display = 'none';
        if(el('rulesToggleBtn')) el('rulesToggleBtn').style.display = 'none';
        if(el('pocketContainer')) el('pocketContainer').style.display = 'none';
        return;
    }

    window.gameSettings = data.settings || { shopEnabled: true, handLimitEnabled: true, handLimit: 5, ptsWin: 3, ptsTask: 2, ptsLose: 0, ptsPassive: 2, costMinor: 2, costMajor: 5, costBuff: 3, rewardMajor: 5, sellReward: 1 };
    window.gameHistory = data.history ? (Array.isArray(data.history) ? data.history : Object.values(data.history)) : [];
    window.gameDecks = data.decks || { normal: [], premium: [], rules: [] };

    if (!window.baseCardsSaved) {
        window.baseCardsSaved = true;
        window.baseCards = [...(window.allCards || [])];
    }
    window.customCards = data.customCards || [];
    let baseIds = new Set(window.baseCards.map(c => c.id));
    window.allCards = [...window.baseCards];
    window.customCards.forEach(cc => {
        if(!baseIds.has(cc.id)) window.allCards.push(cc);
    });
    window.renderCardLibrary();

    if(el('infoPtsWin')) el('infoPtsWin').innerText = `${window.gameSettings.ptsWin} P`;
    if(el('infoPtsTie')) el('infoPtsTie').innerText = `${Math.floor(window.gameSettings.ptsWin * 0.66)} P`; 
    if(el('infoPtsTask')) el('infoPtsTask').innerText = `${window.gameSettings.ptsTask} P`;
    if(el('infoPtsLose')) el('infoPtsLose').innerText = `${window.gameSettings.ptsLose} P`;
    if(el('infoPtsPass')) el('infoPtsPass').innerText = `${window.gameSettings.ptsPassive !== undefined ? window.gameSettings.ptsPassive : 2} P`;
    if(el('infoCostMinor')) el('infoCostMinor').innerText = `${window.gameSettings.costMinor || 2} P`;
    if(el('infoCostMajor')) el('infoCostMajor').innerText = `${window.gameSettings.costMajor || 5} P`;
    if(el('infoCostBuff')) el('infoCostBuff').innerText = `${window.gameSettings.costBuff || 3} P`;
    if(el('infoSellReward')) el('infoSellReward').innerText = `+${window.gameSettings.sellReward !== undefined ? window.gameSettings.sellReward : 1} P`;

    if (el('gmSetShop')) el('gmSetShop').checked = window.gameSettings.shopEnabled;
    if (el('gmSetLimitCheck')) el('gmSetLimitCheck').checked = window.gameSettings.handLimitEnabled;
    if (el('gmSetLimitCount')) el('gmSetLimitCount').value = window.gameSettings.handLimit;
    if (el('gmSetPtsWin')) el('gmSetPtsWin').value = window.gameSettings.ptsWin;
    if (el('gmSetPtsTask')) el('gmSetPtsTask').value = window.gameSettings.ptsTask;
    if (el('gmSetPtsLose')) el('gmSetPtsLose').value = window.gameSettings.ptsLose;
    if (el('gmSetPtsPassive')) el('gmSetPtsPassive').value = window.gameSettings.ptsPassive !== undefined ? window.gameSettings.ptsPassive : 2;
    if (el('gmSetSellReward')) el('gmSetSellReward').value = window.gameSettings.sellReward !== undefined ? window.gameSettings.sellReward : 1;
    
    if (el('gmSetCostMinor')) el('gmSetCostMinor').value = window.gameSettings.costMinor || 2;
    if (el('gmSetCostMajor')) el('gmSetCostMajor').value = window.gameSettings.costMajor || 5;
    if (el('gmSetCostBuff')) el('gmSetCostBuff').value = window.gameSettings.costBuff || 3;
    if (el('gmSetRewardMajor')) el('gmSetRewardMajor').value = window.gameSettings.rewardMajor || 5;

    allPlayers = data.players ? (Array.isArray(data.players) ? data.players : Object.values(data.players)) : [];
    activeHole = data.activeHole || null;
    currentCourse = data.course || null;
    currentHoleIndex = data.currentHoleIndex || 1;
    
    window.populateHoleSelect();

    if (myName && !allPlayers.find(p => p && p.name === myName)) { myName = null; localStorage.removeItem('friba_name'); window.closeShopModal(); }
    window.updateIdentityUI();
    
    const lobbyContainer = el('lobbyContainer');
    const corkboardViewport = el('corkboard-viewport');
    const gameSetupArea = el('gameSetupArea');
    const btnSettings = el('settingsToggleBtn');
    const btnRules = el('rulesToggleBtn');
    const pocket = el('pocketContainer');
    
    if (myName) {
        if (!currentCourse) {
            if(lobbyContainer) lobbyContainer.style.display = 'block';
            if(gameSetupArea) gameSetupArea.style.display = 'block';
            if(corkboardViewport) corkboardViewport.style.display = 'none';
            if(btnSettings) btnSettings.style.display = 'flex'; 
            if(btnRules) btnRules.style.display = 'none'; 
            if(pocket) pocket.style.display = 'none';
        } else {
            if(lobbyContainer) lobbyContainer.style.display = 'none';
            if(corkboardViewport) corkboardViewport.style.display = 'block';
            if(btnSettings) btnSettings.style.display = 'flex';
            if(btnRules) btnRules.style.display = 'flex';
            if(pocket) pocket.style.display = 'flex';
        }
    } else {
        if(lobbyContainer) lobbyContainer.style.display = 'block';
        if(gameSetupArea) gameSetupArea.style.display = 'none';
        if(corkboardViewport) corkboardViewport.style.display = 'none';
        if(btnSettings) btnSettings.style.display = 'none';
        if(btnRules) btnRules.style.display = 'none';
        if(pocket) pocket.style.display = 'none';
    }

    window.renderBoard();
    window.renderReceipt();
    
    if (myName) {
        const me = allPlayers.find(p => p && p.name === myName);
        if (me) {
            let currentPoints = parseInt(me.score, 10) || 0;
            if (typeof window.myLastHoleIndex === 'undefined') { window.myLastHoleIndex = currentHoleIndex; window.myLastScore = currentPoints; } 
            else if (window.myLastHoleIndex !== currentHoleIndex) {
                let diff = currentPoints - window.myLastScore;
                let diffStr = diff > 0 ? "+" + diff : diff;
                
                if (currentCourse && currentHoleIndex > currentCourse.pars.length) {
                     window.showNotification(`Kaikki väylät pelattu! Katso voittaja taululta.`, 'warning');
                } else if (diff !== 0) {
                    window.showNotification(`Väylä ${window.myLastHoleIndex} pelattu! Pisteet: ${diffStr} P (Yht: ${currentPoints} P)`, diff > 0 ? 'info' : 'debuff');
                } else {
                    window.showNotification(`Väylä ${window.myLastHoleIndex} pelattu! Pisteet: 0 P (Yht: ${currentPoints} P)`, 'info');
                }
                
                window.myLastHoleIndex = currentHoleIndex; window.myLastScore = currentPoints;
            } else { window.myLastScore = currentPoints; }

            let myCards = me.cards ? (Array.isArray(me.cards) ? me.cards : Object.values(me.cards)).filter(Boolean) : [];
            window.renderShop(activeHole ? activeHole.shop : null, me.score || 0, me.boughtThisHole);
            
            if (window.gameSettings.handLimitEnabled && myCards.length > window.gameSettings.handLimit) { window.showHandLimitModal(myCards); } 
            else { if(el('handLimitModal')) el('handLimitModal').style.display = 'none'; }
            
            let pts = `${me.score || 0} P`;
            if(el('myResPointsBtn')) el('myResPointsBtn').innerText = pts; 
            if(el('shopModalWallet')) el('shopModalWallet').innerText = pts; 
            if(el('handCountBadge')) el('handCountBadge').innerText = myCards.length; 
        }

        if (activeHole && activeHole.playedCards) {
            const playedCards = Array.isArray(activeHole.playedCards) ? activeHole.playedCards : Object.values(activeHole.playedCards);
            const myNewDebuffs = playedCards.filter(Boolean).filter(pc => (pc.target === myName || pc.target === 'KAIKKI VASTUSTAJAT') && pc.timestamp > lastPlayedCardTimestamp && pc.type === 'sabotage' && pc.by !== myName);
            if (myNewDebuffs.length > 0) {
                myNewDebuffs.forEach(db => { window.showNotification(`💥 Sinua sabotoitiin: ${db.cardName}`, 'debuff'); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); });
                lastPlayedCardTimestamp = Math.max(...playedCards.map(pc => pc.timestamp));
            }
        }
    }
    window.renderAdminPlayerList(); window.renderEventLog(data.eventLog); window.renderScoreLog(data.scoreLog);
});

window.populateRuleSelect = function() { const sel = el('gmRuleSelect'); const rules = window.holeRules || []; if(!sel || rules.length === 0) return; sel.innerHTML = rules.map((r, i) => `<option value="${i}">${r.n}</option>`).join(''); };
setTimeout(window.populateRuleSelect, 500);
