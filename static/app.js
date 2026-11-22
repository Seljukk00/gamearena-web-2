let ws = null;

// ========================================
// 💬 BİL BAKALIM CHAT
// ========================================
let bilChat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

let playerId = null;
let roomCode = "";
let myName = "";
let players = [];
let footballers = [];
let questions = [];
let questionIndices = [];
let eliminated = [];
let mySelection = null;
let selectionConfirmed = false;
let selectionReadyCount = 0;
let selectionCancelPending = false;
let currentTurn = null;
let guessMode = false;
let scores = { 1: 0, 2: 0 };
let remaining = { 1: 32, 2: 32 };
let gameOver = false;
let pendingAnswer = null;
let turnSeconds = 45;
let inRoom = false;
let guessLimit = 0;
let guessesLeft = { 1: 0, 2: 0 };
let waitingForAnswer = false;
let bilMaxPlayers = 2;
let bilBotLevel = "orta";

let timerInterval = null;
let timerRemaining = 0;
let timerElement = null;

let tooltipTimer = null;
let tooltipVisible = false;

let confirmCallback = null;

// ============ ELEMENTLER ============
const homeScreen = document.getElementById("homeScreen");
const createScreen = document.getElementById("createScreen");
const joinScreen = document.getElementById("joinScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const selectScreen = document.getElementById("selectScreen");
const gameScreen = document.getElementById("gameScreen");
const modSelectScreen = document.getElementById("modSelectScreen");
const createTakimScreen = document.getElementById("createTakimScreen");
const gameOverBox = document.getElementById("gameOverBox");
const confirmBox = document.getElementById("confirmBox");
const playerTooltip = document.getElementById("playerTooltip");
const opponentLeftBox = document.getElementById("opponentLeftBox");
const opponentLeftText = document.getElementById("opponentLeftText");
const opponentLeftOkBtn = document.getElementById("opponentLeftOkBtn");

const menuCreateCard = document.getElementById("menuCreateCard");
const menuJoinCard = document.getElementById("menuJoinCard");

const createNameInput = document.getElementById("createNameInput");
const joinNameInput = document.getElementById("joinNameInput");
const roomInput = document.getElementById("roomInput");
const turnSecondsSelect = document.getElementById("turnSecondsSelect");
const guessLimitSelect = document.getElementById("guessLimitSelect");
const lobbyGuessLimit = document.getElementById("lobbyGuessLimit");
const guessLeftText = document.getElementById("guessLeftText");
const guessLeftBox = document.getElementById("guessLeftBox");

const createBtn = document.getElementById("createBtn");
const createBackBtn = document.getElementById("createBackBtn");
const joinBtn = document.getElementById("joinBtn");
const joinBackBtn = document.getElementById("joinBackBtn");
const startBtn = document.getElementById("startBtn");
const lobbyLeaveBtn = document.getElementById("lobbyLeaveBtn");
const guessModeBtn = document.getElementById("guessModeBtn");
const newRoundBtn = document.getElementById("newRoundBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");

const confirmTitle = document.getElementById("confirmTitle");
const confirmImg = document.getElementById("confirmImg");
const confirmName = document.getElementById("confirmName");
const confirmMsg = document.getElementById("confirmMsg");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmNoBtn = document.getElementById("confirmNoBtn");

const createMsg = document.getElementById("createMsg");
const joinMsg = document.getElementById("joinMsg");
const lobbyMsg = document.getElementById("lobbyMsg");
const selectMsg = document.getElementById("selectMsg");
const gameMsg = document.getElementById("gameMsg");

const roomCodeText = document.getElementById("roomCodeText");
const copyHint = document.getElementById("copyHint");
const lobbyTurnSeconds = document.getElementById("lobbyTurnSeconds");
const playersList = document.getElementById("playersList");
const selectGrid = document.getElementById("selectGrid");
const cancelSecretBtn = document.getElementById("cancelSecretBtn");
const gameGrid = document.getElementById("gameGrid");
const questionsBox = document.getElementById("questionsBox");
const logBox = document.getElementById("logBox");

const turnText = document.getElementById("turnText");
const scoreText = document.getElementById("scoreText");
const remainText = document.getElementById("remainText");

const selectTimer = document.getElementById("selectTimer");
const gameTimer = document.getElementById("gameTimer");

const answerPanel = document.getElementById("answerPanel");
const answerQuestionText = document.getElementById("answerQuestionText");
const answerYesBtn = document.getElementById("answerYesBtn");
const answerNoBtn = document.getElementById("answerNoBtn");

const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverText = document.getElementById("gameOverText");

const confettiCanvas = document.getElementById("confetti");

const toastBox = document.getElementById("toastBox");
const toastImg = document.getElementById("toastImg");
const toastTitle = document.getElementById("toastTitle");
const toastMsg = document.getElementById("toastMsg");

let toastTimeout = null;

// ============ SAYFA KAPATMA UYARISI ============
// Oyun/lobby ekranlarındayken tarayıcı yenile/kapat yapınca uyarı göster
window.addEventListener("beforeunload", (e) => {
    const current = getCurrentScreen();
    const gameScreens = ["game", "select", "lobby",
                          "mlGame", "mlLobby",
                          "takimGame", "takimLobby",
                          "haritaGame", "haritaLobby",
                          "gizemGame", "gizemLobby",
                          "ilk11Game", "ilk11Lobby",
                          "sarkiGame", "sarkiLobby",
                          "miniGame", "miniLobby",
                          "satrancGame", "satrancLobby"];
    
    if (gameScreens.includes(current)) {
        e.preventDefault();
        e.returnValue = "";
    }
});

// ============ BAĞLANTI ============
function connectWS() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.onopen = () => { console.log("Bağlantı hazır.");
        // ✨ Yeni bağlantı kurulduğunda liste anlık yenilensin
        _publicRoomsDebouncedRefresh();
    };
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
        // ✨ Her mesajda açık sunucular listesini anlık yenile (backend bir değişiklik bildirirse yakalar)
        _publicRoomsDebouncedRefresh();
    };
    ws.onclose = () => { console.log("Bağlantı kapandı."); };
}

function send(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WS kapalı, mesaj gönderilemedi:", data.type);
        return;
    }
    ws.send(JSON.stringify(data));
}

// ============ EKRAN YÖNETİMİ ============
// ✨ Join ekranda "katıl" formunu gizle - sadece açık sunucular kısmı kalsın
// (oda kodu input, isim input, Katıl butonu, mod bilgi kutusu + sarmalayan kutu + başlık etiketleri gizlenir)
function hideJoinForm() {
    ["roomInput", "joinNameInput", "joinBtn", "joinBackBtn", "joinRoomModeInfo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // ✨ "Katıl" formunu sarmalayan kutuları da gizle → boş ization/boşluk kalmasın
    ["roomInput", "joinNameInput"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const box = el.closest(".centerBox");
        if (!box) return;
        const list = document.getElementById("publicRoomsList");
        // Açık sunucular listesi bu kutu içindeyse kutu kapanmaz (görev akışı bozulmaz)
        if (list && box.contains(list)) return;
        box.style.display = "none";
    });

    // Tüm başlık etiketlerini yakala ve gizle (h1-h6 dahil)
    const joinScreenEl = document.getElementById("joinScreen");
    if (!joinScreenEl) return;
    joinScreenEl.querySelectorAll("label, span, p, h1, h2, h3, h4, h5, h6, b, strong").forEach(el => {
        if (el.children && el.children.length > 1) return;  // Çok çocuklu kutular muksa
        const t = (el.textContent || "").trim().toLowerCase();
        if (t.includes("oda kodu") || t === "katıl" || t.includes("katıl")
            || t.includes("isim") || t.includes("adınız") || t.includes("adın")) {
            el.style.display = "none";
        }
    });
}

function showScreen(screenName) {
    // 🎯 Alt Bar (Footer / Yasal Bilgi) Sadece Ana Menüde (home) Görünsün
    const footers = document.querySelectorAll("footer, .footer, #footer, .siteFooter, .site-footer, .legal-footer");
    footers.forEach(f => {
        if (screenName === "home") {
            f.style.setProperty("display", "block", "important");
        } else {
            f.style.setProperty("display", "none", "important");
        }
    });

    homeScreen.classList.add("hidden");
    createScreen.classList.add("hidden");
    joinScreen.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    selectScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    modSelectScreen.classList.add("hidden");
    createTakimScreen.classList.add("hidden");

    if (screenName === "home") homeScreen.classList.remove("hidden");
    if (screenName === "create") createScreen.classList.remove("hidden");
    if (screenName === "join") {
        joinScreen.classList.remove("hidden");
        hideJoinForm();  // ✨ Katıl formunu gizle - sadece açık sunucular kalsın
        // ✨ Açık Sunucular kutusu - "🎮 GameArena Web" başlık çizgisinin tam altına taşındı,
        //    sadece join ekranda görünür
        const publicRoomsBox = document.getElementById("publicRoomsBox");
        if (publicRoomsBox) publicRoomsBox.classList.remove("hidden");
    } else {
        // ✨ Diğer ekranlarda açık sunucular kutusu görünmez
        const publicRoomsBoxHide = document.getElementById("publicRoomsBox");
        if (publicRoomsBoxHide) publicRoomsBoxHide.classList.add("hidden");
    }
	if (screenName !== "join") stopPublicRoomsRefresh();
    if (screenName === "lobby") lobbyScreen.classList.remove("hidden");
    if (screenName === "select") selectScreen.classList.remove("hidden");
    if (screenName === "game") gameScreen.classList.remove("hidden");
    if (screenName === "modselect") modSelectScreen.classList.remove("hidden");
    if (screenName === "createTakim") createTakimScreen.classList.remove("hidden");
    
    // Bil Bakalım toggle'ı: sadece select ve game ekranlarında göster
    const toggle = document.getElementById("showSecretToggle");
    if (toggle) {
        if (screenName === "select" || screenName === "game") {
            toggle.classList.remove("hidden");
        } else {
            toggle.classList.add("hidden");
        }
    }

    // Bil Bakalım geri butonu: sadece select ve game ekranlarında
    const bilBackBtn = document.getElementById("bilBackTopBtn");
    if (bilBackBtn) {
        if (screenName === "select" || screenName === "game") {
            bilBackBtn.classList.remove("hidden");
        } else {
            bilBackBtn.classList.add("hidden");
        }
    }
}

function setMsg(element, text, color) {
    element.textContent = text;
    element.style.color = color || "#ffd43b";
}

function addLog(text, type) {
    const div = document.createElement("div");
    div.className = "logLine";
    if (type === "mine") div.classList.add("mine");
    if (type === "opp") div.classList.add("opp");
    if (type === "info") div.classList.add("info");
    div.textContent = text;
    logBox.prepend(div);
}

function getOtherPlayerId() {
    return playerId === 1 ? 2 : 1;
}

function getPlayerNameById(id) {
    const p = players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

// ============ TIMER ============
function startTimer(seconds, element) {
    stopTimer();
    timerElement = element;
    timerRemaining = seconds;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateTimerDisplay();
        if (timerRemaining <= 0) stopTimer();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    if (!timerElement) return;
    timerElement.textContent = timerRemaining + "s";
    if (timerRemaining <= 10) timerElement.classList.add("warning");
    else timerElement.classList.remove("warning");
}

// ============ LOBBY ============
function updateLobby() {
    // ✨ ODA KODU MUHABBETİ KALDIRILDI - "Oda Kodu: ###### 👁️" kısmı gizlenir, sadece davet linki kalır
    // ✨ Davet linki gözük butonu KALDIRILDI - link her zaman görünür (hep açık)
    const bilRoomCodeEl = document.getElementById("roomCodeText");
    if (bilRoomCodeEl) {
        const bilRoomCodeBox = bilRoomCodeEl.closest(".roomCodeBox");
        if (bilRoomCodeBox) bilRoomCodeBox.style.display = "none";
        bilRoomCodeEl.style.display = "none";
    }
    const bilRoomCodeEyeEl = document.getElementById("roomCodeEyeBtn");
    if (bilRoomCodeEyeEl) bilRoomCodeEyeEl.style.display = "none";
    const bilCopyHintEl = document.getElementById("copyHint");
    if (bilCopyHintEl) bilCopyHintEl.style.display = "none";

    // ✨ Davet linki göz butonu da kaldırılır - link kısmı sürekli görünür
    const bilInviteLinkEyeEl = document.getElementById("inviteLinkEyeBtn");
    if (bilInviteLinkEyeEl) bilInviteLinkEyeEl.style.display = "none";

    const bilInviteLinkText = document.getElementById("inviteLinkText");
    const bilInviteLinkHint = document.getElementById("inviteLinkHint");
    if (bilInviteLinkText) {
        // Gizli state'i temizle → link her zaman açık görünür
        localStorage.removeItem("hideInviteLink");
        bilInviteLinkText.classList.remove("hiddenLink");
        bilInviteLinkText.textContent = `${location.origin}/?join=${roomCode}`;
        bilInviteLinkText.style.opacity = "";
        // Tıkla → kopyala
        bilInviteLinkText.onclick = () => {
            const link = `${location.origin}/?join=${roomCode}`;
            navigator.clipboard.writeText(link).then(() => {
                if (bilInviteLinkHint) {
                    bilInviteLinkHint.textContent = "✓ Link kopyalandı!";
                    bilInviteLinkHint.classList.add("show");
                    setTimeout(() => bilInviteLinkHint.classList.remove("show"), 2000);
                }
            }).catch(() => {});
        };
    }
    
    lobbyTurnSeconds.textContent = turnSeconds;
    lobbyGuessLimit.textContent = guessLimit === 0 ? "Sınırsız" : guessLimit;
    playersList.innerHTML = "";

    players.forEach(p => {
        const li = document.createElement("li");
        li.classList.add("playerRow");

        // İsim (sola yaslı)
        const nameCell = document.createElement("span");
        nameCell.className = "nameCell";
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);

        // Kick butonu (sağda, sadece host + rakip için)
        if (p.id !== playerId && playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }

        // Renk sınıfı
        if (p.id === playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }

        playersList.appendChild(li);
    });

    const maxP = bilMaxPlayers || 2;
    const curP = players.length;
    const canStart = (maxP === 1) ? (curP >= 1) : (curP === maxP);

    if (playerId === 1 && canStart) {
        startBtn.classList.remove("hidden");
        startBtn.textContent = "Oyunu Başlat";
        if (maxP === 1) {
            setMsg(lobbyMsg, "Tek başınasın. Başlatabilirsin!", "#51cf66");
        } else {
            setMsg(lobbyMsg, "İki oyuncu hazır. Başlatabilirsin!", "#51cf66");
        }
    } else if (playerId === 1) {
        startBtn.classList.add("hidden");
        setMsg(lobbyMsg, "Rakip bekleniyor...", "#ff6b6b");
    } else {
        startBtn.classList.add("hidden");
        setMsg(lobbyMsg, "Host Bekleniliyor...", "#51cf66");
    }
    
    // Oda Ayarları butonu - sadece host görsün
    const roomSettingsBtn = document.getElementById("roomSettingsBtn");
    if (roomSettingsBtn) {
        if (playerId === 1) {
            roomSettingsBtn.classList.remove("hidden");
        } else {
            roomSettingsBtn.classList.add("hidden");
        }
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("changeModeBtn");
    if (changeModeBtn) {
        if (playerId === 1) {
            changeModeBtn.classList.remove("hidden");
        } else {
            changeModeBtn.classList.add("hidden");
        }
    }
}

// ============ SEÇİM EKRANI ============
function renderSelectGrid() {
    selectGrid.innerHTML = "";

    const showSecret = localStorage.getItem("showSecret") !== "false";

    footballers.forEach((f, index) => {
        const card = createCard(f, index, "select");
        if (index === mySelection && selectionConfirmed && showSecret) {
            card.classList.add("mysecret");
        }
        selectGrid.appendChild(card);
    });
}

function updateCancelSecretButton() {
    if (!cancelSecretBtn) return;

    const canCancel = selectionConfirmed
        && selectionReadyCount < 2
        && !gameOver
        && !selectScreen.classList.contains("hidden");

    cancelSecretBtn.classList.toggle("hidden", !canCancel);
    cancelSecretBtn.disabled = !canCancel || selectionCancelPending;
}

// ============ OYUN EKRANI ============
function renderGameGrid() {
    gameGrid.innerHTML = "";
    const showSecret = localStorage.getItem("showSecret") !== "false";
    
    footballers.forEach((f, index) => {
        const card = createCard(f, index, "game");
        if (eliminated[index]) {
            card.classList.add("eliminated");
            const x = document.createElement("div");
            x.className = "overlayX";
            x.textContent = "X";
            card.appendChild(x);
        }
        if (index === mySelection && showSecret) {
            card.classList.add("mysecret");
        }
        gameGrid.appendChild(card);
    });
}

function createCard(f, index, mode) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = index;

    const img = document.createElement("img");
    img.src = `/static/images/${f.img_file || f.img + ".webp"}`;
    img.onerror = () => { img.style.display = "none"; };

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = f.name;

    const meta1 = document.createElement("div");
    meta1.className = "meta";
    meta1.textContent = f.position;
    // ✨ Detaylı Pozisyon Renkleri (Forvet: Kırmızı, Orta Saha: Yeşil, Defans: Mavi, Kaleci: Sarı)
    const posColors = {
        "Forvet": "#ff6b6b", "Santrafor": "#ff6b6b", "Sağ Kanat": "#ff6b6b", "Sol Kanat": "#ff6b6b",
        "Orta Saha": "#51cf66", "OrtaSaha": "#51cf66", "Defansif Orta Saha": "#51cf66", "Merkez Orta Saha": "#51cf66", "Ofansif Orta Saha": "#51cf66",
        "Defans": "#4dabf7", "Stoper": "#4dabf7", "Sağ Bek": "#4dabf7", "Sol Bek": "#4dabf7",
        "Kaleci": "#ffd43b"
    };
    meta1.style.color = posColors[f.position] || "#adb5bd";
    meta1.style.fontWeight = "600";

    const meta2 = document.createElement("div");
    meta2.className = "meta";
    meta2.textContent = f.league;
    // ✨ Lig rengi (CSS class ile)
    const leagueClassMap = {
        "Premier":"league-premier","LaLiga":"league-laliga","SerieA":"league-seriea",
        "Bundesliga":"league-bundesliga","Ligue1":"league-ligue1","SuperLig":"league-superlig",
        "Portugal":"league-portugal","Eredivisie":"league-eredivisie",
        "Saudi":"league-saudi","MLS":"league-mls"
    };
    const leagueClass = leagueClassMap[f.league];
    if (leagueClass) meta2.classList.add(leagueClass);
    meta2.style.fontWeight = "600";

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(meta1);
    card.appendChild(meta2);

    card.addEventListener("mouseenter", (e) => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => { showTooltip(f, e); }, 500);
    });
    card.addEventListener("mousemove", (e) => {
        if (tooltipVisible) positionTooltip(e);
    });
    card.addEventListener("mouseleave", () => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        hideTooltip();
    });

    if (mode === "select") {
        card.onclick = () => {
            if (selectionConfirmed) return;
            openConfirmBox("Gizli Futbolcunu Seç", f, `${f.name} adlı futbolcuyu seçmek istediğine emin misin?`, () => {
                mySelection = index;
                selectionConfirmed = true;
                selectionReadyCount = Math.min(2, selectionReadyCount + 1);
                setMsg(selectMsg, `Seçimin: ${f.name} ✓`);
                renderSelectGrid();
                updateCancelSecretButton();
                send({ type: "select_secret", index: index });
            });
        };
    }

    if (mode === "game") {
        card.ondblclick = () => {
            if (gameOver) return;
            if (currentTurn !== playerId) { setMsg(gameMsg, "Sıra sende değil!", "#ff6b6b"); return; }
            if (waitingForAnswer) { setMsg(gameMsg, "Cevap bekleniyor, tıklayamazsın!", "#ff6b6b"); return; }
            if (eliminated[index]) return;
            openConfirmBox("Tahmin", f, `${f.name} adlı futbolcuyu tahmin etmek istediğine emin misin?`, () => {
                send({ type: "guess", index: index });
                guessMode = false;
                updateGuessModeButton();
            });
        };

        card.onclick = () => {
            if (gameOver) return;
            if (!guessMode) return;
            if (currentTurn !== playerId) return;
            if (waitingForAnswer) { setMsg(gameMsg, "Cevap bekleniyor, tıklayamazsın!", "#ff6b6b"); return; }
            if (eliminated[index]) return;
            openConfirmBox("Tahmin", f, `${f.name} adlı futbolcuyu tahmin etmek istediğine emin misin?`, () => {
                send({ type: "guess", index: index });
                guessMode = false;
                updateGuessModeButton();
            });
        };
    }

    return card;
}

// ============ TOOLTIP ============
function showTooltip(f, e) {
    tooltipVisible = true;
    playerTooltip.innerHTML = "";
    const title = document.createElement("div");
    title.className = "tooltipTitle";
    title.textContent = f.name;
    playerTooltip.appendChild(title);

    addTooltipRow("Ülke", f.nationality);
    addTooltipRow("Kıta", f.continent);
    addTooltipRow("Pozisyon", f.position);
    addTooltipRow("Lig", f.league);

    const boolProps = [
        ["young", "Genç"], ["over30", "30+ Yaş"], ["beard", "Sakallı"],
        ["blonde", "Sarışın"], ["bald", "Kel"], ["headband", "Saç Bandı"],
        ["tattoo", "Dövmesi Var"], ["ballondor", "Ballon d'Or"], ["goals100", "100+ Gol"],
        ["ucl", "S.Ligi Kazandı"], ["worldcup", "D.Kupası Kazandı"], ["captain", "Kaptan"],
        ["leftfoot", "Sol Ayak"], ["europe", "Avrupa Ligi"], ["superlig", "SüperLig Geçmişi"],
        ["african", "Afrikalı"], ["number10", "10 Numara"], ["number9", "9 Numara"],
        ["number7", "7 Numara"]
    ];

    const trueProps = boolProps.filter(([key]) => f[key] === true);
    if (trueProps.length > 0) {
        const sep = document.createElement("div");
        sep.style.borderTop = "1px solid #3b4c63";
        sep.style.marginTop = "6px";
        sep.style.paddingTop = "6px";
        playerTooltip.appendChild(sep);

        trueProps.forEach(([key, label]) => {
            const row = document.createElement("div");
            row.className = "tooltipRow";
            row.innerHTML = `<span class="tooltipValue">✓ ${label}</span>`;
            playerTooltip.appendChild(row);
        });
    }

    playerTooltip.classList.remove("hidden");
    positionTooltip(e);
}

function addTooltipRow(label, value) {
    const row = document.createElement("div");
    row.className = "tooltipRow";
    row.innerHTML = `<span class="tooltipLabel">${label}:</span><span class="tooltipValue">${value}</span>`;
    playerTooltip.appendChild(row);
}

function positionTooltip(e) {
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    const maxX = window.innerWidth - playerTooltip.offsetWidth - 20;
    const maxY = window.innerHeight - playerTooltip.offsetHeight - 20;
    playerTooltip.style.left = Math.min(x, maxX) + "px";
    playerTooltip.style.top = Math.min(y, maxY) + "px";
}

function hideTooltip() {
    tooltipVisible = false;
    playerTooltip.classList.add("hidden");
}

// ============ SORULAR ============
function renderQuestions() {
    questionsBox.innerHTML = "";
    questionIndices.forEach(qi => {
        const btn = document.createElement("button");
        btn.className = "questionBtn";
        btn.textContent = questions[qi][0];
        btn.disabled = currentTurn !== playerId || gameOver || guessMode || waitingForAnswer;
        btn.onclick = () => {
            if (waitingForAnswer) return;
            waitingForAnswer = true;
            playBilSound("soru_sor.mp3");
            renderQuestions();
            updateGuessModeButton();
            send({ type: "ask_question", question_index: qi });
        };
        questionsBox.appendChild(btn);
    });
}

// ============ TOP BAR ============
function updateTopBar() {
    const otherId = getOtherPlayerId();
    const myNameText = getPlayerNameById(playerId);
    const otherNameText = getPlayerNameById(otherId);

    if (currentTurn === playerId) turnText.innerHTML = `<span class="turnMine">Sıra: SENDE</span>`;
    else turnText.innerHTML = `<span class="turnOpp">Sıra: RAKİPTE</span>`;

    scoreText.innerHTML = `Skor: <span class="scoreMine">${myNameText} ${scores[playerId] || 0}</span> - <span class="scoreOpp">${scores[otherId] || 0} ${otherNameText}</span>`;
    remainText.innerHTML = `Kalan: <span class="remainMine">Sen ${remaining[playerId] || 32}</span> / <span class="remainOpp">Rakip ${remaining[otherId] || 32}</span>`;
    updateGuessLeftDisplay();
}

function updateGuessLeftDisplay() {
    if (!guessLeftText) return;
    guessLeftText.classList.remove("unlimited", "safe", "warning", "danger");
    if (guessLimit === 0) {
        guessLeftText.textContent = "∞ Sınırsız";
        guessLeftText.classList.add("unlimited");
    } else {
        const myLeft = guessesLeft[playerId] || 0;
        guessLeftText.textContent = `${myLeft} / ${guessLimit}`;
        if (guessLimit === 1) {
            guessLeftText.classList.add("danger");
        } else if (guessLimit === 2) {
            if (myLeft === 2) guessLeftText.classList.add("warning");
            else guessLeftText.classList.add("danger");
        } else {
            if (myLeft <= 1) guessLeftText.classList.add("danger");
            else if (myLeft <= Math.ceil(guessLimit / 2)) guessLeftText.classList.add("warning");
            else guessLeftText.classList.add("safe");
        }
    }
}

function updateGuessModeButton() {
    if (waitingForAnswer) {
        guessModeBtn.textContent = "⏳ CEVAP BEKLENİYOR...";
        guessModeBtn.classList.remove("active");
        guessModeBtn.disabled = true;
        return;
    }
    guessModeBtn.disabled = false;
    if (guessMode) {
        guessModeBtn.textContent = "TAHMİN MODU AÇIK - Bir karta tıkla";
        guessModeBtn.classList.add("active");
    } else {
        guessModeBtn.textContent = "TAHMİN ET";
        guessModeBtn.classList.remove("active");
    }
}

// ============ ELEMENASYON ============
function getAliveFootballerCount() {
    let count = 0;
    for (let i = 0; i < eliminated.length; i++) {
        if (!eliminated[i]) count++;
    }
    return count;
}

function checkQuestionJS(f, questionIndex) {
    if (!questions || !questions[questionIndex] || !f) return false;
    const q = questions[questionIndex];
    const key = q[1];
    const value = q[2];

    // ✨ Pozisyon kategorileri akıllı kontrolü
    if (key === "position") {
        const pos = (f.position || "").toLowerCase();
        const valLower = (value || "").toLowerCase();

        if (valLower === "orta saha" || valLower === "ortasaha") {
            return pos.includes("orta") || pos.includes("os") || pos.includes("merkez");
        }
        if (valLower === "defans") {
            return pos.includes("defans") || pos.includes("stoper") || pos.includes("bek");
        }
        if (valLower === "forvet") {
            return pos.includes("forvet") || pos.includes("santrafor") || pos.includes("kanat");
        }
        return pos === valLower || pos.includes(valLower);
    }

    // Genel tipler (Boolean & String)
    if (typeof value === "boolean") {
        return Boolean(f[key]) === value;
    }

    if (typeof value === "string") {
        const fVal = String(f[key] || "").toLowerCase();
        return fVal === value.toLowerCase();
    }

    return f[key] === value;
}

function applyElimination(questionIndex, answer) {
    const beforeCount = getAliveFootballerCount();

    for (let i = 0; i < footballers.length; i++) {
        if (eliminated[i]) continue;

        const match = checkQuestionJS(footballers[i], questionIndex);
        if (answer && !match) {
            eliminated[i] = true;
        } else if (!answer && match) {
            eliminated[i] = true;
        }
    }

    const afterCount = getAliveFootballerCount();
    const removedCount = Math.max(0, beforeCount - afterCount);

    remaining[playerId] = afterCount;
    send({ type: "remaining_update", count: remaining[playerId] });
    renderGameGrid();
    updateTopBar();

    return removedCount;
}

// ============ ONAY POPUP ============
function openConfirmBox(title, footballer, message, callback) {
    confirmTitle.textContent = title;
    confirmImg.src = `/static/images/${footballer.img_file || footballer.img + ".webp"}`;
    confirmImg.onerror = () => { confirmImg.style.display = "none"; };
    confirmImg.style.display = "block";
    confirmName.textContent = footballer.name;
    confirmMsg.textContent = message;
    confirmCallback = callback;
    confirmBox.classList.remove("hidden");
}

function closeConfirmBox() {
    confirmBox.classList.add("hidden");
    confirmCallback = null;
}

confirmYesBtn.onclick = () => {
    const cb = confirmCallback;
    closeConfirmBox();
    if (cb) cb();
};

confirmNoBtn.onclick = () => { closeConfirmBox(); };

// ============ CEVAP PANELI ============
function showAnswerPanel(questionIndex, correctAnswer) {
    pendingAnswer = { question_index: questionIndex, correct_answer: correctAnswer };
    const qText = questions[questionIndex][0];
    answerQuestionText.textContent = qText;
    answerYesBtn.classList.remove("correct", "wrong");
    answerNoBtn.classList.remove("correct", "wrong");
    answerYesBtn.disabled = false;
    answerNoBtn.disabled = false;
    if (correctAnswer === true) {
        answerYesBtn.classList.add("correct");
        answerNoBtn.classList.add("wrong");
        answerNoBtn.disabled = true;
    } else {
        answerNoBtn.classList.add("correct");
        answerYesBtn.classList.add("wrong");
        answerYesBtn.disabled = true;
    }

    // Sorular panelini animasyonla kaybet (tüm panel)
    const questionsPanel = document.querySelector(".sidebar .panel:first-child");
    if (questionsPanel) {
        questionsPanel.classList.add("slideOut");
        setTimeout(() => {
            questionsPanel.classList.add("hidden");
            questionsPanel.classList.remove("slideOut");
        }, 250);
    }

    // Cevap panelini göster
    setTimeout(() => {
        answerPanel.classList.remove("hidden", "slideOut");
    }, 250);
    setMsg(gameMsg, "Rakip soru sordu! Doğru cevaba tıkla.", "#ffa94d");

    // Otomatik cevap açıksa 2 saniye sonra otomatik gönder
    const countdownEl = document.getElementById("autoAnswerCountdown");
    if (countdownEl) countdownEl.classList.add("hidden");

    if (autoAnswerCheckbox && autoAnswerCheckbox.checked) {
        startAutoAnswerCountdown();
    }
}

function hideAnswerPanel() {
    // Otomatik cevap timer'ı durdur
    if (autoAnswerTimer) {
        clearInterval(autoAnswerTimer);
        autoAnswerTimer = null;
    }
    const countdownEl = document.getElementById("autoAnswerCountdown");
    if (countdownEl) countdownEl.classList.add("hidden");

    // Animasyonla kaybet, sonra gizle
    if (!answerPanel.classList.contains("hidden")) {
        answerPanel.classList.add("slideOut");
        setTimeout(() => {
            answerPanel.classList.add("hidden");
            answerPanel.classList.remove("slideOut");
        }, 250);
    }

    // Sorular panelini geri göster (animasyonlu)
    const questionsPanel = document.querySelector(".sidebar .panel:first-child");
    if (questionsPanel) {
        setTimeout(() => {
            questionsPanel.classList.remove("hidden", "slideOut");
        }, 250);
    }

    pendingAnswer = null;
}

answerYesBtn.onclick = () => {
    if (!pendingAnswer) return;
    if (pendingAnswer.correct_answer !== true) return;
    send({ type: "submit_answer", answer: true });
};

answerNoBtn.onclick = () => {
    if (!pendingAnswer) return;
    if (pendingAnswer.correct_answer !== false) return;
    send({ type: "submit_answer", answer: false });
};

// ============ SOL ALT CEVAP BİLDİRİMİ ============
let answerToastTimeout = null;
let pendingAnswerToast = null;

function showAnswerToast(answer, removedCount) {
    const toast = document.getElementById("answerToast");
    const text = document.getElementById("answerToastText");
    if (!toast || !text) return;

    if (answerToastTimeout) clearTimeout(answerToastTimeout);

    toast.classList.remove("hidden", "hiding", "yes", "no");
    if (answer) {
        toast.classList.add("yes");
        text.textContent = `✅ EVET (silinen: ${removedCount})`;
    } else {
        toast.classList.add("no");
        text.textContent = `❌ HAYIR (silinen: ${removedCount})`;
    }

    answerToastTimeout = setTimeout(() => {
        toast.classList.add("hiding");
        setTimeout(() => {
            toast.classList.add("hidden");
            toast.classList.remove("hiding");
        }, 400);
    }, 3000);
}

// ============ TOAST ============
function showToast(title, message, imageFile, type) {
    if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    toastBox.classList.remove("hiding", "success");
    if (type === "success") toastBox.classList.add("success");
    toastTitle.textContent = title;
    toastMsg.textContent = message;
    if (imageFile) {
        toastImg.src = `/static/images/${imageFile}`;
        toastImg.style.display = "block";
        toastImg.onerror = () => { toastImg.style.display = "none"; };
    } else {
        toastImg.style.display = "none";
    }
    toastBox.classList.remove("hidden");
    toastTimeout = setTimeout(() => {
        toastBox.classList.add("hiding");
        setTimeout(() => {
            toastBox.classList.add("hidden");
            toastBox.classList.remove("hiding");
        }, 400);
    }, 3000);
}

// ============ KONFETI ============
function startConfetti() {
    const canvas = confettiCanvas;
    canvas.style.display = "block";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    const colors = ["#51cf66", "#ffd43b", "#74c0fc", "#ff6b6b", "#c084fc", "#4dabf7"];
    const particles = [];
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            r: Math.random() * 6 + 4,
            d: Math.random() * 25 + 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngle: 0,
            tiltAngleInc: Math.random() * 0.07 + 0.05
        });
    }
    let frame = 0;
    const maxFrames = 400;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            ctx.stroke();
        });
        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleInc;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
            p.tilt = Math.sin(p.tiltAngle) * 15;
            if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        });
        frame++;
        if (frame < maxFrames) requestAnimationFrame(draw);
        else canvas.style.display = "none";
    }
    draw();
}

// ============ OYUN SONU ============
function openGameOver(msg) {
    gameOver = true;
    stopTimer();
    hideAnswerPanel();

    if (msg.wrong_guess && msg.loser_id !== playerId) {
        let guessedImg = null;
        if (msg.guessed_name) {
            const found = footballers.find(f => f.name === msg.guessed_name);
            if (found) guessedImg = found.img_file || (found.img + ".webp");
        }
        showToast("❌ Rakip Yanlış Tahmin Etti!", `${msg.guesser_name || "Rakip"} tahmin ettiği: ${msg.guessed_name}`, guessedImg);
    }

    setTimeout(() => { gameOverBox.classList.remove("hidden"); }, 500);

    const otherId = getOtherPlayerId();
    const winnerId = msg.winner_id;

    gameOverTitle.classList.remove("win", "lose");
    if (winnerId === playerId) {
        playBilSound("cevap_evet.mp3");
        gameOverTitle.textContent = "KAZANDIN! 🏆";
        gameOverTitle.classList.add("win");
        startConfetti();
    } else {
        playBilSound("cevap_hayir.mp3");
        gameOverTitle.textContent = "KAYBETTİN 😢";
        gameOverTitle.classList.add("lose");
    }

    const mySecretIndex = msg.reveal[String(playerId)];
    const oppSecretIndex = msg.reveal[String(otherId)];
    const mySecretName = mySecretIndex != null ? footballers[mySecretIndex].name : "?";
    const oppSecretName = oppSecretIndex != null ? footballers[oppSecretIndex].name : "?";

    // ✨ Resim yollarını al ve img taglerini hazırla
    const mySecretImg = mySecretIndex != null ? `/static/images/${footballers[mySecretIndex].img_file || footballers[mySecretIndex].img + ".webp"}` : "";
    const oppSecretImg = oppSecretIndex != null ? `/static/images/${footballers[oppSecretIndex].img_file || footballers[oppSecretIndex].img + ".webp"}` : "";
    
    const myImgTag = mySecretImg ? `<img src="${mySecretImg}" style="width:100px; height:100px; object-fit:cover; border-radius:10px; border:3px solid #51cf66; box-shadow:0 0 15px rgba(81,207,102,0.3); background:#1a1e2e; margin-top:8px;">` : `<div style="width:100px; height:100px; border:3px dashed #51cf66; border-radius:10px; margin:8px auto 0 auto; display:flex; align-items:center; justify-content:center; color:#51cf66; font-size:24px;">?</div>`;
    const oppImgTag = oppSecretImg ? `<img src="${oppSecretImg}" style="width:100px; height:100px; object-fit:cover; border-radius:10px; border:3px solid #ff6b6b; box-shadow:0 0 15px rgba(255,107,107,0.3); background:#1a1e2e; margin-top:8px;">` : `<div style="width:100px; height:100px; border:3px dashed #ff6b6b; border-radius:10px; margin:8px auto 0 auto; display:flex; align-items:center; justify-content:center; color:#ff6b6b; font-size:24px;">?</div>`;

    let extra = "";
    if (msg.wrong_guess) {
        if (msg.loser_id === playerId) {
            extra = `<p style="color:#ff6b6b; font-size:16px; margin-top:10px; background:rgba(255,107,107,0.1); padding:8px; border-radius:8px; border:1px solid rgba(255,107,107,0.3);"><b>YANLIŞ TAHMİN!</b><br>Tahmin ettiğin: <b style="color:#fff;">${msg.guessed_name}</b></p>`;
        } else {
            extra = `<p style="color:#51cf66; font-size:16px; margin-top:10px; background:rgba(81,207,102,0.1); padding:8px; border-radius:8px; border:1px solid rgba(81,207,102,0.3);"><b>Rakip yanlış tahmin etti!</b><br>Tahmin ettiği: <b style="color:#fff;">${msg.guessed_name}</b></p>`;
        }
    }

    gameOverText.innerHTML = `
        ${extra}
        <div style="display:flex; justify-content:center; gap:20px; margin-top:15px;">
            <div style="flex:1; text-align:center; background:rgba(81,207,102,0.05); padding:10px; border-radius:12px; border:1px solid rgba(81,207,102,0.2);">
                <div style="color:#adb5bd; font-size:13px; margin-bottom:4px;">Senin Futbolcun</div>
                <div style="color:#51cf66; font-weight:bold; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mySecretName}</div>
                ${myImgTag}
            </div>
            <div style="flex:1; text-align:center; background:rgba(255,107,107,0.05); padding:10px; border-radius:12px; border:1px solid rgba(255,107,107,0.2);">
                <div style="color:#adb5bd; font-size:13px; margin-bottom:4px;">Rakibin Futbolcusu</div>
                <div style="color:#ff6b6b; font-weight:bold; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${oppSecretName}</div>
                ${oppImgTag}
            </div>
        </div>
        <div style="margin-top:20px; font-size:20px; background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid #3b4c63;">
            Skor: <b style="color:#ffd43b; font-size:24px; margin-left:10px;">${scores[playerId]} - ${scores[otherId]}</b>
        </div>
    `;

    if (playerId === 1) newRoundBtn.classList.remove("hidden");
    else newRoundBtn.classList.add("hidden");
    
    // ✨ Lobiye Dön butonu - HERKESE göster (host ve misafir)
    const lobbyBtn = document.getElementById("backToLobbyBtn");
    if (lobbyBtn) lobbyBtn.classList.remove("hidden");
}

function resetForNewRound() {
    footballers = [];
    questions = [];
    questionIndices = [];
    eliminated = [];
    mySelection = null;
    selectionConfirmed = false;
    selectionReadyCount = 0;
    selectionCancelPending = false;
    currentTurn = null;
    guessMode = false;
    remaining = { 1: 32, 2: 32 };
    gameOver = false;
    pendingAnswer = null;
    waitingForAnswer = false;
    pendingAnswerToast = null;
    gameOverBox.classList.add("hidden");
    logBox.innerHTML = "";
    setMsg(gameMsg, "");
    setMsg(selectMsg, "");
    hideAnswerPanel();
    stopTimer();
    updateCancelSecretButton();
}

function fullReset() {
    inRoom = false;
    playerId = null;
    roomCode = "";
    players = [];
    resetForNewRound();
    gameOverBox.classList.add("hidden");
    opponentLeftBox.classList.add("hidden");
    confirmBox.classList.add("hidden");
    showScreen("home");
}

// ============ KICK POPUP ============
function openKickConfirm(targetId, targetName) {
    const overlay = document.getElementById("kickConfirmBox");
    document.getElementById("kickConfirmText").textContent =
        `${targetName} adlı oyuncuyu atmak istediğine emin misin?`;
    overlay.classList.remove("hidden");

    const yesBtn = document.getElementById("kickYesBtn");
    const noBtn = document.getElementById("kickNoBtn");

    const closeBox = () => overlay.classList.add("hidden");

    yesBtn.onclick = () => {
        send({ type: "kick_player", target_id: targetId });
        closeBox();
    };
    noBtn.onclick = closeBox;
}

// ============ BİL BAKALIM SES SİSTEMİ (Autoplay & Preload Korumalı) ============
const _bilAudioCache = {};
let _bilAudioUnlocked = false;

function unlockBilAudio() {
    if (_bilAudioUnlocked) return;
    ["soru_sor.mp3", "cevap_evet.mp3", "cevap_hayir.mp3"].forEach(file => {
        if (!_bilAudioCache[file]) {
            const a = new Audio(`/bil_bakalim_sounds/${file}`);
            a.preload = "auto";
            _bilAudioCache[file] = a;
        }
    });
    _bilAudioUnlocked = true;
}

// Kullanıcı sayfada ilk nereye tıklar/basarsa ses iznini kap
document.addEventListener("click", unlockBilAudio, { once: true });
document.addEventListener("keydown", unlockBilAudio, { once: true });

function playBilSound(filename) {
    try {
        unlockBilAudio();
        const vol = getGlobalVolume();
        let audio = _bilAudioCache[filename];
        if (!audio) {
            audio = new Audio(`/bil_bakalim_sounds/${filename}`);
            _bilAudioCache[filename] = audio;
        }
        const clone = audio.cloneNode();
        clone.volume = vol;
        clone.play().catch(err => console.warn("[Bil Sound] Engellendi:", err));
    } catch(e) {}
}

// ============ CHAT BİLDİRİM SESİ (Ortak - Ses Seviyesinden Bağımsız) ============
function _playChatNotifySound() {
    try {
        const sound = new Audio("/static/sounds/chat_notify.mp3");
        sound.volume = 1.0;
        sound.play().catch(() => {});
    } catch (e) {}
}

// ============ 💬 BİL BAKALIM CHAT ============
function showBilChat() {
    const c = document.getElementById("bilChatContainer");
    if (c) c.style.display = "block";
}

function hideBilChat() {
    const c = document.getElementById("bilChatContainer");
    if (c) c.style.display = "none";
    closeBilChatPanel();
    bilChat.messages = [];
    bilChat.unread = 0;
    const box = document.getElementById("bilChatMessages");
    if (box) box.innerHTML = "";
    clearBilChatPopups();
}

function toggleBilChatPanel() {
    if (bilChat.open) closeBilChatPanel();
    else openBilChatPanel();
}

function openBilChatPanel() {
    bilChat.open = true;
    bilChat.unread = 0;
    const panel = document.getElementById("bilChatPanel");
    const badge = document.getElementById("bilChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearBilChatPopups();
    const box = document.getElementById("bilChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("bilChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", bilChatOutsideClickHandler, true);
    }, 100);
}

function closeBilChatPanel() {
    bilChat.open = false;
    const panel = document.getElementById("bilChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", bilChatOutsideClickHandler, true);
    const input = document.getElementById("bilChatInput");
    if (input && input.value) input.value = "";
}

function bilChatOutsideClickHandler(e) {
    const c = document.getElementById("bilChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeBilChatPanel();
}

function sendBilChatMessage() {
    const input = document.getElementById("bilChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "bil_chat_send", text: text });
}

function showBilChatPopup(msg) {
    if (bilChat.open) return;
    const stack = document.getElementById("bilChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";
    
    const popup = document.createElement("div");
    popup.className = "miniChatPopup";
    // Bil Bakalım'da takım yok, kim host kim değil ona göre renk
    if (msg.sender_id === 1) popup.classList.add("teamRed");
    else popup.classList.add("teamBlue");
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "miniChatPopupName";
    nameSpan.style.color = msg.sender_id === 1 ? "#ff8a8a" : "#7abfff";
    nameSpan.textContent = msg.sender_name;
    
    const textSpan = document.createElement("span");
    textSpan.className = "miniChatPopupText";
    textSpan.textContent = msg.text;
    
    popup.appendChild(nameSpan);
    popup.appendChild(textSpan);
    stack.appendChild(popup);
    
    while (stack.children.length > 5) stack.removeChild(stack.firstChild);
    
    setTimeout(() => {
        popup.classList.add("leaving");
        setTimeout(() => {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
            if (stack.children.length === 0) stack.style.display = "none";
        }, 350);
    }, 3000);
}

function clearBilChatPopups() {
    const stack = document.getElementById("bilChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addBilChatMessage(msg) {
    // ✨ Bildirim sesi - Yazan dahil herkes duysun
    try { _playChatNotifySound(); } catch(e) {}

    bilChat.messages.push(msg);
    if (bilChat.messages.length > bilChat.maxMessages) bilChat.messages.shift();
    
    const box = document.getElementById("bilChatMessages");
    if (!box) return;
    
    const div = document.createElement("div");
    div.className = "miniChatMsg";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "chatName";
    nameSpan.style.color = msg.sender_id === 1 ? "#ff8a8a" : "#7abfff";
    nameSpan.textContent = msg.sender_name + ":";
    
    const textSpan = document.createElement("span");
    textSpan.className = "chatText";
    textSpan.textContent = " " + msg.text;
    
    div.appendChild(nameSpan);
    div.appendChild(textSpan);
    box.appendChild(div);
    
    while (box.children.length > bilChat.maxMessages) box.removeChild(box.firstChild);
    
    if (bilChat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        bilChat.unread++;
        const badge = document.getElementById("bilChatBadge");
        if (badge) {
            badge.textContent = bilChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showBilChatPopup(msg);
    }
}

// ============ MESAJ İŞLEME ============
function handleMessage(msg) {
    if (msg.type === "error") {
        // Kick mesajı özel popup
        if (msg.message && msg.message.toLowerCase().includes("atıl")) {
            const kickBox = document.getElementById("kickBlockedBox");
            if (kickBox) {
                kickBox.classList.remove("hidden");
            } else {
                showToast("🚫 Giriş Engellendi!", msg.message, null);
            }
        // Oda dolu mesajı özel popup
        } else if (msg.message && msg.message.toLowerCase().includes("dolu")) {
            const fullBox = document.getElementById("roomFullBox");
            if (fullBox) {
                fullBox.classList.remove("hidden");
            } else {
                showToast("🚪 Oda Dolu!", msg.message, null);
            }
        } else {
            showToast("⚠️ Hata!", msg.message || "Bir hata oluştu.", null);
        }
        return;
    }
	
	if (msg.type === "public_rooms_list") {
        renderPublicRooms(msg.rooms || []);
        return;
    }

    // Otomatik mod kontrolü (sadece info göster, odaya girme)
    if (msg.type === "room_mode_check_result") {
        const infoBox = document.getElementById("joinRoomModeInfo");
        const currentCode = roomInput ? roomInput.value.trim().toUpperCase() : "";

        // Eski sorgu cevabı geldiyse yoksay
        if (msg.room_code && currentCode && msg.room_code !== currentCode) return;

        if (infoBox) {
            infoBox.classList.remove("loading");
            infoBox.style.textAlign = "center";
            infoBox.style.width = "100%";
            infoBox.style.display = "block";
            infoBox.style.fontSize = "20px";
            infoBox.style.fontWeight = "700";
            if (msg.found) {
                // Mod isimlerini güzelleştir
                const modeDisplayNames = {
                    "bil_bakalim": "🎯 Bil Bakalım",
                    "takim_bilmece": "⚽ Takım Bilmece",
                    "kim_milyoner": "💰 Kim Milyoner",
                    "haritadan_bul": "🌍 Haritadan Bul",
                    "gizemli_kariyer": "🎭 Gizemli Kariyer",
                    "ilk_11_challenge": "⚽ İlk 11 Challenge",
                    "sarkidan_bul": "🎵 Şarkıdan Bul",
                    "mini_futbol": "⚽ Mini Futbol",
                    "jokerli_satranc": "♟️ Jokerli Satranç"
                };
                const displayName = modeDisplayNames[msg.mode] || msg.mode_name || msg.mode;
                infoBox.textContent = displayName;
                infoBox.style.color = "#51cf66";
                infoBox.classList.remove("error");
                infoBox.classList.add("show");
            } else {
                infoBox.textContent = "Oda bulunamadı";
                infoBox.style.color = "#ff6b6b";
                infoBox.classList.add("show", "error");
            }
        }
        return;
    }

    // Katıl butonuna basıldığında odaya bağlan
    if (msg.type === "room_mode_result") {
        if (!msg.found) { setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b"); return; }
        // ✨ İsim input'u kaldırıldı - prompt ile girilen ismi kullan
        const name = (window._joinName && window._joinName.trim())
            ? window._joinName.trim()
            : (joinNameInput ? joinNameInput.value.trim() : "");
        const code = msg.room_code;
        if (msg.mode === "takim_bilmece") {
            send({ type: "takim_join_room", name: name, room_code: code });
        } else if (msg.mode === "kim_milyoner") {
            send({ type: "ml_join_room", name: name, room_code: code, seen_hashes: (typeof getMlHistory === "function") ? getMlHistory() : [] });
        } else if (msg.mode === "haritadan_bul") {
            send({ type: "harita_join_room", name: name, room_code: code });
        } else if (msg.mode === "gizemli_kariyer") {
            send({ type: "gizem_join_room", name: name, room_code: code });
        } else if (msg.mode === "ilk_11_challenge") {
            send({ type: "ilk11_join_room", name: name, room_code: code });
        } else if (msg.mode === "sarkidan_bul") {
            send({ type: "sarki_join_room", name: name, room_code: code });
        } else if (msg.mode === "mini_futbol") {
            send({ type: "mini_join_room", name: name, room_code: code });
        } else if (msg.mode === "jokerli_satranc") {
            send({ type: "satranc_join_room", name: name, room_code: code });
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }

    if (msg.type === "room_created") {
        try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
        playerId = msg.player_id;
        roomCode = msg.room_code;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
        bilMaxPlayers = msg.max_players || 2;
        bilBotLevel = msg.bot_level || "orta";
        inRoom = true;
        showBilChat();
        showScreen("lobby");
        updateLobby();
        return;
    }

    if (msg.type === "room_joined") {
        try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
        playerId = msg.player_id;
        roomCode = msg.room_code;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
        bilMaxPlayers = msg.max_players || 2;
        bilBotLevel = msg.bot_level || "orta";
        inRoom = true;
        showBilChat();
        showScreen("lobby");
        updateLobby();
        return;
    }

    if (msg.type === "lobby_update") {
        // ✨ Lobiye yeni biri geldiyse katılma sesi çal + Toast göster
        if (players && msg.players && players.length < msg.players.length && msg.players.length > 1) {
            try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
            const oldPids = new Set(players.map(p => p.id));
            const newPlayer = msg.players.find(p => !oldPids.has(p.id));
            if (newPlayer && newPlayer.id !== playerId) {
                showToast("👋 Odaya Katıldı", `${newPlayer.name} odaya katıldı!`, null, "success");
            }
        }
        showBilChat();
        roomCode = msg.room_code;
        players = msg.players;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
        if (msg.max_players !== undefined) bilMaxPlayers = msg.max_players;
        if (msg.bot_level !== undefined) bilBotLevel = msg.bot_level;
        updateLobby();
        return;
    }

    if (msg.type === "game_started") {
        resetForNewRound();
        footballers = msg.footballers;
        questions = msg.questions;
        scores = msg.scores;
        players = msg.players;
        playerId = msg.player_id;
        roomCode = msg.room_code;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
        guessesLeft = msg.guesses_left || { 1: guessLimit, 2: guessLimit };
        inRoom = true;
        eliminated = new Array(footballers.length).fill(false);
        showScreen("select");
        renderSelectGrid();
        updateTopBar();
        startTimer(turnSeconds, selectTimer);
        return;
    }

    if (msg.type === "selection_cancel_denied") {
        selectionCancelPending = false;
        updateCancelSecretButton();
        if (!selectScreen.classList.contains("hidden")) {
            setMsg(selectMsg, msg.message || "Seçimin iptal edilemedi.", "#ff6b6b");
        }
        return;
    }

    if (msg.type === "selection_status") {
        selectionReadyCount = Number.isInteger(msg.selected_count) ? msg.selected_count : 0;

        if (Number.isInteger(msg.selected_player_id) && msg.selected_player_id !== playerId) {
            showToast("🎯 Rakip Seçimini Yaptı", "Rakip gizli futbolcusunu seçti.", null, "success");
        }

        if (msg.cancelled_player_id === playerId) {
            mySelection = null;
            selectionConfirmed = false;
            selectionCancelPending = false;
            renderSelectGrid();
            showToast("✅ Seçim İptal Edildi", "Yeni bir gizli futbolcu seçebilirsin.", null, "success");
        } else if (Number.isInteger(msg.cancelled_player_id) && msg.cancelled_player_id !== playerId) {
            showToast("↩️ Rakip Seçimini İptal Etti", "Rakip yeniden gizli futbolcu seçecek.", null, "warning");
        }

        if (selectionReadyCount < 2) setMsg(selectMsg, `Hazır oyuncu: ${selectionReadyCount}/2`);
        else setMsg(selectMsg, "İki oyuncu da seçti. Oyun başlıyor...");

        updateCancelSecretButton();
        return;
    }

    if (msg.type === "auto_selected") {
        if (!selectionConfirmed) {
            mySelection = msg.index;
            selectionConfirmed = true;
            setMsg(selectMsg, `Süre bitti! Otomatik seçildi: ${msg.name}`);
            renderSelectGrid();
            showToast("⏰ Süre Bitti!", `Otomatik seçildi: ${msg.name}`, null, "success");
        }
        return;
    }

    if (msg.type === "opponent_auto_selected") {
        showToast("⏰ Rakip Seçemedi", `${msg.name} için otomatik seçim yapıldı`, null);
        return;
    }

    if (msg.type === "turn_update") {
        currentTurn = msg.current_turn;
        questionIndices = msg.question_indices;
        scores = msg.scores;
        remaining = msg.remaining;
        turnSeconds = msg.turn_seconds || turnSeconds;
        if (msg.guesses_left) guessesLeft = msg.guesses_left;
        if (msg.guess_limit !== undefined) guessLimit = msg.guess_limit;
        waitingForAnswer = false;
        showScreen("game");
        renderGameGrid();
        renderQuestions();
        updateTopBar();
        updateGuessModeButton();
        hideAnswerPanel();
        if (currentTurn === playerId) {
            setMsg(gameMsg, "Senin sıran!", "#51cf66");
            
            // OTOMATIK TAHMİN: Eğer sadece 1 futbolcu kaldıysa otomatik tahmin et
            const remainingIndices = [];
            for (let i = 0; i < eliminated.length; i++) {
                if (!eliminated[i]) remainingIndices.push(i);
            }
            
            if (remainingIndices.length === 1) {
                const lastIndex = remainingIndices[0];
                const lastFootballer = footballers[lastIndex];
                setMsg(gameMsg, `🎯 Son futbolcu: ${lastFootballer.name} - Otomatik tahmin!`, "#ffd43b");
                
                // 2 saniye bekle, sonra otomatik tahmin
                setTimeout(() => {
                    send({ type: "guess", index: lastIndex });
                }, 2000);
                return;
            }
        } else {
            setMsg(gameMsg, "Rakip oynuyor...", "#ff6b6b");
        }
        startTimer(turnSeconds, gameTimer);
        return;
    }

    if (msg.type === "turn_timeout") {
        return;
    }

    if (msg.type === "answer_prompt") {
        playBilSound("soru_sor.mp3");
        const qText = questions[msg.question_index][0];
        showAnswerPanel(msg.question_index, msg.correct_answer);
        startTimer(turnSeconds, gameTimer);
        return;
    }

    if (msg.type === "waiting_for_answer") {
        const qText = questions[msg.question_index][0];
        setMsg(gameMsg, `${msg.opponent_name} cevap veriyor...`, "#ffa94d");
        waitingForAnswer = true;
        renderQuestions();
        updateGuessModeButton();
        startTimer(turnSeconds, gameTimer);
        return;
    }

    if (msg.type === "answer_sent") {
        hideAnswerPanel();
        const qText = (questions && questions[msg.question_index]) ? questions[msg.question_index][0] : "Soru";
        const ansText = msg.answer ? "EVET" : "HAYIR";
        // ✨ Rakibin sorduğu soru ve gelen cevap (KIRMIZI)
        addLog(`${qText} → ${ansText}`, "opp");

        // Gelen cevaba göre ses çal
        playBilSound(msg.answer ? "cevap_evet.mp3" : "cevap_hayir.mp3");

        const otherId = getOtherPlayerId();
        const beforeCount = Number.isInteger(remaining[otherId]) ? remaining[otherId] : 32;

        pendingAnswerToast = {
            answer: msg.answer,
            player_id: otherId,
            before_count: beforeCount
        };
        return;
    }

    if (msg.type === "answer_result") {
        const qText = (questions && questions[msg.question_index]) ? questions[msg.question_index][0] : "Soru";
        const ansText = msg.answer ? "EVET" : "HAYIR";
        // ✨ Benim sorduğum soru ve gelen cevap (YEŞİL)
        addLog(`${qText} → ${ansText}`, "mine");
        setMsg(gameMsg, `Cevap: ${ansText}`, msg.answer ? "#51cf66" : "#ff6b6b");

        // Gelen cevaba göre ses çal
        playBilSound(msg.answer ? "cevap_evet.mp3" : "cevap_hayir.mp3");

        const removedCount = applyElimination(msg.question_index, msg.answer);

        waitingForAnswer = false;
        updateGuessModeButton();
        showAnswerToast(msg.answer, removedCount);
        return;
    }

    if (msg.type === "remaining_update") {
        remaining[msg.player_id] = msg.count;
        updateTopBar();

        if (pendingAnswerToast && pendingAnswerToast.player_id === msg.player_id) {
            const removedCount = Math.max(0, pendingAnswerToast.before_count - msg.count);
            showAnswerToast(pendingAnswerToast.answer, removedCount);
            pendingAnswerToast = null;
        }
        return;
    }

    if (msg.type === "game_over") {
        scores = msg.scores;
        updateTopBar();
        openGameOver(msg);
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "bil_chat_msg") {
        addBilChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            ts: msg.ts
        });
        return;
    }
    
    if (msg.type === "bil_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = bilChat.open;
            bilChat.open = true;
            msg.messages.forEach(m => addBilChatMessage(m));
            bilChat.open = wasOpen;
            bilChat.unread = 0;
            const badge = document.getElementById("bilChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }
    
    // ✨ Host lobiye döndü → herkesi lobiye at
    if (msg.type === "back_to_lobby") {
        gameOverBox.classList.add("hidden");
        stopTimer();
        hideAnswerPanel();
        resetForNewRound();
        showScreen("lobby");
        updateLobby();
        return;
    }

    if (msg.type === "wrong_guess_continue") {
        if (msg.guesses_left) guessesLeft = msg.guesses_left;

        // ✨ Yanlış tahmin edilen oyuncuyu SADECE tahmin edenin tahtasından ele
        // (Rakip tahmin ettiyse benim tahtamda silme YAPMA - o futbolcu benim gizlim olabilir!)
        if (msg.guessed_name && msg.guesser_id === playerId) {
            const idx = footballers.findIndex(f => f.name === msg.guessed_name);
            if (idx !== -1 && !eliminated[idx]) {
                eliminated[idx] = true;
                renderGameGrid();
            }
        }

        // ✨ Yanlış tahminde HER İKİ OYUNCU da ses duyar
        playBilSound("cevap_hayir.mp3");

        if (msg.guesser_id === playerId) {
            const remainingText = guessLimit === 0 ? "Sıra rakibe geçti." : `Kalan hakkın: ${guessesLeft[playerId]}`;
            setMsg(gameMsg, `❌ Yanlış tahmin! ${remainingText}`, "#ff6b6b");
            showToast("❌ Yanlış Tahmin!", `Tahmin ettiğin: ${msg.guessed_name}`, msg.guessed_img);

            // Kendi kalan sayımızı güncelle
            remaining[playerId] = getAliveFootballerCount();
            send({ type: "remaining_update", count: remaining[playerId] });
        } else {
            showToast("❌ Rakip Yanlış Tahmin Etti!", `${msg.guesser_name} tahmin ettiği: ${msg.guessed_name}`, msg.guessed_img);
        }
        updateTopBar();
        return;
    }
	
	// ✨ Rakip oyun içinde ayrıldı → lobiye dön (oda açık)
    if (msg.type === "opponent_left_to_lobby") {
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        stopTimer();
        hideAnswerPanel();
        confirmBox.classList.add("hidden");
        gameOverBox.classList.add("hidden");
        
        showToast("👋 Rakip Ayrıldı", msg.message || "Rakip ayrıldı, lobiye dönüldü.", null, "warning");
        
        // Modun lobby ekranına dön
        const current = getCurrentScreen();
        if (current.includes("takim")) showScreen("takimLobby");
        else if (current.includes("ml")) showScreen("mlLobby");
        else if (current.includes("harita")) showScreen("haritaLobby");
        else if (current.includes("gizem")) showScreen("gizemLobby");
        else if (current.includes("ilk11")) showScreen("ilk11Lobby");
        else if (current.includes("satranc")) showScreen("satrancLobby");
        else showScreen("lobby");  // Bil Bakalım
        
        return;
    }

    if (msg.type === "opponent_left") {
        // ✨ Mini Futbol'da opponent_left = HOST ayrıldı (oda kapandı)
        const current = getCurrentScreen();
        if (current === "miniGame" || current === "miniLobby") {
            const leftName = msg.player_name || "Host";
            
            showToast("🚪 Oda Kapatıldı", "Host ayrıldı, oda kapatıldı.", null, "warning");
            
            // Temizle
            if (typeof HP !== 'undefined' && HP.running) HP.stopGame();
            if (typeof stopMiniGame === "function") stopMiniGame();
            if (typeof stopMiniPing === "function") stopMiniPing();
            
            inRoom = false;
            if (typeof miniData !== "undefined") {
                miniData.roomCode = "";
                miniData.playerId = null;
                miniData.players = [];
                miniData.gameState = null;
            }
            playerId = null;
            roomCode = "";
            
            document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
            
            if (ws) { try { ws.close(); } catch(e) {} }
            setTimeout(() => {
                connectWS();
                showScreen("join");
            }, 500);
            return;
        }
        
        // ✨ Lobby'de ayrıldıysa → popup YOK, sadece toast
        const lobbyScreens = ["lobby", "takimLobby", "mlLobby", "haritaLobby", 
                              "gizemLobby", "ilk11Lobby"];
        if (lobbyScreens.includes(current)) {
            showToast("👋 Rakip Ayrıldı", msg.message || "Rakip lobbyden ayrıldı.", null, "warning");
            return;
        }
        
        // ✨ Oyun içinde ayrıldıysa → popup göster (lobiye dön butonu ile)
        inRoom = false;
        stopTimer();
        hideAnswerPanel();
        confirmBox.classList.add("hidden");
        gameOverBox.classList.add("hidden");
        opponentLeftText.textContent = msg.message || "Rakibin oyundan ayrıldı. Oda kapatıldı.";
        opponentLeftBox.classList.remove("hidden");
    }

    if (msg.type === "player_left_lobby") {
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        showToast("👋 Oyuncu Ayrıldı", msg.message, null);
    }

    if (msg.type === "you_were_kicked") {
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        inRoom = false;
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        if (ws) { try { ws.close(); } catch(e) {} }
        connectWS();
        showScreen("join");
        showToast("⚠️ Odadan Atıldınız!", msg.message || "Host tarafından odadan çıkarıldınız.", null);
        return;
    }

    if (msg.type === "player_kicked") {
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        showToast("⚠️ Oyuncu Atıldı", msg.message, null);
    }

    if (msg.type === "you_are_host_now") {
        // Sen artık host oldun (playerId değişti)
        playerId = msg.new_player_id;
        showToast("👑 Artık Host'sun!", "Rakip ayrıldı, sen host oldun.", null, "success");
    }
}

// ============ BUTON İŞLEMLERİ ============
menuCreateCard.onclick = () => { showScreen("modselect"); };
menuJoinCard.onclick = () => {
    showScreen("join");
    startPublicRoomsRefresh();
};createBackBtn.onclick = () => {
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "bil_bakalim" && pendingModeChange.createScreen === "create") {
        const returnScreen = pendingModeChange.returnScreen || "lobby";
        window._pendingModeChangeCtx = null;
        setMsg(createMsg, "");

        // ✨ Önce eski moddaki lobiye dön
        showScreen(returnScreen);

        // ✨ Sonra Mod Değiştir popup'ını tekrar aç
        setTimeout(() => {
            if (typeof openChangeModeModal === "function") {
                openChangeModeModal();
            }
        }, 200);
        return;
    }
    showScreen("modselect");
};
document.getElementById("modSelectBackBtn").onclick = () => { showScreen("home"); };

document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    card.addEventListener("click", () => {
        const mod = card.dataset.mod;
        if (mod === "bil_bakalim") {
            if (createNameInput) {
                const nameBox = createNameInput.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            if (createBtn) createBtn.textContent = "Oda Oluştur";
            window._pendingModeChangeCtx = null;

            // ✨ Kaydedilmiş ayarları yükle
            try {
                const savedTurn = localStorage.getItem("bilTurnSeconds");
                const savedLimit = localStorage.getItem("bilGuessLimit");
                const savedMaxP = localStorage.getItem("bilMaxPlayers");
                const savedBot = localStorage.getItem("bilBotLevel");

                const turnSel = document.getElementById("turnSecondsSelect");
                const limitSel = document.getElementById("guessLimitSelect");
                const maxPSel = document.getElementById("bilMaxPlayersSelect");
                const botSel = document.getElementById("bilBotLevelSelect");

                if (turnSel && savedTurn) turnSel.value = savedTurn;
                if (limitSel && savedLimit) limitSel.value = savedLimit;
                if (maxPSel && savedMaxP) maxPSel.value = savedMaxP;
                if (botSel && savedBot) botSel.value = savedBot;

                // Event'i manuel tetikle (Kutuyu aç/kapa)
                if (maxPSel) maxPSel.dispatchEvent(new Event("change"));
            } catch(e) {}

            showScreen("create");
            createNameInput.focus();
        } else if (mod === "takim_bilmece") {
            // ✨ Normal giriş için isim + buton normale döndür
            const takimNameInput = document.getElementById("createTakimNameInput");
            if (takimNameInput) {
                const nameBox = takimNameInput.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            const takimCreateBtn = document.getElementById("createTakimBtn");
            if (takimCreateBtn) takimCreateBtn.textContent = "Oda Oluştur";
            window._pendingModeChangeCtx = null;

            // ✨ Kaydedilmiş ayarları yükle
            try {
                const savedMaxP = localStorage.getItem("takimMaxPlayers");
                const savedDiff = localStorage.getItem("takimDifficulty");
                const savedTurnSec = localStorage.getItem("takimTurnSeconds");
                const savedTotalQ = localStorage.getItem("takimTotalQuestions");

                const maxPSel = document.getElementById("takimMaxPlayersSelect");
                const diffSel = document.getElementById("takimDifficultySelect");
                const turnSecSel = document.getElementById("takimTurnSecondsSelect");
                const totalQSel = document.getElementById("takimTotalQuestionsSelect");

                if (maxPSel && savedMaxP) maxPSel.value = savedMaxP;
                if (diffSel && savedDiff) diffSel.value = savedDiff;
                if (turnSecSel && savedTurnSec) turnSecSel.value = savedTurnSec;

                if (totalQSel && typeof window.updateTakimQuestionOptions === "function") {
                    window.updateTakimQuestionOptions(
                        maxPSel ? maxPSel.value : 2,
                        savedTotalQ || totalQSel.value,
                        "takimTotalQuestionsSelect"
                    );
                } else if (totalQSel && savedTotalQ) {
                    totalQSel.value = savedTotalQ;
                }

                if (typeof updateJokerInfo === "function") updateJokerInfo();
            } catch(e) {}

            showScreen("createTakim");
            if (takimNameInput) takimNameInput.focus();
        }
        // Diğer modlar kendi JS dosyalarında handle ediyor (wrap sistemi)
    });
});

const takimDifficultySelect = document.getElementById("takimDifficultySelect");

window.getTakimQuestionOptions = function(maxPlayers) {
    const playerCount = parseInt(maxPlayers, 10) || 2;

    if (playerCount === 1) {
        return [2, 4, 6, 9, 12, 15, 20, 25];
    }

    const maxQuestions = playerCount === 4 ? 32 : 30;
    const options = [];

    for (let count = playerCount; count <= maxQuestions; count += playerCount) {
        options.push(count);
    }

    return options;
};

window.getNearestTakimQuestionCount = function(value, options) {
    if (!Array.isArray(options) || options.length === 0) return null;

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return options[0];

    return options.reduce((nearest, candidate) => {
        const candidateDistance = Math.abs(candidate - parsedValue);
        const nearestDistance = Math.abs(nearest - parsedValue);

        if (
            candidateDistance < nearestDistance ||
            (candidateDistance === nearestDistance && candidate < nearest)
        ) {
            return candidate;
        }

        return nearest;
    }, options[0]);
};

window.updateTakimQuestionOptions = function(maxPlayersValue, preferredValue, selectId) {
    const createMaxPlayersSelect = document.getElementById("takimMaxPlayersSelect");
    const questionSelect = document.getElementById(selectId || "takimTotalQuestionsSelect");

    if (!questionSelect) return;

    const playerCount = maxPlayersValue !== undefined && maxPlayersValue !== null
        ? maxPlayersValue
        : (createMaxPlayersSelect ? createMaxPlayersSelect.value : 2);

    const options = window.getTakimQuestionOptions(playerCount);
    const currentValue = preferredValue !== undefined && preferredValue !== null
        ? preferredValue
        : questionSelect.value;
    const selectedValue = window.getNearestTakimQuestionCount(currentValue, options);

    if (selectedValue === null) return;

    questionSelect.innerHTML = "";
    options.forEach(value => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value} Soru`;
        questionSelect.appendChild(option);
    });

    questionSelect.value = String(selectedValue);
};

const takimMaxPlayersSelectForQuestions = document.getElementById("takimMaxPlayersSelect");
if (takimMaxPlayersSelectForQuestions) {
    takimMaxPlayersSelectForQuestions.addEventListener("change", () => {
        window.updateTakimQuestionOptions(takimMaxPlayersSelectForQuestions.value);
    });
    window.updateTakimQuestionOptions(takimMaxPlayersSelectForQuestions.value);
}

const jokerData = {
    kolay:  { name: 3, year: 3, elim: 3, pass: 3, title: "🟢 KOLAY - Jokerler" },
    orta:   { name: 2, year: 2, elim: 2, pass: 1, title: "🟡 ORTA - Jokerler" },
    zor:    { name: 1, year: 0, elim: 1, pass: 0, title: "🔴 ZOR - Jokerler" },
    klasik: { name: 3, year: 3, elim: 3, pass: 3, title: "🎯 KLASİK - Jokerler" }
};

function updateJokerInfo() {
    const diff = takimDifficultySelect.value;
    const j = jokerData[diff];
    document.getElementById("jokerInfoTitle").textContent = j.title;
    document.getElementById("jokerName").textContent = j.name;
    document.getElementById("jokerYear").textContent = j.year;
    document.getElementById("jokerElim").textContent = j.elim;
    document.getElementById("jokerPass").textContent = j.pass;
}

takimDifficultySelect.addEventListener("change", updateJokerInfo);

document.getElementById("createTakimBackBtn").onclick = () => {
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "takim_bilmece" && pendingModeChange.createScreen === "createTakim") {
        const returnScreen = pendingModeChange.returnScreen || "takimLobby";
        window._pendingModeChangeCtx = null;
        document.getElementById("createTakimMsg").textContent = "";

        // Eski moddaki lobiye dön
        showScreen(returnScreen);

        // Sonra Mod Değiştir popup'ını tekrar aç
        setTimeout(() => {
            if (typeof openChangeModeModal === "function") {
                openChangeModeModal();
            }
        }, 200);
        return;
    }
    showScreen("modselect");
};
joinBackBtn.onclick = () => { showScreen("home"); };

// ==========================================
// AÇIK SUNUCULAR
// ==========================================
let _publicRoomsInterval = null;

// ✨ Katıl anında isim isteme - join ekranında isim input'u artık yok
// "Katıl →" butonuna veya sunucu kartına basınca prompt ile isim sorulur, onaylanınca katıl
// (query_room_mode → room_mode_result adımında isim buradaki değerden kullanılır)
window._joinName = "";
function askJoinName() {
    // ✨ Modern isim modalı - katıl anında açılan şık kutusu
    return new Promise((resolve) => {
        const saved = localStorage.getItem("playerName") || "";

        // Keyframe'lar (görsel animasyonlar) - sadece bir kez ekle
        if (!document.getElementById("joinNameModalStyles")) {
            const style = document.createElement("style");
            style.id = "joinNameModalStyles";
            style.textContent =
                "@keyframes joinNamePop{from{transform:scale(0.9);opacity:0}to{transform:scale(1);opacity:1}}" +
                "@keyframes joinNameFadeOut{to{opacity:0;transform:scale(0.95)}}";
            document.head.appendChild(style);
        }

        const overlay = document.createElement("div");
        overlay.id = "joinNameModalOverlay";
        overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.78); display:flex; align-items:center; justify-content:center; z-index:100000; padding:20px;";
        overlay.innerHTML = `
            <div style="background:linear-gradient(145deg,#1e2746,#141a2e); border:2px solid #ffd43b; border-radius:16px;
                        padding:30px 28px; max-width:420px; width:100%;
                        box-shadow:0 0 50px rgba(255,212,59,0.25), 0 0 80px rgba(0,0,0,0.6);
                        animation:joinNamePop 0.25s ease;">
                <div style="font-size:52px; text-align:center; margin-bottom:6px;">🎮</div>
                <h2 style="color:#ffd43b; text-align:center; margin:0 0 4px 0; font-size:24px;">Odaya Katıl</h2>
                <p style="color:#adb5bd; text-align:center; font-size:14px; margin:0 0 20px 0;">Odaya katılmak için adını gir</p>
                <input id="joinNameModalInput" type="text" placeholder="Adını yaz" maxlength="20" value=""
                       style="width:100%; padding:14px 16px; font-size:16px; background:#0f1422; color:#fff;
                              border:2px solid #3b4c63; border-radius:10px; box-sizing:border-box;
                              outline:none; transition:border-color 0.2s, box-shadow 0.2s;"
                       autocomplete="off">
                <div style="display:flex; justify-content:flex-end; margin-top:6px;">
                    <span id="joinNameModalCount" style="color:#6c757d; font-size:12px;">0/20</span>
                </div>
                <p id="joinNameModalError" style="color:#ff6b6b; font-size:13px; min-height:18px; margin:8px 0 0 0; text-align:center;"></p>
                <div style="display:flex; gap:12px; margin-top:18px;">
                    <button id="joinNameModalOk" class="bigBtn greenBtn" style="flex:1;">✅ Katıl</button>
                    <button id="joinNameModalCancel" class="bigBtn redBtn" style="flex:1;">İptal</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector("#joinNameModalInput");
        const errorEl = overlay.querySelector("#joinNameModalError");
        const countEl = overlay.querySelector("#joinNameModalCount");
        const okBtn = overlay.querySelector("#joinNameModalOk");
        const cancelBtn = overlay.querySelector("#joinNameModalCancel");

        input.value = saved;
        input.focus();
        input.select();

        function updateCount() {
            countEl.textContent = input.value.length + "/20";
        }
        updateCount();

        // Odaklanınca altın çerçeve, çağrıyı bırakınca eski hale dön
        input.addEventListener("input", updateCount);
        input.addEventListener("focus", () => {
            input.style.borderColor = "#ffd43b";
            input.style.boxShadow = "0 0 0 3px rgba(255,212,59,0.15)";
        });
        input.addEventListener("blur", () => {
            input.style.borderColor = "#3b4c63";
            input.style.boxShadow = "";
        });

        function close(result) {
            overlay.style.animation = "joinNameFadeOut 0.15s ease forwards";
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve(result);
            }, 150);
        }

        function submit() {
            const trimmed = input.value.trim();
            if (!trimmed) {
                errorEl.textContent = "⚠️ İsim boş bırakılamaz";
                input.focus();
                return;
            }
            if (trimmed.length > 20) {
                errorEl.textContent = "⚠️ İsim en fazla 20 karakter olabilir";
                input.focus();
                return;
            }
            window._joinName = trimmed;
            localStorage.setItem("playerName", trimmed);
            close(trimmed);
        }

        okBtn.onclick = () => submit();
        cancelBtn.onclick = () => close(null);

        // Enter ile gönder, ESC ile iptal
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") { e.preventDefault(); close(null); }
        });

        // Kutunun dışında tıklayınca iptal
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) close(null);
        });
    });
}

function fetchPublicRooms() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    send({ type: "list_public_rooms" });
}

function renderPublicRooms(rooms) {
    const list = document.getElementById("publicRoomsList");
    if (!list) return;

    if (!rooms || rooms.length === 0) {
        list.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:14px; padding:15px 0;">Şu an açık sunucu yok</p>';
        return;
    }

    // ✨ Kartlar yeniden yapılmaz - mevcut kartlar yerinde güncellenir (titreme olmaz)
    const newRooms = {};
    rooms.forEach(function(r) { newRooms[r.room_code] = r; });

    // Artık listede olmayan kartları sil
    Array.from(list.children).forEach(function(card) {
        const code = card.dataset ? card.dataset.roomCode : null;
        if (!code || !newRooms[code]) card.remove();
    });

    // Mevcut kartları güncelle, olmayanları ekle
    rooms.forEach(function(r) {
        let card = null;
        Array.from(list.children).forEach(function(c) {
            if (c.dataset && c.dataset.roomCode === r.room_code) card = c;
        });
        if (!card) {
            card = createPublicRoomCard(r);
            list.appendChild(card);
        } else {
            updatePublicRoomCard(card, r);
        }
    });

    // ✨ ?join=CODE ile açıldıysa o odayı yeşil vurgula + ekrana scroll
    if (window._pendingJoinHighlight) {
        Array.from(list.children).forEach(card => {
            if (card.dataset && card.dataset.roomCode === window._pendingJoinHighlight) {
                card.style.border = "2px solid #51cf66";
                card.style.boxShadow = "0 0 20px rgba(81,207,102,0.6)";
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                window._pendingJoinHighlight = null;
            }
        });
    }
}

// ✨ Tek bir oda kartını oluşturur (hover/tık handler'ları tek seferlik bağlanır)
function createPublicRoomCard(r) {
    const card = document.createElement("div");
    card.dataset.roomCode = r.room_code;
    card._isFull = false;
    card.style.cssText = "background:rgba(255,255,255,0.05); border:1px solid #3b4c63; border-radius:10px; padding:12px 15px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; transition: all 0.2s;";

    card.onmouseenter = function() {
        card.style.borderColor = "#4dabf7";
        card.style.background = "rgba(77,171,247,0.08)";
    };
    card.onmouseleave = function() {
        card.style.borderColor = "#3b4c63";
        card.style.background = "rgba(255,255,255,0.05)";
    };

    const left = document.createElement("div");
    card._elLeft = left;

    const right = document.createElement("div");
    right.style.cssText = "display:flex; align-items:center; gap:10px;";

    const count = document.createElement("span");
    count.style.cssText = "color:#51cf66; font-size:13px; font-weight:bold;";
    card._elCount = count;

    const btn = document.createElement("button");
    btn.style.cssText = "background:#51cf66; color:#1a1e2e; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;";
    card._elBtn = btn;

    btn.onclick = function(e) {
        e.stopPropagation();
        if (card._isFull) {
            // ✨ Dolu odaya basınca "Oda Dolu!" denir, modal açılmaz
            showToast("🚪 Oda Dolu!", "Bu oda dolu, katılılamaz.", null, "warning");
            return;
        }
        // ✨ İsim input'u yok - katıl anında modern modal ile isim sor, onaylanınca katıl
        askJoinName().then(name => {
            if (!name) return;
            send({ type: "query_room_mode", room_code: card.dataset.roomCode });
        });
    };

    right.appendChild(count);
    right.appendChild(btn);
    card.appendChild(left);
    card.appendChild(right);

    updatePublicRoomCard(card, r);
    return card;
}

// ✨ Kartın içeriğini yerinde günceller (göz atma titrememesi için)
function updatePublicRoomCard(card, r) {
    const isFull = (r.player_count >= r.max_players);
    card._isFull = isFull;

    // Sol kısım: mod + host (her oda normal görünümde)
    card._elLeft.innerHTML = '<div style="color:#fff; font-weight:bold; font-size:15px;">' + r.mode_display + '</div>' +
        '<div style="color:#adb5bd; font-size:13px; margin-top:3px;">Host: ' + (r.host_name || "???") + '</div>';

    // Oyuncu sayısı
    card._elCount.textContent = "👥 " + r.player_count + "/" + r.max_players;
    card._elCount.style.color = "#51cf66";

    // Buton (dolu olsa da normal "Katıl →" görünümü)
    card._elBtn.textContent = "Katıl →";
    card._elBtn.style.cssText = "background:#51cf66; color:#1a1e2e; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;";
    card._elBtn.disabled = false;
}

function startPublicRoomsRefresh() {
    stopPublicRoomsRefresh();
    fetchPublicRooms();
    // ✨ Anlık güncelleme için 2 sn'lik polling (biri çıkıp/girince hemen görünür)
    _publicRoomsInterval = setInterval(fetchPublicRooms, 2000);
}

function stopPublicRoomsRefresh() {
    if (_publicRoomsInterval) {
        clearInterval(_publicRoomsInterval);
        _publicRoomsInterval = null;
    }
}

let _publicRoomsDebounce = null;
// ✨ Anlık güncelleme yardımcısı: çağrıldığında 250ms bekleyip listeyi yeniden çeker
function _publicRoomsDebouncedRefresh() {
    if (_publicRoomsDebounce) clearTimeout(_publicRoomsDebounce);
    _publicRoomsDebounce = setTimeout(() => {
        fetchPublicRooms();
    }, 250);
}

// ✨ Sayfa yeniden görünür olduğunda / pencere odaklandığında anlık yenile
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) _publicRoomsDebouncedRefresh();
});
window.addEventListener("focus", () => {
    _publicRoomsDebouncedRefresh();
});

const _publicRoomsRefreshBtn = document.getElementById("publicRoomsRefreshBtn");
if (_publicRoomsRefreshBtn) {
    _publicRoomsRefreshBtn.onclick = function() {
        fetchPublicRooms();
    };
}

// ✨ Oyuncu sayısına göre bot kutusunu gizle/göster
const bilMaxPlayersSelect = document.getElementById("bilMaxPlayersSelect");
const bilBotLevelBox = document.getElementById("bilBotLevelBox");

if (bilMaxPlayersSelect && bilBotLevelBox) {
    bilMaxPlayersSelect.addEventListener("change", () => {
        if (bilMaxPlayersSelect.value === "1") {
            bilBotLevelBox.style.display = "";
        } else {
            bilBotLevelBox.style.display = "none";
        }
    });
}

createBtn.onclick = () => {
    const enteredName = createNameInput.value.trim();
    const parsedSeconds = parseInt(turnSecondsSelect.value, 10);
    const parsedGuessLimit = parseInt(guessLimitSelect.value, 10);
    const selectedSeconds = isNaN(parsedSeconds) ? 45 : parsedSeconds;
    const selectedGuessLimit = isNaN(parsedGuessLimit) ? 0 : parsedGuessLimit;
    
    const maxP = parseInt(document.getElementById("bilMaxPlayersSelect")?.value) || 2;
    const botL = document.getElementById("bilBotLevelSelect")?.value || "orta";

    // ✨ Ayarları hafızaya kaydet
    try {
        localStorage.setItem("bilTurnSeconds", String(selectedSeconds));
        localStorage.setItem("bilGuessLimit", String(selectedGuessLimit));
        localStorage.setItem("bilMaxPlayers", String(maxP));
        localStorage.setItem("bilBotLevel", botL);
    } catch(e) {}

    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "bil_bakalim" && pendingModeChange.createScreen === "create") {
        if (enteredName) {
            myName = enteredName;
            localStorage.setItem("playerName", myName);
        }
        setMsg(createMsg, "Mod değiştiriliyor...", "#51cf66");
        console.log("[MODE CHANGE] Bil Bakalım için mod_change_room gönderiliyor");
        send({
            type: "mod_change_room",
            new_mode: "bil_bakalim",
            mode_settings: {
                turn_seconds: selectedSeconds,
                guess_limit: selectedGuessLimit
            }
        });
        return;
    }

    myName = enteredName;
    if (!myName) { setMsg(createMsg, "İsim gir.", "#ff6b6b"); return; }
    localStorage.setItem("playerName", myName);
    send({ 
        type: "create_room", 
        name: myName, 
        turn_seconds: selectedSeconds, 
        guess_limit: selectedGuessLimit,
        max_players: maxP,
        bot_level: botL
    });
};

// ✨ "Katıl" butonu kaldırıldı - katıl ekranda sadece açık sunucular listesi kalıyor
// (odaya katılma, açık sunucular listesindeki kart/buton üzerinden yapılır)

startBtn.onclick = () => { send({ type: "start_game" }); };

if (cancelSecretBtn) {
    cancelSecretBtn.onclick = () => {
        if (!selectionConfirmed
            || selectionReadyCount >= 2
            || selectScreen.classList.contains("hidden")
            || selectionCancelPending) {
            return;
        }

        selectionCancelPending = true;
        updateCancelSecretButton();
        send({ type: "cancel_secret_selection" });
    };
}

lobbyLeaveBtn.onclick = () => {
    _showLeaveConfirmPopup();
};

guessModeBtn.onclick = () => {
    if (currentTurn !== playerId || gameOver) { setMsg(gameMsg, "Sıra sende değil!", "#ff6b6b"); return; }
    if (waitingForAnswer) { setMsg(gameMsg, "Cevap bekleniyor, tıklayamazsın!", "#ff6b6b"); return; }
    guessMode = !guessMode;
    updateGuessModeButton();
    renderQuestions();
    if (guessMode) setMsg(gameMsg, "Tahmin modu açık. Bir karta tıkla veya çift tıkla.", "#ffd43b");
    else setMsg(gameMsg, "Tahmin modu kapalı.");
};

newRoundBtn.onclick = () => { send({ type: "start_game" }); };

backToMenuBtn.onclick = () => {
    inRoom = false;
    gameOverBox.classList.add("hidden");
    if (ws) { try { ws.close(); } catch(e) {} }
    connectWS();
    showScreen("home");
};

// ✨ Lobiye Dön butonu
document.getElementById("backToLobbyBtn").onclick = () => {
    if (playerId === 1) {
        // HOST: backend'e broadcast et (herkesi lobiye atacak)
        send({ type: "back_to_lobby" });
    } else {
        // MİSAFİR: sadece kendi ekranını lobiye çevir
        gameOverBox.classList.add("hidden");
        showScreen("lobby");
        updateLobby();
    }
};

// Rakip ayrıldı — "← Geri" butonu → Katıl ekranına
document.getElementById("opponentLeftBackBtn").onclick = () => {
    inRoom = false;
    opponentLeftBox.classList.add("hidden");
    if (ws) { try { ws.close(); } catch(e) {} }
    connectWS();
    showScreen("join");
};

// Rakip ayrıldı — "Ana Menüye Dön" butonu → Ana menüye
opponentLeftOkBtn.onclick = () => {
    inRoom = false;
    opponentLeftBox.classList.add("hidden");
    if (ws) { try { ws.close(); } catch(e) {} }
    connectWS();
    showScreen("home");
};

roomCodeText.onclick = () => {
    // Gizliyken bile kopyalasın (gerçek kodu)
    navigator.clipboard.writeText(roomCode).then(() => {
        copyHint.textContent = "✓ Kopyalandı!";
        copyHint.classList.add("show");
        setTimeout(() => { copyHint.classList.remove("show"); }, 2000);
    }).catch(() => {});
};

// ============ ODA KODU / LİNK GİZLE-GÖSTER ============

function toggleRoomCode(forceShow) {
    const isHidden = roomCodeText.classList.contains("hiddenCode");
    const show = forceShow !== undefined ? forceShow : isHidden;
    
    if (show) {
        roomCodeText.classList.remove("hiddenCode");
        roomCodeText.textContent = roomCode;
    } else {
        roomCodeText.classList.add("hiddenCode");
        roomCodeText.textContent = "######";
    }
}

function toggleInviteLink() {
    const linkText = document.getElementById("inviteLinkText");
    const isHidden = linkText.classList.contains("hiddenLink");
    
    if (isHidden) {
        linkText.classList.remove("hiddenLink");
        linkText.textContent = generateInviteLink();
        localStorage.setItem("hideInviteLink", "false");
    } else {
        linkText.classList.add("hiddenLink");
        linkText.textContent = "########################";
        localStorage.setItem("hideInviteLink", "true");
    }
}

function generateInviteLink() {
    return `${location.origin}/?join=${roomCode}`;
}

function updateInviteLink() {
    const linkText = document.getElementById("inviteLinkText");
    const isHidden = localStorage.getItem("hideInviteLink") === "true";
    
    if (isHidden) {
        linkText.classList.add("hiddenLink");
        linkText.textContent = "########################";
    } else {
        linkText.classList.remove("hiddenLink");
        linkText.textContent = generateInviteLink();
    }
}

// Göz ikon buton olayları
document.getElementById("roomCodeEyeBtn").onclick = (e) => {
    e.stopPropagation();
    toggleRoomCode();
};

document.getElementById("inviteLinkEyeBtn").onclick = (e) => {
    e.stopPropagation();
    toggleInviteLink();
};

// Davet linkine tıklayınca kopyala (gizliyken bile kopyalasın)
document.getElementById("inviteLinkText").onclick = () => {
    const link = generateInviteLink();
    navigator.clipboard.writeText(link).then(() => {
        const hint = document.getElementById("inviteLinkHint");
        hint.textContent = "✓ Link kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

createNameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") createBtn.click(); });
// ✨ Oda kodu input'u ve Katıl butonu kaldırıldı - ilgili keypress handler'lar da kaldırıldı
// (joinNameInput'a Enter basılınca artık hiçbir şey yapmasın)

// ✨ Oda kodu input'u kaldırıldı - otomatik mod bilgisi sorgusu da kaldırıldı
// (joinRoomModeInfo kutusu artık kullanılmaz)

window.addEventListener("resize", () => {
    if (confettiCanvas.style.display === "block") {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
});

const savedName = localStorage.getItem("playerName");
if (savedName) {
    createNameInput.value = savedName;
    joinNameInput.value = savedName;
    document.getElementById("createTakimNameInput").value = savedName;
}

// ============ FOOTER POPUP FONKSİYONLARI ============
function showDisclaimer() { document.getElementById("disclaimerBox").classList.remove("hidden"); }
function closeDisclaimer() { document.getElementById("disclaimerBox").classList.add("hidden"); }
function showAbout() { document.getElementById("aboutBox").classList.remove("hidden"); }
function closeAbout() { document.getElementById("aboutBox").classList.add("hidden"); }
function showContact() { document.getElementById("contactBox").classList.remove("hidden"); }
function closeContact() { document.getElementById("contactBox").classList.add("hidden"); }

function copyEmail() {
    const email = document.getElementById("emailValue").textContent.trim();
    const emailCard = document.querySelector(".emailCard");
    const emailHint = document.getElementById("emailHint");
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(() => {
            showCopiedFeedback(emailCard, emailHint);
        }).catch(() => { fallbackCopy(email, emailCard, emailHint); });
    } else {
        fallbackCopy(email, emailCard, emailHint);
    }
}

function fallbackCopy(text, card, hint) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand("copy");
        showCopiedFeedback(card, hint);
    } catch (e) { alert("Kopyalama başarısız. Manuel kopyalayın: " + text); }
    document.body.removeChild(textarea);
}

function showCopiedFeedback(card, hint) {
    if (!card || !hint) return;
    card.classList.add("copied");
    const originalHint = hint.textContent;
    hint.textContent = "✅ Kopyalandı!";
    setTimeout(() => {
        card.classList.remove("copied");
        hint.textContent = originalHint;
    }, 2000);
}

window.copyEmail = copyEmail;
window.showDisclaimer = showDisclaimer;
window.closeDisclaimer = closeDisclaimer;
window.showAbout = showAbout;
window.closeAbout = closeAbout;
window.showContact = showContact;
window.closeContact = closeContact;

// Otomatik Cevapla Checkbox - localStorage
const autoAnswerCheckbox = document.getElementById("autoAnswerCheckbox");
if (autoAnswerCheckbox) {
    const savedAuto = localStorage.getItem("autoAnswer");
    autoAnswerCheckbox.checked = savedAuto === "true";
    autoAnswerCheckbox.addEventListener("change", () => {
        localStorage.setItem("autoAnswer", autoAnswerCheckbox.checked ? "true" : "false");

        // Eğer şu an rakibin sorusu bekliyorsa VE checkbox işaretlendiyse
        // 2 saniye geri sayım başlat
        if (autoAnswerCheckbox.checked && pendingAnswer) {
            startAutoAnswerCountdown();
        }
        // Eğer checkbox kapatıldıysa ve geri sayım varsa iptal et
        if (!autoAnswerCheckbox.checked && autoAnswerTimer) {
            clearInterval(autoAnswerTimer);
            autoAnswerTimer = null;
            const countdownEl = document.getElementById("autoAnswerCountdown");
            if (countdownEl) countdownEl.classList.add("hidden");
        }
    });
}

// Otomatik cevap geri sayımı başlat
function startAutoAnswerCountdown() {
    if (!pendingAnswer) return;
    if (autoAnswerTimer) clearInterval(autoAnswerTimer);

    const countdownEl = document.getElementById("autoAnswerCountdown");
    let remaining = 3;
    if (countdownEl) {
        countdownEl.textContent = `🤖 Otomatik cevap: ${remaining} sn`;
        countdownEl.classList.remove("hidden");
    }

    autoAnswerTimer = setInterval(() => {
        remaining--;
        if (countdownEl) countdownEl.textContent = `🤖 Otomatik cevap: ${remaining} sn`;
        if (remaining <= 0) {
            clearInterval(autoAnswerTimer);
            autoAnswerTimer = null;
            if (pendingAnswer) {
                send({ type: "submit_answer", answer: pendingAnswer.correct_answer });
            }
        }
    }, 1000);
}

let autoAnswerTimer = null;

// Gizli Futbolcu Toggle - localStorage'dan yükle
const showSecretCheckbox = document.getElementById("showSecretCheckbox");
if (showSecretCheckbox) {
    const saved = localStorage.getItem("showSecret");
    showSecretCheckbox.checked = saved !== "false"; // default: true
    
    showSecretCheckbox.addEventListener("change", () => {
        localStorage.setItem("showSecret", showSecretCheckbox.checked ? "true" : "false");
        // Anlık güncelle
        if (!selectScreen.classList.contains("hidden")) renderSelectGrid();
        if (!gameScreen.classList.contains("hidden")) renderGameGrid();
    });
}

// ==========================================
// ESC ÇIKIŞ POPUP
// ==========================================

// Hangi ekrandayız? Görünür olan ekranı bul
function getCurrentScreen() {
    const screens = {
        "home": "homeScreen",
        "modselect": "modSelectScreen",
        "join": "joinScreen",
        "create": "createScreen",
        "createTakim": "createTakimScreen",
        "createMl": "createMlScreen",
        "createHarita": "createHaritaScreen",
        "createGizem": "createGizemScreen",
        "createIlk11": "createIlk11Screen",
        "lobby": "lobbyScreen",
        "select": "selectScreen",
        "game": "gameScreen",
        "mlLobby": "mlLobbyScreen",
        "mlGame": "mlGameScreen",
        "takimLobby": "takimLobbyScreen",
        "takimGame": "takimGameScreen",
        "haritaLobby": "haritaLobbyScreen",
        "haritaGame": "haritaGameScreen",
        "gizemLobby": "gizemLobbyScreen",
        "gizemGame": "gizemGameScreen",
        "ilk11Lobby": "ilk11LobbyScreen",
        "ilk11Game": "ilk11GameScreen",
        "createSarki": "createSarkiScreen",
        "sarkiLobby": "sarkiLobbyScreen",
        "sarkiGame": "sarkiGameScreen",
        "createMini": "createMiniScreen",
        "miniLobby": "miniLobbyScreen",
        "miniGame": "miniGameScreen",
        "satrancLobby": "satrancLobbyScreen",
        "satrancGame": "satrancGameScreen"
    };
    
    for (const [key, id] of Object.entries(screens)) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden")) return key;
    }
    return "home";
}

// Bir önceki ekran ne olmalı?
function getPreviousScreen() {
    const current = getCurrentScreen();
    
    // Oyun/lobby ekranlarında ana menüye dönmek için onay lazım
    const gameScreens = ["game", "select", "lobby",
                          "mlGame", "mlLobby",
                          "takimGame", "takimLobby",
                          "haritaGame", "haritaLobby",
                          "gizemGame", "gizemLobby",
                          "ilk11Game", "ilk11Lobby",
                          "miniGame", "miniLobby"];
    if (gameScreens.includes(current)) return null;
    
    // Oda oluştur ekranlarından modselect'e
    const createScreens = ["create", "createTakim", "createMl",
                           "createHarita", "createGizem",
                           "createIlk11",
                           "createMini"];
    if (createScreens.includes(current)) return "modselect";
    
    if (current === "join") return "home";
    if (current === "modselect") return "home";
    
    return null;
}

function showEscPopup() {
    document.getElementById("escConfirmBox").classList.remove("hidden");
    // Şu anki ekrana göre butonları özelleştir
    _updateEscPopupButtons();
    // ✨ Host mu misafir mi kontrolü - misafire eski basit menü
    _applyEscPopupUserMode();
}

// ✨ Host için 4 buton, misafir için eski EVET/HAYIR
function _applyEscPopupUserMode() {
    const isHost = _isCurrentHost();
    const card = document.querySelector("#escConfirmBox .escConfirmCard");
    if (!card) return;
    
    // 4 buton container
    const bigMenu = card.querySelector('div[style*="flex-direction:column"]');
    // Eski gizli container
    const oldMenu = card.querySelector('div[style*="display:none"]');
    // Başlık ve mesaj
    const title = card.querySelector(".escTitle");
    const msg = document.getElementById("escMenuMsg");
    const icon = card.querySelector(".escIcon");
    
    if (isHost) {
        // HOST - 4 butonlu zengin menü
        if (bigMenu) bigMenu.style.display = "flex";
        if (oldMenu) oldMenu.style.display = "none";
        if (title) {
            title.textContent = "Menü";
            title.style.color = "#ffd43b";
        }
        if (msg) {
            msg.textContent = "Ne yapmak istersin?";
            msg.style.display = "";
        }
        if (icon) icon.textContent = "⏸️";
    } else {
        // MİSAFİR - eski basit EVET/HAYIR
        if (bigMenu) bigMenu.style.display = "none";
        if (oldMenu) {
            oldMenu.style.display = "";
            // Eski butonları görünür yap
            oldMenu.innerHTML = `
                <div class="confirmButtons">
                    <button id="escYesBtn" class="bigBtn redBtn">🚪 EVET, ÇIKIŞ</button>
                    <button id="escNoBtn" class="bigBtn greenBtn">↩️ HAYIR, DEVAM</button>
                </div>
            `;
            // Butonlara event bağla
            const yesBtn = document.getElementById("escYesBtn");
            const noBtn = document.getElementById("escNoBtn");
            if (yesBtn) {
                yesBtn.onclick = () => {
                    _leaveRoom(_escFromF5);
                };
            }
            if (noBtn) {
                noBtn.onclick = () => {
                    _escFromF5 = false;
                    closeEscPopup();
                };
            }
        }
        if (title) {
            title.textContent = "Çıkmak İstediğine Emin misin?";
            title.style.color = "";
        }
        if (msg) {
            msg.textContent = "Oyundan çıkarsan ana menüye dönersin.";
            msg.style.display = "";
        }
        if (icon) icon.textContent = "🚪";
    }
}

function closeEscPopup() {
    const card = document.querySelector("#escConfirmBox .escConfirmCard");
    card.classList.add("closing");
    setTimeout(() => {
        document.getElementById("escConfirmBox").classList.add("hidden");
        card.classList.remove("closing");
    }, 300);
}

// ✨ Şu anki mod ve ekrana göre butonları göster/gizle
function _updateEscPopupButtons() {
    const current = getCurrentScreen();
    const lobbyBtn = document.getElementById("escLobbyBtn");
    const msg = document.getElementById("escMenuMsg");
    
    // Lobby ekranlarında "Lobiye Dön" gereksiz - gizle
    const lobbyScreens = ["lobby", "mlLobby", "takimLobby", "haritaLobby", 
                          "gizemLobby", "ilk11Lobby", 
                          "miniLobby"];
    if (lobbyScreens.includes(current)) {
        if (lobbyBtn) lobbyBtn.style.display = "none";
        if (msg) msg.textContent = "Ne yapmak istersin?";
    } else {
        if (lobbyBtn) lobbyBtn.style.display = "";
        if (msg) msg.textContent = "Ne yapmak istersin?";
    }
}

// ✨ Host tespiti (tüm modlar için)
function _isCurrentHost() {
    if (playerId === 1) return true;
    if (typeof takimData !== "undefined" && takimData.playerId === 1) return true;
    if (typeof mlData !== "undefined" && mlData.playerId === 1) return true;
    if (typeof haritaData !== "undefined" && haritaData.playerId === 1) return true;
    if (typeof gizemData !== "undefined" && gizemData.playerId === 1) return true;
    if (typeof ilk11Data !== "undefined" && ilk11Data.playerId === 1) return true;
    if (typeof window._sarkiIsHostRef === "function" && window._sarkiIsHostRef()) return true;
    if (typeof miniData !== "undefined" && miniData.playerId === 1) return true;
    if (typeof satrancData !== "undefined" && satrancData.playerId === 1) return true;
    return false;
}

// ✨ Şu anki modu tespit et (mesaj tipi öneki)
function _getCurrentModePrefix() {
    const current = getCurrentScreen();
    if (current.startsWith("takim")) return "takim";
    if (current.startsWith("ml")) return "ml";
    if (current.startsWith("harita")) return "harita";
    if (current.startsWith("gizem")) return "gizem";
    if (current.startsWith("ilk11")) return "ilk11";
    if (current.startsWith("sarki")) return "sarki";
    if (current.startsWith("mini")) return "mini";
    if (current.startsWith("satranc")) return "satranc";
    return null;  // Bil Bakalım
}

// ▶️ Devam Et
document.getElementById("escResumeBtn").onclick = () => {
    _escFromF5 = false;
    closeEscPopup();
};

// 🚪 Lobiye Dön
document.getElementById("escLobbyBtn").onclick = () => {
    _escFromF5 = false;
    const mode = _getCurrentModePrefix();
    const isHost = _isCurrentHost();
    
    closeEscPopup();
    
    // Mod-özel lobiye dön mesajı
    if (mode) {
        if (isHost) {
            // Host: backend'e broadcast et
            send({ type: `${mode}_back_to_lobby` });
        } else {
            // Misafir: sadece kendi ekranını çevir
            const lobbyScreenName = mode + "Lobby";
            showScreen(lobbyScreenName);
            // Mod-özel update fonksiyonu (varsa)
            const updateFnName = `update${mode.charAt(0).toUpperCase()}${mode.slice(1)}Lobby`;
            if (typeof window[updateFnName] === "function") {
                window[updateFnName]();
            }
        }
    } else {
        // ✨ BİL BAKALIM - back_to_lobby mesajı
        if (isHost) {
            // HOST: backend'e broadcast et (herkesi lobiye atacak)
            send({ type: "back_to_lobby" });
        } else {
            // MİSAFİR: sadece kendi ekranını lobiye çevir
            stopTimer();
            hideAnswerPanel();
            resetForNewRound();
            showScreen("lobby");
            updateLobby();
        }
    }
};

// 🏠 Ana Menü
document.getElementById("escHomeBtn").onclick = () => {
    _escFromF5 = false;
    closeEscPopup();
    _leaveRoom(true);
};

// ❌ Odadan Ayrıl → Onay popup göster
document.getElementById("escLeaveBtn").onclick = () => {
    _escFromF5 = false;
    closeEscPopup();
    _showLeaveConfirmPopup();
};

// ✨ Odadan Ayrıl onay popup'ı
window._showLeaveConfirmPopup = function() {
    // Eski varsa kaldır
    const existing = document.getElementById("leaveConfirmPopup");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "leaveConfirmPopup";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard escConfirmCard" style="max-width:450px; border:2px solid #ff6b6b; box-shadow: 0 0 40px rgba(255,107,107,0.3);">
            <div style="font-size:60px; margin:10px 0;">🚪</div>
            <h2 style="color:#ff6b6b; margin:10px 0 15px 0;">Odadan Ayrılmak İstiyor musun?</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Odadan ayrılırsan oyun sona erer.
            </p>
            <div class="confirmButtons">
                <button id="leaveConfirmYesBtn" class="bigBtn redBtn">🚪 EVET, AYRIL</button>
                <button id="leaveConfirmNoBtn" class="bigBtn greenBtn">↩️ HAYIR, KAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("leaveConfirmYesBtn").onclick = () => {
        overlay.remove();
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        const wasHost = _isCurrentHost();
        inRoom = false;
        // ✨ Mod-özel ayrılma temizlik hook'u varsa çağır (ör. Şarkıdan Bul - leaveSarkiRoom)
        if (typeof window._leaveConfirmHook === "function") {
            const hook = window._leaveConfirmHook;
            window._leaveConfirmHook = null;
            hook();
            return;
        }
        if (ws) { try { ws.close(); } catch(e) {} }
        setTimeout(() => {
            connectWS();
            if (wasHost) {
                showScreen("modselect");
            } else {
                showScreen("join");
            }
        }, 300);
    };
    
    document.getElementById("leaveConfirmNoBtn").onclick = () => {
        overlay.remove();
    };
}

// Ortak: odadan ayrıl + ana menüye git
function _leaveRoom(goHome) {
    try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
    const wasHost = _isCurrentHost();
    
    inRoom = false;
    
    if (ws) {
        try { ws.close(); } catch(e) {}
    }
    setTimeout(() => {
        connectWS();
        if (goHome) {
            showScreen("home");
        } else if (wasHost) {
            showScreen("modselect");
        } else {
            showScreen("join");
        }
    }, 300);
}

// ✨ Geriye uyumluluk: eski escYesBtn/escNoBtn hala var ama gizli
// Kodun başka yerlerinde bu ID'lere referans varsa kırılmasın
const _oldEscYes = document.getElementById("escYesBtn");
const _oldEscNo = document.getElementById("escNoBtn");
if (_oldEscYes) {
    _oldEscYes.onclick = () => {
        _leaveRoom(_escFromF5);
    };
}
if (_oldEscNo) {
    _oldEscNo.onclick = () => {
        _escFromF5 = false;
        closeEscPopup();
    };
}

// F5 tuşu - oda içindeyken ESC popup göster
let _escFromF5 = false;
document.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && (e.key === "r" || e.key === "R"))) {
        const current = getCurrentScreen();
        // ✨ miniGame çıkarıldı (kendi F5 kontrolü var)
        const gameScreens = ["game", "select", "lobby",
                              "mlGame", "mlLobby",
                              "takimGame", "takimLobby",
                              "haritaGame", "haritaLobby",
                              "gizemGame", "gizemLobby",
                              "ilk11Game", "ilk11Lobby",
                              "sarkiGame", "sarkiLobby",
                              "miniLobby"];
        if (gameScreens.includes(current)) {
            e.preventDefault();
            _escFromF5 = true;
            showEscPopup();
            return;
        }
    }
});

// ESC tuşu
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    
    // ✨ Mini Futbol oyun ekranında ortak ESC handler ÇALIŞMASIN
    // Mini Futbol kendi ESC handler'ını kullanıyor (mini_futbol.js)
    const current = getCurrentScreen();
    if (current === "miniGame") return;
    
    // ✨ MOD DEĞİŞİMİ EKRANLARINDA ESC → geri butonu gibi davran
    // (create/createTakim/createMl/... ekranlarındayken pending mode change varsa)
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.createScreen === current) {
        const returnScreen = pendingModeChange.returnScreen || "modselect";
        window._pendingModeChangeCtx = null;

        // Mesajları temizle
        const msgIds = ["createMsg", "createTakimMsg", "createMlMsg", "createHaritaMsg",
                        "createGizemMsg", "createIlk11Msg",
                        "createSarkiMsg", "createMiniMsg", "createSatrancMsg"];
        msgIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "";
        });

        showScreen(returnScreen);
        setTimeout(() => {
            if (typeof openChangeModeModal === "function") openChangeModeModal();
        }, 200);
        return;
    }
    
    // Popup açıksa kapat
    const escPopupOpen = !document.getElementById("escConfirmBox").classList.contains("hidden");
    if (escPopupOpen) {
        closeEscPopup();
        return;
    }
    
    // Diğer popup'ları kapat
    const anyOtherPopup = document.querySelector(".overlay:not(.hidden)");
    if (anyOtherPopup && anyOtherPopup.id !== "escConfirmBox") {
        anyOtherPopup.classList.add("hidden");
        return;
    }
    
    if (current === "home") return;
    
    // ✨ Lobby ekranlarında ESC → direkt ayrılma onayı
    const lobbyScreens = ["lobby", "mlLobby", "takimLobby", "haritaLobby",
                          "gizemLobby", "ilk11Lobby",
                          "sarkiLobby", "miniLobby", "satrancLobby"];
    if (lobbyScreens.includes(current)) {
        window._showLeaveConfirmPopup();
        return;
    }
    
    // Oyun ekranlarında ESC → menü popup
    const gameScreens = ["game", "select",
                          "mlGame",
                          "takimGame",
                          "haritaGame",
                          "gizemGame",
                          "ilk11Game",
                          "sarkiGame",
                          "satrancGame"];
    
    if (gameScreens.includes(current)) {
        showEscPopup();
        return;
    }
    
    // Diğer ekranlarda direkt bir önceki ekrana dön (onay yok)
    const prev = getPreviousScreen();
    if (prev) {
        showScreen(prev);
    }
});

connectWS();
showScreen("home");

// ✨ WS bağlantısı kurulunca açık sunucuları hemen çek (katıl ekranında hazır olsun)
setTimeout(() => {
    fetchPublicRooms();
}, 1500);

// URL'de ?join=XXXX varsa katıl ekranını aç + o oda için vurgu kodu kaydet
// (oda kodu input'u artık yok - oda açık sunucular listesinde vurgulanır)
// ✨ Davet linkinden girince auto "katıla basılmış" gibi davran:
//    açılan isim modalına isim girip Katıl basınca direkt o loby'e atılır
const urlParams = new URLSearchParams(window.location.search);
const joinCode = urlParams.get("join");
if (joinCode) {
    showScreen("join");
    window._pendingJoinHighlight = joinCode.toUpperCase();
    setTimeout(() => {
        startPublicRoomsRefresh();
    }, 100);

    // ✨ Otomatik katıl: isim modalını aç, isim girip onaylanınca direkt query_room_mode
    setTimeout(() => {
        askJoinName().then(name => {
            if (!name) return;   // IPTAL → katılma, join ekranda kalsın
            send({ type: "query_room_mode", room_code: joinCode.toUpperCase() });
        });
    }, 300);
}

// ============ ORTAK ODA KODU / DAVET LİNKİ HELPER ============
// Tüm modlar bu fonksiyonu kullanır
window.setupRoomCodeAndLink = function(config) {
    // config: { codeTextId, codeEyeBtnId, copyHintId, linkTextId, linkEyeBtnId, linkHintId, getRoomCode }
    
    const codeText = document.getElementById(config.codeTextId);
    const codeEyeBtn = document.getElementById(config.codeEyeBtnId);
    const copyHint = document.getElementById(config.copyHintId);
    const linkText = document.getElementById(config.linkTextId);
    const linkEyeBtn = document.getElementById(config.linkEyeBtnId);
    const linkHint = document.getElementById(config.linkHintId);
    
    if (!codeText || !codeEyeBtn) return;
    
    function getCode() { return config.getRoomCode(); }
    function getLink() { return `${location.origin}/?join=${getCode()}`; }
    function isHost() {
        // Config'ten getPlayerId varsa onu kullan, yoksa global playerId
        if (config.getPlayerId) {
            return config.getPlayerId() === 1;
        }
        return (typeof playerId !== "undefined" && playerId === 1);
    }
    
    // Kutuları gizle/göster (misafir hepsini gizler)
    function updateVisibility() {
        const codeBox = codeText.closest(".roomCodeBox");
        const linkBox = linkText ? linkText.closest(".inviteLinkBox") : null;
        if (isHost()) {
            if (codeBox) codeBox.style.display = "";
            if (linkBox) linkBox.style.display = "";
        } else {
            if (codeBox) codeBox.style.display = "none";
            if (linkBox) linkBox.style.display = "none";
        }
    }
    
    // Oda kodu render
    function renderCode() {
        updateVisibility();
        if (!isHost()) return;
        if (codeText.classList.contains("hiddenCode")) {
            codeText.textContent = "######";
            // ✨ Gizliyken de canlı yeşil renk (soluk değil)
            codeText.style.color = "#51cf66";
            codeText.style.opacity = "1";
            codeText.style.letterSpacing = "4px";
        } else {
            codeText.textContent = getCode();
            codeText.style.color = "";
            codeText.style.opacity = "";
            codeText.style.letterSpacing = "";
        }
    }
    
    // Link render
    function renderLink() {
        updateVisibility();
        if (!isHost()) return;
        if (!linkText) return;
        const isHidden = localStorage.getItem("hideInviteLink") === "true";
        if (isHidden) {
            linkText.classList.add("hiddenLink");
            // ✨ Kodu ****** ile maskele (link formatı korunsun)
            const code = getCode() || "";
            const maskedCode = "*".repeat(Math.max(6, code.length));
            linkText.textContent = `${location.origin}/?join=${maskedCode}`;
            // Renk normal kalsın (link mavi/yeşil ne ise)
            linkText.style.opacity = "1";
        } else {
            linkText.classList.remove("hiddenLink");
            linkText.textContent = getLink();
            linkText.style.opacity = "";
        }
    }
    
    // Oda kodu tıklama - kopyala
    codeText.onclick = () => {
        navigator.clipboard.writeText(getCode()).then(() => {
            copyHint.textContent = "✓ Kopyalandı!";
            copyHint.classList.add("show");
            setTimeout(() => copyHint.classList.remove("show"), 2000);
        }).catch(() => {});
    };
    
    // Oda kodu göz
    codeEyeBtn.onclick = (e) => {
        e.stopPropagation();
        codeText.classList.toggle("hiddenCode");
        renderCode();
    };
    
    // Link tıklama - kopyala
    if (linkText) {
        linkText.onclick = () => {
            navigator.clipboard.writeText(getLink()).then(() => {
                linkHint.textContent = "✓ Link kopyalandı!";
                linkHint.classList.add("show");
                setTimeout(() => linkHint.classList.remove("show"), 2000);
            }).catch(() => {});
        };
    }
    
    // Link göz
    if (linkEyeBtn) {
        linkEyeBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = localStorage.getItem("hideInviteLink") === "true";
            localStorage.setItem("hideInviteLink", isHidden ? "false" : "true");
            renderLink();
        };
    }
    
    return { renderCode, renderLink };
};

// Sol Üst Geri Butonu (Bil Bakalım) - tıklayınca ESC popup
setTimeout(() => {
    const bilBackBtn = document.getElementById("bilBackTopBtn");
    if (bilBackBtn) {
        bilBackBtn.onclick = () => {
            showEscPopup();
        };
    }
}, 100);

// ============ GLOBAL SES YARDIMCISI ============
function getGlobalVolume() {
    const slider = document.getElementById("mlVolumeRange");
    if (!slider) {
        try {
            const saved = localStorage.getItem("gameArenaVolume");
            if (saved !== null && !isNaN(parseInt(saved, 10))) {
                return Math.max(0, Math.min(100, parseInt(saved, 10))) / 100;
            }
        } catch(e) {}
        return 0.3;
    }
    const val = parseFloat(slider.value);
    return isNaN(val) ? 0.3 : Math.max(0, Math.min(100, val)) / 100;
}
window.getGlobalVolume = getGlobalVolume;

// ============ SES SLIDER BAŞLATICI (PÜRÜZSÜZ DİKEY SÜRÜKLEME) ============
(function initVolumeSlider() {
    const slider = document.getElementById("mlVolumeRange");
    const volumeTrack = document.getElementById("volumeTrack");
    if (!slider || !volumeTrack) return;

    let savedPercent = 30;
    try {
        const saved = localStorage.getItem("gameArenaVolume");
        if (saved !== null && !isNaN(parseInt(saved, 10))) {
            savedPercent = Math.max(0, Math.min(100, parseInt(saved, 10)));
        }
    } catch(e) {}

    function applyUI(pct) {
        const clampedPct = Math.max(0, Math.min(100, Math.round(pct)));
        slider.value = String(clampedPct);

        const valEl = document.getElementById("mlVolumeVal");
        if (valEl) {
            valEl.textContent = String(clampedPct);
        }

        // CSS'teki dikey dolgu ve top pozisyonu için
        const decimalVol = clampedPct / 100;
        volumeTrack.style.setProperty("--volume-percent", String(decimalVol));

        // Hoparlör dalga ikonu
        const volBtn = document.getElementById("volumeButton");
        if (volBtn) {
            if (clampedPct === 0) {
                volBtn.classList.add("muted");
                volBtn.setAttribute("data-level", "0");
            } else {
                volBtn.classList.remove("muted");
                if (clampedPct < 34) {
                    volBtn.setAttribute("data-level", "1");
                } else if (clampedPct < 67) {
                    volBtn.setAttribute("data-level", "2");
                } else {
                    volBtn.setAttribute("data-level", "3");
                }
            }
        }

        try { localStorage.setItem("gameArenaVolume", String(clampedPct)); } catch(e) {}
    }

    applyUI(savedPercent);

    // ✨ GERÇEK DİKEY DOKUNMA / SÜRÜKLEME MANTIĞI (Pürüzsüz & Kolay)
    let isDragging = false;

    function updateFromPointer(e) {
        const rect = volumeTrack.getBoundingClientRect();
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
        
        // CSS padding (üstten ve alttan 15px)
        const padding = 15;
        const trackTop = rect.top + padding;
        const trackBottom = rect.bottom - padding;
        const trackHeight = Math.max(1, trackBottom - trackTop);

        const distanceFromBottom = trackBottom - clientY;
        const pct = (distanceFromBottom / trackHeight) * 100;
        applyUI(pct);
    }

    volumeTrack.addEventListener("mousedown", (e) => {
        isDragging = true;
        updateFromPointer(e);
    });

    window.addEventListener("mousemove", (e) => {
        if (isDragging) {
            e.preventDefault();
            updateFromPointer(e);
        }
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // Mobil Cihazlar İçin Dokunmatik Destek
    volumeTrack.addEventListener("touchstart", (e) => {
        isDragging = true;
        updateFromPointer(e);
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
        if (isDragging) {
            updateFromPointer(e);
        }
    }, { passive: true });

    window.addEventListener("touchend", () => {
        isDragging = false;
    });

    slider.addEventListener("input", () => {
        const val = parseFloat(slider.value) || 0;
        applyUI(val);
    });

    // ✨ Numpad + / - ile ses ayarı
    document.addEventListener("keydown", (e) => {
        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

        const currentPct = parseFloat(slider.value) || 0;
        const step = 1;

        if (e.code === "NumpadAdd" || e.key === "+") {
            e.preventDefault();
            applyUI(currentPct + step);
        } else if (e.code === "NumpadSubtract" || e.key === "-") {
            e.preventDefault();
            applyUI(currentPct - step);
        }
    });
})();

// 🎮 Üstteki "GameArena Web" başlığına tıklayınca odadan ayrılma onayı / ana menü
const _mainHeaderTitle = document.querySelector(".container > h1.mainTitle");
if (_mainHeaderTitle) {
    _mainHeaderTitle.style.cursor = "pointer";
    _mainHeaderTitle.title = "Ana Menü / Odadan Ayrıl";
    _mainHeaderTitle.addEventListener("click", () => {
        const current = getCurrentScreen();
        const inRoomScreens = [
            "lobby", "select", "game",
            "mlLobby", "mlGame",
            "takimLobby", "takimGame",
            "haritaLobby", "haritaGame",
            "gizemLobby", "gizemGame",
            "ilk11Lobby", "ilk11Game",
            "sarkiLobby", "sarkiGame",
            "miniLobby", "miniGame",
            "satrancLobby", "satrancGame"
        ];
        if (inRoomScreens.includes(current)) {
            if (typeof window._showLeaveConfirmPopup === "function") {
                window._showLeaveConfirmPopup();
            }
        } else if (current !== "home") {
            showScreen("home");
        }
    });
}

console.log("GameArena - app.js yüklendi ✓");

// Kick engel popup kapatma
document.getElementById("kickBlockedOkBtn").onclick = () => {
    document.getElementById("kickBlockedBox").classList.add("hidden");
};

// Oda dolu popup kapatma
document.getElementById("roomFullOkBtn").onclick = () => {
    document.getElementById("roomFullBox").classList.add("hidden");
};

// ESC Popup - EVET butonu (host: mod seçim, misafir: katıl, F5: ana menü)
setTimeout(() => {
    const escYes = document.getElementById("escYesBtn");
    if (escYes) {
        escYes.onclick = () => {
            // ✨ Host mu? Global playerId veya mod-özel playerId'ye bak
            let wasHost = (playerId === 1);
            if (!wasHost && typeof takimData !== "undefined" && takimData.playerId === 1) wasHost = true;
            if (!wasHost && typeof mlData !== "undefined" && mlData.playerId === 1) wasHost = true;
            if (!wasHost && typeof haritaData !== "undefined" && haritaData.playerId === 1) wasHost = true;
            if (!wasHost && typeof gizemData !== "undefined" && gizemData.playerId === 1) wasHost = true;
            if (!wasHost && typeof ilk11Data !== "undefined" && ilk11Data.playerId === 1) wasHost = true;
            if (!wasHost && typeof miniData !== "undefined" && miniData.playerId === 1) wasHost = true;
            
            const goHome = _escFromF5;
            
            inRoom = false;
            _escFromF5 = false;
            
            if (ws) {
                try { ws.close(); } catch(e) {}
            }
            closeEscPopup();
            setTimeout(() => {
                connectWS();
                if (goHome) {
                    showScreen("home");
                } else if (wasHost) {
                    showScreen("modselect");
                } else {
                    showScreen("join");
                }
            }, 300);
        };
    }
}, 100);

// ==========================================
// TARAYICI GERİ BUTONU + F5 KONTROLÜ
// ==========================================

// F5 / URL Temizleme: Sayfa yüklenince ?join varsa temizle (setTimeout ile)
setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("join")) {
        // Yeni URL: hostname/ olarak temizle
        window.history.replaceState({ screen: "join" }, "", "/");
    }
}, 500);

// Ekran değiştikçe history'e ekle (browser back'i yakalayabilelim)
const _prevShowScreenForHistory = showScreen;
showScreen = function(screenName) {
    _prevShowScreenForHistory(screenName);

    const pendingModeChange = window._pendingModeChangeCtx;

    // Bil Bakalım createScreen
    if (pendingModeChange && pendingModeChange.createScreen === "create" && screenName !== "create") {
        window._pendingModeChangeCtx = null;
        setMsg(createMsg, "");

        if (createNameInput) {
            const nameBox = createNameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        if (createBtn) {
            createBtn.textContent = "Oda Oluştur";
        }
    }

    // Takım Bilmece createTakim
    if (pendingModeChange && pendingModeChange.createScreen === "createTakim" && screenName !== "createTakim") {
        window._pendingModeChangeCtx = null;
        const msgEl = document.getElementById("createTakimMsg");
        if (msgEl) msgEl.textContent = "";

        const takimNameInput = document.getElementById("createTakimNameInput");
        if (takimNameInput) {
            const nameBox = takimNameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const takimCreateBtn = document.getElementById("createTakimBtn");
        if (takimCreateBtn) takimCreateBtn.textContent = "Oda Oluştur";
    }

    document.getElementById("createGizemBtn").onclick = () => {
    const nameInput = document.getElementById("createGizemNameInput");
    const enteredName = nameInput ? nameInput.value.trim() : "";
    const msgEl = document.getElementById("createGizemMsg");

    const turnSec = parseInt(document.getElementById("gizemTurnSecondsSelect").value) || 60;
    const difficulty = document.getElementById("gizemDifficultySelect").value || "karisik";
    const maxPlayers = parseInt(document.getElementById("gizemMaxPlayersSelect").value) || 2;
    const totalRounds = parseInt(document.getElementById("gizemTotalRoundsSelect").value) || 10;

    // ✨ MOD DEĞİŞİMİ mi?
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "gizemli_kariyer" && pendingModeChange.createScreen === "createGizem") {
        console.log("[MODE CHANGE] Gizemli Kariyer için mod_change_room gönderiliyor");
        if (msgEl) {
            msgEl.textContent = "Mod değiştiriliyor...";
            msgEl.style.color = "#51cf66";
        }
        send({
            type: "mod_change_room",
            new_mode: "gizemli_kariyer",
            mode_settings: {
                turn_seconds: turnSec,
                difficulty: difficulty,
                max_players: maxPlayers,
                total_rounds: totalRounds
            }
        });
        return;
    }

    // Normal akış
    if (!enteredName) {
        if (msgEl) {
            msgEl.textContent = "İsim gir.";
            msgEl.style.color = "#ff6b6b";
        }
        return;
    }
    localStorage.setItem("playerName", enteredName);
    myName = enteredName;

    send({
        type: "gizem_create_room",
        name: enteredName,
        turn_seconds: turnSec,
        difficulty: difficulty,
        max_players: maxPlayers,
        total_rounds: totalRounds
    });
};

    // Haritadan Bul createHarita
    if (pendingModeChange && pendingModeChange.createScreen === "createHarita" && screenName !== "createHarita") {
        window._pendingModeChangeCtx = null;
        const haritaMsgEl = document.getElementById("createHaritaMsg");
        if (haritaMsgEl) haritaMsgEl.textContent = "";

        const haritaNameInput = document.getElementById("createHaritaNameInput");
        if (haritaNameInput) {
            const nameBox = haritaNameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const haritaCreateBtn = document.getElementById("createHaritaBtn");
        if (haritaCreateBtn) haritaCreateBtn.textContent = "Oda Oluştur";
    }

    // ✨ Kaydedilmiş Haritadan Bul ayarlarını yükle
    if (screenName === "createHarita") {
        try {
            const savedMaxP = localStorage.getItem("haritaMaxPlayers");
            const savedDiff = localStorage.getItem("haritaDifficulty");
            const savedTurnSec = localStorage.getItem("haritaTurnSeconds");
            const savedTotalR = localStorage.getItem("haritaTotalRounds");

            const maxPSel = document.getElementById("haritaMaxPlayersSelect");
            const diffSel = document.getElementById("haritaDifficultySelect");
            const turnSecSel = document.getElementById("haritaTurnSecondsSelect");
            const totalRSel = document.getElementById("haritaTotalRoundsSelect");

            if (maxPSel && savedMaxP) maxPSel.value = savedMaxP;
            if (diffSel && savedDiff) diffSel.value = savedDiff;
            if (turnSecSel && savedTurnSec) turnSecSel.value = savedTurnSec;
            if (totalRSel && savedTotalR) totalRSel.value = savedTotalR;
        } catch(e) {}
    }

    // Gizemli Kariyer createGizem
    if (pendingModeChange && pendingModeChange.createScreen === "createGizem" && screenName !== "createGizem") {
        window._pendingModeChangeCtx = null;
        const gizemMsgEl = document.getElementById("createGizemMsg");
        if (gizemMsgEl) gizemMsgEl.textContent = "";

        const gizemNameInput = document.getElementById("createGizemNameInput");
        if (gizemNameInput) {
            const nameBox = gizemNameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const gizemCreateBtn = document.getElementById("createGizemBtn");
        if (gizemCreateBtn) gizemCreateBtn.textContent = "Oda Oluştur";
    }

    // ✨ Kaydedilmiş Gizemli Kariyer ayarlarını yükle
    if (screenName === "createGizem") {
        try {
            const savedMaxP = localStorage.getItem("gizemMaxPlayers");
            const savedDiff = localStorage.getItem("gizemDifficulty");
            const savedTurnSec = localStorage.getItem("gizemTurnSeconds");
            const savedTotalR = localStorage.getItem("gizemTotalRounds");

            const maxPSel = document.getElementById("gizemMaxPlayersSelect");
            const diffSel = document.getElementById("gizemDifficultySelect");
            const turnSecSel = document.getElementById("gizemTurnSecondsSelect");
            const totalRSel = document.getElementById("gizemTotalRoundsSelect");

            if (maxPSel && savedMaxP) maxPSel.value = savedMaxP;
            if (diffSel && savedDiff) diffSel.value = savedDiff;
            if (turnSecSel && savedTurnSec) turnSecSel.value = savedTurnSec;
            if (totalRSel && savedTotalR) totalRSel.value = savedTotalR;
        } catch(e) {}
    }

    // İlk 11 createIlk11
    if (pendingModeChange && pendingModeChange.createScreen === "createIlk11" && screenName !== "createIlk11") {
        window._pendingModeChangeCtx = null;
        const ilk11MsgEl = document.getElementById("createIlk11Msg");
        if (ilk11MsgEl) ilk11MsgEl.textContent = "";

        const ilk11NameInput = document.getElementById("createIlk11NameInput");
        if (ilk11NameInput) {
            const nameBox = ilk11NameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const ilk11CreateBtn = document.getElementById("createIlk11Btn");
        if (ilk11CreateBtn) ilk11CreateBtn.textContent = "Oda Oluştur";
    }

    
    // ✨ Kaydedilmiş Şarkıdan Bul ayarlarını yükle
    if (screenName === "createSarki") {
        try {
            const rawSettings = localStorage.getItem("sarkiCreateSettings");
            if (rawSettings) {
                const s = JSON.parse(rawSettings);
                const maxPSel = document.getElementById("sarkiMaxPlayersSelect");
                const dilSel = document.getElementById("sarkiDilSelect");
                const totalSSel = document.getElementById("sarkiTotalSongsSelect");
                const songDurSel = document.getElementById("sarkiSongDurationSelect");
                const ansDurSel = document.getElementById("sarkiAnswerDurationSelect");
                const turSel = document.getElementById("sarkiTurSelect");

                if (maxPSel && s.max_players) maxPSel.value = String(s.max_players);
                if (dilSel && s.dil) dilSel.value = s.dil;
                if (totalSSel && s.total_songs) totalSSel.value = String(s.total_songs);
                if (songDurSel && s.song_duration) songDurSel.value = String(s.song_duration);
                if (ansDurSel && s.answer_duration) ansDurSel.value = String(s.answer_duration);
                if (turSel && s.tur) turSel.value = s.tur;
            }
        } catch(e) {}
    }

    

    // Jokerli Satranç createSatranc
    if (pendingModeChange && pendingModeChange.createScreen === "createSatranc" && screenName !== "createSatranc") {
        window._pendingModeChangeCtx = null;
        const satrancMsgEl = document.getElementById("createSatrancMsg");
        if (satrancMsgEl) satrancMsgEl.textContent = "";

        const satrancNameInput = document.getElementById("createSatrancNameInput");
        if (satrancNameInput) {
            const nameBox = satrancNameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const satrancCreateBtn = document.getElementById("createSatrancBtn");
        if (satrancCreateBtn) satrancCreateBtn.textContent = "Oda Oluştur";
    }

    // Mini Futbol createMini
    if (pendingModeChange && pendingModeChange.createScreen === "createMini" && screenName !== "createMini") {
        window._pendingModeChangeCtx = null;
        const miniMsgEl = document.getElementById("createMiniMsg");
        if (miniMsgEl) miniMsgEl.textContent = "";

        const miniNameInput = document.getElementById("createMiniNameInput");
        if (miniNameInput) {
            const nameBox = miniNameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const miniCreateBtn = document.getElementById("createMiniBtn");
        if (miniCreateBtn) miniCreateBtn.textContent = "🎮 Oda Oluştur";
    }

    try {
        window.history.pushState({ screen: screenName }, "", "");
    } catch (e) {}
    
    // 💬 Bil Bakalım chat: sadece lobby/select/game ekranlarında görünür
    const bilScreens = ["lobby", "select", "game"];
    if (!bilScreens.includes(screenName)) {
        hideBilChat();
    }
};

// Tarayıcı Geri butonuna basılınca
window.addEventListener("popstate", (e) => {
    const current = getCurrentScreen();

    // Ana menüdeyse → normal davran (siteden çık)
    if (current === "home") {
        return;
    }

    // Lobby/oyun ekranlarında → uyarı popup
    const gameScreens = ["game", "select", "lobby",
                          "mlGame", "mlLobby",
                          "takimGame", "takimLobby",
                          "haritaGame", "haritaLobby",
                          "gizemGame", "gizemLobby",
                          "ilk11Game", "ilk11Lobby",
                          "miniGame", "miniLobby"];

    if (gameScreens.includes(current)) {
        // Geri gitmeyi engelle - history'e yeniden ekle
        window.history.pushState({ screen: current }, "", "");
        // Popup göster
        showBackConfirmPopup();
        return;
    }

    // Oda oluştur ekranlarındaysa → mod seçime dön
    const createScreens = ["create", "createTakim", "createMl",
                           "createHarita", "createGizem",
                           "createIlk11",
                           "createMini"];
    if (createScreens.includes(current)) {
        showScreen("modselect");
        return;
    }

    // Katıl ekranındaysa → ana menü
    if (current === "join") {
        showScreen("home");
        return;
    }

    // Mod seçim ekranındaysa → ana menü
    if (current === "modselect") {
        showScreen("home");
        return;
    }

    // Default → ana menü
    showScreen("home");
});

function showBackConfirmPopup() {
    document.getElementById("backConfirmBox").classList.remove("hidden");
}

function closeBackConfirmPopup() {
    const card = document.querySelector("#backConfirmBox .escConfirmCard");
    card.classList.add("closing");
    setTimeout(() => {
        document.getElementById("backConfirmBox").classList.add("hidden");
        card.classList.remove("closing");
    }, 300);
}

// Popup butonları
document.getElementById("backYesBtn").onclick = () => {
    const wasHost = (playerId === 1);
    
    inRoom = false;
    if (ws) {
        try { ws.close(); } catch(e) {}
    }
    closeBackConfirmPopup();
    setTimeout(() => {
        connectWS();
        showScreen(wasHost ? "modselect" : "join");
    }, 300);
};

document.getElementById("backNoBtn").onclick = () => {
    closeBackConfirmPopup();
};

// ========================================
// 💬 BİL BAKALIM CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("bilChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleBilChatPanel);
    
    const closeBtn = document.getElementById("bilChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeBilChatPanel);
    
    const sendBtn = document.getElementById("bilChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendBilChatMessage);
    
    const input = document.getElementById("bilChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendBilChatMessage();
                closeBilChatPanel();  // ✨ Mesaj gönderdikten sonra chat kapansın
                return;
            }
            e.stopPropagation();
        });
    }
    
    // T tuşu → chat aç + focus
    document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k !== "t") return;
        
        // Sadece Bil Bakalım ekranlarında (lobby/select/game)
        const current = getCurrentScreen();
        if (!["lobby", "select", "game"].includes(current)) return;
        
        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        // Chat görünmüyorsa yoksay
        const container = document.getElementById("bilChatContainer");
        if (!container || container.style.display === "none") return;
        
        // Zaten açıksa yoksay
        if (bilChat.open) return;
        
        // Popup açıksa yoksay
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        e.preventDefault();
        e.stopPropagation();
        openBilChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (bilChat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeBilChatPanel();
        }
    }, true);
}, 200);

// ==========================================
// ODA AYARLARI POPUP - Ortak Sistem
// ==========================================

// Aktif ayar konfigürasyonu (hangi mod için açıldı)
let _activeSettingsConfig = null;

/**
 * Genel oda ayarları popup açıcı
 * config = {
 *   title: "Oda Ayarları - Kim Milyoner",
 *   fields: [
 *     { id: "turnSec", label: "⏱️ Tur Süresi", type: "select",
 *       options: [{value:30,label:"30 saniye"}, ...], current: 60 },
 *     ...
 *   ],
 *   onSave: (values) => { send({...}) }
 * }
 */
window.openRoomSettingsGeneric = function(config) {
    _activeSettingsConfig = config;
    const content = document.getElementById("roomSettingsContent");
    
    let html = "";
    
    // Normal ayarlar (select)
    config.fields.forEach((field, i) => {
        // ✨ Gelişmiş modda devre dışı bırakılacaklar (data-disable-on-advanced)
        const disableOnAdv = field.disableOnAdvanced ? ` data-disable-on-adv="1"` : "";
        
        // ✨ minValue kontrolü (oyuncu sayısı kısıtlaması için)
        const minVal = field.minValue || null;
        const mapping = field.valueMapping || null;  // fonksiyon: (rawVal) => effectiveMax
        
        html += `<div style="margin-bottom:20px;" id="settingsGroup_${field.id}"${disableOnAdv}>
            <label style="display:block; color:#ffd43b; font-weight:bold; margin-bottom:8px;">
                ${field.label}:${minVal ? ` <span style="color:#ffa94d; font-size:12px; font-weight:normal;">(min: ${minVal})</span>` : ''}
            </label>
            <select id="settingsField_${field.id}" style="width:100%; padding:12px; font-size:16px;${minVal ? ' border:2px solid #ffa94d;' : ''}">`;
        
        field.options.forEach(opt => {
            let disabled = "";
            let optLabel = opt.label;
            let optStyle = "";
            
            // minValue kontrolü
            if (minVal !== null) {
                const rawVal = parseInt(opt.value);
                if (!isNaN(rawVal)) {
                    const effectiveMax = mapping ? mapping(rawVal) : rawVal;
                    if (effectiveMax < minVal) {
                        disabled = " disabled";
                        optLabel = "🚫 " + optLabel + ` (min ${minVal})`;
                        optStyle = ' style="opacity:0.35; color:#6c757d;"';
                    }
                }
            }
            
            const selected = String(opt.value) == String(field.current) ? "selected" : "";
            html += `<option value="${opt.value}" ${selected}${disabled}${optStyle}>${optLabel}</option>`;
        });
        
        html += `</select>`;
        
        // minValue varsa altına uyarı
        if (minVal) {
            html += `<p style="color:#ffa94d; font-size:12px; margin:6px 0 0 0; font-style:italic;">
                ⚠️ Odada ${minVal} oyuncu var. Daha düşük seçilemez.
            </p>`;
        }
        
        html += `</div>`;
    });
    
    // ✨ GELİŞMİŞ AYARLAR bölümü (varsa)
    if (config.advancedFields && config.advancedFields.length > 0) {
        // localStorage'dan kaydedilmiş değerleri yükle
        let savedAdv = {};
        let savedEnabled = false;
        try {
            const raw = localStorage.getItem("miniAdvancedSettings");
            if (raw) savedAdv = JSON.parse(raw);
            savedEnabled = localStorage.getItem("miniAdvancedEnabled") === "true";
        } catch(e) {}
        
        // Kayıtlı değerleri field'lara uygula
        config.advancedFields.forEach(field => {
            if (savedAdv[field.id] !== undefined) {
                field.current = savedAdv[field.id];
            }
        });
        
        const checkedAttr = savedEnabled ? "checked" : "";
        
        html += `
            <div style="margin-top:25px; padding-top:20px; border-top:2px dashed #495057;">
                <label style="display:flex; align-items:center; cursor:pointer; user-select:none; 
                              padding:12px 16px; background:rgba(103,65,217,0.15); 
                              border:1px solid #6741d9; border-radius:10px;
                              transition: all 0.2s;">
                    <input type="checkbox" id="advancedToggle" ${checkedAttr}
                           style="margin-right:12px; width:20px; height:20px; cursor:pointer;">
                    <span style="color:#c084fc; font-weight:bold; font-size:16px;">
                        🔧 Gelişmiş Ayarları Aç
                    </span>
                </label>
                
                <div id="advancedContent" style="max-height:0; overflow:hidden; 
                                                  transition: max-height 0.4s ease-out;
                                                  margin-top:0;">
                    <div style="padding:20px 15px 5px 15px; background:rgba(103,65,217,0.05); 
                                border-radius:10px; margin-top:12px;
                                border-left:3px solid #6741d9;">
                        <p style="color:#adb5bd; font-size:13px; margin:0 0 20px 0; font-style:italic;">
                            ⚠️ Bu ayarlar oyun fiziğini doğrudan etkiler. Dikkatli değiştir.
                        </p>
        `;
        
        // ✨ Gelişmiş: Maç Süresi + Kazanma Skoru (özgür değer) - config'te varsa göster
        if (config.showAdvancedGoalDuration) {
            const curGoal = config.currentGoalTarget || 3;
            const curDur = config.currentMatchDuration || 180;
            html += `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                    <div>
                        <label style="display:block; color:#c084fc; font-weight:bold; 
                                      font-size:13px; margin-bottom:6px;">
                            ⚽ Kazanma Skoru
                        </label>
                        <input type="number" id="advGoalTarget"
                               min="1" max="9999" step="1" value="${curGoal}"
                               style="width:100%; padding:8px 10px; font-size:14px;
                                      background:#1a1e2e; color:#fff; 
                                      border:1px solid #6741d9; border-radius:6px;
                                      font-family:monospace;">
                        <p style="color:#6c757d; font-size:11px; margin:4px 0 0 0;">0 = sınırsız</p>
                    </div>
                    <div>
                        <label style="display:block; color:#c084fc; font-weight:bold; 
                                      font-size:13px; margin-bottom:6px;">
                            ⏱️ Maç Süresi (dk)
                        </label>
                        <input type="number" id="advMatchDuration"
                               min="0" max="9999" step="1" value="${Math.round(curDur / 60)}"
                               style="width:100%; padding:8px 10px; font-size:14px;
                                      background:#1a1e2e; color:#fff; 
                                      border:1px solid #6741d9; border-radius:6px;
                                      font-family:monospace;">
                        <p style="color:#6c757d; font-size:11px; margin:4px 0 0 0;">0 = sınırsız</p>
                    </div>
                </div>
            `;
        }
        
        config.advancedFields.forEach(field => {
            html += `<div style="margin-bottom:18px;">
                <label style="display:flex; justify-content:space-between; align-items:center; 
                              color:#c084fc; font-weight:bold; margin-bottom:8px; font-size:14px;">
                    <span>${field.label}</span>
                    <span id="advVal_${field.id}" style="color:#ffd43b; font-family:monospace; 
                                                          background:rgba(0,0,0,0.3); 
                                                          padding:3px 10px; border-radius:6px;">
                        ${field.current}${field.unit || ""}
                    </span>
                </label>
                <input type="range" id="advField_${field.id}" 
                       min="${field.min}" max="${field.max}" step="${field.step || 1}"
                       value="${field.current}"
                       style="width:100%; height:6px; cursor:pointer; accent-color:#c084fc;">
                <div style="display:flex; justify-content:space-between; color:#6c757d; 
                            font-size:11px; margin-top:2px;">
                    <span>${field.min}${field.unit || ""}</span>
                    <span>${field.max}${field.unit || ""}</span>
                </div>
                ${field.desc ? `<p style="color:#868e96; font-size:12px; margin:6px 0 0 0; font-style:italic;">${field.desc}</p>` : ""}
            </div>`;
        });
        
        html += `
                        <!-- Dışa Aktar / İçe Aktar butonları (Adım 4'te fonksiyonel olacak) -->
                        <div style="display:flex; gap:10px; margin-top:20px; padding-top:15px; 
                                    border-top:1px solid #3b4c63;">
                            <button id="advExportBtn" class="bigBtn" 
                                    style="flex:1; background:#20c997; font-size:14px; padding:10px;">
                                💾 Ayarları Dışa Aktar
                            </button>
                            <button id="advImportBtn" class="bigBtn" 
                                    style="flex:1; background:#495057; font-size:14px; padding:10px;">
                                📁 Ayarları Yükle
                            </button>
                        </div>
                        
                        <button id="advResetBtn" class="bigBtn" 
                                style="width:100%; background:#e67e22; font-size:13px; 
                                       padding:8px; margin-top:10px;">
                            🔄 Varsayılana Sıfırla
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    
    // ✨ Readonly mod - tüm select'leri devre dışı bırak
    if (config.readonly) {
        setTimeout(() => {
            const selects = document.querySelectorAll("#roomSettingsContent select");
            selects.forEach(sel => {
                sel.disabled = true;
                sel.style.opacity = "0.7";
                sel.style.cursor = "not-allowed";
            });
            // Slider'ları da disable
            const sliders = document.querySelectorAll("#roomSettingsContent input[type=range]");
            sliders.forEach(s => {
                s.disabled = true;
                s.style.opacity = "0.5";
            });
            // Checkbox'ları da
            const checkboxes = document.querySelectorAll("#roomSettingsContent input[type=checkbox]");
            checkboxes.forEach(c => {
                c.disabled = true;
                c.style.opacity = "0.5";
                if (c.parentElement) c.parentElement.style.cursor = "not-allowed";
            });
            // Butonları gizle (export, import, reset gibi)
            const advBtns = document.querySelectorAll("#advExportBtn, #advImportBtn, #advResetBtn");
            advBtns.forEach(b => { if (b) b.style.display = "none"; });
            
            // Kaydet butonu gizle, sadece "Kapat" göster
            const saveBtn = document.getElementById("roomSettingsSaveBtn");
            const cancelBtn = document.getElementById("roomSettingsCancelBtn");
            if (saveBtn) saveBtn.style.display = "none";
            if (cancelBtn) cancelBtn.textContent = "Kapat";
        }, 50);
    }
    
    // ✨ Card'ı flex yap, içeriği scroll'a alarak butonları sabitle
    const settingsCard = document.querySelector("#roomSettingsBox .overlayCard");
    if (settingsCard) {
        settingsCard.style.setProperty("max-height", "85vh", "important");
        settingsCard.style.setProperty("height", "auto", "important");
        settingsCard.style.setProperty("display", "flex", "important");
        settingsCard.style.setProperty("flex-direction", "column", "important");
        settingsCard.style.setProperty("overflow", "hidden", "important");
        settingsCard.style.setProperty("padding", "20px", "important");
        settingsCard.style.setProperty("box-sizing", "border-box", "important");
        settingsCard.style.setProperty("margin", "auto", "important");
    }
    
    // Content scroll'lu olsun
    const contentEl = document.getElementById("roomSettingsContent");
    if (contentEl) {
        contentEl.style.setProperty("overflow-y", "auto", "important");
        contentEl.style.setProperty("overflow-x", "hidden", "important");
        contentEl.style.setProperty("flex", "1 1 auto", "important");
        contentEl.style.setProperty("min-height", "0", "important");
        contentEl.style.setProperty("padding-right", "10px", "important");
    }
    
    // Butonlar hiç scroll'a girmesin (sabit alt)
    const btnContainer = document.querySelector("#roomSettingsBox .confirmButtons");
    if (btnContainer) {
        btnContainer.style.setProperty("flex-shrink", "0", "important");
        btnContainer.style.setProperty("border-top", "1px solid rgba(255,255,255,0.1)", "important");
        btnContainer.style.setProperty("padding-top", "15px", "important");
        btnContainer.style.setProperty("margin-top", "15px", "important");
        btnContainer.style.setProperty("background", "inherit", "important");
    }
    
    // Overlay z-index footer'ın üstünde olsun
    const overlay = document.getElementById("roomSettingsBox");
    if (overlay) {
        overlay.style.setProperty("z-index", "99999", "important");
        overlay.style.setProperty("align-items", "center", "important");
    }
    
    // Footer'ı geçici gizle (popup açıkken görünmesin)
    const footer = document.querySelector(".siteFooter");
    if (footer) footer.style.setProperty("display", "none", "important");
    
    document.getElementById("roomSettingsBox").classList.remove("hidden");
    
    // ✨ Gelişmiş ayarlar toggle animasyonu
    const toggle = document.getElementById("advancedToggle");
    const advContent = document.getElementById("advancedContent");
    if (toggle && advContent) {
        // ✨ Toggle fonksiyonu
        function applyAdvancedState(isChecked, animate) {
            const disableGroups = document.querySelectorAll('[data-disable-on-adv="1"]');
            
            if (isChecked) {
                if (animate) {
                    advContent.style.maxHeight = advContent.scrollHeight + "px";
                    setTimeout(() => {
                        if (toggle.checked) advContent.style.maxHeight = "5000px";
                    }, 400);
                } else {
                    advContent.style.maxHeight = "5000px";
                }
                
                disableGroups.forEach(g => {
                    g.style.opacity = "0.4";
                    g.style.pointerEvents = "none";
                    const sel = g.querySelector("select");
                    if (sel) sel.disabled = true;
                    let badge = g.querySelector(".advDisabledBadge");
                    if (!badge) {
                        badge = document.createElement("span");
                        badge.className = "advDisabledBadge";
                        badge.textContent = " (gelişmiş modda devre dışı)";
                        badge.style.cssText = "color:#e67e22; font-size:12px; font-weight:normal; margin-left:8px;";
                        const label = g.querySelector("label");
                        if (label) label.appendChild(badge);
                    }
                });
            } else {
                if (animate) {
                    advContent.style.maxHeight = advContent.scrollHeight + "px";
                    setTimeout(() => {
                        advContent.style.maxHeight = "0";
                    }, 10);
                } else {
                    advContent.style.maxHeight = "0";
                }
                
                disableGroups.forEach(g => {
                    g.style.opacity = "1";
                    g.style.pointerEvents = "auto";
                    const sel = g.querySelector("select");
                    if (sel) sel.disabled = false;
                    const badge = g.querySelector(".advDisabledBadge");
                    if (badge) badge.remove();
                });
            }
        }
        
        toggle.addEventListener("change", () => {
            applyAdvancedState(toggle.checked, true);
        });
        
        // ✨ Sayfa yüklenirken toggle'ın durumunu uygula (localStorage'dan geldiyse)
        if (toggle.checked) {
            setTimeout(() => applyAdvancedState(true, false), 50);
        }
    }
    
    // ✨ Slider değerleri anlık göster
    if (config.advancedFields) {
        config.advancedFields.forEach(field => {
            const slider = document.getElementById("advField_" + field.id);
            const valSpan = document.getElementById("advVal_" + field.id);
            if (slider && valSpan) {
                slider.addEventListener("input", () => {
                    valSpan.textContent = slider.value + (field.unit || "");
                });
            }
        });
    }
    
    // ✨ Dışa Aktar / İçe Aktar butonları (Adım 4'te dolduracağız)
    const exportBtn = document.getElementById("advExportBtn");
    const importBtn = document.getElementById("advImportBtn");
    const resetBtn = document.getElementById("advResetBtn");
    if (exportBtn) exportBtn.onclick = () => alert("Dışa aktar - Adım 4'te eklenecek");
    if (importBtn) importBtn.onclick = () => alert("Yükle - Adım 4'te eklenecek");
    
    // ✨ Varsayılana Sıfırla - localStorage'ı sil + slider'ları default'a çek
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (!confirm("Gelişmiş ayarları varsayılan değerlere sıfırlamak istediğine emin misin?")) return;
            
            // Her slider'ı config'teki varsayılan değere çek
            if (config.advancedFields) {
                config.advancedFields.forEach(field => {
                    const slider = document.getElementById("advField_" + field.id);
                    const valSpan = document.getElementById("advVal_" + field.id);
                    
                    // Field.current localStorage'dan gelmiş olabilir, orijinal default'u bul
                    // MINI_ADVANCED_FIELDS'ten al (mini_futbol.js'de tanımlı)
                    let defaultVal = field.current;
                    if (typeof MINI_ADVANCED_FIELDS !== "undefined") {
                        const orig = MINI_ADVANCED_FIELDS.find(f => f.id === field.id);
                        if (orig) defaultVal = orig.current;
                    }
                    
                    if (slider) slider.value = defaultVal;
                    if (valSpan) valSpan.textContent = defaultVal + (field.unit || "");
                });
            }
            
            // localStorage'dan sil
            try {
                localStorage.removeItem("miniAdvancedSettings");
            } catch(e) {}
            
            console.log("[SETTINGS] Gelişmiş ayarlar varsayılana sıfırlandı");
        };
    }
};

function closeRoomSettings() {
    document.getElementById("roomSettingsBox").classList.add("hidden");
    _activeSettingsConfig = null;
    // Footer geri aç
    const footer = document.querySelector(".siteFooter");
    if (footer) footer.style.display = "";
}

// İptal butonu
document.getElementById("roomSettingsCancelBtn").onclick = () => {
    closeRoomSettings();
};

// Kaydet butonu
document.getElementById("roomSettingsSaveBtn").onclick = () => {
    if (!_activeSettingsConfig) return;
    
    const values = {};
    _activeSettingsConfig.fields.forEach(field => {
        const el = document.getElementById("settingsField_" + field.id);
        if (el) values[field.id] = el.value;
    });
    
    // ✨ Gelişmiş ayarları da topla
    let advancedValues = null;
    if (_activeSettingsConfig.advancedFields) {
        advancedValues = {};
        _activeSettingsConfig.advancedFields.forEach(field => {
            const slider = document.getElementById("advField_" + field.id);
            if (slider) {
                advancedValues[field.id] = parseFloat(slider.value);
            }
        });
    }
    
    // ✨ Gelişmişteki özgür Kazanma Skoru + Maç Süresi (dk → sn çevir)
    const advGoalEl = document.getElementById("advGoalTarget");
    const advDurEl = document.getElementById("advMatchDuration");
    const advToggle = document.getElementById("advancedToggle");
    if (advGoalEl && advDurEl && advToggle && advToggle.checked) {
        let g = parseInt(advGoalEl.value);
        let dMin = parseInt(advDurEl.value);  // Dakika olarak alındı
        if (!g || g <= 0) g = 999;
        if (!dMin || dMin <= 0) dMin = 99999;
        if (g > 9999) g = 9999;
        if (dMin > 9999) dMin = 9999;
        // Dakikayı saniyeye çevir (backend saniye bekliyor)
        let d = (dMin >= 9999) ? 99999 : dMin * 60;
        // values'a override et (onSave içinde bunu kullanacak)
        values.goalTarget = g;
        values.matchDuration = d;
        
        // ✨ localStorage'a da kaydet (oda yeniden kurulduğunda hatırlansın)
        try {
            const raw = localStorage.getItem("miniAdvancedSettings");
            const advDict = raw ? JSON.parse(raw) : {};
            advDict._advGoalTarget = g;
            advDict._advMatchDurationMin = dMin;
            localStorage.setItem("miniAdvancedSettings", JSON.stringify(advDict));
        } catch(e) {}
    }
    
    // ✨ Gelişmiş toggle durumunu da kaydet (advancedValues null değilse aktif demek)
    if (advancedValues) {
        try {
            const raw = localStorage.getItem("miniAdvancedSettings");
            const advDict = raw ? JSON.parse(raw) : {};
            // Slider değerlerini kaydet
            Object.assign(advDict, advancedValues);
            localStorage.setItem("miniAdvancedSettings", JSON.stringify(advDict));
            localStorage.setItem("miniAdvancedEnabled", "true");
        } catch(e) {}
    } else if (advToggle) {
        // Toggle kapalıysa false yap
        try {
            localStorage.setItem("miniAdvancedEnabled", advToggle.checked ? "true" : "false");
        } catch(e) {}
    }
    
    _activeSettingsConfig.onSave(values, advancedValues);
    closeRoomSettings();
};

// ==========================================
// BİL BAKALIM - Oda Ayarları
// ==========================================

function openRoomSettings() {
    window.openRoomSettingsGeneric({
        title: "Bil Bakalım - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: bilMaxPlayers || 2,
                minValue: (players && players.length > 1) ? players.length : null,
                options: [
                    {value: 1, label: "1 Oyuncu"},
                    {value: 2, label: "2 Oyuncu"}
                ]
            },
            {
                id: "botLevel",
                label: "🤖 Bot Seviyesi",
                current: bilBotLevel || "orta",
                options: [
                    {value: "kolay", label: "🟢 Kolay Bot"},
                    {value: "orta", label: "🟡 Orta Bot"},
                    {value: "zor", label: "🔴 Zor Bot"}
                ]
            },
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: turnSeconds || 45,
                options: [
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 90, label: "90 saniye"}
                ]
            },
            {
                id: "guessLimit",
                label: "🎯 Tahmin Hakkı",
                current: guessLimit || 0,
                options: [
                    {value: 0, label: "Sınırsız"},
                    {value: 1, label: "1 (Riskli!)"},
                    {value: 2, label: "2"},
                    {value: 3, label: "3"},
                    {value: 4, label: "4"},
                    {value: 5, label: "5"},
                    {value: 6, label: "6"},
                    {value: 7, label: "7"},
                    {value: 8, label: "8"},
                    {value: 9, label: "9"},
                    {value: 10, label: "10"}
                ]
            }
        ],
        onSave: (values) => {
            try {
                localStorage.setItem("bilMaxPlayers", String(values.maxPlayers));
                localStorage.setItem("bilBotLevel", values.botLevel);
                localStorage.setItem("bilTurnSeconds", String(values.turnSec));
                localStorage.setItem("bilGuessLimit", String(values.guessLimit));
            } catch(e) {}
            send({
                type: "update_room_settings",
                max_players: parseInt(values.maxPlayers) || 2,
                bot_level: values.botLevel || "orta",
                turn_seconds: parseInt(values.turnSec) || 45,
                guess_limit: parseInt(values.guessLimit) || 0
            });
        }
    });
    
    // Popup açılınca 2 oyuncu ise Bot Seviyesi kutusunu gizle
    setTimeout(() => {
        const maxSel = document.getElementById("settingsField_maxPlayers");
        const botGroup = document.getElementById("settingsGroup_botLevel");
        if (maxSel && botGroup) {
            const updateBotVis = () => {
                botGroup.style.display = (maxSel.value === "1") ? "" : "none";
            };
            updateBotVis();
            maxSel.addEventListener("change", updateBotVis);
        }
    }, 50);
}

// Bil Bakalım buton olayı
document.getElementById("roomSettingsBtn").onclick = () => {
    openRoomSettings();
};

// ==========================================
// ✨ MOD DEĞİŞTİR SİSTEMİ (Tüm Modlar için Ortak)
// ==========================================

const ALL_MODES = [
    { id: "bil_bakalim", name: "Bil Bakalım", img: "/mod_resimleri/bil_bakalim.webp", desc: "Klasik futbolcu tahmin oyunu", maxPlayers: 2 },
    { id: "takim_bilmece", name: "Takım Bilmece", img: "/mod_resimleri/takim_bilmece.webp", desc: "11 oyuncudan takımı bul", maxPlayers: 5 },
    { id: "kim_milyoner", name: "Kim Milyoner?", img: "/mod_resimleri/kim_milyoner.webp", desc: "Milyoner tarzı bilgi yarışması", maxPlayers: 5 },
    { id: "ilk_11_challenge", name: "İlk 11 Challenge", img: "/mod_resimleri/ilk_11.webp", desc: "4-3-3 kadroyu kur, rakibi yen", maxPlayers: 2 },
    { id: "gizemli_kariyer", name: "Gizemli Kariyer", img: "/mod_resimleri/gizemli_kariyer.webp", desc: "Kariyerden futbolcuyu bul", maxPlayers: 5 },
    { id: "haritadan_bul", name: "Haritadan Bul", img: "/mod_resimleri/haritadan_bul.webp", desc: "Ülkeyi haritada göster", maxPlayers: 5 },
    
    
    { id: "sarkidan_bul", name: "🎵 Şarkıdan Bul", img: "/mod_resimleri/sarkidan_bul.webp", desc: "Şarkıyı dinle, sanatçıyı ve adını bul!", maxPlayers: 5 },
    { id: "mini_futbol", name: "⚽ Mini Futbol", img: "/mod_resimleri/mini_futbol.webp", desc: "1v1'den 5v5'e gerçek zamanlı futbol!", maxPlayers: 15 },
    { id: "jokerli_satranc", name: "♟️ Jokerli Satranç", img: "/mod_resimleri/jokerli_satranc.webp", desc: "26 jokerle klasik satrancı alt üst et!", maxPlayers: 2 }
];

let _selectedNewMode = null;
let _currentActiveMode = null;  // Popup açıldığında set edilir

// Şu anki modu tespit et
function getCurrentMode() {
    const current = getCurrentScreen();
    if (current === "lobby" || current === "select" || current === "game") return "bil_bakalim";
    if (current.startsWith("takim")) return "takim_bilmece";
    if (current.startsWith("ml")) return "kim_milyoner";
    if (current.startsWith("harita")) return "haritadan_bul";
    if (current.startsWith("gizem")) return "gizemli_kariyer";
    if (current.startsWith("ilk11")) return "ilk_11_challenge";
    if (current.startsWith("sarki")) return "sarkidan_bul";
    if (current.startsWith("mini")) return "mini_futbol";
    if (current.startsWith("satranc")) return "jokerli_satranc";
    return null;
}

function openChangeModeModal() {
    _currentActiveMode = getCurrentMode();
    _selectedNewMode = null;
    
    const grid = document.getElementById("changeModeGrid");
    grid.innerHTML = "";
    
    // ✨ Ortak yeşil parlama stili (aktif ve seçilen için aynı)
    const GREEN_HIGHLIGHT = "5px solid #51cf66";
    const GREEN_GLOW = "0 0 35px rgba(81,207,102,0.9), 0 0 60px rgba(81,207,102,0.5), inset 0 0 20px rgba(81,207,102,0.2)";
    
    // ✨ Şu anki oda oyuncu sayısını bul (tüm modlardan çek)
    let currentPlayerCount = 0;
    if (typeof players !== "undefined" && Array.isArray(players) && players.length > 0) {
        currentPlayerCount = players.length;
    } else if (typeof takimData !== "undefined" && takimData.players && takimData.players.length > 0) {
        currentPlayerCount = takimData.players.length;
    } else if (typeof mlData !== "undefined" && mlData.players && mlData.players.length > 0) {
        currentPlayerCount = mlData.players.length;
    } else if (typeof haritaData !== "undefined" && haritaData.players && haritaData.players.length > 0) {
        currentPlayerCount = haritaData.players.length;
    } else if (typeof gizemData !== "undefined" && gizemData.players && gizemData.players.length > 0) {
        currentPlayerCount = gizemData.players.length;
    } else if (typeof ilk11Data !== "undefined" && ilk11Data.players && ilk11Data.players.length > 0) {
        currentPlayerCount = ilk11Data.players.length;
    
    } else if (typeof miniData !== "undefined" && miniData.players && miniData.players.length > 0) {
        currentPlayerCount = miniData.players.length;
    } else if (typeof satrancData !== "undefined" && satrancData.players && satrancData.players.length > 0) {
        currentPlayerCount = satrancData.players.length;
    }
    // Sarkı için özel — window helper kullan
    if (currentPlayerCount === 0 && typeof window._sarkiGetPlayerCount === "function") {
        try { currentPlayerCount = window._sarkiGetPlayerCount() || 0; } catch(e) {}
    }
    // Fallback: en az 1 (kendim)
    if (currentPlayerCount < 1) currentPlayerCount = 1;
    
    console.log(`[MODE CHANGE] Oda oyuncu sayısı: ${currentPlayerCount}`);
    
    ALL_MODES.forEach(mode => {
        const isActive = (mode.id === _currentActiveMode);
        const modeMax = mode.maxPlayers || 2;
        // ✨ Bu mod bu oyuncu sayısına uygun mu?
        const tooManyPlayers = (currentPlayerCount > modeMax) && !isActive;
        
        const card = document.createElement("div");
        card.className = "mod-card";
        card.dataset.modId = mode.id;
        card.style.transition = "all 0.25s ease";
        
        if (isActive) {
            card.style.border = GREEN_HIGHLIGHT;
            card.style.boxShadow = GREEN_GLOW;
        }
        
        // ✨ Kapasiteye uymuyorsa soluk göster
        if (tooManyPlayers) {
            card.style.opacity = "0.4";
            card.style.filter = "grayscale(70%)";
            card.style.cursor = "not-allowed";
            card.title = `Bu modda maksimum ${modeMax} oyuncu olabilir (şu an ${currentPlayerCount} kişi)`;
        }
        
        // ✨ Uyarı badge (üstte kırmızı bant)
        const warningBadge = tooManyPlayers 
            ? `<div style="position:absolute; top:5px; left:5px; right:5px; background:rgba(255,107,107,0.95); color:#fff; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:6px; text-align:center; z-index:5; box-shadow:0 2px 8px rgba(0,0,0,0.4);">
                ⚠️ Max ${modeMax} oyuncu (şu an ${currentPlayerCount})
              </div>`
            : "";
        
        card.style.position = "relative";
        card.innerHTML = `
            ${warningBadge}
            <img src="${mode.img}" alt="${mode.name}" onerror="this.style.display='none'">
            <div class="mod-info">
                <h3>${mode.name}${isActive ? ' ✅' : ''}</h3>
                <p>${mode.desc}</p>
            </div>
        `;
        
        // Tek tık → seç
        card.addEventListener("click", () => {
            if (mode.id === _currentActiveMode) return;  // Aynı mod seçilemez
            
            // ✨ Kapasite dolu ise engel
            if (tooManyPlayers) {
                if (typeof showToast === "function") {
                    showToast(
                        "⚠️ Kapasite Yetersiz",
                        `${mode.name} modunda maksimum ${modeMax} oyuncu olabilir. Şu an odada ${currentPlayerCount} kişi var. Önce bazı oyuncuları çıkar veya kick et.`,
                        null,
                        "warning"
                    );
                }
                return;
            }
            
            _selectedNewMode = mode.id;
            
            // ✨ TÜM kartları normalize et (aktif olan bile - artık seçim öncelikli)
            grid.querySelectorAll(".mod-card").forEach(c => {
                c.style.border = "";
                c.style.boxShadow = "";
            });
            
            // Seçileni parlak yeşil ile işaretle
            card.style.border = GREEN_HIGHLIGHT;
            card.style.boxShadow = GREEN_GLOW;
            
            // Onay butonunu aktifleştir
            const confirmBtn = document.getElementById("changeModeConfirmBtn");
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = "1";
            confirmBtn.style.cursor = "pointer";
        });
        
        // Çift tık → direkt geç
        card.addEventListener("dblclick", () => {
            if (mode.id === _currentActiveMode) return;
            if (tooManyPlayers) return;  // ✨ Çift tık da engel
            _selectedNewMode = mode.id;
            confirmModeChange();
        });
        
        grid.appendChild(card);
    });
    
    document.getElementById("changeModeModal").classList.remove("hidden");
}

function closeChangeModeModal() {
    document.getElementById("changeModeModal").classList.add("hidden");
    _selectedNewMode = null;
    _currentActiveMode = null;
    // Butonu resetle
    const confirmBtn = document.getElementById("changeModeConfirmBtn");
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = "0.5";
    confirmBtn.style.cursor = "not-allowed";
}

function confirmModeChange() {
    if (!_selectedNewMode) return;
    if (_selectedNewMode === _currentActiveMode) {
        closeChangeModeModal();
        return;
    }
    
    // ✨ Şarkıdan Bul için özel akış (kendi sistemi var)
    if (_selectedNewMode === "sarkidan_bul" && _isCurrentHost()) {
        closeChangeModeModal();
        if (typeof window._sarkiPrepareModeChange === "function") {
            const handled = window._sarkiPrepareModeChange();
            if (handled) return;
        }
    }
    
    // ✨ Her mod kendi _xxxPrepareModeChange fonksiyonunu kayıt eder
    // window._modeChangeHandlers = { "bil_bakalim": function, ... }
    // ✨ ÖNEMLİ: closeChangeModeModal _selectedNewMode'u null yapar,
    //   o yüzden önce yerel değişkene alıyoruz
    const modeToChange = _selectedNewMode;
    const handlerFn = window._modeChangeHandlers ? window._modeChangeHandlers[modeToChange] : null;

    if (_isCurrentHost() && typeof handlerFn === "function") {
        closeChangeModeModal();
        try {
            const handled = handlerFn();
            if (handled) return;
        } catch (err) {
            console.error("[MODE CHANGE] Handler hata verdi:", err);
        }
    }
    
    // Fallback: direkt backend'e gönder
    send({ type: "mod_change_room", new_mode: modeToChange });
    closeChangeModeModal();
}

// Buton event'leri
document.getElementById("changeModeBtn").onclick = openChangeModeModal;
document.getElementById("changeModeCloseBtn").onclick = closeChangeModeModal;
document.getElementById("changeModeCancelBtn").onclick = closeChangeModeModal;
document.getElementById("changeModeConfirmBtn").onclick = confirmModeChange;

// ✨ TÜM MODLAR için "Mod Değiştir" butonları
const _allChangeModeBtnIds = [
    "takimChangeModeBtn",
    "mlChangeModeBtn",
    "haritaChangeModeBtn",
    "gizemChangeModeBtn",
    "ilk11ChangeModeBtn",
    "sarkiChangeModeBtn",
    "miniChangeModeBtn",
    "satrancChangeModeBtn"
];
_allChangeModeBtnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = openChangeModeModal;
});

// ✨ Yardımcı fonksiyon: Mod Değiştir butonunu göster/gizle
window.updateChangeModeBtnVisibility = function(btnId, isHost) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isHost) {
        btn.classList.remove("hidden");
    } else {
        btn.classList.add("hidden");
    }
};

window._pendingModeChangeCtx = window._pendingModeChangeCtx || null;
window._modeChangeHandlers = window._modeChangeHandlers || {};

// ==========================================
// ✨ OYUNCU SAYISI KISITLAMA HELPER'LARI
// ==========================================

// Şu anki odadaki oyuncu sayısını döner
window._getCurrentRoomPlayerCount = function() {
    let count = 0;
    try {
        if (typeof players !== "undefined" && Array.isArray(players) && players.length > 0) count = players.length;
        else if (typeof takimData !== "undefined" && takimData.players && takimData.players.length > 0) count = takimData.players.length;
        else if (typeof mlData !== "undefined" && mlData.players && mlData.players.length > 0) count = mlData.players.length;
        else if (typeof haritaData !== "undefined" && haritaData.players && haritaData.players.length > 0) count = haritaData.players.length;
        else if (typeof gizemData !== "undefined" && gizemData.players && gizemData.players.length > 0) count = gizemData.players.length;
        else if (typeof ilk11Data !== "undefined" && ilk11Data.players && ilk11Data.players.length > 0) count = ilk11Data.players.length;
        
        else if (typeof miniData !== "undefined" && miniData.players && miniData.players.length > 0) count = miniData.players.length;
        else if (typeof satrancData !== "undefined" && satrancData.players && satrancData.players.length > 0) count = satrancData.players.length;
    } catch(e) {}
    if (count < 1) count = 1;
    return count;
};

// Bir <select> içindeki minValue altındaki option'ları disabled yapar
// selectId: dropdown ID'si (örn "haritaMaxPlayersSelect")
// minValue: bu değerin altındaki option'lar disabled olur
// mapping: opsiyonel (mini futbol için: {2:1, 4:2, 6:3, ...} gibi)
window._applyMinPlayerLimit = function(selectId, minValue, mapping) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    
    let firstEnabledValue = null;
    let currentDisabled = false;
    
    Array.from(sel.options).forEach(opt => {
        const rawVal = parseInt(opt.value);
        if (isNaN(rawVal)) return;
        
        // Mapping varsa değeri çevir (mini futbol: value=oyuncu*2 ise gerçek oyuncu = value/2)
        // Buradaki "gerçek oyuncu sayısı" o modun oyuncu sayısıdır (max)
        const effectiveMax = mapping ? mapping(rawVal) : rawVal;
        
        if (effectiveMax < minValue) {
            opt.disabled = true;
            opt.style.opacity = "0.35";
            opt.style.color = "#6c757d";
            if (!opt.textContent.includes("🚫")) {
                opt.textContent = "🚫 " + opt.textContent + ` (min ${minValue})`;
            }
            if (sel.value === String(rawVal)) currentDisabled = true;
        } else {
            opt.disabled = false;
            opt.style.opacity = "";
            opt.style.color = "";
            // 🚫 prefix'ini kaldır
            opt.textContent = opt.textContent.replace(/^🚫 /, "").replace(/ \(min \d+\)$/, "");
            if (firstEnabledValue === null) firstEnabledValue = String(rawVal);
        }
    });
    
    // Şu anki seçim disabled ise → ilk enabled'a çek
    if (currentDisabled && firstEnabledValue !== null) {
        sel.value = firstEnabledValue;
    }
    
    // Görsel uyarı (dropdown border rengi)
    if (minValue > 2) {
        sel.style.borderColor = "#ffa94d";
        sel.style.boxShadow = "0 0 8px rgba(255,169,77,0.3)";
        sel.title = `Odadaki oyuncu sayısı ${minValue}. Daha düşük seçilemez.`;
    } else {
        sel.style.borderColor = "";
        sel.style.boxShadow = "";
        sel.title = "";
    }
};

// Mini Futbol için özel mapping (value=2 → 1v1, value=4 → 2v2, ...)
// Bir "değer" verildiğinde onun temsil ettiği maksimum oyuncu sayısını döner
window._miniFutbolValueToMax = function(rawValue) {
    return rawValue; // 2 → 2, 4 → 4, 6 → 6, 8 → 8, 10 → 10 (aynı zaten)
};

function _getModeChangeLobbyScreen(modeId) {
    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };
    return modeToScreen[modeId] || "lobby";
}

window._modeChangeHandlers["bil_bakalim"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = _currentActiveMode || getCurrentMode();
    window._pendingModeChangeCtx = {
        newMode: "bil_bakalim",
        createScreen: "create",
        returnScreen: _getModeChangeLobbyScreen(fromMode)
    };

    const savedName = (typeof myName === "string" && myName.trim())
        ? myName.trim()
        : (localStorage.getItem("playerName") || "");

    if (createNameInput) createNameInput.value = savedName;

    setMsg(createMsg, 'Bil Bakalım ayarlarını seç, sonra "Oda Oluştur" ile modu değiştir.', "#ffd43b");
    showScreen("create");

    if (createNameInput) {
        setTimeout(() => createNameInput.focus(), 50);
    }

    console.log("[MODE CHANGE] Bil Bakalım create ekranı açıldı");
    return true;
};



// Backend'den "mod değişti" mesajı gelince
const _prevHandleForModChange = handleMessage;
handleMessage = function(msg) {
    // ✨ HOST ODAYI KAPATTI - Kullanıcı katıl ekranına atılır
    if (msg.type === "host_left_room") {
        console.log("[HOST LEFT] Oda kapatıldı");
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        
        // Tüm popup'ları kapat
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        
        // HP motoru varsa durdur
        if (typeof HP !== 'undefined' && HP.running) {
            try { HP.stopGame(); } catch(e) {}
        }
        if (typeof stopMiniGame === "function") {
            try { stopMiniGame(); } catch(e) {}
        }
        if (typeof stopMiniPing === "function") {
            try { stopMiniPing(); } catch(e) {}
        }
        
        // Timer'ları durdur
        try { stopTimer(); } catch(e) {}
        
        // Chat'leri gizle
        try { if (typeof hideBilChat === "function") hideBilChat(); } catch(e) {}
        try { if (typeof hideMiniChat === "function") hideMiniChat(); } catch(e) {}
        
        // Global state sıfırla
        inRoom = false;
        playerId = null;
        roomCode = "";
        
        // Mod-özel data'ları sıfırla
        try { if (typeof takimData !== "undefined") { takimData.playerId = null; takimData.roomCode = ""; takimData.inGame = false; } } catch(e) {}
        try { if (typeof mlData !== "undefined") { mlData.playerId = null; mlData.roomCode = ""; mlData.inGame = false; } } catch(e) {}
        try { if (typeof haritaData !== "undefined") { haritaData.playerId = null; haritaData.roomCode = ""; haritaData.inGame = false; } } catch(e) {}
        try { if (typeof gizemData !== "undefined") { gizemData.playerId = null; gizemData.roomCode = ""; gizemData.inGame = false; } } catch(e) {}
        try { if (typeof ilk11Data !== "undefined") { ilk11Data.playerId = null; ilk11Data.roomCode = ""; ilk11Data.inGame = false; } } catch(e) {}
        
        try { if (typeof miniData !== "undefined") { miniData.playerId = null; miniData.roomCode = ""; miniData.players = []; miniData.gameState = null; } } catch(e) {}
        try { if (typeof satrancData !== "undefined") { satrancData.playerId = null; satrancData.roomCode = ""; } } catch(e) {}
        
        // WS yenile
        if (ws) {
            try { ws.close(); } catch(e) {}
        }
        setTimeout(() => {
            connectWS();
        }, 300);
        
        // Katıl ekranına git
        showScreen("join");
        
        // Toast göster
        setTimeout(() => {
            showToast("👑 Host Odayı Kapattı", msg.message || "Host odadan ayrıldı, oda kapatıldı.", null, "warning");
        }, 400);
        
        return;
    }
    
    if (msg.type === "mod_changed") {
        console.log("[MOD DEĞİŞTİ]", msg.new_mode, "player_id:", msg.player_id);
        
        // ✨ ÖNCE eski modun aktif sistemlerini temizle
        // Mini Futbol'daysak: HP motoru, ping, chat, timer'lar durmalı
        try {
            if (typeof HP !== 'undefined' && HP.running) {
                HP.stopGame();
                console.log("[MOD DEĞİŞTİ] HP motoru durduruldu");
            }
            if (typeof stopMiniGame === "function") stopMiniGame();
            if (typeof stopMiniPing === "function") stopMiniPing();
            if (typeof hideMiniChat === "function") hideMiniChat();
        } catch(e) { console.error("Mini temizleme hatası:", e); }
        
        // Diğer modların da chat'lerini kapat
        try { if (typeof hideBilChat === "function") hideBilChat(); } catch(e) {}
        try { if (typeof hideTakimChat === "function") hideTakimChat(); } catch(e) {}
        try { if (typeof hideMlChat === "function") hideMlChat(); } catch(e) {}
        try { if (typeof hideHaritaChat === "function") hideHaritaChat(); } catch(e) {}
        try { if (typeof hideGizemChat === "function") hideGizemChat(); } catch(e) {}
        try { if (typeof hideIlk11Chat === "function") hideIlk11Chat(); } catch(e) {}
        try { if (typeof hideSarkiChat === "function") hideSarkiChat(); } catch(e) {}
        
        // Timer temizle (Bil Bakalım vs.)
        try { if (typeof stopTimer === "function") stopTimer(); } catch(e) {}
        
        // ✨ Global state'i güncelle
        roomCode = msg.room_code;
        playerId = msg.player_id;
        inRoom = true;
        
        // ✨ HER MOD İÇİN kendi Data objesini güncelle (varsa)
        // Böylece o modun JS'i "ben hazırım" der ve lobby render eder
        if (msg.new_mode === "bil_bakalim") {
            // Bil Bakalım global playerId zaten kullanıyor
        }
        if (msg.new_mode === "takim_bilmece" && typeof takimData !== "undefined") {
            takimData.playerId = msg.player_id;
            takimData.roomCode = msg.room_code;
            takimData.inGame = true;
        }
        if (msg.new_mode === "kim_milyoner" && typeof mlData !== "undefined") {
            mlData.playerId = msg.player_id;
            mlData.roomCode = msg.room_code;
            mlData.inGame = true;
        }
        if (msg.new_mode === "haritadan_bul" && typeof haritaData !== "undefined") {
            haritaData.playerId = msg.player_id;
            haritaData.roomCode = msg.room_code;
            haritaData.inGame = true;
        }
        if (msg.new_mode === "gizemli_kariyer" && typeof gizemData !== "undefined") {
            gizemData.playerId = msg.player_id;
            gizemData.roomCode = msg.room_code;
            gizemData.inGame = true;
        }
        if (msg.new_mode === "ilk_11_challenge" && typeof ilk11Data !== "undefined") {
            ilk11Data.playerId = msg.player_id;
            ilk11Data.roomCode = msg.room_code;
            ilk11Data.inGame = true;
        }
        
        if (msg.new_mode === "sarkidan_bul") {
            // ✨ Sarkı state'ini de senkronize et (sarkiIsHost için)
            // Modül scope'lu değişkenlerine erişim window fonksiyonları ile
            if (typeof window._sarkiSyncState === "function") {
                window._sarkiSyncState(msg.player_id, msg.room_code);
            }
        }
        if (msg.new_mode === "mini_futbol" && typeof miniData !== "undefined") {
            miniData.playerId = msg.player_id;
            miniData.roomCode = msg.room_code;
        }
        if (msg.new_mode === "jokerli_satranc" && typeof satrancData !== "undefined") {
            satrancData.playerId = msg.player_id;
            satrancData.roomCode = msg.room_code;
        }
        
        // Yeni modun lobi ekranına geç
        const modeToScreen = {
            "bil_bakalim": "lobby",
            "takim_bilmece": "takimLobby",
            "kim_milyoner": "mlLobby",
            "haritadan_bul": "haritaLobby",
            "gizemli_kariyer": "gizemLobby",
            "ilk_11_challenge": "ilk11Lobby",
            
            "sarkidan_bul": "sarkiLobby",
            "mini_futbol": "miniLobby",
            "jokerli_satranc": "satrancLobby"
        };
        const newScreen = modeToScreen[msg.new_mode];
        if (newScreen) {
            showScreen(newScreen);
        }
        // Toast göster
        const modeNames = {
            "bil_bakalim": "Bil Bakalım",
            "takim_bilmece": "Takım Bilmece",
            "kim_milyoner": "Kim Milyoner",
            "haritadan_bul": "Haritadan Bul",
            "gizemli_kariyer": "Gizemli Kariyer",
            "ilk_11_challenge": "İlk 11 Challenge",
            "sarkidan_bul": "🎵 Şarkıdan Bul",
            "mini_futbol": "⚽ Mini Futbol",
            "jokerli_satranc": "♟️ Jokerli Satranç"
        };
        showToast("🔄 Mod Değişti", `Yeni mod: ${modeNames[msg.new_mode] || msg.new_mode}`, null, "success");
        return;
    }
    _prevHandleForModChange(msg);
};

// ==========================================
// ✨ MOD DEĞİŞTİR HANDLER'LARI (Modlar için)
// ==========================================
window._pendingModeChangeCtx = window._pendingModeChangeCtx || null;
window._modeChangeHandlers = window._modeChangeHandlers || {};

window._modeChangeHandlers["bil_bakalim"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "bil_bakalim",
        createScreen: "create",
        returnScreen: modeToScreen[fromMode] || "lobby"
    };

    const savedName = (typeof myName === "string" && myName.trim())
        ? myName.trim()
        : (localStorage.getItem("playerName") || "");

    if (createNameInput) createNameInput.value = savedName;

    // ✨ Mod değişimi: isim kutusunu gizle (host zaten odada)
    if (createNameInput) {
        const nameBox = createNameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    // ✨ Buton yazısını değiştir
    if (createBtn) {
        createBtn.textContent = "✅ Modu Değiştir";
    }

    setMsg(createMsg, 'Bil Bakalım ayarlarını seç, sonra butona bas.', "#ffd43b");
    showScreen("create");

    console.log("[MODE CHANGE] Bil Bakalım create ekranı açıldı (isim gizlendi)");
    return true;
};

console.log("[MODE CHANGE] Bil Bakalım handler kayıt edildi ✓");

// ==========================================
// TAKIM BİLMECE handler
// ==========================================
window._modeChangeHandlers["takim_bilmece"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        "meme_arena": "memeLobby",
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "takim_bilmece",
        createScreen: "createTakim",
        returnScreen: modeToScreen[fromMode] || "takimLobby"
    };

    const nameInput = document.getElementById("createTakimNameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    const createBtnEl = document.getElementById("createTakimBtn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createTakimMsg");
    if (msgEl) {
        msgEl.textContent = 'Takım Bilmece ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createTakim");

    // ✨ Oyuncu sayısı kısıtlama (mevcut oda kaç kişi ise onun altına düşürtme)
    setTimeout(() => {
        const currentCount = window._getCurrentRoomPlayerCount();
        if (currentCount > 2) {
            window._applyMinPlayerLimit("takimMaxPlayersSelect", currentCount);
            const maxPlayersSelect = document.getElementById("takimMaxPlayersSelect");
            if (maxPlayersSelect) {
                maxPlayersSelect.dispatchEvent(new Event("change"));
            }
        }
    }, 100);

    console.log("[MODE CHANGE] Takım Bilmece create ekranı açıldı (isim gizlendi)");
    return true;
};

console.log("[MODE CHANGE] Takım Bilmece handler kayıt edildi ✓");

// ==========================================
// KİM MİLYONER handler
// ==========================================
window._modeChangeHandlers["kim_milyoner"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "kim_milyoner",
        createScreen: "createMl",
        returnScreen: modeToScreen[fromMode] || "mlLobby"
    };

    const nameInput = document.getElementById("createMlNameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    // ✨ Turnstile widget'ını gizle (host doğrulanmış)
    const turnstileBox = document.getElementById("mlTurnstileWidget");
    if (turnstileBox) {
        const box = turnstileBox.closest(".centerBox");
        if (box) box.style.display = "none";
    }

    const createBtnEl = document.getElementById("createMlBtn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createMlMsg");
    if (msgEl) {
        msgEl.textContent = 'Kim Milyoner ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createMl");

    // ✨ Oyuncu sayısı kısıtlama
    setTimeout(() => {
        const currentCount = window._getCurrentRoomPlayerCount();
        if (currentCount > 2) {
            window._applyMinPlayerLimit("mlMaxPlayersSelect", currentCount);
            const maxPlayersSelect = document.getElementById("mlMaxPlayersSelect");
            if (maxPlayersSelect) {
                maxPlayersSelect.dispatchEvent(new Event("change"));
            }
        }
    }, 100);

    console.log("[MODE CHANGE] Kim Milyoner create ekranı açıldı");
    return true;
};

console.log("[MODE CHANGE] Kim Milyoner handler kayıt edildi ✓");

// ==========================================
// HARİTADAN BUL handler
// ==========================================
window._modeChangeHandlers["haritadan_bul"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "haritadan_bul",
        createScreen: "createHarita",
        returnScreen: modeToScreen[fromMode] || "haritaLobby"
    };

    const nameInput = document.getElementById("createHaritaNameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    const createBtnEl = document.getElementById("createHaritaBtn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createHaritaMsg");
    if (msgEl) {
        msgEl.textContent = 'Haritadan Bul ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createHarita");

    // ✨ Oyuncu sayısı kısıtlama
    setTimeout(() => {
        const currentCount = window._getCurrentRoomPlayerCount();
        if (currentCount > 2) {
            window._applyMinPlayerLimit("haritaMaxPlayersSelect", currentCount);
            const maxPlayersSelect = document.getElementById("haritaMaxPlayersSelect");
            if (maxPlayersSelect) {
                maxPlayersSelect.dispatchEvent(new Event("change"));
            }
        }
    }, 100);

    console.log("[MODE CHANGE] Haritadan Bul create ekranı açıldı");
    return true;
};

console.log("[MODE CHANGE] Haritadan Bul handler kayıt edildi ✓");

// ==========================================
// GİZEMLİ KARİYER handler
// ==========================================
window._modeChangeHandlers["gizemli_kariyer"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "gizemli_kariyer",
        createScreen: "createGizem",
        returnScreen: modeToScreen[fromMode] || "gizemLobby"
    };

    const nameInput = document.getElementById("createGizemNameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    const createBtnEl = document.getElementById("createGizemBtn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createGizemMsg");
    if (msgEl) {
        msgEl.textContent = 'Gizemli Kariyer ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createGizem");

    // ✨ Oyuncu sayısı kısıtlama
    setTimeout(() => {
        const currentCount = window._getCurrentRoomPlayerCount();
        if (currentCount > 2) {
            window._applyMinPlayerLimit("gizemMaxPlayersSelect", currentCount);
            const maxPlayersSelect = document.getElementById("gizemMaxPlayersSelect");
            if (maxPlayersSelect) {
                maxPlayersSelect.dispatchEvent(new Event("change"));
            }
        }
    }, 100);

    console.log("[MODE CHANGE] Gizemli Kariyer create ekranı açıldı");
    return true;
};

console.log("[MODE CHANGE] Gizemli Kariyer handler kayıt edildi ✓");

// ==========================================
// İLK 11 CHALLENGE handler
// ==========================================
window._modeChangeHandlers["ilk_11_challenge"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "ilk_11_challenge",
        createScreen: "createIlk11",
        returnScreen: modeToScreen[fromMode] || "ilk11Lobby"
    };

    const nameInput = document.getElementById("createIlk11NameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    const createBtnEl = document.getElementById("createIlk11Btn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createIlk11Msg");
    if (msgEl) {
        msgEl.textContent = 'İlk 11 ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createIlk11");

    console.log("[MODE CHANGE] İlk 11 create ekranı açıldı");
    return true;
};

console.log("[MODE CHANGE] İlk 11 handler kayıt edildi ✓");



// ==========================================
// JOKERLİ SATRANÇ handler
// ==========================================
window._modeChangeHandlers["jokerli_satranc"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "jokerli_satranc",
        createScreen: "createSatranc",
        returnScreen: modeToScreen[fromMode] || "satrancLobby"
    };

    const nameInput = document.getElementById("createSatrancNameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    const createBtnEl = document.getElementById("createSatrancBtn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createSatrancMsg");
    if (msgEl) {
        msgEl.textContent = 'Jokerli Satranç ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createSatranc");

    console.log("[MODE CHANGE] Jokerli Satranç create ekranı açıldı");
    return true;
};

console.log("[MODE CHANGE] Jokerli Satranç handler kayıt edildi ✓");

// ==========================================
// MİNİ FUTBOL handler
// ==========================================
window._modeChangeHandlers["mini_futbol"] = function() {
    if (!_isCurrentHost()) return false;

    const fromMode = (typeof _currentActiveMode !== "undefined" && _currentActiveMode)
        ? _currentActiveMode
        : getCurrentMode();

    const modeToScreen = {
        "bil_bakalim": "lobby",
        "takim_bilmece": "takimLobby",
        "kim_milyoner": "mlLobby",
        "haritadan_bul": "haritaLobby",
        "gizemli_kariyer": "gizemLobby",
        "ilk_11_challenge": "ilk11Lobby",
        
        
        "sarkidan_bul": "sarkiLobby",
        "mini_futbol": "miniLobby",
        "jokerli_satranc": "satrancLobby"
    };

    window._pendingModeChangeCtx = {
        newMode: "mini_futbol",
        createScreen: "createMini",
        returnScreen: modeToScreen[fromMode] || "miniLobby"
    };

    const nameInput = document.getElementById("createMiniNameInput");
    if (nameInput) {
        const nameBox = nameInput.closest(".centerBox");
        if (nameBox) nameBox.style.display = "none";
    }

    const createBtnEl = document.getElementById("createMiniBtn");
    if (createBtnEl) createBtnEl.textContent = "✅ Modu Değiştir";

    const msgEl = document.getElementById("createMiniMsg");
    if (msgEl) {
        msgEl.textContent = 'Mini Futbol ayarlarını seç, sonra butona bas.';
        msgEl.style.color = "#ffd43b";
    }

    showScreen("createMini");

    // ✨ Oyuncu sayısı kısıtlama (Mini Futbol: oyuncu + izleyici toplamı hesaba katılmalı ama şimdilik sadece oyuncu)
    setTimeout(() => {
        const currentCount = window._getCurrentRoomPlayerCount();
        if (currentCount > 2) {
            // Mini Futbol için: value=2→1v1, value=4→2v2 vs.
            // currentCount 3 ise → 2v2 (value=4) veya üstü gerekir
            // currentCount 5 ise → 3v3 (value=6) veya üstü gerekir
            // Yani effective max = value / 1 (çünkü value oyuncu sayısını gösteriyor)
            window._applyMinPlayerLimit("miniPlayerCountSelect", currentCount, (v) => v);
        }
    }, 100);

    console.log("[MODE CHANGE] Mini Futbol create ekranı açıldı");
    return true;
};

console.log("[MODE CHANGE] Mini Futbol handler kayıt edildi ✓");
