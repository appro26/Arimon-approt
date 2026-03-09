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
        if (installCard) installCard.style.display = 'none';
        return; 
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
            } else {
                alert("Asennus ei onnistu suoraan tästä selaimesta. Käytä Chromea tai valitse valikosta 'Asenna sovellus'.");
            }
        };
    }
}

window.dismissInstallPrompt = function() {
    localStorage.setItem('appro_install_dismissed', 'true');
    const installCard = document.getElementById('installCard');
    if (installCard) installCard.style.display = 'none';
};

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
let isPlayerCompactMode = false;
let isGMCompactMode = false;
let pendingWinnerTasks = [];
let winnerTimeout = null;
let pendingXP = 0;
let xpTimeout = null;

const APP_NAME = "Arimon Approt";
document.title = APP_NAME;

// OLETUSTEHTÄVÄT
const defaultTasks = [
    { id: 1, n: "Mise en place", d: "Varmista, että kaikilla pöytäseurueen jäsenillä on lasissa juotavaa (myös vettä). Jos jollain on tyhjää, täytä se.", p: 2, m: 2, b: false, r: 2 },
    { id: 2, n: "Uudelleenkäynnistys (Reboot)", d: "Kaikkien suorittajien on juotava lasi vettä yhdeltä istumalta 'järjestelmän vakauttamiseksi'.", p: 1, m: 3, b: false, r: 3 },
    { id: 3, n: "Holari-yritys", d: "Heitä lasinalunen tyhjään tuoppiin tai lasiin 2 metrin etäisyydeltä. Kolme yritystä.", p: 2, m: 2, b: false, r: 2 },
    { id: 4, n: "Air Drop saapuu", d: "Tilaa synttärisankarille juoma (mieto tai alkoholiton käy).", p: 3, m: 1, b: true, r: 1 },
    { id: 5, n: "Gordon Ramsay -palautekierros", d: "Kehu nykyisen baarin miljöötä tai juomavalikoimaa yhdelle tuntemattomalle asiakkaalle 'ammattilaisen otteella'.", p: 2, m: 1, b: false, r: 1 },
    { id: 6, n: "Tikettijärjestelmän ruuhka", d: "Kuuntele synttärisankarin yksi valitsema muisto menneisyydestä keskeyttämättä. Lopuksi analysoi 'ratkaisu'.", p: 1, m: 2, b: true, r: 2 },
    { id: 7, n: "Spotterin rooli", d: "Seuraa synttärisankarin lasia 5 minuutin ajan. Jos hän aikoo laskea sen pöydälle ilman alusta, estä se tai aseta alunen alle.", p: 2, m: 1, b: false, r: 1 },
    { id: 8, n: "Level 3 -kypärä", d: "Pidä mukanasi jotain outoa esinettä (esim. tyhjä tölkki tai pilli) seuraavaan baariin asti hukkaamatta sitä.", p: 2, m: 2, b: false, r: 2 },
    { id: 9, n: "Uunilohi palaa pohjaan", d: "Suorittajien on poistuttava välittömästi ulos 'tuulettumaan' 2 minuutiksi ilman puhelimia.", p: 1, m: 4, b: false, r: 4 },
    { id: 10, n: "BIOS-päivitys", d: "Kerro synttärisankarille yksi asia, jota hän ei vielä tiennyt sinusta (IT-salaisuus).", p: 1, m: 1, b: false, r: 1 },
    { id: 11, n: "Caddy-palvelu", d: "Kanna synttärisankarin takkia tai laukkua seuraavaan siirtymään (tai baarin sisällä siirtyessä).", p: 2, m: 1, b: true, r: 1 },
    { id: 12, n: "Pochinki Loot", d: "Hae koko seurueelle nippu ilmaisia servettejä tai pillejä tiskiltä ja jaa ne tasaisesti.", p: 1, m: 1, b: false, r: 1 },
    { id: 13, n: "Sous-chefin suositus", d: "Valitse synttärisankarille seuraava juoma listalta (hän maksaa itse, jos tehtävä ei vaadi ostamista).", p: 1, m: 1, b: true, r: 1 },
    { id: 14, n: "Palomuuri (Firewall)", d: "Seiso synttärisankarin ja muiden asiakkaiden välissä 'suojana' 3 minuutin ajan.", p: 2, m: 2, b: false, r: 2 },
    { id: 15, n: "OB-linja (Out of Bounds)", d: "Käy koskettamassa baarin kaukaisinta seinää ja palaa takaisin sanomatta sanaakaan matkalla.", p: 1, m: 3, b: false, r: 3 },
    { id: 16, n: "Red Zone", d: "Kukaan suorittajista ei saa käyttää sanaa 'joo' tai 'ei' seuraavan 5 minuutin aikana.", p: 2, m: 5, b: false, r: 5 },
    { id: 17, n: "Lautasliina-origami", d: "Taittele lautasliinasta jokin tunnistettava hahmo tai esine ja lahjoita se sankarille.", p: 1, m: 1, b: false, r: 1 },
    { id: 18, n: "Ping-testi", d: "Heitä yläfemma kaikkien muiden seurueen jäsenten kanssa mahdollisimman nopeasti (alle 10 sekuntia).", p: 1, m: 1, b: false, r: 1 },
    { id: 19, n: "Mandatory-kierto", d: "Ennen kuin istut alas, sinun on kierrettävä valittu pöytä tai tuoli myötäpäivään ympäri.", p: 1, m: 4, b: false, r: 4 },
    { id: 20, n: "Pan Melee Only", d: "Pitele kädessäsi paistinpannua muistuttavaa esinettä (esim. lautanen tai pyöreä alunen) koko seuraavan puheen ajan.", p: 1, m: 1, b: false, r: 1 },
    { id: 21, n: "Keittiömestarin tervehdys", d: "Tarjoa sankarille pieni suolainen välipala (pähkinöitä, sipsejä tms. baarista).", p: 3, m: 1, b: true, r: 1 },
    { id: 22, n: "Etätuki-istunto", d: "Selitä synttärisankarille mahdollisimman monimutkaisesti, miten jokin arkipäiväinen esine (esim. kynä) toimii.", p: 1, m: 1, b: false, r: 1 },
    { id: 23, n: "Putterin tarkkuus", d: "Liu'uta kolikko pöytää pitkin mahdollisimman lähelle reunaa tippumatta. Kolme yritystä.", p: 2, m: 2, b: false, r: 2 },
    { id: 24, n: "Med Kit -huolto", d: "Käy ostamassa sankarille jotain nesteyttävää tai särkylääkettä 'valmiiksi' kaappiin/laukkuun.", p: 3, m: 1, b: true, r: 1 },
    { id: 25, n: "Jälkiruokalista", d: "Lue ääneen keksitty 'ylistyspuhe' synttärisankarille käyttäen mahdollisimman monta ruoka-aiheista sanaa.", p: 2, m: 1, b: true, r: 1 },
    { id: 26, n: "Käyttäjävirhe (User Error)", d: "Sano 'Olen pahoillani, kyseessä oli käyttäjävirhe' aina kun joku seurueesta tekee jotain kömpelöä seuraavan 10 min aikana.", p: 2, m: 1, b: false, r: 1 },
    { id: 27, n: "Fore!", d: "Huuda 'FORE!' (kohtuullisella volyymilla) aina kun joku seurueesta nousee seisomaan. Kesto 5 minuuttia.", p: 1, m: 2, b: false, r: 2 },
    { id: 28, n: "Blue Zone -siirtymä", d: "Seuraavaan baariin siirryttäessä suorittajien on kuljettava viimeisenä ja varmistettava, ettei ketään jää jälkeen.", p: 1, m: 2, b: false, r: 2 },
    { id: 29, n: "Raaka-aineanalyysi", d: "Tunnista sokkona (silmät kiinni) mitä juomaa sankarisi lasissa on hajun perusteella.", p: 2, m: 1, b: false, r: 1 },
    { id: 30, n: "Pilvipalvelun varmuuskopio", d: "Ota yhteisselfie koko porukasta (tai mahdollisimman monesta) ja varmista, että se on 'tallessa'.", p: 1, m: 1, b: true, r: 1 },
    { id: 31, n: "Tree Kick -epäonni", d: "Matki puuta (seiso yhdellä jalalla kädet sivuilla) 30 sekuntia kesken keskustelun.", p: 2, m: 2, b: false, r: 2 },
    { id: 32, n: "Winner Winner Chicken Dinner", d: "Tilaa sankarille (ja itsellesi jos haluat) pientä syötävää, kuten kanansiipiä tai vastaavaa.", p: 3, m: 1, b: true, r: 1 },
    { id: 33, n: "Suoritin-rasitus", d: "Rumputa pöytää sormillasi kuin olisit kirjoittamassa koodia erittäin nopeasti 30 sekuntia.", p: 1, m: 1, b: false, r: 1 },
    { id: 34, n: "Verkkosilta (Bridge)", d: "Pidä molempia käsiä pöydällä 'siltana' seuraavan 5 minuutin ajan. Et saa irrottaa niitä.", p: 1, m: 1, b: false, r: 2 },
    { id: 35, n: "Red Zone Survival", d: "Kyykisty pöydän alle suojaan 30 sekunniksi välittömästi, kun joku huutaa 'POMMI!'.", p: 1, m: 1, b: false, r: 3 },
    { id: 36, n: "Pro-tason draiveri", d: "Heitä roskasi (esim. karkkipaperi) roskikseen vähintään 3 metrin päästä. Onnistuttava!", p: 2, m: 1, b: false, r: 1 },
    { id: 37, n: "Tukipyyntö (Support Ticket)", d: "Käy kysymässä baarimikolta: 'Voitteko auttaa, minulla on yhteysongelma?'", p: 3, m: 1, b: false, r: 1 },
    { id: 38, n: "Salasanan vaihto", d: "Keksi sankarille uusi lempinimi, jota kaikkien on käytettävä seuraavat 10 minuuttia.", p: 2, m: 1, b: true, r: 1 },
    { id: 39, n: "UAV aktivoitu", d: "Käy tarkistamassa onko baarin toisessa huoneessa tai tiskillä tilaa ja raportoi takaisin.", p: 1, m: 0, b: false, r: 1 },
    { id: 40, n: "Kiekon etsintä", d: "Etsi baarin lattialta tai pöytien alta jokin pudonnut esine ja palauta se omistajalle.", p: 1, m: 1, b: false, r: 2 },
    { id: 41, n: "Sous-viden lämpö", d: "Hiero sankarille hartioita 1 minuutin ajan 'lämmittääksesi' hänet seuraavaan baariin.", p: 1, m: 0, b: true, r: 1 },
    { id: 42, n: "Kovalevyn eheytys", d: "Järjestä kaikki lompakkosi kolikot tai kortit suuruusjärjestykseen pöydälle.", p: 1, m: 0, b: false, r: 1 },
    { id: 43, n: "Bridge Camping", d: "Seiso baarin oviaukon tai kapean kohdan lähellä 2 minuuttia 'vartioimassa' kulkua.", p: 2, m: 1, b: false, r: 2 },
    { id: 44, n: "Levyaseman virhe", d: "Vaihda kenkiäsi päittäin (vasen oikeaan ja oikea vasempaan) 5 minuutin ajaksi.", p: 2, m: 1, b: false, r: 1 },
    { id: 45, n: "Ping-mittaus", d: "Pistele sormella sankaria olkapäähän ja sano 'Ping' aina kun hän ottaa kulauksen juomastaan.", p: 1, m: 0, b: true, r: 1 },
    { id: 46, n: "Ethernet-kaapeli", d: "Muodosta 'yhteys' pitämällä kädestä kiinni naapuria 3 minuutin ajan keskeytyksettä.", p: 1, m: 1, b: false, r: 3 },
    { id: 47, n: "Flare Gun", d: "Nosta molemmat kädet ylös ja huuda 'TÄÄLLÄ OLLAAN!' mahdollisimman vakuuttavasti.", p: 2, m: 1, b: false, r: 1 },
    { id: 48, n: "Flippaava kiekko", d: "Pyörähdä 360 astetta paikallasi 3 kertaa aina kun joku seurueesta vaihtaa asentoa.", p: 2, m: 1, b: false, r: 1 },
    { id: 49, n: "Salty Player", d: "Kerro jokin asia, joka sinua ärsyttää (IT-ongelma tai huono grippi) erittäin intohimoisesti.", p: 1, m: 0, b: false, r: 1 },
    { id: 50, n: "Zonin reuna", d: "Siirrä tuolisi niin kauas pöydästä kuin mahdollista ja yritä silti pysyä keskustelussa.", p: 2, m: 1, b: false, r: 2 },
    { id: 51, n: "Anvil-testi", d: "Hiero kahta lasinalusta vastakkain pitäen kovaa ääntä 30 sekuntia putkeen.", p: 1, m: 1, b: false, r: 2 },
    { id: 52, n: "Komentorivi (CLI)", d: "Puhu seuraavat 3 minuuttia käyttäen vain yhden sanan lauseita. Esim. 'Jano. Juon. Nyt.'", p: 2, m: 1, b: false, r: 1 },
    { id: 53, n: "Ace-tuuletus", d: "Juokse baarin ympäri (tai lyhyt lenkki) kädet levällään kuin olisit tehnyt hole-in-onen.", p: 3, m: 1, b: false, r: 1 },
    { id: 54, n: "Winner Winner Chicken Dinner", d: "Osta koko seurueelle kierros vettä (tai shotti, jos budjetti sallii).", p: 3, m: 0, b: true, r: 2 },
    { id: 55, n: "Lagipiikki", d: "Liiku 'nykien' (pysähdy sekunniksi joka askeleella) kun seuraavan kerran nouset ylös.", p: 2, m: 1, b: false, r: 2 },
    { id: 56, n: "Fore!-varoitus", d: "Aina kun joku laskee lasin pöytään, huuda 'FORE!' seuraavan 5 minuutin ajan.", p: 1, m: 1, b: false, r: 1 },
    { id: 57, n: "Lootbox-yllätys", d: "Käy ostamasta sankarille jokin yllätys tiskiltä (pähkinöitä, tikkarit, tms).", p: 3, m: 0, b: true, r: 1 },
    { id: 58, n: "Stack Overflow", d: "Pinoa vähintään 5 tyhjää lasinalusta päällekkäin ja pidä ne pystyssä 1 minuutti.", p: 1, m: 1, b: false, r: 1 },
    { id: 59, n: "Putti-putki", d: "Heitä kolikko tai korkki lasiin metrin päästä. Onnistuttava kerran kolmesta.", p: 2, m: 1, b: false, r: 2 },
    { id: 60, n: "Uunilohi-muisto", d: "Kerro nolo tai hauska muisto ammattikoulun ajoilta. Jos et muista, juo lasi vettä.", p: 1, m: 0, b: true, r: 1 },
    { id: 61, n: "Hardware Reset", d: "Kosketa varpaitasi polvia koukistamatta 15 sekuntia putkeen.", p: 1, m: 1, b: false, r: 2 },
    { id: 62, n: "Ghillie-shotti", d: "Ota huikka juomastasi niin, että yrität olla mahdollisimman näkymätön (esim. takin alla).", p: 1, m: 1, b: false, r: 2 },
    { id: 63, n: "Ob-raja (Out of Bounds)", d: "Seuraavan siirtymän aikana et saa astua katuvalojen varjoihin (tai tiettyihin laattoihin).", p: 2, m: 1, b: false, r: 3 },
    { id: 64, n: "Etätuki-puhelu", d: "Soita (tai teeskentele soittavasi) kaverille ja selitä miten baarijakkara 'asennetaan'.", p: 2, m: 1, b: false, r: 1 },
    { id: 65, n: "Drop-alueen vartija", d: "Pidä kättäsi sankarin tuolin selkänojalla 5 minuuttia 'suojellen häntä'.", p: 1, m: 1, b: true, r: 1 },
    { id: 66, n: "Caddy-vinkki", d: "Suosittele sankarille seuraavaa liikettä tai juomaa 'ammattilaisen varmuudella'.", p: 1, m: 0, b: true, r: 1 },
    { id: 67, n: "System Restore", d: "Istu täysin hiljaa ja silmät kiinni 30 sekuntia, kunnes 'boottaus' on valmis.", p: 1, m: 1, b: false, r: 2 },
    { id: 68, n: "Pan-haaste", d: "Pitele juomaasi kaksin käsin kuin se olisi painava paistinpannu seuraavat 5 minuuttia.", p: 1, m: 1, b: false, r: 1 },
    { id: 69, n: "Ankkurilinkki", d: "Pidä jalkaasi toisen pelaajan jalan päällä seuraavan 3 minuutin ajan.", p: 1, m: 1, b: false, r: 2 },
    { id: 70, n: "Power Supply", d: "Osta sankarille ja itsellesi jotain pientä suolaista purtavaa.", p: 3, m: 0, b: true, r: 1 },
    { id: 71, n: "Scramble-peli", d: "Kaikki suorittajat vaihtavat paikkoja keskenään mahdollisimman nopeasti (juosten).", p: 1, m: 1, b: false, r: 4 },
    { id: 72, n: "Bugiraportti", d: "Luettele 5 asiaa, jotka ovat 'vialla' nykyisessä sijainnissasi (vitsillä).", p: 1, m: 0, b: false, r: 1 },
    { id: 73, n: "Air Drop -paketti", d: "Nosta sankarin juoma ilmaan ja huuda: 'Paketti toimitettu!' aina kun hän aikoo juoda.", p: 2, m: 1, b: true, r: 1 },
    { id: 74, n: "Spotterin silmät", d: "Kuvaile muille pelaajille, mitä tapahtuu sankarin selän takana ilman että hän kääntyy.", p: 1, m: 0, b: true, r: 1 },
    { id: 75, n: "Terminaattori-mode", d: "Puhu seuraavat 2 minuuttia konemaisella äänellä ilman tunteita.", p: 2, m: 1, b: false, r: 2 },
    { id: 76, n: "Frisbee-ketjut", d: "Rämistele avaimiasi tai kolikoitasi aina kun joku nauraa (kuin kiekko ketjuissa).", p: 1, m: 1, b: false, r: 1 },
    { id: 77, n: "Palomuuri-asento", d: "Seiso sankarisi edessä kädet puuskassa 'suojana' 2 minuuttia.", p: 2, m: 1, b: false, r: 1 },
    { id: 78, n: "Keittiömestarin tarkastus", d: "Maista (luvan kanssa) pienen pieni pala jonkun ruuasta tai tilkkanen juomasta ja anna arvosana.", p: 1, m: 0, b: false, r: 2 },
    { id: 79, n: "Full Auto -sarja", d: "Juo 5 pientä hörppyä juomaasi peräkkäin 'sarjatulella'.", p: 1, m: 0, b: false, r: 2 },
    { id: 80, n: "Kiekon palautus", d: "Käy viemässä tyhjä lasi tiskille (itse valitsemasi) mahdollisimman tyylikkäästi.", p: 1, m: 0, b: false, r: 1 },
    { id: 81, n: "Admin-komento", d: "Sankari saa päättää, kuka suorittajista joutuu kertomaan vitsin tai juomaan lasin vettä.", p: 2, m: 0, b: true, r: 2 },
    { id: 82, n: "Victory Dance", d: "Tee lyhyt ja energinen voittotanssi baarin lattialla (PUBG tyyliin).", p: 3, m: 1, b: false, r: 1 },
    
    // --- SANKARITEHTÄVÄT ---
    { id: 83, n: "Admin-huolto (Sankari)", d: "Sankarin on kerättävä seurueen kaikki tyhjät tölkit/lasit ja vietävä ne tiskille yksin.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 84, n: "Kiekon etsintä (Sankari)", d: "Sankari joutuu nousemaan ylös ja kävelemään baarin ympäri etsimässä 'kadonnutta kiekkoa' silmät kiinni ohjattuna.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 85, n: "PUBG Emote (Sankari)", d: "Sankarin on esitettävä jokin PUBG-pelin tuuletus tai liike baarin keskellä mahdollisimman näyttävästi.", p: 3, m: 1, b: true, r: 1, isHero: true },
    { id: 86, n: "Koodin katselmointi (Sankari)", d: "Sankarin on keksittävä jokaisesta pelaajasta yksi positiivinen 'kommentti' (kuten koodin katselmoinnissa).", p: 1, m: 0, b: true, r: 1, isHero: true },
    { id: 87, n: "Mise en place -tarkastus (Sankari)", d: "Sankarin on maistettava kolmen eri pelaajan juomaa ja arvattava niiden ainesosat.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 88, n: "Ping-testi (Sankari)", d: "Sankarin on vastattava 'PONG' sekunnin sisällä aina kun joku huutaa 'PING' seuraavan 10 minuutin ajan.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 89, n: "Putti-haaste (Sankari)", d: "Sankarin on heitettävä lasinalunen pystyasennossa olevaan tyhjään tuoppiin. Kolme yritystä.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 90, n: "Blue Zone -juoksu (Sankari)", d: "Sankarin on käytävä koskettamassa baarin ulko-ovea ja palattava 15 sekunnissa takaisin.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 91, n: "Hardware Troubleshooting (Sankari)", d: "Sankarin on selitettävä jollekin tuntemattomalle asiakkaalle, miten frisbeegolfin pituusdraivi tai IT-tuki toimii.", p: 3, m: 1, b: true, r: 1, isHero: true },
    { id: 92, n: "Chef's Special (Sankari)", d: "Sankarin on loihdittava 'annos' eli koottava pöydän snacks-kulhosta näyttävä taideteos ja syötävä se.", p: 1, m: 0, b: true, r: 1, isHero: true },
    { id: 93, n: "Palvelinhuoneen hämärä (Sankari)", d: "Sankarin on suoritettava seuraava tilauksensa tai keskustelunsa kuiskaamalla, kuin hän olisi salaisessa palvelinruumissa.", p: 1, m: 1, b: true, r: 1, isHero: true },
    { id: 94, n: "Range-treeni (Sankari)", d: "Sankarin on 'heitettävä' viisi erilaista frisbeegolf-kiekkoa ja selitettävä niiden lentoradat seurueelle.", p: 2, m: 0, b: true, r: 1, isHero: true },
    { id: 95, n: "Loot-varkaus (Sankari)", d: "Sankarin on onnistuttava ottamaan yksi hörppy jonkun muun lasista niin, ettei kukaan huomaa (stealth mode).", p: 3, m: 1, b: true, r: 1, isHero: true },
    { id: 96, n: "Käyttöjärjestelmän vaihto (Sankari)", d: "Sankarin on vaihdettava kieltä ja puhuttava seuraavat 5 minuuttia pelkkää englantia.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 97, n: "Spotterin virhe (Sankari)", d: "Sankarin on osoitettava baarista kolme mahdollista 'vaaran paikkaa' ja annettava niille IT-tukihenkinen korjaussuunnitelma.", p: 1, m: 0, b: true, r: 1, isHero: true },
    { id: 98, n: "C1-tason grippi (Sankari)", d: "Sankarin on pidettävä lasistaan kiinni erittäin oudolla otteella seuraavat 5 minuuttia.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 99, n: "Bug Bounty (Sankari)", d: "Sankarin on etsittävä muiden pelaajien vaatetuksesta yksi 'bugi' ja kerrottava, miten se korjataan (esim. vino kaulus).", p: 1, m: 0, b: true, r: 1, isHero: true },
    { id: 100, n: "Air Drop Defense (Sankari)", d: "Sankarin on suojeltava omaa juomaansa niin, ettei kukaan saa koskea siihen 5 minuuttiin.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 101, n: "Mando-kierto (Sankari)", d: "Sankarin on noustava ylös ja kierrettävä koko seurue ympäri tehden samalla frisbeegolf-lähipeliä matkivia liikkeitä.", p: 2, m: 1, b: true, r: 1, isHero: true },
    { id: 102, n: "System Overload (Sankari)", d: "Sankarin on lueteltava 10 IT-termiä, 10 frisbeegolf-termiä tai 10 PUBG-termiä 30 sekunnissa.", p: 3, m: 1, b: true, r: 1, isHero: true }
];

// --- OFFLINE-MOOTTORI (KORJATTU TÄYDELLISESTI LOKAALIKSI) ---
let localGameState = null;

document.addEventListener('DOMContentLoaded', () => {
    checkInstallStatus();
    
    const savedBackup = localStorage.getItem('arimon_backup');
    if (savedBackup) {
        try {
            localGameState = JSON.parse(savedBackup);
            processGameState(localGameState);
        } catch(e){}
    } else {
        localGameState = {
            players: [], tasks: defaultTasks, activeTasks: {}, history: {}, eventLog: {},
            config: { useCooldowns: true, strictVolunteer: false, excludeUsedTasks: true, bdayHero: null, visibility: { title: true, points: true, drawCount: false, desc: false, minus: true, bday: true }, heroDraw: { include: true, weighted: false, interval: 4, drawCount: 0 } }
        };
        processGameState(localGameState);
    }
    updateIdentityUI(); 
});

function triggerLocalRender() {
    if (localGameState) {
        localStorage.setItem('arimon_backup', JSON.stringify(localGameState));
        processGameState(localGameState);
    }
}

// --- FIREBASE SYNKRONOINTI ---
db.ref('gameState').on('value', (snap) => {
    const data = snap.val();
    if(!data) return;

    if (!data.tasks || !data.config) return;

    localGameState = data;
    localStorage.setItem('arimon_backup', JSON.stringify(data));
    processGameState(data);
});

function processGameState(data) {
    if(!data) return;

    if (currentResetId && data.resetId && data.resetId !== currentResetId) { localStorage.clear(); location.reload(); return; }
    if (!currentResetId && data.resetId) { currentResetId = data.resetId; localStorage.setItem('appro_reset_id', data.resetId); }

    allPlayers = data.players || [];
    
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
            checkInstallStatus(); 
        }
    }
    
    taskLibrary = (data.tasks || []).map(t => {
        if (t.id >= 83 && t.id <= 102) return { ...t, isHero: true };
        return t;
    });

    taskHistory = Object.values(data.history || {}).reverse().slice(0, 10);
    const config = data.config || {};
    const heroId = config.bdayHero;
    const vis = config.visibility || { title: true, points: true, drawCount: false, desc: false, minus: true, bday: true };
    const heroDrawConfig = config.heroDraw || { include: true, weighted: false, interval: 4, drawCount: 0 };

    updateIdentityUI();
    renderLeaderboard(config.useCooldowns, heroId);
    updateManualTaskSelect();
    renderHistory();
    
    if(document.getElementById('adminPanel').style.display === 'block') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
            renderAdminPlayerList(heroId);
            renderTaskLibrary();
        }
        renderEventLog(data.eventLog);
        
        document.getElementById('useCooldowns').checked = !!config.useCooldowns;
        document.getElementById('strictVolunteer').checked = !!config.strictVolunteer;
        document.getElementById('excludeUsedTasks').checked = !!config.excludeUsedTasks;
        
        document.getElementById('visTitle').checked = !!vis.title;
        document.getElementById('visPoints').checked = !!vis.points;
        document.getElementById('visDrawCount').checked = !!vis.drawCount;
        document.getElementById('visDesc').checked = !!vis.desc;
        document.getElementById('visMinus').checked = !!vis.minus;
        document.getElementById('visBday').checked = !!vis.bday;
        
        document.getElementById('incHero').checked = !!heroDrawConfig.include;
        document.getElementById('weightHero').checked = !!heroDrawConfig.weighted;
        document.getElementById('heroInterval').value = heroDrawConfig.interval || 4;
    }

    checkForNewWinnerPopups(data.activeTasks || {});
    renderActiveTasks(data.activeTasks || {}, config);
    lastKnownTasks = JSON.parse(JSON.stringify(data.activeTasks || {}));
}

// --- TÄYSIN LOKAALIT (OFFLINE) TOIMINNOT ---

function logEvent(msg) {
    const time = new Date().toLocaleTimeString('fi-FI');
    const lId = "l_" + Date.now();
    if(!localGameState.eventLog) localGameState.eventLog = {};
    localGameState.eventLog[lId] = { time, msg };
    
    db.ref(`gameState/eventLog/${lId}`).set({ time, msg }).catch(()=>{});
    triggerLocalRender();
}

window.toggleGMCompactMode = function() {
    isGMCompactMode = !isGMCompactMode;
    const btn = document.getElementById('gmCompactToggleBtn');
    if (btn) btn.innerText = isGMCompactMode ? 'LAAJENNA NÄKYMÄ' : 'SUPISTA NÄKYMÄ';
    triggerLocalRender();
};

window.togglePlayerCompactMode = function() {
    isPlayerCompactMode = !isPlayerCompactMode;
    const btn = document.getElementById('playerCompactToggleBtn');
    if (btn) btn.innerText = isPlayerCompactMode ? 'LAAJENNA NÄKYMÄ' : 'SUPISTA NÄKYMÄ';
    triggerLocalRender();
};

window.resetGame = function() {
    if (confirm("VAROITUS: Tämä poistaa kaikki tiedot. Jatketaanko?")) {
        const newResetId = Date.now().toString();
        const resetData = {
            players: [], tasks: defaultTasks, usedTaskIds: [], activeTasks: {}, history: {}, eventLog: {}, resetId: newResetId,
            config: { useCooldowns: true, strictVolunteer: false, excludeUsedTasks: true, bdayHero: null, visibility: { title: true, points: true, drawCount: false, desc: false, minus: true, bday: true }, heroDraw: { include: true, weighted: false, interval: 4, drawCount: 0 } }
        };
        db.ref('gameState').set(resetData).catch(err => console.log("Offline nollaus odottaa verkkoa."));
        localStorage.clear(); 
        location.reload();
    }
};

function checkForNewWinnerPopups(newTasks) {
    if (!myName) return;
    let addedNew = false;
    
    Object.keys(newTasks).forEach(taskId => {
        const newTask = newTasks[taskId];
        const oldTask = lastKnownTasks[taskId];
        const wasJustLocked = newTask.locked && (!oldTask || !oldTask.locked);
        if (wasJustLocked && !newTask.isHero) {
            const isMeSelected = (newTask.participants || []).some(r => r.name === myName);
            if (isMeSelected && !pendingWinnerTasks.includes(newTask.n)) {
                pendingWinnerTasks.push(newTask.n);
                addedNew = true;
            }
        }
    });
    
    if (addedNew) {
        if (winnerTimeout) clearTimeout(winnerTimeout);
        winnerTimeout = setTimeout(() => {
            const html = pendingWinnerTasks.length > 1 
                ? pendingWinnerTasks.map(n => `&bull; ${n}`).join('<br>') 
                : pendingWinnerTasks[0];
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
        pop.style.color = pendingXP > 0 ? "var(--success)" : "var(--danger)";
        pop.innerText = (pendingXP > 0 ? "+" : "") + pendingXP + " XP";
        pop.classList.remove('xp-animate'); 
        void pop.offsetWidth; 
        pop.classList.add('xp-animate');
        
        pendingXP = 0;
        setTimeout(() => { pop.style.display = 'none'; }, 2200);
    }, 400);
}

window.updateTaskDrawCount = function(taskId, val) {
    if(localGameState.activeTasks && localGameState.activeTasks[taskId]) {
        localGameState.activeTasks[taskId].r = parseInt(val);
        db.ref(`gameState/activeTasks/${taskId}/r`).set(parseInt(val)).catch(()=>{});
        triggerLocalRender();
    }
};

function renderActiveTasks(tasksObj, config) {
    const container = document.getElementById('activeTasksContainer');
    const isGM = document.body.className.includes('gm');
    const vis = config.visibility || { title: true, points: true, drawCount: false, desc: false, minus: true, bday: true };
    
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    
    if (isGM && isGMCompactMode) container.classList.add('compact-view');
    else if (!isGM && isPlayerCompactMode) container.classList.add('compact-view');
    else container.classList.remove('compact-view');
    
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

    currentIds.forEach((taskId) => {
        const taskData = tasksObj[taskId];
        const isLocked = !!taskData.locked;
        const results = taskData.participants || [];
        const isMePart = results.some(r => r.name === myName);
        const isHeroTask = !!taskData.isHero; 
        
        const isSpying = (isGM && localSpyState[taskId]);
        const showFull = isLocked || isHeroTask || isSpying;
        
        let card = container.querySelector(`[data-task-id="${taskId}"]`);
        
        if (!card) {
            card = document.createElement('div');
            card.className = 'card task-box active-task-item';
            card.setAttribute('data-task-id', taskId);
            card.innerHTML = `
                <div class="t-status"></div>
                <div class="t-header"></div>
                <div class="t-desc"></div>
                <div class="t-action"></div>
                <div class="t-gm gm-only"></div>
            `;
            container.appendChild(card);
        }

        let flexOrder = 10;
        if (!isGM && myName) {
            if (isLocked && isMePart && !isHeroTask) flexOrder = 1;
            else if (!isLocked && !isHeroTask) flexOrder = 2;
            else flexOrder = 3;
        } else {
            flexOrder = parseInt(taskId.split('_')[1] || 10);
        }
        card.style.order = flexOrder;

        card.classList.toggle('hero-task-gold', isHeroTask);
        card.classList.toggle('participating', !isGM && !isHeroTask && isLocked && isMePart);
        card.classList.toggle('not-participating', !isGM && !isHeroTask && isLocked && !isMePart);

        let statusHtml = '';
        if (isGM) {
            statusHtml += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
            if (isHeroTask) {
                statusHtml += `<span class="task-status-tag" style="background: var(--hero-gold); color: black; margin:0;">ODOTTAA PISTEYTYSTÄ</span>`;
            } else if (!isLocked) {
                statusHtml += `<span class="task-status-tag" style="background: var(--gm-accent); color: white; margin:0;">${taskData.drawn ? 'ODOTTAA LUKITUSTA' : 'ODOTTAA ARVONTAA'}</span>`;
            } else {
                statusHtml += `<span class="task-status-tag" style="background: var(--success); color: white; margin:0;">ODOTTAA PISTEYTYSTÄ</span>`;
            }
            statusHtml += `<button class="btn btn-danger" style="width:auto; margin:0; padding:4px 8px; font-size:0.6rem;" onclick="deleteActiveTask('${taskId}')">X POISTA</button>`;
            statusHtml += `</div>`;
        } else {
            if (isHeroTask) {
                statusHtml += `<div class="task-status-tag" style="background: var(--hero-gold); color: black; font-weight: 900;">✨ SANKARITEHTÄVÄ ✨</div>`;
            } else if (isLocked) {
                statusHtml += `<div class="task-status-tag ${isMePart ? '' : 'muted'}">${isMePart ? '🎉 SINUN TEHTÄVÄSI' : '👀 SEURAA MUIDEN SUORITUSTA'}</div>`;
            } else {
                statusHtml += `<h2>VAIHE: ILMOITTAUTUMINEN</h2>`;
            }
        }

        let headerHtml = '';
        const displayTitle = (showFull || vis.title) ? taskData.n : "??? (Salainen tehtävä)";
        headerHtml += `<h1 style="margin:5px 0;">${displayTitle}</h1>`;

        let tagsHtml = '';
        if (showFull || vis.points) {
            tagsHtml += `<div class="xp-badge" style="display:inline-block; margin-bottom:10px; margin-right:5px;">${taskData.p} XP</div>`;
        }
        
        if (!isHeroTask && (showFull || vis.drawCount)) {
            tagsHtml += `<div class="xp-badge" style="display:inline-block; margin-bottom:10px; background:rgba(255,255,255,0.1); color:var(--text); border-color:rgba(255,255,255,0.2); margin-right:5px;">👥 MAX ${taskData.r || 1} SUORITTAJAA</div>`;
        }

        if ((showFull || vis.minus) && taskData.m) {
            tagsHtml += `<div class="xp-badge" style="display:inline-block; margin-bottom:10px; background:rgba(185,50,50,0.15); color:var(--danger); border-color:var(--danger); margin-right:5px;">⚠️ MIINUS-UHKA</div>`;
        }
        if ((showFull || vis.bday) && taskData.b) {
            tagsHtml += `<div class="xp-badge" style="display:inline-block; margin-bottom:10px; background:rgba(194,120,33,0.15); color:var(--gm-accent); border-color:var(--gm-accent);">🎂 SANKARIBONUS</div>`;
        }
        headerHtml += `<div>${tagsHtml}</div>`;

        let descHtml = '';
        if (isSpying && isGMCompactMode) {
            descHtml += `<style>
                .compact-view [data-task-id="${taskId}"] { padding: 24px !important; }
                .compact-view [data-task-id="${taskId}"] .instruction-card { display: block !important; }
                .compact-view [data-task-id="${taskId}"] .task-description { display: block !important; }
                .compact-view [data-task-id="${taskId}"] .t-gm .btn { padding: 18px !important; font-size: 0.8rem !important; }
            </style>`;
        }

        const shouldShowDesc = showFull || vis.desc;
        if (shouldShowDesc) {
            const displayDesc = (taskData.d && taskData.d.trim() !== "") ? taskData.d : "Ei ohjeita.";
            descHtml += `<div class="instruction-card"><p><strong>OHJEET:</strong><br>${displayDesc}</p></div>`;
            if (isLocked && !isHeroTask) {
                const drawnPlayers = results.map(r => r.name);
                if (drawnPlayers.length > 0) {
                    descHtml += `<div style="margin-top:10px; font-weight:900; color:var(--success); font-size:0.8rem;">SUORITTAJAT: ${drawnPlayers.join(', ')}</div>`;
                }
            }
        } else {
            descHtml += `<p class="task-description" style="opacity:0.5; font-size:1.1rem;">Tehtävä paljastetaan valituille pelaajille...</p>`;
        }

        let actionHtml = '';
        if (!isGM && !isLocked && !isHeroTask) {
            const isBannedFromThis = config.useCooldowns && taskData.bannedPlayers && taskData.bannedPlayers.includes(myName);
            const amIIn = results.some(r => r.name === myName);

            actionHtml += `<div class="join-action-area" style="margin-top:15px;">`;
            if (isBannedFromThis && !amIIn) {
                actionHtml += `<p style="color:var(--danger); font-weight:800; text-align:center;">OLET JÄÄHYLLÄ TÄSTÄ TEHTÄVÄSTÄ!</p>`;
            } else {
                actionHtml += `<button class="btn ${amIIn ? 'btn-success' : 'btn-primary'}" onclick="volunteer('${taskId}')">${amIIn ? 'OSALLISTUT! ✓' : 'HALUAN OSALLISTUA'}</button>`;
            }
            actionHtml += `</div>`;
        } else if (!isGM && isHeroTask) {
            actionHtml += `<p style="font-size: 0.7rem; color: var(--hero-gold); text-align: center; margin-top: 10px; font-weight: 700;">GM MERKITSEE PISTEET SUORITUKSEN JÄLKEEN</p>`;
        }

        let gmHtml = '';
        if (isGM) {
            gmHtml += `<div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.05); padding-top:15px;">`;
            if (!isHeroTask) {
                gmHtml += `
                    <div class="volunteer-selector-grid" id="grid-${taskId}"></div>
                    <div class="admin-row-stack">
                        <div style="display:flex; gap:10px; flex:1;">
                            <select id="drawCount-${taskId}" style="flex:1; margin:0;" onchange="updateTaskDrawCount('${taskId}', this.value)"></select>
                            <button class="btn btn-gm" style="flex:2; margin:0;" onclick="drawRandom('${taskId}')">ARVO PELAAJAT</button>
                        </div>
                        <button class="btn btn-success" style="margin:0; font-size:0.75rem; padding:12px;" onclick="lockParticipants('${taskId}')">LUKITSE VALINNAT</button>
                    </div>
                `;
            }
            gmHtml += `<div id="scoring-${taskId}"></div>`;
            gmHtml += `
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn btn-success" id="finish-${taskId}" style="display:${(isLocked || isHeroTask) ? 'block' : 'none'}; flex:2; margin:0;" onclick="showScoring('${taskId}')">MERKITSE VALMIIKSI</button>
                    <button class="btn btn-secondary" style="flex:1; font-size:0.6rem; padding:8px; margin:0;" onclick="toggleGMSpy('${taskId}')">SPEKSIT</button>
                </div>
            </div>`;
        }

        const updateNode = (selector, newHtml) => {
            const node = card.querySelector(selector);
            if (node && node.innerHTML !== newHtml) node.innerHTML = newHtml;
        };

        updateNode('.t-status', statusHtml);
        updateNode('.t-header', headerHtml);
        updateNode('.t-desc', descHtml);
        updateNode('.t-action', actionHtml);
        updateNode('.t-gm', gmHtml);

        if (isGM) {
            if (!isHeroTask) {
                renderGMGrid(taskId, results, isLocked, taskData.isLotteryRunning, config.useCooldowns, taskData);
                updateDrawCountSelect(taskId, taskData);
            }
            if (isLocked || isHeroTask) {
                renderScoringArea(taskId, results, isHeroTask, taskData.heroWin);
            }
        }
    });
}

function drawAllTasks() {
    let drawsTriggered = 0;
    if(!localGameState.activeTasks) return;
    Object.keys(localGameState.activeTasks).forEach(taskId => {
        const taskData = localGameState.activeTasks[taskId];
        if (!taskData.locked && !taskData.isHero && (taskData.participants || []).length > 0 && !taskData.drawn) {
            drawRandom(taskId, true);
            drawsTriggered++;
        }
    });
    if (drawsTriggered > 0) logEvent(`Massatoiminto: Arvottu pelaajat ${drawsTriggered} tehtävään.`);
    else alert("Ei arvottavia tehtäviä.");
}

function lockAllTasks() {
    let count = 0;
    if(!localGameState.activeTasks) return;
    Object.keys(localGameState.activeTasks).forEach(taskId => {
        const taskData = localGameState.activeTasks[taskId];
        if (!taskData.locked && !taskData.isHero && (taskData.participants || []).length > 0) {
            lockParticipants(taskId, true);
            count++;
        }
    });
    if (count > 0) logEvent(`Massatoiminto: Lukittu ${count} tehtävää.`);
    else alert("Ei lukittavia tehtäviä.");
}

function finishAllTasks() {
    let finishTriggered = 0;
    if(!localGameState.activeTasks) return;
    Object.keys(localGameState.activeTasks).forEach(taskId => {
        const taskData = localGameState.activeTasks[taskId];
        if (taskData.locked || taskData.isHero) {
            showScoring(taskId, true); 
            finishTriggered++;
        }
    });
    if (finishTriggered > 0) logEvent(`Massatoiminto: Merkitty ${finishTriggered} tehtävää valmiiksi.`);
    else alert("Ei valmiita tehtäviä odottamassa pisteytystä.");
}

function deleteActiveTask(taskId) {
    if (confirm("Haluatko varmasti poistaa tämän aktiivisen tehtävän?")) {
        delete localGameState.activeTasks[taskId];
        db.ref('gameState/activeTasks/' + taskId).remove().catch(()=>{});
        logEvent("Aktiivinen tehtävä poistettu manuaalisesti.");
        triggerLocalRender();
    }
}

function drawRandom(taskId, isMassAction = false) {
    const sel = document.getElementById(`drawCount-${taskId}`);
    const count = sel ? (parseInt(sel.value) || 1) : 1;
    
    let taskData = localGameState.activeTasks[taskId];
    if(!taskData) return;
    let list = taskData.participants || [];
    if(list.length === 0) return;

    taskData.isLotteryRunning = true;
    triggerLocalRender();
    
    setTimeout(() => {
        let shuffled = [...list].sort(() => 0.5 - Math.random());
        let winners = shuffled.slice(0, count).map(p => ({ ...p, win: true }));
        
        taskData.participants = winners;
        taskData.isLotteryRunning = false;
        taskData.drawn = true;
        
        db.ref(`gameState/activeTasks/${taskId}`).update({ participants: winners, isLotteryRunning: false, drawn: true }).catch(()=>{});
        if (!isMassAction) logEvent(`Arvottu ${count} suorittajaa tehtävään: ${taskData.n}`);
        triggerLocalRender();
    }, 2000); 
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
        const isBannedFromThis = showCD && taskData.bannedPlayers && taskData.bannedPlayers.includes(p.name);
        
        btn.className = `btn ${isInc ? 'btn-primary selected-participant' : 'btn-secondary'} ${isBannedFromThis ? 'on-cooldown' : ''}`;
        btn.disabled = isLocked || isShuffling; 
        btn.innerHTML = `${p.name}${isBannedFromThis ? ' <small>(J)</small>' : ''}`;
        btn.onclick = () => toggleParticipant(taskId, p.name);
    });

    if (isShuffling) {
        if (!window.rouletteTimers) window.rouletteTimers = {};
        if (!window.rouletteTimers[taskId]) {
            window.rouletteTimers[taskId] = setInterval(() => {
                Array.from(grid.children).forEach(b => b.classList.remove('roulette-focus'));
                const validBtns = Array.from(grid.children).filter(b => b.className.includes('selected-participant'));
                if(validBtns.length > 0) {
                    const randomBtn = validBtns[Math.floor(Math.random() * validBtns.length)];
                    randomBtn.classList.add('roulette-focus');
                }
            }, 120); 
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
    triggerLocalRender();
}

function setRole(r) {
    document.body.className = r + '-mode';
    document.getElementById('btnPlayer').classList.toggle('active', r === 'player');
    document.getElementById('btnGM').classList.toggle('active', r === 'gm');
    triggerLocalRender();
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

function claimIdentity() {
    const n = document.getElementById('playerNameInput').value.trim();
    if(!n) return; 
    myName = n; 
    localStorage.setItem('appro_name', n);
    updateIdentityUI(); 

    if(!localGameState.players) localGameState.players = [];
    if(!localGameState.players.find(x => x.name === n)) {
        localGameState.players.push({ name: n, score: 0, cooldown: 0 }); 
        db.ref('gameState/players').set(localGameState.players).catch(()=>{});
        logEvent(`Uusi pelaaja liittyi: ${n}`);
    }
}

function volunteer(taskId) {
    if(!myName) return;
    
    if (localGameState.config?.useCooldowns && localGameState.activeTasks[taskId].bannedPlayers && localGameState.activeTasks[taskId].bannedPlayers.includes(myName)) {
        alert("Olet jäähyllä tästä tehtävästä!"); return;
    }
    
    if (localGameState.config?.strictVolunteer) {
        let inOther = Object.keys(localGameState.activeTasks).some(id => {
            if (id === taskId) return false;
            const t = localGameState.activeTasks[id];
            return !t.locked && (t.participants || []).some(r => r.name === myName);
        });
        if (inOther) {
            alert("Jäähy: Olet jo ilmoittautunut toiseen avoimeen tehtävään!"); return;
        }
    }

    let task = localGameState.activeTasks[taskId];
    if(task.locked) return;
    
    let list = task.participants || []; 
    let joined = false;
    const idx = list.findIndex(r => r.name === myName);
    
    if(idx > -1) {
        list.splice(idx, 1);
        joined = false;
    } else {
        list.push({ name: myName, win: true });
        joined = true;
    }
    
    task.participants = list;
    db.ref(`gameState/activeTasks/${taskId}/participants`).set(list).catch(()=>{});
    logEvent(joined ? `${myName} ilmoittautui: ${task.n}` : `${myName} perui osallistumisen: ${task.n}`);
}

function toggleParticipant(taskId, name) {
    let task = localGameState.activeTasks[taskId];
    if(!task) return;
    
    let list = task.participants || []; 
    let added = false;
    const idx = list.findIndex(r => r.name === name);
    
    if(idx > -1) {
        list.splice(idx, 1);
        added = false;
    } else {
        list.push({ name: name, win: true });
        added = true;
    }
    
    task.participants = list;
    db.ref(`gameState/activeTasks/${taskId}/participants`).set(list).catch(()=>{});
    logEvent(added ? `GM lisäsi pelaajan ${name}: ${task.n}` : `GM poisti pelaajan ${name}: ${task.n}`);
}

function lockParticipants(taskId, isMassAction = false) { 
    const taskInstance = localGameState.activeTasks[taskId];
    const res = taskInstance.participants || [];
    const drawnNames = res.map(r => r.name);
    
    if (localGameState.config?.useCooldowns) {
        localGameState.players = (localGameState.players || []).map(p => {
            if (drawnNames.includes(p.name)) p.cooldown = 1; // Pelaaja saa sukupolvi-jäähyn!
            return p;
        });
        db.ref('gameState/players').set(localGameState.players).catch(()=>{});
    }
    
    taskInstance.locked = true;
    db.ref(`gameState/activeTasks/${taskId}/locked`).set(true).catch(()=>{}); 
    localSpyState[taskId] = false;
    
    if (!isMassAction) logEvent(`Lukitut suorittajat tehtävään ${taskInstance.n}: ${drawnNames.join(', ')}`);
}

function showScoring(taskId, isMassAction = false) {
    const d = localGameState;
    const taskInstance = d.activeTasks[taskId];
    if(!taskInstance) return;
    
    const res = taskInstance.participants || [];
    const heroId = d.config?.bdayHero;
    let used = d.usedTaskIds || [];
    used.push(taskInstance.id);
    d.usedTaskIds = used;
    
    let winnersNames = [];
    let taskCompletedBySomeone = res.some(r => r.win);
    
    d.players = (d.players || []).map((p, idx) => {
        let earned = 0;
        if (taskInstance.isHero) {
            if (idx === heroId) {
                const heroWon = taskInstance.heroWin !== false;
                if (heroWon) earned += taskInstance.p;
                else if (taskInstance.m) earned -= taskInstance.p;
                winnersNames.push(p.name);
            }
        } else {
            const part = res.find(r => r.name === p.name);
            if(part) {
                if(part.win) { 
                    earned += taskInstance.p; 
                    winnersNames.push(p.name); 
                } else if(taskInstance.m) {
                    earned -= taskInstance.p;
                }
            } else if (idx === heroId && taskInstance.b) {
                if (taskCompletedBySomeone) earned += 1; 
            }
        }
        p.score = Math.max(0, (p.score || 0) + earned);
        return p;
    });

    const histItem = {
        taskName: taskInstance.n,
        winners: winnersNames.length > 0 ? winnersNames : ["Ei onnistujia"],
        timestamp: new Date().toLocaleTimeString('fi-FI')
    };
    if(!d.history) d.history = {};
    const hId = "h_" + Date.now();
    d.history[hId] = histItem;
    
    db.ref(`gameState/history/${hId}`).set(histItem).catch(()=>{});
    delete d.activeTasks[taskId];
    
    db.ref('gameState').update({ players: d.players, activeTasks: d.activeTasks || {}, usedTaskIds: d.usedTaskIds }).catch(()=>{});
    if (!isMassAction) logEvent(`Tehtävä valmis: ${taskInstance.n}. Pisteet jaettu.`);
    triggerLocalRender();
}

window.toggleHeroTaskWin = function(taskId) {
    if(localGameState.activeTasks && localGameState.activeTasks[taskId]) {
        const current = localGameState.activeTasks[taskId].heroWin;
        const newVal = current === false ? true : false;
        localGameState.activeTasks[taskId].heroWin = newVal;
        db.ref(`gameState/activeTasks/${taskId}/heroWin`).set(newVal).catch(()=>{});
        triggerLocalRender();
    }
};

function toggleWin(taskId, i) { 
    if(localGameState.activeTasks && localGameState.activeTasks[taskId]) {
        const p = localGameState.activeTasks[taskId].participants[i];
        p.win = !p.win;
        db.ref(`gameState/activeTasks/${taskId}/participants/${i}/win`).set(p.win).catch(()=>{});
        triggerLocalRender();
    }
}

function confirmRandomize() {
    const d = localGameState;
    const config = d.config || {};
    const heroDraw = config.heroDraw || { include: true, weighted: false, interval: 4, drawCount: 0 };
    const used = d.usedTaskIds || [];

    let bannedFromThisTask = [];
    
    if (config.useCooldowns) {
        d.players = (d.players || []).map(p => {
            // Varmistetaan että jäähy on numero (0 tai 1)
            let cd = p.cooldown === true ? 1 : (p.cooldown || 0); 
            
            // Jos pelaajalla on jäähy aktiivisena, hänet bannataan TÄSTÄ uudesta tehtävästä
            if (cd > 0) {
                bannedFromThisTask.push(p.name);
            }
            
            // Pudotetaan jäähyn arvoa yhdellä, jolloin seuraavaan pystyy osallistumaan
            if (cd > 0) cd--; 
            
            return { ...p, cooldown: cd }; 
        });
        db.ref('gameState/players').set(d.players).catch(()=>{});
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

    if (isForcedHero && finalHero.length > 0) pool = finalHero;
    else if (heroDraw.include && !heroDraw.weighted) pool = finalNormal.concat(finalHero); 
    else pool = finalNormal; 

    if(pool.length === 0) pool = finalHero; 

    const t = pool[Math.floor(Math.random() * pool.length)];
    const instanceId = "t_" + Date.now();
    
    const newTaskObj = { 
        ...t, 
        locked: false, 
        participants: [], 
        drawn: false,
        bannedPlayers: bannedFromThisTask 
    };

    if(!d.activeTasks) d.activeTasks = {};
    d.activeTasks[instanceId] = newTaskObj;
    
    let updates = {};
    updates[`gameState/activeTasks/${instanceId}`] = newTaskObj;
    
    if (heroDraw.weighted) {
        d.config.heroDraw.drawCount = newDrawCount;
        updates[`gameState/config/heroDraw/drawCount`] = newDrawCount;
    }

    logEvent(`Arvottu uusi tehtävä: ${t.n}`);
    db.ref().update(updates).catch(e => console.log("Offline arvonta suoritettu, odottaa verkkoa."));
    triggerLocalRender();
}

function selectManualTask(idx) {
    if (idx === "") return;
    const d = localGameState;
    
    let bannedFromThisTask = [];
    if (d.config?.useCooldowns) {
        d.players = (d.players || []).map(p => {
            let cd = p.cooldown === true ? 1 : (p.cooldown || 0); 
            if (cd > 0) bannedFromThisTask.push(p.name);
            if (cd > 0) cd--; 
            return { ...p, cooldown: cd }; 
        });
        db.ref('gameState/players').set(d.players).catch(()=>{});
    }
    
    const t = taskLibrary[idx];
    const instanceId = "t_" + Date.now();
    const newTaskObj = { 
        ...t, 
        locked: false, 
        participants: [], 
        drawn: false,
        bannedPlayers: bannedFromThisTask 
    };
    
    if(!d.activeTasks) d.activeTasks = {};
    d.activeTasks[instanceId] = newTaskObj;

    db.ref(`gameState/activeTasks/${instanceId}`).set(newTaskObj).catch(()=>{});
    logEvent(`Valittu manuaalinen tehtävä: ${t.n}`);
    document.getElementById('manualTaskSelect').value = ""; 
    triggerLocalRender();
}

function adminAddPlayer() {
    const input = document.getElementById('adminNewPlayerName');
    const n = input.value.trim();
    if(!n) return;
    
    if(!localGameState.players) localGameState.players = [];
    if(!localGameState.players.find(x => x.name === n)) { 
        localGameState.players.push({ name: n, score: 0, cooldown: 0 }); 
        db.ref('gameState/players').set(localGameState.players).catch(()=>{}); 
        
        input.value = ''; 
        input.blur(); // KORJAUS 2: Piilotetaan näppäimistö ja poistetaan focus!
        
        logEvent(`Admin lisäsi pelaajan: ${n}`);
        
        // KORJAUS 2: Pakotetaan pelaajalistan päivitys heti
        renderAdminPlayerList(localGameState.config?.bdayHero || null); 
        triggerLocalRender();
    } else { alert("Pelaaja on jo listalla!"); }
}

function adjustScore(idx, amt) { 
    if(localGameState.players && localGameState.players[idx]) {
        localGameState.players[idx].score = Math.max(0, (localGameState.players[idx].score || 0) + amt);
        db.ref(`gameState/players/${idx}/score`).set(localGameState.players[idx].score).catch(()=>{}); 
        logEvent(`Admin muutti pelaajan ${localGameState.players[idx].name} pisteitä: ${amt > 0 ? '+' : ''}${amt} XP`);
        triggerLocalRender();
    }
}

function removePlayer(idx) { 
    if(confirm("Poista pelaaja?")) { 
        logEvent(`Admin poisti pelaajan: ${localGameState.players[idx].name}`);
        localGameState.players.splice(idx, 1); 
        db.ref('gameState/players').set(localGameState.players).catch(()=>{}); 
        triggerLocalRender();
    } 
}

function setBdayHero(idx) { 
    if(localGameState.config) {
        const newVal = localGameState.config.bdayHero === idx ? null : idx;
        localGameState.config.bdayHero = newVal;
        db.ref('gameState/config/bdayHero').set(newVal).catch(()=>{});
        if(newVal !== null) logEvent(`Asetettu synttärisankari: ${localGameState.players[newVal].name}`);
        triggerLocalRender();
    }
}

function adminToggleCooldown(idx) { 
    if(localGameState.players && localGameState.players[idx]) {
        const newState = localGameState.players[idx].cooldown > 0 ? 0 : 1;
        localGameState.players[idx].cooldown = newState;
        db.ref(`gameState/players/${idx}/cooldown`).set(newState).catch(()=>{}); 
        triggerLocalRender();
    }
}

function updateConfig(key, val) { 
    if(!localGameState.config) localGameState.config = {};
    localGameState.config[key] = val;
    db.ref(`gameState/config/${key}`).set(val).catch(()=>{}); 
    triggerLocalRender();
}

function updateVisConfig(key, val) { 
    if(!localGameState.config.visibility) localGameState.config.visibility = {};
    localGameState.config.visibility[key] = val;
    db.ref(`gameState/config/visibility/${key}`).set(val).catch(()=>{}); 
    triggerLocalRender();
}

window.updateHeroConfig = function(key, val) { 
    if(!localGameState.config.heroDraw) localGameState.config.heroDraw = {};
    localGameState.config.heroDraw[key] = val;
    db.ref(`gameState/config/heroDraw/${key}`).set(val).catch(()=>{}); 
    triggerLocalRender();
};

function updateTaskInLib(idx, field, val) { 
    if(localGameState.tasks && localGameState.tasks[idx]) {
        localGameState.tasks[idx][field] = val;
        db.ref(`gameState/tasks/${idx}/${field}`).set(val).catch(()=>{}); 
        triggerLocalRender();
    }
}

function removeTask(idx) { 
    if(confirm("Poista tehtävä kirjastosta?")) { 
        localGameState.tasks.splice(idx, 1); 
        db.ref('gameState/tasks').set(localGameState.tasks).catch(()=>{}); 
        triggerLocalRender();
    } 
}

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
    if(!n || !d) return;
    
    const newTask = { id: Date.now(), n, d, p, m, b, r, isHero: hero };
    if(!localGameState.tasks) localGameState.tasks = [];
    localGameState.tasks.push(newTask);
    
    db.ref('gameState/tasks').set(localGameState.tasks).catch(()=>{});
    logEvent(`Luotu uusi tehtävä kirjastoon: ${n}`);
    
    document.getElementById('newTaskName').value = ''; 
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('newTaskIsHero').checked = false;
    
    // KORJAUS 2: Poistetaan focus, jotta lista päivittyy heti ruudulle!
    document.getElementById('newTaskName').blur();
    document.getElementById('newTaskDesc').blur();
    
    renderTaskLibrary();
    triggerLocalRender();
}

function updateIdentityUI() { 
    const identityCard = document.getElementById('identityCard');
    const idTag = document.getElementById('idTag');
    if(identityCard) identityCard.style.display = myName ? 'none' : 'block'; 
    if(idTag) idTag.innerText = myName ? "PROFIILI: " + myName : "KIRJAUDU SISÄÄN"; 
}

function toggleAdminPanel() { 
    const p = document.getElementById('adminPanel'); const isOpening = p.style.display === 'none'; p.style.display = isOpening ? 'block' : 'none'; 
    if(isOpening) { renderAdminPlayerList(localGameState?.config?.bdayHero || null); renderTaskLibrary(); }
}

function renderLeaderboard(showCD, heroId) {
    const list = document.getElementById('playerList');
    if(!list) return;
    list.innerHTML = '';
    [...allPlayers].sort((a,b) => b.score - a.score).forEach((p) => {
        const pIdx = allPlayers.findIndex(x => x.name === p.name);
        const isHero = heroId !== null && pIdx === heroId;
        const div = document.createElement('div');
        div.className = `player-row ${p.name === myName ? 'me' : ''} ${isHero ? 'is-hero' : ''} ${p.cooldown > 0 ? 'on-cooldown' : ''}`;
        
        const cdText = (showCD && p.cooldown > 0) ? ' <small style="color:var(--danger)">[JÄÄHY]</small>' : '';
        div.innerHTML = `<span>${isHero?'🎂 ':''}${p.name}${cdText}</span><span class="xp-badge">${p.score} XP</span>`;
        list.appendChild(div);
    });
}

function renderAdminPlayerList(heroId) {
    const list = document.getElementById('adminPlayerList');
    if(!list) return; list.innerHTML = "";
    allPlayers.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-row'; div.style.padding = '8px';
        
        const isHero = i === heroId;
        const heroBg = isHero ? 'var(--hero-gold)' : 'transparent';
        const heroColor = isHero ? '#000' : 'inherit';
        const heroBorder = isHero ? 'var(--hero-gold)' : 'rgba(255,255,255,0.2)';

        div.innerHTML = `
            <div style="width:100%">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; font-weight:bold;">${p.name} (${p.score})</span>
                    <div style="display:flex; gap:4px;">
                        <button class="btn" style="width:32px; padding:5px; margin:0; background:${heroBg}; color:${heroColor}; border:1px solid ${heroBorder};" onclick="setBdayHero(${i})">🎂</button>
                        <button class="btn ${p.cooldown > 0 ? 'btn-success' : 'btn-secondary'}" style="width:auto; font-size:0.5rem; padding:5px; margin:0;" onclick="adminToggleCooldown(${i})">${p.cooldown > 0 ? 'VAP' : 'J'}</button>
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
