let ws = null;

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
                          "stadGame", "stadLobby",
                          "memeGame", "memeLobby",
                          "miniGame", "miniLobby"];
    
    if (gameScreens.includes(current)) {
        e.preventDefault();
        e.returnValue = "";
    }
});

// ============ BAĞLANTI ============
function connectWS() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.onopen = () => { console.log("Bağlantı hazır."); };
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
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
function showScreen(screenName) {
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
    if (screenName === "join") joinScreen.classList.remove("hidden");
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
    // ✨ Ortak helper kullan (yeşil ###### + link ****** görünümü)
    if (window.setupRoomCodeAndLink && !window._bilBakalimRoomHelper) {
        window._bilBakalimRoomHelper = window.setupRoomCodeAndLink({
            codeTextId: "roomCodeText",
            codeEyeBtnId: "roomCodeEyeBtn",
            copyHintId: "copyHint",
            linkTextId: "inviteLinkText",
            linkEyeBtnId: "inviteLinkEyeBtn",
            linkHintId: "inviteLinkHint",
            getRoomCode: () => roomCode,
            getPlayerId: () => playerId
        });
    }
    if (window._bilBakalimRoomHelper) {
        window._bilBakalimRoomHelper.renderCode();
        window._bilBakalimRoomHelper.renderLink();
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

    if (playerId === 1 && players.length === 2) {
        startBtn.classList.remove("hidden");
        setMsg(lobbyMsg, "İki oyuncu hazır. Başlatabilirsin!", "#51cf66");
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
    // ✨ Pozisyon rengi
    const posColors = {"Kaleci":"#ffd43b","Defans":"#4dabf7","OrtaSaha":"#51cf66","Orta Saha":"#51cf66","Forvet":"#ff6b6b"};
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
                setMsg(selectMsg, `Seçimin: ${f.name} ✓`);
                renderSelectGrid();
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
function applyElimination(questionIndex, answer) {
    const q = questions[questionIndex];
    const key = q[1];
    const value = q[2];
    for (let i = 0; i < footballers.length; i++) {
        if (eliminated[i]) continue;
        const match = footballers[i][key] === value;
        if (answer && !match) eliminated[i] = true;
        else if (!answer && match) eliminated[i] = true;
    }
    remaining[playerId] = eliminated.filter(x => !x).length;
    send({ type: "remaining_update", count: remaining[playerId] });
    renderGameGrid();
    updateTopBar();
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

function showAnswerToast(answer, remainingCount) {
    const toast = document.getElementById("answerToast");
    const text = document.getElementById("answerToastText");
    if (!toast || !text) return;

    if (answerToastTimeout) clearTimeout(answerToastTimeout);

    toast.classList.remove("hidden", "hiding", "yes", "no");
    if (answer) {
        toast.classList.add("yes");
        text.textContent = `✅ EVET (kalan: ${remainingCount})`;
    } else {
        toast.classList.add("no");
        text.textContent = `❌ HAYIR (kalan: ${remainingCount})`;
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
        gameOverTitle.textContent = "KAZANDIN! 🏆";
        gameOverTitle.classList.add("win");
        startConfetti();
    } else {
        gameOverTitle.textContent = "KAYBETTİN 😢";
        gameOverTitle.classList.add("lose");
    }

    const mySecretIndex = msg.reveal[String(playerId)];
    const oppSecretIndex = msg.reveal[String(otherId)];
    const mySecretName = mySecretIndex != null ? footballers[mySecretIndex].name : "?";
    const oppSecretName = oppSecretIndex != null ? footballers[oppSecretIndex].name : "?";

    let extra = "";
    if (msg.wrong_guess) {
        if (msg.loser_id === playerId) {
            extra = `<p style="color:#ff6b6b; font-size:18px; margin-top:15px;"><b>YANLIŞ TAHMİN!</b><br>Tahmin ettiğin: <b>${msg.guessed_name}</b></p>`;
        } else {
            extra = `<p style="color:#51cf66; font-size:18px; margin-top:15px;"><b>Rakip yanlış tahmin etti!</b><br>Tahmin ettiği: <b>${msg.guessed_name}</b></p>`;
        }
    }

    gameOverText.innerHTML = `
        ${extra}
        <p style="margin-top:20px;">Senin futbolcun: <b style="color:#51cf66;">${mySecretName}</b></p>
        <p>Rakibin futbolcusu: <b style="color:#ff6b6b;">${oppSecretName}</b></p>
        <p style="margin-top:15px; font-size:22px;">Skor: <b>${scores[playerId]} - ${scores[otherId]}</b></p>
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
    currentTurn = null;
    guessMode = false;
    remaining = { 1: 32, 2: 32 };
    gameOver = false;
    pendingAnswer = null;
    waitingForAnswer = false;
    gameOverBox.classList.add("hidden");
    logBox.innerHTML = "";
    setMsg(gameMsg, "");
    setMsg(selectMsg, "");
    hideAnswerPanel();
    stopTimer();
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
                infoBox.textContent = msg.mode_name || msg.mode;
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
        const name = joinNameInput.value.trim();
        const code = msg.room_code;
        if (msg.mode === "takim_bilmece") {
            send({ type: "takim_join_room", name: name, room_code: code });
        } else if (msg.mode === "kim_milyoner") {
            send({ type: "ml_join_room", name: name, room_code: code });
        } else if (msg.mode === "haritadan_bul") {
            send({ type: "harita_join_room", name: name, room_code: code });
        } else if (msg.mode === "gizemli_kariyer") {
            send({ type: "gizem_join_room", name: name, room_code: code });
        } else if (msg.mode === "ilk_11_challenge") {
            send({ type: "ilk11_join_room", name: name, room_code: code });
        } else if (msg.mode === "stadyum_tanima") {
            send({ type: "stad_join_room", name: name, room_code: code });
        } else if (msg.mode === "meme_arena") {
            send({ type: "meme_join_room", name: name, room_code: code });
        } else if (msg.mode === "mini_futbol") {
            send({ type: "mini_join_room", name: name, room_code: code });
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }

    if (msg.type === "room_created") {
        playerId = msg.player_id;
        roomCode = msg.room_code;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
        inRoom = true;
        showScreen("lobby");
        updateLobby();
        return;
    }

    if (msg.type === "room_joined") {
        playerId = msg.player_id;
        roomCode = msg.room_code;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
        inRoom = true;
        showScreen("lobby");
        updateLobby();
        return;
    }

    if (msg.type === "lobby_update") {
        roomCode = msg.room_code;
        players = msg.players;
        turnSeconds = msg.turn_seconds || 45;
        guessLimit = msg.guess_limit || 0;
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
        addLog("Yeni tur başladı.", "info");
        startTimer(turnSeconds, selectTimer);
        return;
    }

    if (msg.type === "selection_status") {
        if (msg.selected_count < 2) setMsg(selectMsg, `Hazır oyuncu: ${msg.selected_count}/2`);
        else setMsg(selectMsg, "İki oyuncu da seçti. Oyun başlıyor...");
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
            addLog("Sıra sende.", "mine");
            
            // OTOMATIK TAHMİN: Eğer sadece 1 futbolcu kaldıysa otomatik tahmin et
            const remainingIndices = [];
            for (let i = 0; i < eliminated.length; i++) {
                if (!eliminated[i]) remainingIndices.push(i);
            }
            
            if (remainingIndices.length === 1) {
                const lastIndex = remainingIndices[0];
                const lastFootballer = footballers[lastIndex];
                setMsg(gameMsg, `🎯 Son futbolcu: ${lastFootballer.name} - Otomatik tahmin!`, "#ffd43b");
                addLog(`Son futbolcu kaldı: ${lastFootballer.name}`, "info");
                
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
        if (msg.player_id === playerId) addLog("Sürenden geçti! Sıra rakibe.", "info");
        else addLog(`${getPlayerNameById(msg.player_id)} süresini kaçırdı.`, "info");
        return;
    }

    if (msg.type === "answer_prompt") {
        const qText = questions[msg.question_index][0];
        addLog(`${msg.asker_name} sordu: ${qText}`, "opp");
        showAnswerPanel(msg.question_index, msg.correct_answer);
        startTimer(turnSeconds, gameTimer);
        return;
    }

    if (msg.type === "waiting_for_answer") {
        const qText = questions[msg.question_index][0];
        setMsg(gameMsg, `${msg.opponent_name} cevap veriyor...`, "#ffa94d");
        addLog(`Sordun: ${qText}`, "mine");
        waitingForAnswer = true;
        renderQuestions();
        updateGuessModeButton();
        startTimer(turnSeconds, gameTimer);
        return;
    }

    if (msg.type === "answer_sent") {
        hideAnswerPanel();
        const ansText = msg.answer ? "EVET" : "HAYIR";
        addLog(`Cevap gönderildi: ${ansText}${msg.auto ? " (otomatik)" : ""}`, "mine");
        // Sol alt cevap bildirimi (kendi ekranımda göster)
        const myRemaining = remaining[playerId] || 0;
        showAnswerToast(msg.answer, myRemaining);
        return;
    }

    if (msg.type === "answer_result") {
        const qText = questions[msg.question_index][0];
        const ansText = msg.answer ? "EVET" : "HAYIR";
        addLog(`${qText} → ${ansText}${msg.auto ? " (otomatik)" : ""}`, "info");
        setMsg(gameMsg, `Cevap: ${ansText}`, msg.answer ? "#51cf66" : "#ff6b6b");
        applyElimination(msg.question_index, msg.answer);
        waitingForAnswer = false;
        updateGuessModeButton();
        // Sol alt cevap bildirimi
        const myRemaining = remaining[playerId] || 0;
        showAnswerToast(msg.answer, myRemaining);
        return;
    }

    if (msg.type === "remaining_update") {
        remaining[msg.player_id] = msg.count;
        updateTopBar();
        return;
    }

    if (msg.type === "game_over") {
        scores = msg.scores;
        updateTopBar();
        openGameOver(msg);
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
        if (msg.guesser_id === playerId) {
            const remainingText = guessLimit === 0 ? "Sıra rakibe geçti." : `Kalan hakkın: ${guessesLeft[playerId]}`;
            setMsg(gameMsg, `❌ Yanlış tahmin! ${remainingText}`, "#ff6b6b");
            addLog(`Yanlış tahmin: ${msg.guessed_name}`, "mine");
            showToast("❌ Yanlış Tahmin!", `Tahmin ettiğin: ${msg.guessed_name}`, msg.guessed_img);
        } else {
            addLog(`${msg.guesser_name} yanlış tahmin: ${msg.guessed_name}`, "opp");
            showToast("❌ Rakip Yanlış Tahmin Etti!", `${msg.guesser_name} tahmin ettiği: ${msg.guessed_name}`, msg.guessed_img);
        }
        updateTopBar();
        return;
    }
	
	// ✨ Rakip oyun içinde ayrıldı → lobiye dön (oda açık)
    if (msg.type === "opponent_left_to_lobby") {
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
        else if (current.includes("stad")) showScreen("stadLobby");
        else if (current.includes("meme")) showScreen("memeLobby");
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
                              "gizemLobby", "ilk11Lobby", "stadLobby", "memeLobby"];
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
        // Rakip lobbyden ayrıldı ama oda açık kaldı
        showToast("👋 Oyuncu Ayrıldı", msg.message, null);
    }

    if (msg.type === "you_were_kicked") {
        // Sen atıldın — anında katıl ekranına git + toast göster
        inRoom = false;
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        if (ws) { try { ws.close(); } catch(e) {} }
        connectWS();
        showScreen("join");
        showToast("⚠️ Odadan Atıldınız!", msg.message || "Host tarafından odadan çıkarıldınız.", null);
        return;
    }

    if (msg.type === "player_kicked") {
        // Başka bir oyuncu atıldı
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
menuJoinCard.onclick = () => { showScreen("join"); joinNameInput.focus(); };
createBackBtn.onclick = () => { showScreen("modselect"); };
document.getElementById("modSelectBackBtn").onclick = () => { showScreen("home"); };

document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    card.addEventListener("click", () => {
        const mod = card.dataset.mod;
        if (mod === "bil_bakalim") {
            showScreen("create");
            createNameInput.focus();
        } else if (mod === "takim_bilmece") {
            showScreen("createTakim");
            document.getElementById("createTakimNameInput").focus();
        }
        // Diğer modlar kendi JS dosyalarında handle ediyor (wrap sistemi)
    });
});

const takimDifficultySelect = document.getElementById("takimDifficultySelect");
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

document.getElementById("createTakimBackBtn").onclick = () => { showScreen("modselect"); };
joinBackBtn.onclick = () => { showScreen("home"); };

createBtn.onclick = () => {
    myName = createNameInput.value.trim();
    if (!myName) { setMsg(createMsg, "İsim gir.", "#ff6b6b"); return; }
    localStorage.setItem("playerName", myName);
    const selectedSeconds = parseInt(turnSecondsSelect.value) || 45;
    const selectedGuessLimit = parseInt(guessLimitSelect.value) || 0;
    send({ type: "create_room", name: myName, turn_seconds: selectedSeconds, guess_limit: selectedGuessLimit });
};

joinBtn.onclick = () => {
    myName = joinNameInput.value.trim();
    const code = roomInput.value.trim().toUpperCase();
    if (!myName) { setMsg(joinMsg, "İsim gir.", "#ff6b6b"); return; }
    if (!code) { setMsg(joinMsg, "Oda kodu gir.", "#ff6b6b"); return; }
    localStorage.setItem("playerName", myName);
    send({ type: "query_room_mode", room_code: code });
};

startBtn.onclick = () => { send({ type: "start_game" }); };

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
joinNameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") roomInput.focus(); });
roomInput.addEventListener("keypress", (e) => { if (e.key === "Enter") joinBtn.click(); });

// Oda kodu yazılınca otomatik mod bilgisi getir
let joinModeQueryTimer = null;
roomInput.addEventListener("input", () => {
    const code = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (roomInput.value !== code) roomInput.value = code;

    const infoBox = document.getElementById("joinRoomModeInfo");
    if (!infoBox) return;

    if (code.length < 6) {
        infoBox.textContent = "";
        infoBox.classList.remove("show", "error", "loading");
        return;
    }

    if (joinModeQueryTimer) clearTimeout(joinModeQueryTimer);

    infoBox.textContent = "";
    infoBox.classList.remove("error", "show", "loading");

    joinModeQueryTimer = setTimeout(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "query_room_mode_check", room_code: code }));
    }, 350);
});

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
        "createStad": "createStadScreen",
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
        "stadLobby": "stadLobbyScreen",
        "stadGame": "stadGameScreen",
        "createMeme": "createMemeScreen",
        "memeLobby": "memeLobbyScreen",
        "memeGame": "memeGameScreen",
        "createMini": "createMiniScreen",
        "miniLobby": "miniLobbyScreen",
        "miniGame": "miniGameScreen"
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
                          "stadGame", "stadLobby",
                          "memeGame", "memeLobby",
                          "miniGame", "miniLobby"];
    if (gameScreens.includes(current)) return null;
    
    // Oda oluştur ekranlarından modselect'e
    const createScreens = ["create", "createTakim", "createMl",
                           "createHarita", "createGizem",
                           "createIlk11", "createStad", "createMeme",
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
                          "gizemLobby", "ilk11Lobby", "stadLobby", 
                          "memeLobby", "miniLobby"];
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
    if (typeof stadData !== "undefined" && stadData.playerId === 1) return true;
    if (typeof memeData !== "undefined" && memeData.playerId === 1) return true;
    if (typeof miniData !== "undefined" && miniData.playerId === 1) return true;
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
    if (current.startsWith("stad")) return "stad";
    if (current.startsWith("meme")) return "meme";
    if (current.startsWith("mini")) return "mini";
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
        const wasHost = _isCurrentHost();
        inRoom = false;
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
                              "stadGame", "stadLobby",
                              "memeGame", "memeLobby",
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
                          "gizemLobby", "ilk11Lobby", "stadLobby",
                          "memeLobby", "miniLobby"];
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
                          "stadGame",
                          "memeGame"];
    
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

// URL'de ?join=XXXX varsa otomatik oda kod inputuna doldur
const urlParams = new URLSearchParams(window.location.search);
const joinCode = urlParams.get("join");
if (joinCode) {
    showScreen("join");
    setTimeout(() => {
        roomInput.value = joinCode.toUpperCase();
        joinNameInput.focus();
        // Input event tetikle ki mod sorgusu gitsin
        roomInput.dispatchEvent(new Event("input"));
    }, 100);
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
            if (!wasHost && typeof stadData !== "undefined" && stadData.playerId === 1) wasHost = true;
            if (!wasHost && typeof memeData !== "undefined" && memeData.playerId === 1) wasHost = true;
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
    try {
        window.history.pushState({ screen: screenName }, "", "");
    } catch (e) {}
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
                          "stadGame", "stadLobby",
                          "memeGame", "memeLobby",
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
                           "createIlk11", "createStad", "createMeme",
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
        html += `<div style="margin-bottom:20px;" id="settingsGroup_${field.id}"${disableOnAdv}>
            <label style="display:block; color:#ffd43b; font-weight:bold; margin-bottom:8px;">
                ${field.label}:
            </label>
            <select id="settingsField_${field.id}" style="width:100%; padding:12px; font-size:16px;">`;
        
        field.options.forEach(opt => {
            const selected = String(opt.value) == String(field.current) ? "selected" : "";
            html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        });
        
        html += `</select></div>`;
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
            send({
                type: "update_room_settings",
                turn_seconds: parseInt(values.turnSec) || 45,
                guess_limit: parseInt(values.guessLimit) || 0
            });
        }
    });
}

// Bil Bakalım buton olayı
document.getElementById("roomSettingsBtn").onclick = () => {
    openRoomSettings();
};