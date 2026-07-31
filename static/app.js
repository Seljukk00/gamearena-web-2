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
// beforeunload kaldırıldı - ESC popup zaten var

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
        alert("Sunucu bağlantısı yok. Sayfayı yenile.");
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
    // Oda kodu gizliyse ••••••, değilse kod göster
    if (roomCodeText.classList.contains("hiddenCode")) {
        roomCodeText.textContent = "••••••";
    } else {
        roomCodeText.textContent = roomCode;
    }
    updateInviteLink();
    lobbyTurnSeconds.textContent = turnSeconds;
    lobbyGuessLimit.textContent = guessLimit === 0 ? "Sınırsız" : guessLimit;
    playersList.innerHTML = "";

    players.forEach(p => {
        const li = document.createElement("li");
        li.classList.add("playerRow");

        // 1. Sütun: Kick butonu (× veya boş)
        const kickCell = document.createElement("span");
        kickCell.className = "kickCell";
        if (p.id !== playerId && playerId === 1) {
            const kickBtn = document.createElement("span");
            kickBtn.className = "kickBtn";
            kickBtn.textContent = "×";
            kickBtn.title = "Oyuncuyu at";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            kickCell.appendChild(kickBtn);
        }
        li.appendChild(kickCell);

        // 2. Sütun: Sayı
        const numCell = document.createElement("span");
        numCell.className = "numCell";
        numCell.textContent = p.id;
        li.appendChild(numCell);

        // 3. Sütun: Ayraç
        const dashCell = document.createElement("span");
        dashCell.className = "dashCell";
        dashCell.textContent = "-";
        li.appendChild(dashCell);

        // 4. Sütun: İsim
        const nameCell = document.createElement("span");
        nameCell.className = "nameCell";
        nameCell.textContent = p.id === playerId ? `${p.name} (Sen)` : p.name;
        li.appendChild(nameCell);

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

    const meta2 = document.createElement("div");
    meta2.className = "meta";
    meta2.textContent = f.league;

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
    if (msg.type === "error") { alert(msg.message); return; }

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

    if (msg.type === "opponent_left") {
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
        // Sen atıldın
        inRoom = false;
        alert("⚠️ Odadan atıldın!");
        location.reload();
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
    });
});

const takimDifficultySelect = document.getElementById("takimDifficultySelect");
const jokerData = {
    kolay: { name: 3, year: 3, elim: 3, pass: 3, title: "🟢 KOLAY - Jokerler" },
    orta:  { name: 2, year: 2, elim: 2, pass: 1, title: "🟡 ORTA - Jokerler" },
    zor:   { name: 1, year: 0, elim: 1, pass: 0, title: "🔴 ZOR - Jokerler" }
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
    setMsg(joinMsg, "Odaya bağlanıyor...", "#ffd43b");
    send({ type: "query_room_mode", room_code: code });
};

startBtn.onclick = () => { send({ type: "start_game" }); };

lobbyLeaveBtn.onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        inRoom = false;
        if (ws) ws.close();
        location.reload();
    }
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
    if (confirm("Ana menüye dönmek istediğine emin misin? Oda kapanacak.")) {
        inRoom = false;
        if (ws) ws.close();
        location.reload();
    }
};

opponentLeftOkBtn.onclick = () => { location.reload(); };

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
        "stadGame": "stadGameScreen"
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
                          "stadGame", "stadLobby"];
    if (gameScreens.includes(current)) return null;
    
    // Oda oluştur ekranlarından modselect'e
    const createScreens = ["create", "createTakim", "createMl",
                           "createHarita", "createGizem",
                           "createIlk11", "createStad"];
    if (createScreens.includes(current)) return "modselect";
    
    if (current === "join") return "home";
    if (current === "modselect") return "home";
    
    return null;
}

function showEscPopup() {
    document.getElementById("escConfirmBox").classList.remove("hidden");
}

function closeEscPopup() {
    const card = document.querySelector("#escConfirmBox .escConfirmCard");
    card.classList.add("closing");
    setTimeout(() => {
        document.getElementById("escConfirmBox").classList.add("hidden");
        card.classList.remove("closing");
    }, 300);
}

document.getElementById("escYesBtn").onclick = () => {
    // Odayı kapat ve mod seçime dön
    inRoom = false;
    if (ws) {
        try { ws.close(); } catch(e) {}
    }
    closeEscPopup();
    setTimeout(() => {
        connectWS();
        showScreen("modselect");
    }, 300);
};

document.getElementById("escNoBtn").onclick = () => {
    closeEscPopup();
};

// ESC tuşu
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    
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
    
    const current = getCurrentScreen();
    if (current === "home") return;
    
    // Oyun/lobby ekranlarında popup göster
    const gameScreens = ["game", "select", "lobby",
                          "mlGame", "mlLobby",
                          "takimGame", "takimLobby",
                          "haritaGame", "haritaLobby",
                          "gizemGame", "gizemLobby",
                          "ilk11Game", "ilk11Lobby",
                          "stadGame", "stadLobby"];
    
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
    
    // Oda kodu render
    function renderCode() {
        if (codeText.classList.contains("hiddenCode")) {
            codeText.textContent = "######";
        } else {
            codeText.textContent = getCode();
        }
    }
    
    // Link render
    function renderLink() {
        if (!linkText) return;
        const isHidden = localStorage.getItem("hideInviteLink") === "true";
        if (isHidden) {
            linkText.classList.add("hiddenLink");
            linkText.textContent = "########################";
        } else {
            linkText.classList.remove("hiddenLink");
            linkText.textContent = getLink();
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

// ESC Popup - EVET butonu (mod seçime dönsün)
setTimeout(() => {
    const escYes = document.getElementById("escYesBtn");
    if (escYes) {
        escYes.onclick = () => {
            inRoom = false;
            if (ws) {
                try { ws.close(); } catch(e) {}
            }
            closeEscPopup();
            setTimeout(() => {
                connectWS();
                showScreen("modselect");
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
                          "stadGame", "stadLobby"];

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
                           "createIlk11", "createStad"];
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
    // Kullanıcı çıkmak istedi - odayı kapat ve mod seçime dön
    inRoom = false;
    if (ws) {
        try { ws.close(); } catch(e) {}
    }
    closeBackConfirmPopup();
    // Yeni WebSocket bağlantısı kur (eski oda kapansın diye)
    setTimeout(() => {
        connectWS();
        showScreen("modselect");
    }, 300);
};

document.getElementById("backNoBtn").onclick = () => {
    closeBackConfirmPopup();
};