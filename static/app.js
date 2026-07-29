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
let guessLimit = 0; // 0 = sınırsız
let guessesLeft = { 1: 0, 2: 0 };
let waitingForAnswer = false; // Soru sordum, cevap bekliyorum

// Timer
let timerInterval = null;
let timerRemaining = 0;
let timerElement = null;

// Tooltip
let tooltipTimer = null;
let tooltipVisible = false;

// Onay popup callback
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

window.addEventListener("beforeunload", (e) => {
    if (inRoom) {
        e.preventDefault();
        e.returnValue = "Odadan çıkmak istediğine emin misin?";
        return "Odadan çıkmak istediğine emin misin?";
    }
});

// ============ BAĞLANTI ============

function connectWS() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.onopen = () => {
        console.log("Bağlantı hazır.");
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onclose = () => {
        console.log("Bağlantı kapandı.");
    };
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
        if (timerRemaining <= 0) {
            stopTimer();
        }
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
    if (timerRemaining <= 10) {
        timerElement.classList.add("warning");
    } else {
        timerElement.classList.remove("warning");
    }
}

// ============ LOBBY ============

function updateLobby() {
    roomCodeText.textContent = roomCode;
    lobbyTurnSeconds.textContent = turnSeconds;
    lobbyGuessLimit.textContent = guessLimit === 0 ? "Sınırsız" : guessLimit;
    playersList.innerHTML = "";

    players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
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

    footballers.forEach((f, index) => {
        const card = createCard(f, index, "select");
        if (index === mySelection && selectionConfirmed) {
            card.classList.add("mysecret");
        }
        selectGrid.appendChild(card);
    });
}

// ============ OYUN EKRANI ============

function renderGameGrid() {
    gameGrid.innerHTML = "";

    footballers.forEach((f, index) => {
        const card = createCard(f, index, "game");

        if (eliminated[index]) {
            card.classList.add("eliminated");

            const x = document.createElement("div");
            x.className = "overlayX";
            x.textContent = "X";
            card.appendChild(x);
        }

        if (index === mySelection) {
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

    // TOOLTIP - Hover 0.5 saniye
    card.addEventListener("mouseenter", (e) => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => {
            showTooltip(f, e);
        }, 500);
    });

    card.addEventListener("mousemove", (e) => {
        if (tooltipVisible) {
            positionTooltip(e);
        }
    });

    card.addEventListener("mouseleave", () => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        hideTooltip();
    });

    if (mode === "select") {
        card.onclick = () => {
            if (selectionConfirmed) return;
            openConfirmBox(
                "Gizli Futbolcunu Seç",
                f,
                `${f.name} adlı futbolcuyu seçmek istediğine emin misin?`,
                () => {
                    mySelection = index;
                    selectionConfirmed = true;
                    setMsg(selectMsg, `Seçimin: ${f.name} ✓`);
                    renderSelectGrid();
                    send({
                        type: "select_secret",
                        index: index
                    });
                }
            );
        };
    }

    if (mode === "game") {
        // Çift tıklama - direkt tahmin
        card.ondblclick = () => {
            if (gameOver) return;
            if (currentTurn !== playerId) {
                setMsg(gameMsg, "Sıra sende değil!", "#ff6b6b");
                return;
            }
            if (waitingForAnswer) {
                setMsg(gameMsg, "Cevap bekleniyor, tıklayamazsın!", "#ff6b6b");
                return;
            }
            if (eliminated[index]) return;

            openConfirmBox(
                "Tahmin",
                f,
                `${f.name} adlı futbolcuyu tahmin etmek istediğine emin misin?`,
                () => {
                    send({
                        type: "guess",
                        index: index
                    });
                    guessMode = false;
                    updateGuessModeButton();
                }
            );
        };

        // Tek tıklama - tahmin modu varsa
        card.onclick = () => {
            if (gameOver) return;
            if (!guessMode) return;
            if (currentTurn !== playerId) return;
            if (waitingForAnswer) {
                setMsg(gameMsg, "Cevap bekleniyor, tıklayamazsın!", "#ff6b6b");
                return;
            }
            if (eliminated[index]) return;

            openConfirmBox(
                "Tahmin",
                f,
                `${f.name} adlı futbolcuyu tahmin etmek istediğine emin misin?`,
                () => {
                    send({
                        type: "guess",
                        index: index
                    });
                    guessMode = false;
                    updateGuessModeButton();
                }
            );
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
        ["young", "Genç"],
        ["over30", "30+ Yaş"],
        ["beard", "Sakallı"],
        ["blonde", "Sarışın"],
        ["bald", "Kel"],
        ["headband", "Saç Bandı"],
        ["tattoo", "Dövmesi Var"],
        ["ballondor", "Ballon d'Or"],
        ["goals100", "100+ Gol"],
        ["ucl", "S.Ligi Kazandı"],
        ["worldcup", "D.Kupası Kazandı"],
        ["captain", "Kaptan"],
        ["leftfoot", "Sol Ayak"],
        ["europe", "Avrupa Ligi"],
        ["superlig", "SüperLig Geçmişi"],
        ["african", "Afrikalı"],
        ["number10", "10 Numara"],
        ["number9", "9 Numara"],
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

        const disabled = currentTurn !== playerId || gameOver || guessMode || waitingForAnswer;
        btn.disabled = disabled;

        btn.onclick = () => {
            if (waitingForAnswer) return;
            // Soruyu gönder ve bekleme moduna geç
            waitingForAnswer = true;
            renderQuestions();
            updateGuessModeButton();
            send({
                type: "ask_question",
                question_index: qi
            });
        };

        questionsBox.appendChild(btn);
    });
}

// ============ TOP BAR ============

function updateTopBar() {
    const otherId = getOtherPlayerId();
    const myNameText = getPlayerNameById(playerId);
    const otherNameText = getPlayerNameById(otherId);

    if (currentTurn === playerId) {
        turnText.innerHTML = `<span class="turnMine">Sıra: SENDE</span>`;
    } else {
        turnText.innerHTML = `<span class="turnOpp">Sıra: RAKİPTE</span>`;
    }

    scoreText.innerHTML = `Skor: <span class="scoreMine">${myNameText} ${scores[playerId] || 0}</span> - <span class="scoreOpp">${scores[otherId] || 0} ${otherNameText}</span>`;

    remainText.innerHTML = `Kalan: <span class="remainMine">Sen ${remaining[playerId] || 32}</span> / <span class="remainOpp">Rakip ${remaining[otherId] || 32}</span>`;

    updateGuessLeftDisplay();
}

function updateGuessLeftDisplay() {
    if (!guessLeftText) return;

    guessLeftText.classList.remove("unlimited", "safe", "warning", "danger");

    if (guessLimit === 0) {
        // Sınırsız
        guessLeftText.textContent = "∞ Sınırsız";
        guessLeftText.classList.add("unlimited");
    } else {
        const myLeft = guessesLeft[playerId] || 0;
        guessLeftText.textContent = `${myLeft} / ${guessLimit}`;

        // Renk mantığı
        // Toplam N hak varsa:
        // - Son 1 hep KIRMIZI
        // - Ortadaki(ler) SARI (toplam >= 3 ise ortada sarı var)
        // - Baştakiler YEŞİL

        if (guessLimit === 1) {
            // Sadece 1 hak - hep kırmızı
            guessLeftText.classList.add("danger");
        } else if (guessLimit === 2) {
            // 2 hak - 2 sarı, 1 kırmızı
            if (myLeft === 2) guessLeftText.classList.add("warning");
            else if (myLeft === 1) guessLeftText.classList.add("danger");
            else guessLeftText.classList.add("danger");
        } else {
            // 3+ hak
            if (myLeft <= 1) {
                guessLeftText.classList.add("danger");
            } else if (myLeft <= Math.ceil(guessLimit / 2)) {
                guessLeftText.classList.add("warning");
            } else {
                guessLeftText.classList.add("safe");
            }
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

        if (answer && !match) {
            eliminated[i] = true;
        } else if (!answer && match) {
            eliminated[i] = true;
        }
    }

    remaining[playerId] = eliminated.filter(x => !x).length;

    send({
        type: "remaining_update",
        count: remaining[playerId]
    });

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

confirmNoBtn.onclick = () => {
    closeConfirmBox();
};

// ============ CEVAP PANELI ============

function showAnswerPanel(questionIndex, correctAnswer) {
    pendingAnswer = {
        question_index: questionIndex,
        correct_answer: correctAnswer
    };

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

    answerPanel.classList.remove("hidden");
    setMsg(gameMsg, "Rakip soru sordu! Doğru cevaba tıkla.", "#ffa94d");
}

function hideAnswerPanel() {
    answerPanel.classList.add("hidden");
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

// ============ TOAST BİLDİRİM ============

function showToast(title, message, imageFile, type) {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    toastBox.classList.remove("hiding", "success");
    if (type === "success") {
        toastBox.classList.add("success");
    }

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

            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }
        });

        frame++;
        if (frame < maxFrames) {
            requestAnimationFrame(draw);
        } else {
            canvas.style.display = "none";
        }
    }

    draw();
}

// ============ OYUN SONU ============

function openGameOver(msg) {
    gameOver = true;
    stopTimer();
    hideAnswerPanel();

    // Rakip yanlış tahmin ettiyse, önce toast göster
    if (msg.wrong_guess && msg.loser_id !== playerId) {
        // Rakibin tahmin ettiği futbolcunun resmini bul
        let guessedImg = null;
        if (msg.guessed_name) {
            const found = footballers.find(f => f.name === msg.guessed_name);
            if (found) guessedImg = found.img_file || (found.img + ".webp");
        }
        showToast(
            "❌ Rakip Yanlış Tahmin Etti!",
            `${msg.guesser_name || "Rakip"} tahmin ettiği: ${msg.guessed_name}`,
            guessedImg
        );
    }

    setTimeout(() => {
        gameOverBox.classList.remove("hidden");
    }, 500);

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
            extra = `<p style="color:#ff6b6b; font-size:18px; margin-top:15px;">
                <b>YANLIŞ TAHMİN!</b><br>Tahmin ettiğin: <b>${msg.guessed_name}</b>
            </p>`;
        } else {
            extra = `<p style="color:#51cf66; font-size:18px; margin-top:15px;">
                <b>Rakip yanlış tahmin etti!</b><br>Tahmin ettiği: <b>${msg.guessed_name}</b>
            </p>`;
        }
    }

    gameOverText.innerHTML = `
        ${extra}
        <p style="margin-top:20px;">Senin futbolcun: <b style="color:#51cf66;">${mySecretName}</b></p>
        <p>Rakibin futbolcusu: <b style="color:#ff6b6b;">${oppSecretName}</b></p>
        <p style="margin-top:15px; font-size:22px;">Skor: <b>${scores[playerId]} - ${scores[otherId]}</b></p>
    `;

    if (playerId === 1) {
        newRoundBtn.classList.remove("hidden");
    } else {
        newRoundBtn.classList.add("hidden");
    }
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

// ============ MESAJ İŞLEME ============

function handleMessage(msg) {
    if (msg.type === "error") {
        alert(msg.message);
        return;
    }
	
	if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }
        const name = joinNameInput.value.trim();
        const code = msg.room_code;
        if (msg.mode === "takim_bilmece") {
            send({
                type: "takim_join_room",
                name: name,
                room_code: code
            });
        } else {
            send({
                type: "join_room",
                name: name,
                room_code: code
            });
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
        if (msg.selected_count < 2) {
            setMsg(selectMsg, `Hazır oyuncu: ${msg.selected_count}/2`);
        } else {
            setMsg(selectMsg, "İki oyuncu da seçti. Oyun başlıyor...");
        }
        return;
    }

    if (msg.type === "auto_selected") {
        if (!selectionConfirmed) {
            mySelection = msg.index;
            selectionConfirmed = true;
            setMsg(selectMsg, `Süre bitti! Otomatik seçildi: ${msg.name}`);
            renderSelectGrid();
            showToast(
                "⏰ Süre Bitti!",
                `Otomatik seçildi: ${msg.name}`,
                null,
                "success"
            );
        }
        return;
    }

    if (msg.type === "opponent_auto_selected") {
        showToast(
            "⏰ Rakip Seçemedi",
            `${msg.name} için otomatik seçim yapıldı`,
            null
        );
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
        waitingForAnswer = false; // Yeni tur başladı

        showScreen("game");
        renderGameGrid();
        renderQuestions();
        updateTopBar();
        updateGuessModeButton();
        hideAnswerPanel();

        if (currentTurn === playerId) {
            setMsg(gameMsg, "Senin sıran!", "#51cf66");
            addLog("Sıra sende.", "mine");
        } else {
            setMsg(gameMsg, "Rakip oynuyor...", "#ff6b6b");
        }

        startTimer(turnSeconds, gameTimer);
        return;
    }

    if (msg.type === "turn_timeout") {
        if (msg.player_id === playerId) {
            addLog("Sürenden geçti! Sıra rakibe.", "info");
        } else {
            addLog(`${getPlayerNameById(msg.player_id)} süresini kaçırdı.`, "info");
        }
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
        return;
    }

    if (msg.type === "answer_result") {
        const qText = questions[msg.question_index][0];
        const ansText = msg.answer ? "EVET" : "HAYIR";
        addLog(`${qText} → ${ansText}${msg.auto ? " (otomatik)" : ""}`, "info");
        setMsg(gameMsg, `Cevap: ${ansText}`, msg.answer ? "#51cf66" : "#ff6b6b");
        applyElimination(msg.question_index, msg.answer);
        waitingForAnswer = false; // Cevap geldi, bekleme bitti
        updateGuessModeButton();
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
        // Yanlış tahmin ama oyun devam
        if (msg.guesses_left) guessesLeft = msg.guesses_left;

        if (msg.guesser_id === playerId) {
            // Sen yanlış tahmin ettin
            const remainingText = guessLimit === 0
                ? "Sıra rakibe geçti."
                : `Kalan hakkın: ${guessesLeft[playerId]}`;
            setMsg(gameMsg, `❌ Yanlış tahmin! ${remainingText}`, "#ff6b6b");
            addLog(`Yanlış tahmin: ${msg.guessed_name}`, "mine");
            showToast(
                "❌ Yanlış Tahmin!",
                `Tahmin ettiğin: ${msg.guessed_name}`,
                msg.guessed_img
            );
        } else {
            // Rakip yanlış tahmin etti
            addLog(`${msg.guesser_name} yanlış tahmin: ${msg.guessed_name}`, "opp");
            showToast(
                "❌ Rakip Yanlış Tahmin Etti!",
                `${msg.guesser_name} tahmin ettiği: ${msg.guessed_name}`,
                msg.guessed_img
            );
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
        opponentLeftText.textContent = "Rakibin oyundan ayrıldı. Oda kapatıldı.";
        opponentLeftBox.classList.remove("hidden");
    }
}

// ============ BUTON İŞLEMLERİ ============

menuCreateCard.onclick = () => {
    showScreen("modselect");
};

menuJoinCard.onclick = () => {
    showScreen("join");
    joinNameInput.focus();
};

createBackBtn.onclick = () => {
    showScreen("modselect");
};

document.getElementById("modSelectBackBtn").onclick = () => {
    showScreen("home");
};

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

// Takım Bilmece - Zorluk değişince joker sayıları güncellensin
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

// Takım Bilmece geri butonu
document.getElementById("createTakimBackBtn").onclick = () => {
    showScreen("modselect");
};

// Takım Bilmece oda oluştur butonu (şimdilik uyarı verecek)
document.getElementById("createTakimBtn").onclick = () => {
    const name = document.getElementById("createTakimNameInput").value.trim();
    if (!name) {
        document.getElementById("createTakimMsg").textContent = "İsim gir.";
        document.getElementById("createTakimMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    alert("Takım Bilmece oyun kodu henüz yazılmadı. Bir sonraki adımda backend ekleyeceğiz.");
};

joinBackBtn.onclick = () => {
    showScreen("home");
};

createBtn.onclick = () => {
    myName = createNameInput.value.trim();
    if (!myName) {
        setMsg(createMsg, "İsim gir.", "#ff6b6b");
        return;
    }
    localStorage.setItem("playerName", myName);
    const selectedSeconds = parseInt(turnSecondsSelect.value) || 45;
    const selectedGuessLimit = parseInt(guessLimitSelect.value) || 0;
    send({
        type: "create_room",
        name: myName,
        turn_seconds: selectedSeconds,
        guess_limit: selectedGuessLimit
    });
};

joinBtn.onclick = () => {
    myName = joinNameInput.value.trim();
    const code = roomInput.value.trim().toUpperCase();

    if (!myName) {
        setMsg(joinMsg, "İsim gir.", "#ff6b6b");
        return;
    }
    if (!code) {
        setMsg(joinMsg, "Oda kodu gir.", "#ff6b6b");
        return;
    }
    localStorage.setItem("playerName", myName);
    
    // Önce oda hangi mod diye sor
    setMsg(joinMsg, "Odaya bağlanıyor...", "#ffd43b");
    send({
        type: "query_room_mode",
        room_code: code
    });
};

startBtn.onclick = () => {
    send({ type: "start_game" });
};

lobbyLeaveBtn.onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        inRoom = false;
        if (ws) ws.close();
        location.reload();
    }
};

guessModeBtn.onclick = () => {
    if (currentTurn !== playerId || gameOver) {
        setMsg(gameMsg, "Sıra sende değil!", "#ff6b6b");
        return;
    }
    if (waitingForAnswer) {
        setMsg(gameMsg, "Cevap bekleniyor, tıklayamazsın!", "#ff6b6b");
        return;
    }
    guessMode = !guessMode;
    updateGuessModeButton();
    renderQuestions();

    if (guessMode) {
        setMsg(gameMsg, "Tahmin modu açık. Bir karta tıkla veya çift tıkla.", "#ffd43b");
    } else {
        setMsg(gameMsg, "Tahmin modu kapalı.");
    }
};

newRoundBtn.onclick = () => {
    send({ type: "start_game" });
};

backToMenuBtn.onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin? Oda kapanacak.")) {
        inRoom = false;
        if (ws) ws.close();
        location.reload();
    }
};

opponentLeftOkBtn.onclick = () => {
    location.reload();
};

// Oda kodu kopyalama
roomCodeText.onclick = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
        copyHint.textContent = "✓ Kopyalandı!";
        copyHint.classList.add("show");
        setTimeout(() => {
            copyHint.classList.remove("show");
        }, 2000);
    }).catch(() => {
        const temp = document.createElement("textarea");
        temp.value = roomCode;
        document.body.appendChild(temp);
        temp.select();
        try {
            document.execCommand("copy");
            copyHint.textContent = "✓ Kopyalandı!";
            copyHint.classList.add("show");
            setTimeout(() => copyHint.classList.remove("show"), 2000);
        } catch (e) {}
        document.body.removeChild(temp);
    });
};

// Enter tuşu desteği
createNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") createBtn.click();
});

joinNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") roomInput.focus();
});

roomInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") joinBtn.click();
});

// Window resize
window.addEventListener("resize", () => {
    if (confettiCanvas.style.display === "block") {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
});

// Kaydedilmiş ismi getir
const savedName = localStorage.getItem("playerName");
if (savedName) {
    createNameInput.value = savedName;
    joinNameInput.value = savedName;
    document.getElementById("createTakimNameInput").value = savedName;
}

// ==========================================
// TAKIM BİLMECE - FRONTEND
// ==========================================

let takimData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    difficulty: "kolay",
    players: [],
    totalQuestions: 12,
    turnSeconds: 60,
    currentTurn: null,
    questionNo: 0,
    teamData: null,
    scores: { 1: 0, 2: 0 },
    jokersLeft: { 1: {}, 2: {} },
    revealedNames: { 1: {}, 2: {} },
    yearRevealed: { 1: false, 2: false },
    eliminatedOptions: { 1: [], 2: [] },
    answered: false,
    timerInterval: null,
    timerSeconds: 60
};

const takimLobbyScreen = document.getElementById("takimLobbyScreen");
const takimGameScreen = document.getElementById("takimGameScreen");

// showScreen'i genişlet
const originalShowScreen = showScreen;
showScreen = function(screenName) {
    homeScreen.classList.add("hidden");
    createScreen.classList.add("hidden");
    joinScreen.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    selectScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    modSelectScreen.classList.add("hidden");
    createTakimScreen.classList.add("hidden");
    takimLobbyScreen.classList.add("hidden");
    takimGameScreen.classList.add("hidden");

    if (screenName === "home") homeScreen.classList.remove("hidden");
    if (screenName === "create") createScreen.classList.remove("hidden");
    if (screenName === "join") joinScreen.classList.remove("hidden");
    if (screenName === "lobby") lobbyScreen.classList.remove("hidden");
    if (screenName === "select") selectScreen.classList.remove("hidden");
    if (screenName === "game") gameScreen.classList.remove("hidden");
    if (screenName === "modselect") modSelectScreen.classList.remove("hidden");
    if (screenName === "createTakim") createTakimScreen.classList.remove("hidden");
    if (screenName === "takimLobby") takimLobbyScreen.classList.remove("hidden");
    if (screenName === "takimGame") takimGameScreen.classList.remove("hidden");
};

// Oda oluştur butonu - GERÇEK backend
document.getElementById("createTakimBtn").onclick = () => {
    const name = document.getElementById("createTakimNameInput").value.trim();
    if (!name) {
        document.getElementById("createTakimMsg").textContent = "İsim gir.";
        document.getElementById("createTakimMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;
    
    const difficulty = document.getElementById("takimDifficultySelect").value;
    const turnSeconds = parseInt(document.getElementById("takimTurnSecondsSelect").value) || 60;
    send({
        type: "takim_create_room",
        name: name,
        difficulty: difficulty,
        turn_seconds: turnSeconds
    });
};

// Takım Bilmece odaya katıl - mod seçim ekranındaki karta ekleyecek
// (Aslında zaten "Odaya Katıl" ekranı ortak, tek bir ekran)

// ==== TAKIM LOBBY BUTONLARI ====
document.getElementById("takimStartBtn").onclick = () => {
    send({ type: "takim_start_game" });
};

document.getElementById("takimLobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        takimData.inGame = false;
        inRoom = false;
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("takimRoomCodeText").onclick = () => {
    navigator.clipboard.writeText(takimData.roomCode).then(() => {
        const hint = document.getElementById("takimCopyHint");
        hint.textContent = "✓ Kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

// ==== TAKIM GERİ BUTON ====
document.getElementById("takimBackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin? Oyundan çıkacaksın.")) {
        takimData.inGame = false;
        inRoom = false;
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("takimBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("takimRematchBtn").onclick = () => {
    document.getElementById("takimGameOverBox").classList.add("hidden");
    send({ type: "takim_rematch" });
};

// ==== TAKIM JOKER BUTONLARI ====
document.getElementById("takimJokerNameBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    
    if (takimPickPlayerMode) {
        // Zaten açık, iptal et
        cancelNameJoker();
        return;
    }
    
    // Backend'e "başladım" de - hemen sayı düşecek
    send({ type: "takim_joker_name_start" });
    
    takimPickPlayerMode = true;
    updateTakimStatus("Bir oyuncuya tıkla ismi görün");
    document.getElementById("takimJokerCancelBtn").classList.remove("hidden");
    renderTakimField();
    renderTakimOptions(); // Şıkları kilitle
};

function cancelNameJoker() {
    send({ type: "takim_joker_name_cancel" });
    takimPickPlayerMode = false;
    updateTakimStatus("");
    document.getElementById("takimJokerCancelBtn").classList.add("hidden");
    renderTakimField();
    renderTakimOptions(); // Şıkları aç
}

document.getElementById("takimJokerCancelBtn").onclick = () => {
    cancelNameJoker();
};

document.getElementById("takimJokerYearBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    send({ type: "takim_joker_year" });
};

document.getElementById("takimJokerElimBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    send({ type: "takim_joker_elim" });
};

document.getElementById("takimJokerPassBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    document.getElementById("takimPassConfirmBox").classList.remove("hidden");
};

document.getElementById("takimPassYesBtn").onclick = () => {
    document.getElementById("takimPassConfirmBox").classList.add("hidden");
    send({ type: "takim_joker_pass" });
};

document.getElementById("takimPassNoBtn").onclick = () => {
    document.getElementById("takimPassConfirmBox").classList.add("hidden");
};

let takimPickPlayerMode = false;

// ==== TAKIM CEVAP BUTONLARI ====
document.querySelectorAll(".takimOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
        const choice = parseInt(btn.dataset.choice);
        if (takimData.eliminatedOptions[takimData.playerId].includes(choice)) return;
        send({ type: "takim_answer", choice: choice });
    };
});

// ==========================================
// TAKIM BİLMECE - Yardımcı Fonksiyonlar
// ==========================================

function updateTakimStatus(text, color) {
    const el = document.getElementById("takimStatusMsg");
    el.textContent = text || "";
    el.style.color = color || "#ffa94d";
}

function updateTakimLobby() {
    document.getElementById("takimRoomCodeText").textContent = takimData.roomCode;
    const diffNames = { kolay: "🟢 Kolay", orta: "🟡 Orta", zor: "🔴 Zor" };
    document.getElementById("takimLobbyDifficulty").textContent = diffNames[takimData.difficulty] || takimData.difficulty;
    document.getElementById("takimLobbyTurnSeconds").textContent = takimData.turnSeconds || 60;
    
    const list = document.getElementById("takimPlayersList");
    list.innerHTML = "";
    takimData.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === takimData.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    
    const startBtn = document.getElementById("takimStartBtn");
    const msg = document.getElementById("takimLobbyMsg");
    
    if (takimData.playerId === 1 && takimData.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (takimData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

function getTakimOtherPlayerId() {
    return takimData.playerId === 1 ? 2 : 1;
}

function getTakimPlayerName(id) {
    const p = takimData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function renderTakimField() {
    const field = document.getElementById("takimField");
    field.innerHTML = "";
    
    if (!takimData.teamData) return;
    const players = takimData.teamData.players;
    
    // Pozisyonlara göre grupla
    const gk = [], defs = [], mids = [], fwds = [];
    players.forEach((p, idx) => {
        const pos = p.pos.toUpperCase();
        if (pos === "GK") gk.push({ idx, p });
        else if (["RB", "CB", "LB"].includes(pos)) defs.push({ idx, p });
        else if (["CM", "AM", "DM", "CDM"].includes(pos)) mids.push({ idx, p });
        else fwds.push({ idx, p });
    });
    
    // Defsi sırala
    defs.sort((a, b) => {
        const order = { LB: 0, CB: 1, RB: 2 };
        return (order[a.p.pos.toUpperCase()] ?? 1) - (order[b.p.pos.toUpperCase()] ?? 1);
    });
    fwds.sort((a, b) => {
        const order = { LW: 0, ST: 1, CF: 1, RW: 2 };
        return (order[a.p.pos.toUpperCase()] ?? 1) - (order[b.p.pos.toUpperCase()] ?? 1);
    });
    
    const positioned = [];
    
    // GK - dibe
    gk.forEach(({ idx, p }) => {
        positioned.push({ idx, p, x: 50, y: 88 });
    });
    
    // Defans
    if (defs.length > 0) {
        const y = 70;
        defs.forEach((item, i) => {
            const x = defs.length === 1 ? 50 : 15 + (70 * i / (defs.length - 1));
            positioned.push({ idx: item.idx, p: item.p, x, y });
        });
    }
    
    // Orta saha
    if (mids.length > 0) {
        const y = 45;
        mids.forEach((item, i) => {
            const x = mids.length === 1 ? 50 : 15 + (70 * i / (mids.length - 1));
            positioned.push({ idx: item.idx, p: item.p, x, y });
        });
    }
    
    // Forvet
    if (fwds.length > 0) {
        const y = 15;
        fwds.forEach((item, i) => {
            const x = fwds.length === 1 ? 50 : 15 + (70 * i / (fwds.length - 1));
            positioned.push({ idx: item.idx, p: item.p, x, y });
        });
    }
    
    // Ekrana çiz
    positioned.forEach(({ idx, p, x, y }) => {
        const slot = document.createElement("div");
        slot.className = "takimPlayerSlot";
        slot.style.left = x + "%";
        slot.style.top = y + "%";
        
        const flagBox = document.createElement("div");
        flagBox.className = "takimFlagBox";
        
        if (takimPickPlayerMode && !takimData.revealedNames[takimData.playerId][idx]) {
            flagBox.classList.add("clickable");
            flagBox.onclick = () => {
                send({ type: "takim_joker_name", player_index: idx });
                takimPickPlayerMode = false;
                updateTakimStatus("");
            };
        }
        
        const img = document.createElement("img");
        img.src = `/flags/${p.flag}.png`;
        img.onerror = () => {
            img.style.display = "none";
            flagBox.textContent = p.flag.substr(0, 3).toUpperCase();
            flagBox.style.color = "#000";
            flagBox.style.fontSize = "11px";
            flagBox.style.fontWeight = "bold";
            flagBox.style.padding = "8px 6px";
        };
        flagBox.appendChild(img);
        
        const pos = document.createElement("div");
        pos.className = "takimPlayerPos";
        pos.textContent = p.pos;
        
        slot.appendChild(flagBox);
        slot.appendChild(pos);
        
        // İsim açıldıysa göster
        const myName = takimData.revealedNames[takimData.playerId][idx];
        const oppName = takimData.revealedNames[getTakimOtherPlayerId()][idx];
        if (myName) {
            const nameDiv = document.createElement("div");
            nameDiv.className = "takimPlayerName";
            nameDiv.textContent = myName;
            slot.appendChild(nameDiv);
        } else if (oppName) {
            const nameDiv = document.createElement("div");
            nameDiv.className = "takimPlayerName";
            nameDiv.style.color = "#ffa94d";
            nameDiv.textContent = oppName;
            slot.appendChild(nameDiv);
        }
        
        field.appendChild(slot);
    });
}

function renderTakimOptions() {
    if (!takimData.teamData) return;
    const opts = takimData.teamData.options;
    const buttons = document.querySelectorAll(".takimOptBtn");
    
    buttons.forEach((btn, i) => {
        btn.classList.remove("eliminated", "correct", "wrong");
        btn.disabled = false;
        btn.querySelector(".optText").textContent = opts[i] || "---";
        
        const isMyTurn = takimData.currentTurn === takimData.playerId;
        if (!isMyTurn || takimData.answered) {
            btn.disabled = true;
        }
        
        // Joker aktifse şıklar kilitli
        if (takimPickPlayerMode) {
            btn.disabled = true;
        }
        
        if (takimData.eliminatedOptions[takimData.playerId].includes(i)) {
            btn.classList.add("eliminated");
            btn.disabled = true;
        }
    });
}

function renderTakimJokers() {
    const isMyTurn = takimData.currentTurn === takimData.playerId;
    const my = takimData.jokersLeft[takimData.playerId] || {};
    const opp = takimData.jokersLeft[getTakimOtherPlayerId()] || {};
    const panel = document.getElementById("takimJokerPanel");
    
    // Zorluk etiketi
    const diffNames = { kolay: "KOLAY", orta: "ORTA", zor: "ZOR" };
    document.getElementById("takimDifficultyLabel").textContent = "Zorluk: " + (diffNames[takimData.difficulty] || takimData.difficulty);
    
    if (isMyTurn) {
        // Kendi sıran - normal görünüm
        panel.classList.remove("opponent-view");
        document.getElementById("takimJokerTitle").textContent = "JOKERLER";
        document.getElementById("takimJokerTitle").style.color = "gold";
        
        document.getElementById("takimJokerNameCount").textContent = my.name ?? 0;
        document.getElementById("takimJokerYearCount").textContent = my.year ?? 0;
        document.getElementById("takimJokerElimCount").textContent = my.elim ?? 0;
        document.getElementById("takimJokerPassCount").textContent = my.pass ?? 0;
        
        const canUse = !takimData.answered;
        document.getElementById("takimJokerNameBtn").disabled = !canUse || (my.name ?? 0) <= 0;
        document.getElementById("takimJokerYearBtn").disabled = !canUse || (my.year ?? 0) <= 0 || takimData.yearRevealed[takimData.playerId];
        document.getElementById("takimJokerElimBtn").disabled = !canUse || (my.elim ?? 0) <= 0;
        document.getElementById("takimJokerPassBtn").disabled = !canUse || (my.pass ?? 0) <= 0;
    } else {
        // Rakibin sırası - rakip jokerleri göster (okunabilir)
        panel.classList.add("opponent-view");
        document.getElementById("takimJokerTitle").textContent = "RAKİP JOKERLER";
        document.getElementById("takimJokerTitle").style.color = "#ffa94d";
        
        document.getElementById("takimJokerNameCount").textContent = opp.name ?? 0;
        document.getElementById("takimJokerYearCount").textContent = opp.year ?? 0;
        document.getElementById("takimJokerElimCount").textContent = opp.elim ?? 0;
        document.getElementById("takimJokerPassCount").textContent = opp.pass ?? 0;
        
        // Rakip jokerlerinin butonları tıklanamaz ama görünür
        document.getElementById("takimJokerNameBtn").disabled = true;
        document.getElementById("takimJokerYearBtn").disabled = true;
        document.getElementById("takimJokerElimBtn").disabled = true;
        document.getElementById("takimJokerPassBtn").disabled = true;
    }
}

function renderTakimScoreboard() {
    const p1 = getTakimPlayerName(1);
    const p2 = getTakimPlayerName(2);
    document.getElementById("takimP1Name").textContent = p1;
    document.getElementById("takimP2Name").textContent = p2;
    document.getElementById("takimP1ScoreName").textContent = p1;
    document.getElementById("takimP2ScoreName").textContent = p2;
    document.getElementById("takimP1Score").textContent = takimData.scores[1];
    document.getElementById("takimP2Score").textContent = takimData.scores[2];
    document.getElementById("takimScore").textContent = `${takimData.scores[1]} - ${takimData.scores[2]}`;
    
    document.getElementById("takimQuestionNo").textContent = `Soru ${takimData.questionNo + 1}/${takimData.totalQuestions}`;
    
    const turnName = getTakimPlayerName(takimData.currentTurn);
    const turnColor = takimData.currentTurn === takimData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("takimTurnInfo").innerHTML = `Sıra: <span style="color:${turnColor}">${turnName}</span>`;
    
    // Yıl
    const yearEl = document.getElementById("takimYearDisplay");
    if (takimData.yearRevealed[takimData.playerId]) {
        yearEl.textContent = `Yıl: ${takimData.teamData.year}`;
        yearEl.classList.add("revealed");
    } else {
        yearEl.textContent = "Yıl: ???";
        yearEl.classList.remove("revealed");
    }
}

function renderTakimAll() {
    renderTakimScoreboard();
    renderTakimField();
    renderTakimOptions();
    renderTakimJokers();
}

// ==== TAKIM TIMER ====
function startTakimTimer(seconds) {
    stopTakimTimer();
    takimData.timerSeconds = seconds;
    updateTakimTimerDisplay();
    takimData.timerInterval = setInterval(() => {
        takimData.timerSeconds--;
        updateTakimTimerDisplay();
        if (takimData.timerSeconds <= 0) {
            stopTakimTimer();
        }
    }, 1000);
}

function stopTakimTimer() {
    if (takimData.timerInterval) {
        clearInterval(takimData.timerInterval);
        takimData.timerInterval = null;
    }
}

function updateTakimTimerDisplay() {
    const el = document.getElementById("takimTimer");
    el.textContent = takimData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (takimData.timerSeconds <= 10) {
        el.classList.add("danger");
    } else if (takimData.timerSeconds <= 20) {
        el.classList.add("warning");
    }
}

// ==========================================
// TAKIM BİLMECE - MESAJ HANDLERI
// ==========================================

const originalHandleMessage = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "takim_room_created" || msg.type === "takim_room_joined") {
        takimData.playerId = msg.player_id;
        takimData.roomCode = msg.room_code;
        takimData.difficulty = msg.difficulty || "kolay";
        takimData.inGame = true;
        inRoom = true;
        showScreen("takimLobby");
        updateTakimLobby();
        return;
    }
    
    if (msg.type === "takim_lobby_update") {
        takimData.roomCode = msg.room_code;
        takimData.players = msg.players;
        takimData.difficulty = msg.difficulty || "kolay";
        takimData.turnSeconds = msg.turn_seconds || 60;
        updateTakimLobby();
        return;
    }
    
    if (msg.type === "takim_game_started") {
        takimData.playerId = msg.player_id;
        takimData.players = msg.players;
        takimData.difficulty = msg.difficulty;
        takimData.totalQuestions = msg.total_questions;
        takimData.turnSeconds = msg.turn_seconds;
        takimData.currentTurn = msg.current_turn;
        takimData.questionNo = msg.question_no;
        takimData.teamData = msg.team_data;
        takimData.scores = msg.scores;
        takimData.jokersLeft = msg.jokers_left;
        takimData.revealedNames = { 1: {}, 2: {} };
        takimData.yearRevealed = { 1: false, 2: false };
        takimData.eliminatedOptions = { 1: [], 2: [] };
        takimData.answered = false;
        takimPickPlayerMode = false;
        
        showScreen("takimGame");
        renderTakimAll();
        startTakimTimer(takimData.turnSeconds);
        
        if (takimData.currentTurn === takimData.playerId) {
            updateTakimStatus("Senin sıran!", "#51cf66");
        } else {
            updateTakimStatus(getTakimPlayerName(takimData.currentTurn) + " oynuyor...", "#ffa94d");
        }
        return;
    }
    
    if (msg.type === "takim_new_question") {
        takimData.questionNo = msg.question_no;
        takimData.currentTurn = msg.current_turn;
        takimData.teamData = msg.team_data;
        takimData.scores = msg.scores;
        takimData.jokersLeft = msg.jokers_left;
        takimData.revealedNames = { 1: {}, 2: {} };
        takimData.yearRevealed = { 1: false, 2: false };
        takimData.eliminatedOptions = { 1: [], 2: [] };
        takimData.answered = false;
        takimPickPlayerMode = false;
        document.getElementById("takimJokerCancelBtn").classList.add("hidden");
        
        renderTakimAll();
        startTakimTimer(takimData.turnSeconds);
        
        if (takimData.currentTurn === takimData.playerId) {
            updateTakimStatus("Senin sıran!", "#51cf66");
        } else {
            updateTakimStatus(getTakimPlayerName(takimData.currentTurn) + " oynuyor...", "#ffa94d");
        }
        return;
    }
    
    if (msg.type === "takim_joker_used") {
        if (msg.jokers_left) takimData.jokersLeft = msg.jokers_left;
        
        if (msg.joker_type === "name") {
            if (!takimData.revealedNames[msg.player_id]) takimData.revealedNames[msg.player_id] = {};
            takimData.revealedNames[msg.player_id][msg.player_index] = msg.player_name;
            // Kendi seçtiysem picker'ı kapat
            if (msg.player_id === takimData.playerId) {
                takimPickPlayerMode = false;
                updateTakimStatus("");
                document.getElementById("takimJokerCancelBtn").classList.add("hidden");
            }
        } else if (msg.joker_type === "year") {
            takimData.yearRevealed[msg.player_id] = true;
        } else if (msg.joker_type === "elim") {
            takimData.eliminatedOptions[msg.player_id] = msg.eliminated;
        }
        
        renderTakimAll();
        return;
    }
    
    if (msg.type === "takim_joker_preview") {
        // Rakip/ben butona bastım, sayı azaldı (henüz seçmedi)
        if (msg.jokers_left) takimData.jokersLeft = msg.jokers_left;
        renderTakimJokers();
        return;
    }
    
    if (msg.type === "takim_joker_cancel") {
        // İptal edildi, sayı geri geldi
        if (msg.jokers_left) takimData.jokersLeft = msg.jokers_left;
        renderTakimJokers();
        return;
    }
    
    if (msg.type === "takim_answer_result") {
        takimData.answered = true;
        takimData.scores = msg.scores;
        stopTakimTimer();
        
        const buttons = document.querySelectorAll(".takimOptBtn");
        buttons.forEach((btn, i) => {
            btn.disabled = true;
            if (i === msg.correct_answer) {
                btn.classList.add("correct");
            } else if (i === msg.choice && !msg.correct) {
                btn.classList.add("wrong");
            }
        });
        
        let statusText = "";
        if (msg.passed) {
            statusText = `${getTakimPlayerName(msg.player_id)} PAS GEÇTİ`;
        } else if (msg.timeout) {
            statusText = `${getTakimPlayerName(msg.player_id)} SÜRESİ DOLDU! -1`;
        } else if (msg.correct) {
            statusText = `${getTakimPlayerName(msg.player_id)} DOĞRU! +3`;
        } else {
            statusText = `${getTakimPlayerName(msg.player_id)} YANLIŞ! -1`;
        }
        updateTakimStatus(statusText, msg.correct ? "#51cf66" : "#ff6b6b");
        renderTakimScoreboard();
        return;
    }
    
    if (msg.type === "takim_game_over") {
        takimData.scores = msg.scores;
        stopTakimTimer();
        renderTakimScoreboard();
        
        const title = document.getElementById("takimGameOverTitle");
        const text = document.getElementById("takimGameOverText");
        
        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === takimData.playerId) {
            title.textContent = "KAZANDIN! 🏆";
            title.style.color = "#51cf66";
            startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }
        
        text.innerHTML = `Skor: <b>${takimData.scores[1]} - ${takimData.scores[2]}</b>`;
        
        // Rematch butonu - sadece host'ta göster
        const rematchBtn = document.getElementById("takimRematchBtn");
        if (takimData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
        
        document.getElementById("takimGameOverBox").classList.remove("hidden");
        return;
    }
    
    originalHandleMessage(msg);
};

// ==========================================
// KİM MİLYONER - FRONTEND
// ==========================================

let mlData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    category: "futbol",
    difficulty: "karisik",
    aiReady: false,
    turnSeconds: 60,
    players: [],
    currentPlayer: null,
    q_idx: 0,
    question: "",
    options: [],
    prize: 0,
    prizeStr: "500",
    level: "kolay",
    scores: { 1: 0, 2: 0 },
    jokers: { 1: {}, 2: {} },
    paraAgaci: [],
    answered: false,
    removed: [],
    timerInterval: null,
    timerSeconds: 60,
    audienceMode: false
};

const mlSounds = {
    correct: null,
    wrong: null,
    question: null,
    menu: null
};

function loadMlSounds() {
    try {
        mlSounds.correct = new Audio("/ml_assets/correct.mp3");
        mlSounds.wrong = new Audio("/ml_assets/wrong.mp3");
        mlSounds.question = new Audio("/ml_assets/question.WAV");
        mlSounds.menu = new Audio("/ml_assets/menu.mp3");
        
        // Kayıtlı ses seviyesini getir (Yoksa 30) - int olarak parse et
        const saved = localStorage.getItem("mlVolume");
        const savedVol = saved !== null ? parseInt(saved) : 30;
        updateAllVolumes(savedVol);
        
        if (mlSounds.question) mlSounds.question.loop = true;
        if (mlSounds.menu) mlSounds.menu.loop = true;
    } catch (e) {
        console.error("Ses yükleme hatası:", e);
    }
}

function updateAllVolumes(val) {
    const volume = val / 100;
    Object.values(mlSounds).forEach(s => {
        if (s) s.volume = volume;
    });
    // UI Güncelle
    const range = document.getElementById("mlVolumeRange");
    const text = document.getElementById("mlVolumeVal");
    const icon = document.getElementById("mlVolumeIcon");
    
    if (range) range.value = val;
    if (text) text.textContent = val;
    if (icon) icon.textContent = val == 0 ? "🔇" : (val < 50 ? "🔉" : "🔊");
}

// Ses slider listener
document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "mlVolumeRange") {
        const val = e.target.value;
        updateAllVolumes(val);
        localStorage.setItem("mlVolume", val);
    }
});
loadMlSounds();

function playMlSound(name) {
    const s = mlSounds[name];
    if (!s) return;
    try {
        s.currentTime = 0;
        s.play().catch(() => {});
    } catch (e) {}
}

function stopMlSound(name) {
    const s = mlSounds[name];
    if (!s) return;
    try { s.pause(); s.currentTime = 0; } catch (e) {}
}

function stopAllMlSounds() {
    Object.keys(mlSounds).forEach(k => stopMlSound(k));
}

const createMlScreen = document.getElementById("createMlScreen");
const mlLobbyScreen = document.getElementById("mlLobbyScreen");
const mlGameScreen = document.getElementById("mlGameScreen");

// showScreen'i genişlet
const _prevShowScreen = showScreen;
showScreen = function(screenName) {
    _prevShowScreen(screenName);
    createMlScreen.classList.add("hidden");
    mlLobbyScreen.classList.add("hidden");
    mlGameScreen.classList.add("hidden");
    if (screenName === "createMl") createMlScreen.classList.remove("hidden");
    if (screenName === "mlLobby") mlLobbyScreen.classList.remove("hidden");
    if (screenName === "mlGame") mlGameScreen.classList.remove("hidden");
    
    // Ses yönetimi
    if (screenName !== "mlGame") stopMlSound("question");
    if (screenName === "createMl" || screenName === "mlLobby") playMlSound("menu");
    else stopMlSound("menu");
};

// Mod kartına tıklama - Kim Milyoner ekle
document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    const mod = card.dataset.mod;
    if (mod === "kim_milyoner") {
        card.addEventListener("click", () => {
            showScreen("createMl");
            document.getElementById("createMlNameInput").focus();
        });
    }
});

// Kaydedilmiş isim
const _savedName = localStorage.getItem("playerName");
if (_savedName) {
    document.getElementById("createMlNameInput").value = _savedName;
}

// Oda oluştur butonu
document.getElementById("createMlBtn").onclick = () => {
    const name = document.getElementById("createMlNameInput").value.trim();
    if (!name) {
        document.getElementById("createMlMsg").textContent = "İsim gir.";
        document.getElementById("createMlMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;
    
    const category = document.getElementById("mlCategorySelect").value;
    const difficulty = document.getElementById("mlDifficultySelect").value;
    const turnSec = parseInt(document.getElementById("mlTurnSecondsSelect").value) || 60;
    send({
        type: "ml_create_room",
        name: name,
        category: category,
        difficulty: difficulty,
        turn_seconds: turnSec
    });
};

document.getElementById("createMlBackBtn").onclick = () => {
    showScreen("modselect");
};

// Lobby butonları
document.getElementById("mlStartBtn").onclick = () => {
    send({ type: "ml_start_game" });
};

document.getElementById("mlLobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        stopAllMlSounds();
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("mlRoomCodeText").onclick = () => {
    navigator.clipboard.writeText(mlData.roomCode).then(() => {
        const hint = document.getElementById("mlCopyHint");
        hint.textContent = "✓ Kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

// Oyun butonları
document.getElementById("mlBackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin?")) {
        stopAllMlSounds();
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("mlBackToMenuBtn").onclick = () => {
    stopAllMlSounds();
    location.reload();
};

document.getElementById("mlRematchBtn").onclick = () => {
    document.getElementById("mlGameOverBox").classList.add("hidden");
    send({ type: "ml_rematch" });
};

// Cevap butonları
document.querySelectorAll(".mlOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
        const letter = btn.dataset.letter;
        if (mlData.removed.includes(letter)) return;
        send({ type: "ml_answer", letter: letter });
    };
});

// Jokerler
document.getElementById("mlJokerFifty").onclick = () => {
    if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
    send({ type: "ml_joker", joker: "fifty" });
};
document.getElementById("mlJokerAudience").onclick = () => {
    if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
    send({ type: "ml_joker", joker: "audience" });
};
document.getElementById("mlJokerPhone").onclick = () => {
    if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
    send({ type: "ml_joker", joker: "phone" });
};

// Timer
function startMlTimer(seconds) {
    stopMlTimer();
    mlData.timerSeconds = seconds;
    updateMlTimerDisplay();
    mlData.timerInterval = setInterval(() => {
        mlData.timerSeconds--;
        updateMlTimerDisplay();
        if (mlData.timerSeconds <= 0) stopMlTimer();
    }, 1000);
}

function stopMlTimer() {
    if (mlData.timerInterval) {
        clearInterval(mlData.timerInterval);
        mlData.timerInterval = null;
    }
}

function updateMlTimerDisplay() {
    const el = document.getElementById("mlTimer");
    el.textContent = mlData.timerSeconds;
    el.classList.remove("warning", "danger");
    if (mlData.timerSeconds <= 10) el.classList.add("danger");
    else if (mlData.timerSeconds <= 20) el.classList.add("warning");
}

function getMlOtherPlayerId() {
    return mlData.playerId === 1 ? 2 : 1;
}

function getMlPlayerName(id) {
    const p = mlData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateMlLobby() {
    document.getElementById("mlRoomCodeText").textContent = mlData.roomCode;
    const catNames = { futbol: "⚽ Futbol", genel_kultur: "📚 Genel Kültür", karisik: "🎲 Karışık" };
    const diffNames = { 
        kolay: "🟢 Kolay", 
        orta: "🟡 Orta", 
        zor: "🔴 Zor", 
        cok_zor: "💀 Çok Zor", 
        karisik: "🎯 Karışık" 
    };
    document.getElementById("mlLobbyCategory").textContent = catNames[mlData.category] || mlData.category;
    document.getElementById("mlLobbyDifficulty").textContent = diffNames[mlData.difficulty] || mlData.difficulty;
    document.getElementById("mlLobbyTurnSeconds").textContent = mlData.turnSeconds || 60;
    
    // Durum bildirimi
    const aiStatusEl = document.getElementById("mlAiStatus");
    if (aiStatusEl) {
        if (mlData.aiReady) {
            aiStatusEl.textContent = "✅ Sorular hazır!";
            aiStatusEl.style.color = "#51cf66";
        } else {
            aiStatusEl.textContent = "⏳ Sorular hazırlanıyor...";
            aiStatusEl.style.color = "#ffa94d";
        }
    }
    
    const list = document.getElementById("mlPlayersList");
    list.innerHTML = "";
    mlData.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === mlData.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    
    const startBtn = document.getElementById("mlStartBtn");
    const msg = document.getElementById("mlLobbyMsg");
    
    if (mlData.playerId === 1 && mlData.players.length === 2) {
        startBtn.classList.remove("hidden");
        if (mlData.aiReady) {
            // Sorular hazır - butonu aktif et
            startBtn.disabled = false;
            startBtn.style.opacity = "1";
            startBtn.style.cursor = "pointer";
            startBtn.textContent = "Oyunu Başlat";
            msg.textContent = "✅ Her şey hazır. Başlatabilirsin!";
            msg.style.color = "#51cf66";
        } else {
            // Sorular hazır değil - butonu pasif yap
            startBtn.disabled = true;
            startBtn.style.opacity = "0.5";
            startBtn.style.cursor = "not-allowed";
            startBtn.textContent = "⏳ Sorular Hazırlanıyor...";
            msg.textContent = "⏳ Sorular hazırlanıyor, birazdan başlayabilirsin";
            msg.style.color = "#ffa94d";
        }
    } else if (mlData.playerId === 1) {
        startBtn.classList.add("hidden");
        startBtn.disabled = false;
        startBtn.textContent = "Oyunu Başlat";
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        startBtn.disabled = false;
        startBtn.textContent = "Oyunu Başlat";
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

function renderMlParaAgaci() {
    const box = document.getElementById("mlParaAgaci");
    box.innerHTML = "";
    // Tersten (yüksek para üstte)
    for (let i = 11; i >= 0; i--) {
        const row = document.createElement("div");
        row.className = "mlParaSatir";
        if (i === mlData.qIdx) row.classList.add("aktif");
        const para = mlData.paraAgaci[i] || "";
        row.innerHTML = `<span><span class="paraSira">${i+1}.</span> ${para} TL</span>`;
        box.appendChild(row);
    }
}

function renderMlTopBar() {
    const p1 = getMlPlayerName(1);
    const p2 = getMlPlayerName(2);
    document.getElementById("mlP1Name").textContent = p1;
    document.getElementById("mlP2Name").textContent = p2;
    document.getElementById("mlP1Money").textContent = mlData.scores[1].toLocaleString('tr-TR') + " TL";
    document.getElementById("mlP2Money").textContent = mlData.scores[2].toLocaleString('tr-TR') + " TL";
    
    const turnName = getMlPlayerName(mlData.currentPlayer);
    const turnColor = mlData.currentPlayer === mlData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("mlScoreLine").innerHTML = `Sıra: <span style="color:${turnColor}; font-weight:bold;">${turnName}</span>`;
}

function renderMlQuestion() {
    document.getElementById("mlQuestionInfo").textContent = `Soru ${mlData.qIdx + 1}/12`;
    document.getElementById("mlPrizeInfo").textContent = `Ödül: ${mlData.prizeStr} TL`;
    document.getElementById("mlQuestionText").textContent = mlData.question;
    
    const buttons = document.querySelectorAll(".mlOptBtn");
    buttons.forEach(btn => {
        const letter = btn.dataset.letter;
        btn.classList.remove("correct", "wrong", "eliminated");
        btn.disabled = false;
        
        const idx = "ABCD".indexOf(letter);
        const opt = mlData.options[idx] || "";
        btn.querySelector(".optText").textContent = opt.replace(/^[A-D]\)\s*/, "");
        
        if (mlData.removed.includes(letter)) {
            btn.classList.add("eliminated");
            btn.disabled = true;
        }
        
        const isMyTurn = mlData.currentPlayer === mlData.playerId;
        if (!isMyTurn || mlData.answered) {
            btn.disabled = true;
        }
    });
}

function renderMlJokers() {
    const isMyTurn = mlData.currentPlayer === mlData.playerId;
    const my = mlData.jokers[mlData.playerId] || {};
    const canUse = isMyTurn && !mlData.answered;
    
    document.getElementById("mlJokerFifty").disabled = !canUse || !my.fifty;
    document.getElementById("mlJokerAudience").disabled = !canUse || !my.audience;
    document.getElementById("mlJokerPhone").disabled = !canUse || !my.phone;
}

function renderMlAll() {
    renderMlTopBar();
    renderMlQuestion();
    renderMlJokers();
    renderMlParaAgaci();
}

function setMlInfo(text, type) {
    const el = document.getElementById("mlInfoText");
    el.textContent = text || "";
    el.classList.remove("correct", "wrong", "info");
    if (type) el.classList.add(type);
}

function showAudienceResult(result) {
    const box = document.getElementById("mlAudienceBox");
    box.classList.remove("hidden");
    
    box.querySelectorAll(".mlAudBar").forEach(bar => {
        const letter = bar.dataset.letter;
        const pct = result[letter] || 0;
        const fill = bar.querySelector(".mlAudBarFill");
        const pctEl = bar.querySelector(".mlAudPct");
        fill.style.height = (pct * 0.9) + "%";
        pctEl.textContent = "%" + pct;
    });
}

function hideAudienceResult() {
    document.getElementById("mlAudienceBox").classList.add("hidden");
}

// Mesaj handler'ı wrap
const _prevHandleMessage = handleMessage;
handleMessage = function(msg) {
    // ML mesajları
    if (msg.type === "ml_room_created" || msg.type === "ml_room_joined") {
        mlData.playerId = msg.player_id;
        mlData.roomCode = msg.room_code;
        mlData.category = msg.category || "futbol";
        mlData.difficulty = msg.difficulty || "karisik";
        mlData.turnSeconds = msg.turn_seconds || 60;
        mlData.aiReady = false;
        mlData.inGame = true;
        inRoom = true;
        showScreen("mlLobby");
        updateMlLobby();
        return;
    }
    
    if (msg.type === "ml_lobby_update") {
        mlData.roomCode = msg.room_code;
        mlData.players = msg.players;
        mlData.category = msg.category || "futbol";
        mlData.difficulty = msg.difficulty || "karisik";
        mlData.turnSeconds = msg.turn_seconds || 60;
        mlData.aiReady = msg.ai_ready === true;
        updateMlLobby();
        return;
    }
    
	if (msg.type === "ml_loading") {
        // Soru üretilirken loading göster
        setMlInfo(msg.message || "⏳ Sorular yükleniyor...", "info");
        return;
    }
	
    if (msg.type === "ml_game_started") {
        mlData.playerId = msg.player_id;
        mlData.players = msg.players;
        mlData.category = msg.category;
        mlData.turnSeconds = msg.turn_seconds;
        mlData.currentPlayer = msg.current_player;
        mlData.qIdx = msg.q_idx;
        mlData.question = msg.question;
        mlData.options = msg.options;
        mlData.prize = msg.prize;
        mlData.prizeStr = msg.prize_str;
        mlData.level = msg.level;
        mlData.scores = msg.scores;
        mlData.jokers = msg.jokers;
        mlData.paraAgaci = msg.para_agaci;
        mlData.answered = false;
        mlData.removed = [];
        hideAudienceResult();
        setMlInfo("");
        
        showScreen("mlGame");
        stopMlSound("menu");
        playMlSound("question");
        renderMlAll();
        startMlTimer(mlData.turnSeconds);
        
        if (mlData.currentPlayer === mlData.playerId) {
            setMlInfo("Senin sıran!", "correct");
        } else {
            setMlInfo(getMlPlayerName(mlData.currentPlayer) + " oynuyor...", "info");
        }
        return;
    }
    
    if (msg.type === "ml_new_question") {
        mlData.currentPlayer = msg.current_player;
        mlData.qIdx = msg.q_idx;
        mlData.question = msg.question;
        mlData.options = msg.options;
        mlData.prize = msg.prize;
        mlData.prizeStr = msg.prize_str;
        mlData.level = msg.level;
        mlData.scores = msg.scores;
        mlData.jokers = msg.jokers;
        mlData.answered = false;
        mlData.removed = [];
        hideAudienceResult();
        setMlInfo("");
        
        playMlSound("question");
        renderMlAll();
        startMlTimer(mlData.turnSeconds);
        
        if (mlData.currentPlayer === mlData.playerId) {
            setMlInfo("Senin sıran!", "correct");
        } else {
            setMlInfo(getMlPlayerName(mlData.currentPlayer) + " oynuyor...", "info");
        }
        return;
    }
    
    if (msg.type === "ml_answer_result") {
        mlData.answered = true;
        mlData.scores = msg.scores;
        stopMlTimer();
        stopMlSound("question");
        
        // İşaretle
        const buttons = document.querySelectorAll(".mlOptBtn");
        buttons.forEach(btn => {
            btn.disabled = true;
            const letter = btn.dataset.letter;
            if (letter === msg.correct_answer) {
                btn.classList.add("correct");
            } else if (letter === msg.selected && !msg.correct) {
                btn.classList.add("wrong");
            }
        });
        
        let statusText = "";
        let statusType = "info";
        const playerName = getMlPlayerName(msg.player_id);
        
        if (msg.timeout) {
            statusText = `${playerName} SÜRESİ DOLDU! Doğru: ${msg.correct_answer}`;
            statusType = "wrong";
            playMlSound("wrong");
        } else if (msg.correct) {
            statusText = `${playerName} DOĞRU! +${mlData.prizeStr} TL`;
            statusType = "correct";
            playMlSound("correct");
        } else {
            statusText = `${playerName} YANLIŞ! Doğru: ${msg.correct_answer}`;
            statusType = "wrong";
            playMlSound("wrong");
        }
        setMlInfo(statusText, statusType);
        renderMlTopBar();
        return;
    }
    
    if (msg.type === "ml_joker_result") {
        if (msg.jokers) mlData.jokers = msg.jokers;
        
        if (msg.joker === "fifty") {
            mlData.removed = msg.removed;
            mlData.options = msg.options;
            renderMlQuestion();
            renderMlJokers();
        } else if (msg.joker === "audience") {
            showAudienceResult(msg.result);
            renderMlJokers();
        } else if (msg.joker === "phone_calling") {
            setMlInfo("📞 TELEFON: Aranıyor...", "info");
            renderMlJokers();
        } else if (msg.joker === "phone_result") {
            setMlInfo(`📞 TELEFON: "${msg.result}"`, "info");
            renderMlJokers();
        }
        return;
    }
    
    if (msg.type === "ml_game_over") {
        mlData.scores = msg.scores;
        stopMlTimer();
        stopAllMlSounds();
        renderMlTopBar();
        
        const title = document.getElementById("mlGameOverTitle");
        const text = document.getElementById("mlGameOverText");
        
        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === mlData.playerId) {
            title.textContent = "KAZANDIN! 🏆";
            title.style.color = "#51cf66";
            startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }
        
        const p1 = getMlPlayerName(1);
        const p2 = getMlPlayerName(2);
        text.innerHTML = `
            <div style="font-size:20px; margin:15px 0;">
                <span style="color:#51cf66;">${p1}</span>: <b>${mlData.scores[1].toLocaleString('tr-TR')} TL</b><br>
                <span style="color:#ff6b6b;">${p2}</span>: <b>${mlData.scores[2].toLocaleString('tr-TR')} TL</b>
            </div>
        `;
        
        const rematchBtn = document.getElementById("mlRematchBtn");
        if (mlData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
        
        document.getElementById("mlGameOverBox").classList.remove("hidden");
        return;
    }
    
    _prevHandleMessage(msg);
};

// room_mode_result için ml desteği
const _origHandleForMode = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }
        const name = joinNameInput.value.trim();
        const code = msg.room_code;
        if (msg.mode === "takim_bilmece") {
            send({ type: "takim_join_room", name: name, room_code: code });
        } else if (msg.mode === "kim_milyoner") {
            send({ type: "ml_join_room", name: name, room_code: code });
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }
    _origHandleForMode(msg);
};

// Başlangıçta tüm popup'ları kapat
document.getElementById("takimGameOverBox").classList.add("hidden");
document.getElementById("takimPassConfirmBox").classList.add("hidden");
document.getElementById("takimJokerCancelBtn").classList.add("hidden");
document.getElementById("mlGameOverBox").classList.add("hidden");

connectWS();
showScreen("home");

// ==========================================
// HARITADAN BUL - FRONTEND
// ==========================================

let haritaData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 30,
    totalRounds: 10,
    currentTurn: null,
    roundNo: 0,
    footballer: null,
    countries: {},
    scores: { 1: 0, 2: 0 },
    answered: false,
    pendingCode: null,
    lastSelectedCode: null,
    lastCorrectCode: null,
    timerInterval: null,
    timerSeconds: 30,
    roundStarting: false,
    // Zoom & Pan
    zoom: 1.0,
    minZoom: 1.0,
    maxZoom: 5.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0
};

const createHaritaScreen = document.getElementById("createHaritaScreen");
const haritaLobbyScreen = document.getElementById("haritaLobbyScreen");
const haritaGameScreen = document.getElementById("haritaGameScreen");

// showScreen genişlet
const _prevShowScreenHarita = showScreen;
showScreen = function(screenName) {
    _prevShowScreenHarita(screenName);
    createHaritaScreen.classList.add("hidden");
    haritaLobbyScreen.classList.add("hidden");
    haritaGameScreen.classList.add("hidden");
    if (screenName === "createHarita") createHaritaScreen.classList.remove("hidden");
    if (screenName === "haritaLobby") haritaLobbyScreen.classList.remove("hidden");
    if (screenName === "haritaGame") haritaGameScreen.classList.remove("hidden");
};

// Mod kartına tıklama
document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    const mod = card.dataset.mod;
    if (mod === "haritadan_bul") {
        card.addEventListener("click", () => {
            showScreen("createHarita");
            document.getElementById("createHaritaNameInput").focus();
        });
    }
});

// Kaydedilmiş isim
const _savedNameHarita = localStorage.getItem("playerName");
if (_savedNameHarita) {
    document.getElementById("createHaritaNameInput").value = _savedNameHarita;
}

// Oda oluştur butonu
document.getElementById("createHaritaBtn").onclick = () => {
    const name = document.getElementById("createHaritaNameInput").value.trim();
    if (!name) {
        document.getElementById("createHaritaMsg").textContent = "İsim gir.";
        document.getElementById("createHaritaMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;
    
    const turnSec = parseInt(document.getElementById("haritaTurnSecondsSelect").value) || 30;
    send({
        type: "harita_create_room",
        name: name,
        turn_seconds: turnSec
    });
};

document.getElementById("createHaritaBackBtn").onclick = () => {
    showScreen("modselect");
};

// Lobby butonları
document.getElementById("haritaStartBtn").onclick = () => {
    send({ type: "harita_start_game" });
};

document.getElementById("haritaLobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("haritaRoomCodeText").onclick = () => {
    navigator.clipboard.writeText(haritaData.roomCode).then(() => {
        const hint = document.getElementById("haritaCopyHint");
        hint.textContent = "✓ Kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

// Oyun butonları
document.getElementById("haritaBackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("haritaBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("haritaRematchBtn").onclick = () => {
    document.getElementById("haritaGameOverBox").classList.add("hidden");
    send({ type: "harita_rematch" });
};

// Onay popup
document.getElementById("haritaConfirmYesBtn").onclick = () => {
    if (!haritaData.pendingCode) return;
    send({
        type: "harita_answer",
        country_code: haritaData.pendingCode
    });
    document.getElementById("haritaConfirmBox").classList.add("hidden");
};

document.getElementById("haritaConfirmNoBtn").onclick = () => {
    haritaData.pendingCode = null;
    renderHaritaMarkers();
    document.getElementById("haritaConfirmBox").classList.add("hidden");
};

// ==== ZOOM & PAN ====
const haritaMapWrapper = document.getElementById("haritaMapWrapper");
const haritaWorldMap = document.getElementById("haritaWorldMap");
const haritaMarkersEl = document.getElementById("haritaMarkers");

function applyHaritaTransform() {
    const transform = `translate(${haritaData.panX}px, ${haritaData.panY}px) scale(${haritaData.zoom})`;
    // Hem haritayı hem marker container'ı birlikte transform et
    haritaWorldMap.style.transform = transform;
    haritaMarkersEl.style.transform = transform;
    document.getElementById("haritaZoomLevel").textContent = Math.round(haritaData.zoom * 100) + "%";
    // Marker'ları counter-scale ile aynı boyutta tut
    updateHaritaMarkerScale();
}

function updateHaritaMarkerScale() {
    const invZoom = 1 / haritaData.zoom;
    const markers = haritaMarkersEl.querySelectorAll(".haritaMarker");
    markers.forEach(marker => {
        marker.style.transform = `translate(-50%, -50%) scale(${invZoom})`;
    });
}

function clampHaritaPan() {
    const rect = haritaMapWrapper.getBoundingClientRect();
    const scaledW = rect.width * haritaData.zoom;
    const scaledH = rect.height * haritaData.zoom;
    const minX = rect.width - scaledW;
    const minY = rect.height - scaledH;
    haritaData.panX = Math.max(minX, Math.min(0, haritaData.panX));
    haritaData.panY = Math.max(minY, Math.min(0, haritaData.panY));
}

function zoomHaritaAt(clientX, clientY, delta) {
    const rect = haritaMapWrapper.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    const oldZoom = haritaData.zoom;
    let newZoom = Math.max(haritaData.minZoom, Math.min(haritaData.maxZoom, oldZoom + delta));
    if (Math.abs(newZoom - oldZoom) < 0.01) return;
    
    // Zoom noktası sabit kalsın
    const relX = (mouseX - haritaData.panX) / oldZoom;
    const relY = (mouseY - haritaData.panY) / oldZoom;
    
    haritaData.zoom = newZoom;
    haritaData.panX = mouseX - relX * newZoom;
    haritaData.panY = mouseY - relY * newZoom;
    
    clampHaritaPan();
    applyHaritaTransform();
}

function resetHaritaView() {
    haritaData.zoom = 1.0;
    haritaData.panX = 0;
    haritaData.panY = 0;
    applyHaritaTransform();
}

// Wheel zoom
haritaMapWrapper.addEventListener("wheel", (e) => {
    // İzleyicide bloklama - ama sayfayı da scroll etmesin
    if (haritaData.currentTurn !== haritaData.playerId) {
        e.preventDefault();
        return;
    }
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    zoomHaritaAt(e.clientX, e.clientY, delta);
    broadcastHaritaView();
}, { passive: false });

// Sağ tık ile pan
haritaMapWrapper.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

haritaMapWrapper.addEventListener("mousedown", (e) => {
    if (haritaData.currentTurn !== haritaData.playerId) return; // İzleyici pan yapamaz
    if (e.button === 2) {
        // Sağ tık - pan başlat
        haritaData.isPanning = true;
        haritaData.panStartX = e.clientX;
        haritaData.panStartY = e.clientY;
        haritaData.panStartOffsetX = haritaData.panX;
        haritaData.panStartOffsetY = haritaData.panY;
        haritaMapWrapper.style.cursor = "grabbing";
    } else if (e.button === 1) {
        // Orta tık - reset
        e.preventDefault();
        resetHaritaView();
        broadcastHaritaView();
    }
});

window.addEventListener("mousemove", (e) => {
    if (haritaData.isPanning) {
        const dx = e.clientX - haritaData.panStartX;
        const dy = e.clientY - haritaData.panStartY;
        haritaData.panX = haritaData.panStartOffsetX + dx;
        haritaData.panY = haritaData.panStartOffsetY + dy;
        clampHaritaPan();
        applyHaritaTransform();
        broadcastHaritaViewThrottled();
    }
});

window.addEventListener("mouseup", (e) => {
    if (haritaData.isPanning) {
        haritaData.isPanning = false;
        haritaMapWrapper.style.cursor = "crosshair";
    }
});

// Zoom butonları
document.getElementById("haritaZoomIn").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    zoomHaritaAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.3);
    broadcastHaritaView();
};

document.getElementById("haritaZoomOut").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    zoomHaritaAt(rect.left + rect.width / 2, rect.top + rect.height / 2, -0.3);
    broadcastHaritaView();
};

document.getElementById("haritaZoomReset").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    resetHaritaView();
    broadcastHaritaView();
};

// ---- Rakip için harita senkronizasyonu ----
let _haritaBroadcastTimer = null;
function broadcastHaritaView() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    send({
        type: "harita_view_sync",
        zoom: haritaData.zoom,
        pan_x: haritaData.panX,
        pan_y: haritaData.panY
    });
}

function broadcastHaritaViewThrottled() {
    if (_haritaBroadcastTimer) return;
    _haritaBroadcastTimer = setTimeout(() => {
        broadcastHaritaView();
        _haritaBroadcastTimer = null;
    }, 60);
}

// ---- Mouse pozisyon senkronu ----
let _haritaMouseThrottleTimer = null;
let _lastMouseX = 0, _lastMouseY = 0;
let _lastHoverCountry = null;

function broadcastHaritaMouse(x, y, countryCode) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    send({
        type: "harita_mouse_sync",
        x: x,
        y: y,
        country: countryCode
    });
}

function broadcastHaritaMouseThrottled(x, y, countryCode) {
    _lastMouseX = x;
    _lastMouseY = y;
    _lastHoverCountry = countryCode;
    if (_haritaMouseThrottleTimer) return;
    _haritaMouseThrottleTimer = setTimeout(() => {
        broadcastHaritaMouse(_lastMouseX, _lastMouseY, _lastHoverCountry);
        _haritaMouseThrottleTimer = null;
    }, 50);
}

// Mouse hareketini yakala (sıradaki oyuncu)
haritaMapWrapper.addEventListener("mousemove", (e) => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    
    // Mouse'un wrapper içindeki ham pozisyonu (px)
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    // Zoom + pan'ı geri çıkararak HARİTA İÇ KOORDİNATINI bul (0-1 normalize)
    // Görünen konum = ic_pozisyon * (rect * zoom) + panX
    // O zaman: ic_pozisyon = (rawX - panX) / (rect.width * zoom)
    const mapX = (rawX - haritaData.panX) / (rect.width * haritaData.zoom);
    const mapY = (rawY - haritaData.panY) / (rect.height * haritaData.zoom);
    
    // Hangi marker üstünde?
    const hovered = document.elementFromPoint(e.clientX, e.clientY);
    let countryCode = null;
    if (hovered && hovered.classList && hovered.classList.contains("haritaMarker")) {
        countryCode = hovered.dataset.code;
    }
    broadcastHaritaMouseThrottled(mapX, mapY, countryCode);
});

// Timer
function startHaritaTimer(seconds) {
    stopHaritaTimer();
    haritaData.timerSeconds = seconds;
    updateHaritaTimerDisplay();
    haritaData.timerInterval = setInterval(() => {
        haritaData.timerSeconds--;
        updateHaritaTimerDisplay();
        if (haritaData.timerSeconds <= 0) stopHaritaTimer();
    }, 1000);
}

function stopHaritaTimer() {
    if (haritaData.timerInterval) {
        clearInterval(haritaData.timerInterval);
        haritaData.timerInterval = null;
    }
}

function updateHaritaTimerDisplay() {
    const el = document.getElementById("haritaTimer");
    el.textContent = haritaData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (haritaData.timerSeconds <= 5) el.classList.add("danger");
    else if (haritaData.timerSeconds <= 10) el.classList.add("warning");
}

function getHaritaOtherId() {
    return haritaData.playerId === 1 ? 2 : 1;
}

function getHaritaPlayerName(id) {
    const p = haritaData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateHaritaLobby() {
    document.getElementById("haritaRoomCodeText").textContent = haritaData.roomCode;
    document.getElementById("haritaLobbyTurnSeconds").textContent = haritaData.turnSeconds || 30;
    
    const list = document.getElementById("haritaPlayersList");
    list.innerHTML = "";
    haritaData.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === haritaData.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    
    const startBtn = document.getElementById("haritaStartBtn");
    const msg = document.getElementById("haritaLobbyMsg");
    
    if (haritaData.playerId === 1 && haritaData.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (haritaData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

function updateHaritaTopBar() {
    document.getElementById("haritaRoundInfo").textContent = 
        `Tur ${haritaData.roundNo + 1}/${haritaData.totalRounds}`;
    
    const turnName = getHaritaPlayerName(haritaData.currentTurn);
    const turnColor = haritaData.currentTurn === haritaData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("haritaTurnInfo").innerHTML = 
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;
    
    const p1 = getHaritaPlayerName(1);
    const p2 = getHaritaPlayerName(2);
    document.getElementById("haritaP1Name").textContent = p1;
    document.getElementById("haritaP2Name").textContent = p2;
    document.getElementById("haritaScore").textContent = 
        `${haritaData.scores[1]} - ${haritaData.scores[2]}`;
}

function updateHaritaPlayerCard() {
    if (!haritaData.footballer) return;
    const img = document.getElementById("haritaPlayerImg");
    img.src = `/static/images/${haritaData.footballer.img_file}`;
    img.onerror = () => { img.style.opacity = "0.3"; };
    img.onload = () => { img.style.opacity = "1"; };
    document.getElementById("haritaPlayerName").textContent = haritaData.footballer.name;
    
    const statusEl = document.getElementById("haritaPlayerStatus");
    const container = document.getElementById("haritaMapContainer");
    const overlay = document.getElementById("haritaSpectatorOverlay");
    
    if (haritaData.currentTurn === haritaData.playerId) {
        statusEl.textContent = "Ülkesini haritada bul!";
        statusEl.style.color = "#51cf66";
        container.classList.remove("spectator");
        overlay.classList.add("hidden");
    } else {
        const oppName = getHaritaPlayerName(haritaData.currentTurn);
        statusEl.textContent = `${oppName} oynuyor...`;
        statusEl.style.color = "#ff6b6b";
        container.classList.add("spectator");
        overlay.classList.remove("hidden");
    }
    
    // Doğru cevap yazısını gizle (yeni tur veya oyuncu kartı yenilenince)
    document.getElementById("haritaCorrectAnswer").classList.add("hidden");
}

// Büyük ortadaki overlay göster
function showHaritaBigOverlay(text, type, duration) {
    const overlay = document.getElementById("haritaBigOverlay");
    const textEl = document.getElementById("haritaBigOverlayText");
    textEl.textContent = text;
    overlay.classList.remove("hidden", "correct", "wrong", "turn");
    if (type) overlay.classList.add(type);
    if (duration) {
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, duration);
    }
}

function hideHaritaBigOverlay() {
    document.getElementById("haritaBigOverlay").classList.add("hidden");
}

// Sol paneldeki "Doğru: X" yazısı
function showHaritaCorrectAnswer(countryTr) {
    const el = document.getElementById("haritaCorrectAnswer");
    el.innerHTML = `<span class="cavLabel">DOĞRU CEVAP</span>🌍 ${countryTr}`;
    el.classList.remove("hidden");
}

// Haritayı doğru ülkeye ışınla + zoom
function flyHaritaToCountry(code) {
    if (!code || !haritaData.countries[code]) return;
    const cdata = haritaData.countries[code];
    const rect = haritaMapWrapper.getBoundingClientRect();
    
    // Hedef zoom seviyesi
    const targetZoom = 3.5;
    haritaData.zoom = targetZoom;
    
    // Ülkeyi ekranın ortasına konumlandır
    // ülke pozisyonu * (rect * zoom) + panX = rect.width / 2
    // panX = rect.width/2 - x * rect.width * zoom
    haritaData.panX = rect.width / 2 - cdata.x * rect.width * targetZoom;
    haritaData.panY = rect.height / 2 - cdata.y * rect.height * targetZoom;
    
    clampHaritaPan();
    applyHaritaTransform();
}

function setHaritaStatus(text, type) {
    const el = document.getElementById("haritaStatusMsg");
    el.textContent = text || "";
    el.classList.remove("correct", "wrong", "info");
    if (type) el.classList.add(type);
}

function renderHaritaMarkers() {
    haritaMarkersEl.innerHTML = "";
    
    const isMyTurn = haritaData.currentTurn === haritaData.playerId;
    const canClick = isMyTurn && !haritaData.answered;
    
    Object.entries(haritaData.countries).forEach(([code, cdata]) => {
        const marker = document.createElement("div");
        marker.className = "haritaMarker";
        marker.style.left = (cdata.x * 100) + "%";
        marker.style.top = (cdata.y * 100) + "%";
        marker.dataset.code = code;
        marker.dataset.tr = cdata.tr;
        
        // Durum sınıfları
        if (code === haritaData.lastCorrectCode) {
            marker.classList.add("correct");
        } else if (code === haritaData.lastSelectedCode && code !== haritaData.lastCorrectCode) {
            marker.classList.add("wrong");
        } else if (code === haritaData.pendingCode) {
            marker.classList.add("pending");
        }
        
        // Tooltip HER ZAMAN çalışsın (izleyici de görsün)
        marker.addEventListener("mouseenter", (e) => {
            showHaritaTooltip(cdata.tr, e);
        });
        marker.addEventListener("mousemove", (e) => {
            moveHaritaTooltip(e);
        });
        marker.addEventListener("mouseleave", () => {
            hideHaritaTooltip();
        });
        
        // Tıklama sadece sıradaki oyuncuda
        if (canClick) {
            marker.addEventListener("click", (e) => {
                e.stopPropagation();
                haritaData.pendingCode = code;
                document.getElementById("haritaConfirmCountry").textContent = cdata.tr;
                document.getElementById("haritaConfirmBox").classList.remove("hidden");
            });
        } else {
            // Cursor'ı normal göster (tıklanamaz olduğunu belli etsin)
            marker.style.cursor = "default";
        }
        
        haritaMarkersEl.appendChild(marker);
    });
    updateHaritaMarkerScale();
}

function showHaritaTooltip(text, e) {
    const tooltip = document.getElementById("haritaTooltip");
    tooltip.textContent = text;
    tooltip.classList.remove("hidden");
    moveHaritaTooltip(e);
}

function moveHaritaTooltip(e) {
    const tooltip = document.getElementById("haritaTooltip");
    // Mouse'un 15px sağ üstünde
    tooltip.style.left = (e.clientX + 15) + "px";
    tooltip.style.top = (e.clientY - 30) + "px";
}

function hideHaritaTooltip() {
    document.getElementById("haritaTooltip").classList.add("hidden");
}

function renderHaritaAll() {
    updateHaritaTopBar();
    updateHaritaPlayerCard();
    renderHaritaMarkers();
}

// Mesaj handler wrap
const _prevHandleMessageHarita = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "harita_room_created" || msg.type === "harita_room_joined") {
        haritaData.playerId = msg.player_id;
        haritaData.roomCode = msg.room_code;
        haritaData.turnSeconds = msg.turn_seconds || 30;
        haritaData.inGame = true;
        inRoom = true;
        showScreen("haritaLobby");
        updateHaritaLobby();
        return;
    }
    
    if (msg.type === "harita_lobby_update") {
        haritaData.roomCode = msg.room_code;
        haritaData.players = msg.players;
        haritaData.turnSeconds = msg.turn_seconds || 30;
        updateHaritaLobby();
        return;
    }
    
    if (msg.type === "harita_game_started") {
        haritaData.playerId = msg.player_id;
        haritaData.players = msg.players;
        haritaData.turnSeconds = msg.turn_seconds;
        haritaData.totalRounds = msg.total_rounds;
        haritaData.currentTurn = msg.current_turn;
        haritaData.roundNo = msg.round_no;
        haritaData.footballer = msg.footballer;
        haritaData.countries = msg.countries;
        haritaData.scores = msg.scores;
        haritaData.answered = false;
        haritaData.pendingCode = null;
        haritaData.lastSelectedCode = null;
        haritaData.lastCorrectCode = null;
        
        showScreen("haritaGame");
        resetHaritaView();
        applyHaritaTransform();
        renderHaritaAll();
        setHaritaStatus("");
        startHaritaTimer(haritaData.turnSeconds);
        return;
    }
    
    if (msg.type === "harita_new_round") {
        haritaData.roundNo = msg.round_no;
        haritaData.totalRounds = msg.total_rounds;
        haritaData.currentTurn = msg.current_turn;
        haritaData.footballer = msg.footballer;
        haritaData.scores = msg.scores;
        haritaData.answered = false;
        haritaData.pendingCode = null;
        haritaData.lastSelectedCode = null;
        haritaData.lastCorrectCode = null;
        
        // Temizlik
        document.getElementById("haritaFakeCursor").classList.add("hidden");
        document.getElementById("haritaFakeTooltip").classList.add("hidden");
        document.getElementById("haritaCorrectBanner").classList.add("hidden");
        document.getElementById("haritaCorrectAnswer").classList.add("hidden");
        hideHaritaBigOverlay();
        
        // Haritayı 100%'e sıfırla
        resetHaritaView();
        // Host tarafındaysa reset'i rakibe de yolla
        if (haritaData.currentTurn === haritaData.playerId) {
            broadcastHaritaView();
        }
        
        renderHaritaAll();
        setHaritaStatus("");
        
        // "SIRA SENDE" veya "RAKİP OYNUYOR" büyük yazı göster
        if (haritaData.currentTurn === haritaData.playerId) {
            showHaritaBigOverlay("SIRA SENDE!", "turn", 1800);
        } else {
            const oppName = getHaritaPlayerName(haritaData.currentTurn);
            showHaritaBigOverlay(`${oppName.toUpperCase()} OYNUYOR`, "wrong", 1800);
        }
        
        // Timer'ı yazının bitmesinden sonra başlat
        setTimeout(() => {
            startHaritaTimer(haritaData.turnSeconds);
        }, 1800);
        
        return;
    }
	
	if (msg.type === "harita_view_sync") {
        // Sadece izleyici tarafı uygular
        if (msg.player_id === haritaData.playerId) return;
        haritaData.zoom = msg.zoom;
        haritaData.panX = msg.pan_x;
        haritaData.panY = msg.pan_y;
        applyHaritaTransform();
        return;
    }
	
	if (msg.type === "harita_mouse_sync") {
        if (msg.player_id === haritaData.playerId) return;
        // Rakibin mouse'unu ekranda göster
        const cursor = document.getElementById("haritaFakeCursor");
        const tooltip = document.getElementById("haritaFakeTooltip");
        const rect = haritaMapWrapper.getBoundingClientRect();
        
        // Gelen msg.x/y = harita iç koordinatı (0-1, zoom/pan yok)
        // Bizde göstermek için: zoom + pan uygula
        const localX = msg.x * rect.width * haritaData.zoom + haritaData.panX;
        const localY = msg.y * rect.height * haritaData.zoom + haritaData.panY;
        
        cursor.style.left = localX + "px";
        cursor.style.top = localY + "px";
        cursor.classList.remove("hidden");
        
        // Ülke ismi tooltip - fixed position (viewport)
        if (msg.country && haritaData.countries[msg.country]) {
            tooltip.textContent = haritaData.countries[msg.country].tr;
            tooltip.classList.remove("hidden");
            tooltip.style.left = (rect.left + localX + 15) + "px";
            tooltip.style.top = (rect.top + localY - 30) + "px";
        } else {
            tooltip.classList.add("hidden");
        }
        return;
    }
    
    if (msg.type === "harita_answer_result") {
        haritaData.answered = true;
        haritaData.scores = msg.scores;
        haritaData.lastSelectedCode = msg.selected_code;
        haritaData.lastCorrectCode = msg.correct_code;
        stopHaritaTimer();
        
        const playerName = getHaritaPlayerName(msg.player_id);
        let statusText = "";
        let statusType = "info";
        
        if (msg.timeout) {
            statusText = `⏰ ${playerName} süresi doldu!`;
            statusType = "wrong";
        } else if (msg.correct) {
            statusText = `✓ ${playerName} doğru bildi!`;
            statusType = "correct";
        } else {
            statusText = `✗ ${playerName} yanlış tahmin: ${msg.selected_tr}`;
            statusType = "wrong";
        }
        
        setHaritaStatus(statusText, statusType);
        renderHaritaMarkers();
        updateHaritaTopBar();
        
        // Büyük ekran ortası overlay - DOĞRU / YANLIŞ
        if (msg.correct) {
            showHaritaBigOverlay("✓ DOĞRU", "correct", 2500);
        } else {
            showHaritaBigOverlay("✗ YANLIŞ", "wrong", 2500);
        }
        
        // Yanlış veya timeout ise → sol paneldeki futbolcu kartının altında doğru ülke
        if (!msg.correct && msg.correct_tr) {
            showHaritaCorrectAnswer(msg.correct_tr);
        }
        
        // Haritayı doğru ülkeye ışınla + zoom (herkeste)
        setTimeout(() => {
            flyHaritaToCountry(msg.correct_code);
            // Sync et rakibe (sadece sıradaki gönderir)
            if (haritaData.currentTurn === haritaData.playerId) {
                broadcastHaritaView();
            }
        }, 500);
        
        return;
    }
    
    if (msg.type === "harita_game_over") {
        haritaData.scores = msg.scores;
        stopHaritaTimer();
        updateHaritaTopBar();
        
        const title = document.getElementById("haritaGameOverTitle");
        const text = document.getElementById("haritaGameOverText");
        
        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === haritaData.playerId) {
            title.textContent = "KAZANDIN! 🏆";
            title.style.color = "#51cf66";
            startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }
        
        const p1 = getHaritaPlayerName(1);
        const p2 = getHaritaPlayerName(2);
        text.innerHTML = `
            <div style="font-size:20px; margin:15px 0;">
                <span style="color:#51cf66;">${p1}</span>: <b>${haritaData.scores[1]}</b><br>
                <span style="color:#ff6b6b;">${p2}</span>: <b>${haritaData.scores[2]}</b>
            </div>
        `;
        
        const rematchBtn = document.getElementById("haritaRematchBtn");
        if (haritaData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
        
        document.getElementById("haritaGameOverBox").classList.remove("hidden");
        return;
    }
    
    _prevHandleMessageHarita(msg);
};

// room_mode_result için harita desteği (join akışı)
const _origHandleForModeHarita = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }
        const name = joinNameInput.value.trim();
        const code = msg.room_code;
        if (msg.mode === "takim_bilmece") {
            send({ type: "takim_join_room", name: name, room_code: code });
        } else if (msg.mode === "kim_milyoner") {
            send({ type: "ml_join_room", name: name, room_code: code });
        } else if (msg.mode === "haritadan_bul") {
            send({ type: "harita_join_room", name: name, room_code: code });
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }
    _origHandleForModeHarita(msg);
};

// Başlangıçta popup'ları kapat
document.getElementById("haritaGameOverBox").classList.add("hidden");
document.getElementById("haritaConfirmBox").classList.add("hidden");

// F5/refresh sonrası ana menüye zorla dön
showScreen("home");

// ==========================================
// GİZEMLİ KARİYER - FRONTEND
// ==========================================

let gizemData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 60,
    totalRounds: 10,
    currentTurn: null,
    roundNo: 0,
    career: [],
    options: [],
    scores: { 1: 0, 2: 0 },
    jokersLeft: { 1: {}, 2: {} },
    hiddenIndices: [],
    answered: false,
    timerInterval: null,
    timerSeconds: 60
};

const createGizemScreen = document.getElementById("createGizemScreen");
const gizemLobbyScreen = document.getElementById("gizemLobbyScreen");
const gizemGameScreen = document.getElementById("gizemGameScreen");

// showScreen genişlet
const _prevShowScreenGizem = showScreen;
showScreen = function(screenName) {
    _prevShowScreenGizem(screenName);
    createGizemScreen.classList.add("hidden");
    gizemLobbyScreen.classList.add("hidden");
    gizemGameScreen.classList.add("hidden");
    if (screenName === "createGizem") createGizemScreen.classList.remove("hidden");
    if (screenName === "gizemLobby") gizemLobbyScreen.classList.remove("hidden");
    if (screenName === "gizemGame") gizemGameScreen.classList.remove("hidden");
};

// Mod kartına tıklama
const gizemCard = document.querySelector('[data-mod="gizemli_kariyer"]');
if (gizemCard) {
    gizemCard.addEventListener("click", () => {
        console.log("[GIZEM] Karta tıklandı");
        showScreen("createGizem");
        setTimeout(() => {
            const input = document.getElementById("createGizemNameInput");
            if (input) input.focus();
        }, 100);
    });
    console.log("[GIZEM] Kart listener eklendi");
} else {
    console.error("[GIZEM] Kart bulunamadı!");
}

// Kaydedilmiş isim
const _savedNameGizem = localStorage.getItem("playerName");
if (_savedNameGizem) {
    const gizInput = document.getElementById("createGizemNameInput");
    if (gizInput) gizInput.value = _savedNameGizem;
}

// Oda oluştur
document.getElementById("createGizemBtn").onclick = () => {
    const name = document.getElementById("createGizemNameInput").value.trim();
    if (!name) {
        document.getElementById("createGizemMsg").textContent = "İsim gir.";
        document.getElementById("createGizemMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;

    const turnSec = parseInt(document.getElementById("gizemTurnSecondsSelect").value) || 60;
    send({
        type: "gizem_create_room",
        name: name,
        turn_seconds: turnSec
    });
};

document.getElementById("createGizemBackBtn").onclick = () => {
    showScreen("modselect");
};

// Lobby butonları
document.getElementById("gizemStartBtn").onclick = () => {
    send({ type: "gizem_start_game" });
};

document.getElementById("gizemLobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("gizemRoomCodeText").onclick = () => {
    navigator.clipboard.writeText(gizemData.roomCode).then(() => {
        const hint = document.getElementById("gizemCopyHint");
        hint.textContent = "✓ Kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

// Oyun butonları
document.getElementById("gizemBackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("gizemBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("gizemRematchBtn").onclick = () => {
    document.getElementById("gizemGameOverBox").classList.add("hidden");
    send({ type: "gizem_rematch" });
};

// Şık butonları
document.querySelectorAll(".gizemOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (gizemData.currentTurn !== gizemData.playerId || gizemData.answered) return;
        const choice = parseInt(btn.dataset.choice);
        if (gizemData.hiddenIndices.includes(choice)) return;
        send({ type: "gizem_answer", index: choice });
    };
});

// Joker butonları
document.getElementById("gizemJokerHintBtn").onclick = () => {
    if (gizemData.currentTurn !== gizemData.playerId || gizemData.answered) return;
    send({ type: "gizem_joker_hint" });
};

document.getElementById("gizemJokerPassBtn").onclick = () => {
    if (gizemData.currentTurn !== gizemData.playerId || gizemData.answered) return;
    document.getElementById("gizemPassConfirmBox").classList.remove("hidden");
};

document.getElementById("gizemPassYesBtn").onclick = () => {
    document.getElementById("gizemPassConfirmBox").classList.add("hidden");
    send({ type: "gizem_joker_pass" });
};

document.getElementById("gizemPassNoBtn").onclick = () => {
    document.getElementById("gizemPassConfirmBox").classList.add("hidden");
};

// Timer
function startGizemTimer(seconds) {
    stopGizemTimer();
    gizemData.timerSeconds = seconds;
    updateGizemTimerDisplay();
    gizemData.timerInterval = setInterval(() => {
        gizemData.timerSeconds--;
        updateGizemTimerDisplay();
        if (gizemData.timerSeconds <= 0) stopGizemTimer();
    }, 1000);
}

function stopGizemTimer() {
    if (gizemData.timerInterval) {
        clearInterval(gizemData.timerInterval);
        gizemData.timerInterval = null;
    }
}

function updateGizemTimerDisplay() {
    const el = document.getElementById("gizemTimer");
    el.textContent = gizemData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (gizemData.timerSeconds <= 10) el.classList.add("danger");
    else if (gizemData.timerSeconds <= 20) el.classList.add("warning");
}

function getGizemOtherId() {
    return gizemData.playerId === 1 ? 2 : 1;
}

function getGizemPlayerName(id) {
    const p = gizemData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateGizemLobby() {
    document.getElementById("gizemRoomCodeText").textContent = gizemData.roomCode;
    document.getElementById("gizemLobbyTurnSeconds").textContent = gizemData.turnSeconds || 60;

    const list = document.getElementById("gizemPlayersList");
    list.innerHTML = "";
    gizemData.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === gizemData.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });

    const startBtn = document.getElementById("gizemStartBtn");
    const msg = document.getElementById("gizemLobbyMsg");

    if (gizemData.playerId === 1 && gizemData.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (gizemData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

function updateGizemTopBar() {
    document.getElementById("gizemRoundInfo").textContent =
        `Tur ${gizemData.roundNo + 1}/${gizemData.totalRounds}`;

    const turnName = getGizemPlayerName(gizemData.currentTurn);
    const turnColor = gizemData.currentTurn === gizemData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("gizemTurnInfo").innerHTML =
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;

    const p1 = getGizemPlayerName(1);
    const p2 = getGizemPlayerName(2);
    document.getElementById("gizemP1Name").textContent = p1;
    document.getElementById("gizemP2Name").textContent = p2;
    document.getElementById("gizemScore").textContent =
        `${gizemData.scores[1]} - ${gizemData.scores[2]}`;
}

function renderGizemCareer() {
    const box = document.getElementById("gizemCareerFlow");
    box.innerHTML = "";
    if (!gizemData.career || gizemData.career.length === 0) return;

    gizemData.career.forEach((team, i) => {
        const item = document.createElement("div");
        item.className = "gizemCareerItem";

        const logoBox = document.createElement("div");
        logoBox.className = "gizemTeamLogo";

        // Logoyu dene (TM CDN'den), olmazsa fallback (renkli kutu + isim)
        const showFallback = () => {
            logoBox.innerHTML = "";
            logoBox.classList.add("fallback");
            const [r, g, b] = team.color || [100, 100, 100];
            logoBox.style.background = `rgb(${r}, ${g}, ${b})`;
            const shortName = team.name.length > 10 ? team.name.substring(0, 10) : team.name;
            logoBox.textContent = shortName;
            const brightness = (r + g + b) / 3;
            logoBox.style.color = brightness < 128 ? "#fff" : "#000";
        };

        if (team.logo_url) {
            const img = document.createElement("img");
            img.src = team.logo_url;
            img.alt = team.name;
            img.referrerPolicy = "no-referrer"; // TM hotlink korumasını bypass et
            img.onerror = showFallback;
            logoBox.appendChild(img);
        } else {
            showFallback();
        }

        const nameDiv = document.createElement("div");
        nameDiv.className = "gizemTeamName";
        nameDiv.textContent = team.name;

        item.appendChild(logoBox);
        item.appendChild(nameDiv);
        box.appendChild(item);

        // Ok ekle (son eleman değilse)
        if (i < gizemData.career.length - 1) {
            const arrow = document.createElement("div");
            arrow.className = "gizemCareerArrow";
            arrow.textContent = "→";
            box.appendChild(arrow);
        }
    });
}

function renderGizemOptions() {
    const buttons = document.querySelectorAll(".gizemOptBtn");
    const isMyTurn = gizemData.currentTurn === gizemData.playerId;

    buttons.forEach((btn, i) => {
        btn.classList.remove("hidden-opt", "correct", "wrong");
        btn.disabled = false;
        const optText = gizemData.options[i] || "---";
        btn.querySelector(".optText").textContent = optText;

        if (gizemData.hiddenIndices.includes(i)) {
            btn.classList.add("hidden-opt");
            btn.disabled = true;
        }

        if (!isMyTurn || gizemData.answered) {
            btn.disabled = true;
        }
    });
}

function renderGizemJokers() {
    const isMyTurn = gizemData.currentTurn === gizemData.playerId;
    const my = gizemData.jokersLeft[gizemData.playerId] || {};
    const canUse = isMyTurn && !gizemData.answered;

    document.getElementById("gizemJokerHintBtn").disabled = !canUse || !my.hint || gizemData.hiddenIndices.length > 0;
    document.getElementById("gizemJokerPassBtn").disabled = !canUse || !my.pass;
}

function renderGizemAll() {
    updateGizemTopBar();
    renderGizemCareer();
    renderGizemOptions();
    renderGizemJokers();
}

function setGizemStatus(text, type) {
    const el = document.getElementById("gizemStatusMsg");
    el.textContent = text || "";
    el.classList.remove("correct", "wrong", "info");
    if (type) el.classList.add(type);
}

// Mesaj handler wrap
const _prevHandleMessageGizem = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "gizem_room_created" || msg.type === "gizem_room_joined") {
        gizemData.playerId = msg.player_id;
        gizemData.roomCode = msg.room_code;
        gizemData.turnSeconds = msg.turn_seconds || 60;
        gizemData.inGame = true;
        inRoom = true;
        showScreen("gizemLobby");
        updateGizemLobby();
        return;
    }

    if (msg.type === "gizem_lobby_update") {
        gizemData.roomCode = msg.room_code;
        gizemData.players = msg.players;
        gizemData.turnSeconds = msg.turn_seconds || 60;
        updateGizemLobby();
        return;
    }

    if (msg.type === "gizem_game_started") {
        gizemData.playerId = msg.player_id;
        gizemData.players = msg.players;
        gizemData.turnSeconds = msg.turn_seconds;
        gizemData.totalRounds = msg.total_rounds;
        gizemData.currentTurn = msg.current_turn;
        gizemData.roundNo = msg.round_no;
        gizemData.career = msg.career;
        gizemData.options = msg.options;
        gizemData.scores = msg.scores;
        gizemData.jokersLeft = msg.jokers_left;
        gizemData.hiddenIndices = [];
        gizemData.answered = false;

        showScreen("gizemGame");
        renderGizemAll();
        setGizemStatus("");
        startGizemTimer(gizemData.turnSeconds);

        if (gizemData.currentTurn === gizemData.playerId) {
            setGizemStatus("Senin sıran! Doğru futbolcuyu bul.", "correct");
        } else {
            setGizemStatus(getGizemPlayerName(gizemData.currentTurn) + " oynuyor...", "info");
        }
        return;
    }

    if (msg.type === "gizem_new_round") {
        gizemData.roundNo = msg.round_no;
        gizemData.totalRounds = msg.total_rounds;
        gizemData.currentTurn = msg.current_turn;
        gizemData.career = msg.career;
        gizemData.options = msg.options;
        gizemData.scores = msg.scores;
        gizemData.jokersLeft = msg.jokers_left;
        gizemData.hiddenIndices = [];
        gizemData.answered = false;

        renderGizemAll();
        setGizemStatus("");
        startGizemTimer(gizemData.turnSeconds);

        if (gizemData.currentTurn === gizemData.playerId) {
            setGizemStatus("Senin sıran! Doğru futbolcuyu bul.", "correct");
        } else {
            setGizemStatus(getGizemPlayerName(gizemData.currentTurn) + " oynuyor...", "info");
        }
        return;
    }

    if (msg.type === "gizem_joker_used") {
        if (msg.jokers_left) gizemData.jokersLeft = msg.jokers_left;
        if (msg.joker_type === "hint") {
            gizemData.hiddenIndices = msg.hidden_indices || [];
        }
        renderGizemOptions();
        renderGizemJokers();
        return;
    }

    if (msg.type === "gizem_answer_result") {
        gizemData.answered = true;
        gizemData.scores = msg.scores;
        if (msg.jokers_left) gizemData.jokersLeft = msg.jokers_left;
        stopGizemTimer();

        // Şıkları işaretle
        const buttons = document.querySelectorAll(".gizemOptBtn");
        buttons.forEach((btn, i) => {
            btn.disabled = true;
            if (i === msg.correct_index) {
                btn.classList.add("correct");
            } else if (i === msg.selected_index && !msg.correct) {
                btn.classList.add("wrong");
            }
        });

        const playerName = getGizemPlayerName(msg.player_id);
        let statusText = "";
        let statusType = "info";

        if (msg.passed) {
            statusText = `⏭️ ${playerName} PAS geçti. Doğru: ${msg.correct_name}`;
            statusType = "wrong";
        } else if (msg.timeout) {
            statusText = `⏰ ${playerName} süresi doldu! Doğru: ${msg.correct_name}`;
            statusType = "wrong";
        } else if (msg.correct) {
            statusText = `✓ ${playerName} DOĞRU! +${msg.earned} puan`;
            statusType = "correct";
        } else {
            statusText = `✗ ${playerName} YANLIŞ! Doğru: ${msg.correct_name}`;
            statusType = "wrong";
        }

        setGizemStatus(statusText, statusType);
        updateGizemTopBar();
        return;
    }

    if (msg.type === "gizem_game_over") {
        gizemData.scores = msg.scores;
        stopGizemTimer();
        updateGizemTopBar();

        const title = document.getElementById("gizemGameOverTitle");
        const text = document.getElementById("gizemGameOverText");

        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === gizemData.playerId) {
            title.textContent = "KAZANDIN! 🏆";
            title.style.color = "#51cf66";
            startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }

        const p1 = getGizemPlayerName(1);
        const p2 = getGizemPlayerName(2);
        text.innerHTML = `
            <div style="font-size:20px; margin:15px 0;">
                <span style="color:#51cf66;">${p1}</span>: <b>${gizemData.scores[1]}</b> puan<br>
                <span style="color:#ff6b6b;">${p2}</span>: <b>${gizemData.scores[2]}</b> puan
            </div>
        `;

        const rematchBtn = document.getElementById("gizemRematchBtn");
        if (gizemData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }

        document.getElementById("gizemGameOverBox").classList.remove("hidden");
        return;
    }

    _prevHandleMessageGizem(msg);
};

// room_mode_result için gizem desteği
const _origHandleForModeGizem = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }
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
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }
    _origHandleForModeGizem(msg);
};

// Başlangıçta popup'ları kapat
document.getElementById("gizemGameOverBox").classList.add("hidden");
document.getElementById("gizemPassConfirmBox").classList.add("hidden");

// ==========================================
// İLK 11 CHALLENGE - FRONTEND
// ==========================================

let ilk11Data = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 120,
    positions: {},
    myTeam: {},       // { pos_id: { index, name, img_file } }
    myCount: 0,
    oppCount: 0,
    oppFinished: false,
    timerInterval: null,
    timerSeconds: 120,
    logItems: []
};

const createIlk11Screen = document.getElementById("createIlk11Screen");
const ilk11LobbyScreen = document.getElementById("ilk11LobbyScreen");
const ilk11GameScreen = document.getElementById("ilk11GameScreen");
const ilk11PopupBox = document.getElementById("ilk11PopupBox");
const ilk11ResultBox = document.getElementById("ilk11ResultBox");

// showScreen genişlet
const _prevShowScreenIlk11 = showScreen;
showScreen = function(screenName) {
    _prevShowScreenIlk11(screenName);
    createIlk11Screen.classList.add("hidden");
    ilk11LobbyScreen.classList.add("hidden");
    ilk11GameScreen.classList.add("hidden");
    if (screenName === "createIlk11") createIlk11Screen.classList.remove("hidden");
    if (screenName === "ilk11Lobby") ilk11LobbyScreen.classList.remove("hidden");
    if (screenName === "ilk11Game") ilk11GameScreen.classList.remove("hidden");
};

// Mod kartına tıklama
const ilk11Card = document.querySelector('[data-mod="ilk_11_challenge"]');
if (ilk11Card) {
    ilk11Card.addEventListener("click", () => {
        showScreen("createIlk11");
        setTimeout(() => {
            const input = document.getElementById("createIlk11NameInput");
            if (input) input.focus();
        }, 100);
    });
}

// Kaydedilmiş isim
const _savedNameIlk11 = localStorage.getItem("playerName");
if (_savedNameIlk11) {
    const inp = document.getElementById("createIlk11NameInput");
    if (inp) inp.value = _savedNameIlk11;
}

// Oda oluştur
document.getElementById("createIlk11Btn").onclick = () => {
    const name = document.getElementById("createIlk11NameInput").value.trim();
    if (!name) {
        document.getElementById("createIlk11Msg").textContent = "İsim gir.";
        document.getElementById("createIlk11Msg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;
    const turnSec = parseInt(document.getElementById("ilk11TurnSecondsSelect").value) || 120;
    send({ type: "ilk11_create_room", name: name, turn_seconds: turnSec });
};

document.getElementById("createIlk11BackBtn").onclick = () => {
    showScreen("modselect");
};

// Lobby butonları
document.getElementById("ilk11StartBtn").onclick = () => {
    send({ type: "ilk11_start_game" });
};

document.getElementById("ilk11LobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("ilk11RoomCodeText").onclick = () => {
    navigator.clipboard.writeText(ilk11Data.roomCode).then(() => {
        const hint = document.getElementById("ilk11CopyHint");
        hint.textContent = "✓ Kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

// Oyun butonları
document.getElementById("ilk11BackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("ilk11BackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("ilk11RematchBtn").onclick = () => {
    ilk11ResultBox.classList.add("hidden");
    send({ type: "ilk11_rematch" });
};

document.getElementById("ilk11PopupCloseBtn").onclick = () => {
    ilk11PopupBox.classList.add("hidden");
};

// ==========================================
// İLK 11 - YARDIMCI FONKSİYONLAR
// ==========================================

function getIlk11PlayerName(id) {
    const p = ilk11Data.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateIlk11Lobby() {
    document.getElementById("ilk11RoomCodeText").textContent = ilk11Data.roomCode;
    document.getElementById("ilk11LobbyTurnSeconds").textContent = ilk11Data.turnSeconds || 120;

    const list = document.getElementById("ilk11PlayersList");
    list.innerHTML = "";
    ilk11Data.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === ilk11Data.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });

    const startBtn = document.getElementById("ilk11StartBtn");
    const msg = document.getElementById("ilk11LobbyMsg");

    if (ilk11Data.playerId === 1 && ilk11Data.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (ilk11Data.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

// Timer
function startIlk11Timer(seconds) {
    stopIlk11Timer();
    ilk11Data.timerSeconds = seconds;
    updateIlk11TimerDisplay();
    ilk11Data.timerInterval = setInterval(() => {
        ilk11Data.timerSeconds--;
        updateIlk11TimerDisplay();
        if (ilk11Data.timerSeconds <= 0) stopIlk11Timer();
    }, 1000);
}

function stopIlk11Timer() {
    if (ilk11Data.timerInterval) {
        clearInterval(ilk11Data.timerInterval);
        ilk11Data.timerInterval = null;
    }
}

function updateIlk11TimerDisplay() {
    const el = document.getElementById("ilk11Timer");
    el.textContent = ilk11Data.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (ilk11Data.timerSeconds <= 20) el.classList.add("danger");
    else if (ilk11Data.timerSeconds <= 40) el.classList.add("warning");
}

function addIlk11Log(text) {
    ilk11Data.logItems.unshift(text);
    if (ilk11Data.logItems.length > 15) ilk11Data.logItems.pop();

    const list = document.getElementById("ilk11LogList");
    list.innerHTML = "";
    ilk11Data.logItems.forEach(item => {
        const div = document.createElement("div");
        div.className = "ilk11LogItem";
        div.textContent = item;
        list.appendChild(div);
    });
}

function updateIlk11Progress() {
    document.getElementById("ilk11MyProgress").textContent =
        `Kadrom: ${ilk11Data.myCount}/11`;
    document.getElementById("ilk11OppProgress").textContent =
        `Rakip: ${ilk11Data.oppCount}/11`;
    document.getElementById("ilk11MyCount").textContent =
        `${ilk11Data.myCount} / 11`;

    const oppStatus = document.getElementById("ilk11OppStatus");
    if (ilk11Data.oppFinished) {
        oppStatus.textContent = "✓ 11'i hazır!";
        oppStatus.style.color = "#ff6b6b";
    } else {
        oppStatus.textContent = `Seçiyor... (${ilk11Data.oppCount}/11)`;
        oppStatus.style.color = "#ffa94d";
    }
}

// ==========================================
// İLK 11 - SAHA ÇİZİMİ
// ==========================================

// Pozisyon koordinatları (x/y: 0-1 oranları)
const ILK11_POSITIONS = {
    GK:  { name: "KALECİ",    x: 0.50, y: 0.88, type: "Kaleci"   },
    LB:  { name: "SOL BEK",   x: 0.15, y: 0.68, type: "Defans"   },
    CB1: { name: "STOPER",    x: 0.38, y: 0.73, type: "Defans"   },
    CB2: { name: "STOPER",    x: 0.62, y: 0.73, type: "Defans"   },
    RB:  { name: "SAĞ BEK",   x: 0.85, y: 0.68, type: "Defans"   },
    CM1: { name: "ORTA SAHA", x: 0.22, y: 0.48, type: "OrtaSaha" },
    CM2: { name: "ORTA SAHA", x: 0.50, y: 0.52, type: "OrtaSaha" },
    CM3: { name: "ORTA SAHA", x: 0.78, y: 0.48, type: "OrtaSaha" },
    LW:  { name: "SOL KANAT", x: 0.18, y: 0.22, type: "Forvet"   },
    ST:  { name: "FORVET",    x: 0.50, y: 0.15, type: "Forvet"   },
    RW:  { name: "SAĞ KANAT", x: 0.82, y: 0.22, type: "Forvet"   }
};

function renderIlk11Field() {
    const slotsContainer = document.getElementById("ilk11Slots");
    const field = document.getElementById("ilk11Field");
    if (!slotsContainer || !field) return;

    slotsContainer.innerHTML = "";

    const fieldW = field.offsetWidth || 520;
    const fieldH = field.offsetHeight || 580;
    const slotW = 85;
    const slotH = 100;

    Object.entries(ILK11_POSITIONS).forEach(([posId, posData]) => {
        const slot = document.createElement("div");
        slot.className = "ilk11Slot";

        const px = posData.x * fieldW - slotW / 2;
        const py = posData.y * fieldH - slotH / 2;
        slot.style.left = px + "px";
        slot.style.top = py + "px";

        const filled = ilk11Data.myTeam[posId];

        if (filled) {
            slot.classList.add("filled");

            const img = document.createElement("img");
            img.className = "ilk11SlotImg";
            img.src = `/static/images/${filled.img_file}`;
            img.onerror = () => { img.style.display = "none"; };

            const nameDiv = document.createElement("div");
            nameDiv.className = "ilk11SlotName";
            nameDiv.textContent = filled.name.length > 10
                ? filled.name.substring(0, 10) + "…"
                : filled.name;

            slot.appendChild(img);
            slot.appendChild(nameDiv);
        } else {
            slot.classList.add("empty");

            const posName = document.createElement("div");
            posName.className = "ilk11SlotPosName";
            posName.textContent = posData.name;

            const posIdDiv = document.createElement("div");
            posIdDiv.className = "ilk11SlotPosId";
            posIdDiv.textContent = posId;

            slot.appendChild(posName);
            slot.appendChild(posIdDiv);

            // Tıklanabilir - popup aç
            slot.addEventListener("click", () => {
                openIlk11Popup(posId, posData);
            });
        }

        slotsContainer.appendChild(slot);
    });
}

// ==========================================
// İLK 11 - POPUP (FUTBOLCU SEÇ)
// ==========================================

function openIlk11Popup(posId, posData) {
    document.getElementById("ilk11PopupTitle").textContent =
        `${posData.name} için futbolcu seç`;

    const grid = document.getElementById("ilk11PopupOptions");
    grid.innerHTML = "";

    // Loading göster
    const loading = document.createElement("div");
    loading.textContent = "Yükleniyor...";
    loading.style.color = "#ffd43b";
    loading.style.padding = "20px";
    grid.appendChild(loading);

    ilk11PopupBox.classList.remove("hidden");

    // Backend'den seçenekleri iste
    send({ type: "ilk11_get_options", pos_id: posId });

    // Mevcut pos_id'yi sakla
    ilk11PopupBox.dataset.currentPosId = posId;
}

function renderIlk11PopupOptions(options) {
    const grid = document.getElementById("ilk11PopupOptions");
    grid.innerHTML = "";

    const posId = ilk11PopupBox.dataset.currentPosId;

    options.forEach(opt => {
        const card = document.createElement("div");
        card.className = "ilk11PopupOption";

        const img = document.createElement("img");
        img.className = "ilk11PopupImg";
        img.src = `/static/images/${opt.img_file}`;
        img.onerror = () => { img.style.display = "none"; };

        const name = document.createElement("div");
        name.className = "ilk11PopupName";
        name.textContent = opt.name;

        const pos = document.createElement("div");
        pos.className = "ilk11PopupPos";
        pos.textContent = opt.position;

        const league = document.createElement("div");
        league.className = "ilk11PopupLeague";
        league.textContent = opt.league || "?";

        const nat = document.createElement("div");
        nat.className = "ilk11PopupNat";
        nat.textContent = opt.nationality || "?";

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(pos);
        card.appendChild(league);
        card.appendChild(nat);

        card.addEventListener("click", () => {
            ilk11PopupBox.classList.add("hidden");
            send({
                type: "ilk11_select",
                pos_id: posId,
                index: opt.index
            });
        });

        grid.appendChild(card);
    });
}

// ==========================================
// İLK 11 - SONUÇ EKRANI
// ==========================================

function renderIlk11Result(data) {
    stopIlk11Timer();

    // İsimler
    document.getElementById("ilk11ResultMyName").textContent = data.player1.name;
    document.getElementById("ilk11ResultOppName").textContent = data.player2.name;

    // Skorlar
    document.getElementById("ilk11ResultMyRating").textContent = data.player1.total_rating;
    document.getElementById("ilk11ResultMyChem").textContent = data.player1.chemistry;
    document.getElementById("ilk11ResultMyTotal").textContent = data.player1.total_score;

    document.getElementById("ilk11ResultOppRating").textContent = data.player2.total_rating;
    document.getElementById("ilk11ResultOppChem").textContent = data.player2.chemistry;
    document.getElementById("ilk11ResultOppTotal").textContent = data.player2.total_score;

    // Mini sahalar
    renderIlk11MiniField("ilk11ResultMyField", data.player1.team, "#51cf66");
    renderIlk11MiniField("ilk11ResultOppField", data.player2.team, "#ffa94d");

    // Kazanan yazısı
    const winnerEl = document.getElementById("ilk11ResultWinner");
    if (data.winner_id === 0) {
        winnerEl.textContent = "⚖️ BERABERE!";
        winnerEl.style.color = "#74c0fc";
    } else if (data.winner_id === ilk11Data.playerId) {
        winnerEl.textContent = "🏆 KAZANDIN!";
        winnerEl.style.color = "#51cf66";
        startConfetti();
    } else {
        winnerEl.textContent = "😢 KAYBETTİN";
        winnerEl.style.color = "#ff6b6b";
    }

    // Rematch sadece host
    const rematchBtn = document.getElementById("ilk11RematchBtn");
    if (ilk11Data.playerId === 1) {
        rematchBtn.classList.remove("hidden");
    } else {
        rematchBtn.classList.add("hidden");
    }

    ilk11ResultBox.classList.remove("hidden");
}

function renderIlk11MiniField(containerId, teamData, borderColor) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const fw = container.offsetWidth || 380;
    const fh = container.offsetHeight || 350;
    const slotW = 62;
    const slotH = 75;

    teamData.forEach(player => {
        const posData = ILK11_POSITIONS[player.pos_id];
        if (!posData) return;

        const slot = document.createElement("div");
        slot.className = "ilk11MiniSlot";

        const px = posData.x * fw - slotW / 2;
        const py = posData.y * fh - slotH / 2;
        slot.style.left = px + "px";
        slot.style.top = py + "px";
        slot.style.border = `2px solid ${borderColor}`;
        slot.style.background = "rgba(0,0,0,0.5)";
        slot.style.borderRadius = "6px";
        slot.style.position = "absolute";
        slot.style.textAlign = "center";

        if (player.index >= 0) {
            const ratingDiv = document.createElement("div");
            ratingDiv.className = "ilk11MiniRating";
            ratingDiv.textContent = player.rating || "?";
            slot.appendChild(ratingDiv);

            const img = document.createElement("img");
            img.className = "ilk11MiniImg";
            img.src = `/static/images/${player.img_file}`;
            img.onerror = () => { img.style.display = "none"; };
            slot.appendChild(img);

            const nameDiv = document.createElement("div");
            nameDiv.className = "ilk11MiniName";
            nameDiv.textContent = (player.name || "").substring(0, 8);
            slot.appendChild(nameDiv);
        } else {
            slot.style.opacity = "0.3";
            const posName = document.createElement("div");
            posName.style.color = "white";
            posName.style.fontSize = "11px";
            posName.style.marginTop = "25px";
            posName.textContent = player.pos_name || player.pos_id;
            slot.appendChild(posName);
        }

        container.appendChild(slot);
    });
}

// ==========================================
// İLK 11 - MESAJ HANDLER
// ==========================================

const _prevHandleMessageIlk11 = handleMessage;
handleMessage = function(msg) {

    if (msg.type === "ilk11_room_created" || msg.type === "ilk11_room_joined") {
        ilk11Data.playerId = msg.player_id;
        ilk11Data.roomCode = msg.room_code;
        ilk11Data.turnSeconds = msg.turn_seconds || 120;
        ilk11Data.inGame = true;
        inRoom = true;
        showScreen("ilk11Lobby");
        updateIlk11Lobby();
        return;
    }

    if (msg.type === "ilk11_lobby_update") {
        ilk11Data.roomCode = msg.room_code;
        ilk11Data.players = msg.players;
        ilk11Data.turnSeconds = msg.turn_seconds || 120;
        updateIlk11Lobby();
        return;
    }

    if (msg.type === "ilk11_game_started") {
        ilk11Data.playerId = msg.player_id;
        ilk11Data.players = msg.players;
        ilk11Data.turnSeconds = msg.turn_seconds;
        ilk11Data.positions = msg.positions;
        ilk11Data.myTeam = {};
        ilk11Data.myCount = 0;
        ilk11Data.oppCount = 0;
        ilk11Data.oppFinished = false;
        ilk11Data.logItems = [];

        const myNameStr = getIlk11PlayerName(ilk11Data.playerId);
        const oppId = ilk11Data.playerId === 1 ? 2 : 1;
        const oppName = getIlk11PlayerName(oppId);

        document.getElementById("ilk11MyName").textContent = myNameStr;
        document.getElementById("ilk11OppName").textContent = oppName;

        showScreen("ilk11Game");
        updateIlk11Progress();

        setTimeout(() => {
            renderIlk11Field();
        }, 100);

        document.getElementById("ilk11StatusMsg").textContent =
            "Mevkilere tıklayarak kadronı kur!";

        startIlk11Timer(ilk11Data.turnSeconds);
        return;
    }

    if (msg.type === "ilk11_options") {
        renderIlk11PopupOptions(msg.options);
        return;
    }

    if (msg.type === "ilk11_selected") {
        ilk11Data.myTeam[msg.pos_id] = {
            index: msg.index,
            name: msg.name,
            img_file: msg.img_file
        };
        ilk11Data.myCount = msg.count;

        const posData = ILK11_POSITIONS[msg.pos_id];
        const posName = posData ? posData.name : msg.pos_id;
        addIlk11Log(`${posName}: ${msg.name}`);

        updateIlk11Progress();
        renderIlk11Field();

        if (msg.count >= 11) {
            document.getElementById("ilk11StatusMsg").textContent =
                "✅ Kadron hazır! Rakip bekleniyor...";
            document.getElementById("ilk11StatusMsg").style.color = "#51cf66";
        }
        return;
    }

    if (msg.type === "ilk11_opponent_progress") {
        ilk11Data.oppCount = msg.count;
        updateIlk11Progress();
        return;
    }

    if (msg.type === "ilk11_opponent_finished") {
        ilk11Data.oppFinished = true;
        ilk11Data.oppCount = 11;
        updateIlk11Progress();
        addIlk11Log(`${msg.name} kadrosunu tamamladı!`);
        showToast(
            "⚽ Rakip Hazır!",
            `${msg.name} 11'ini tamamladı!`,
            null,
            "success"
        );
        return;
    }

    if (msg.type === "ilk11_team_complete") {
        document.getElementById("ilk11StatusMsg").textContent = msg.message;
        document.getElementById("ilk11StatusMsg").style.color = "#ffd43b";
        return;
    }

    if (msg.type === "ilk11_auto_completed") {
        addIlk11Log("⏰ Süre doldu! Eksik pozisyonlar otomatik dolduruldu.");
        document.getElementById("ilk11StatusMsg").textContent =
            "⏰ Süre bitti! Kadron otomatik tamamlandı.";
        document.getElementById("ilk11StatusMsg").style.color = "#ffa94d";
        return;
    }

    if (msg.type === "ilk11_result") {
        renderIlk11Result(msg);
        return;
    }

    _prevHandleMessageIlk11(msg);
};

// room_mode_result için ilk11 desteği
const _origHandleForModeIlk11 = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }
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
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }
    _origHandleForModeIlk11(msg);
};

// Başlangıçta popup'ları kapat
ilk11PopupBox.classList.add("hidden");
ilk11ResultBox.classList.add("hidden");

console.log("app.js yüklendi ✓");
     
// ==========================================
// STADYUM TANIMA - FRONTEND
// ==========================================

let stadData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 20,
    totalRounds: 10,
    currentPlayer: null,
    roundNo: 0,
    stadium: null,
    options: [],
    eliminatedIndices: [],
    scores: { 1: 0, 2: 0 },
    jokersLeft: { 1: 3, 2: 3 },
    answered: false,
    timerInterval: null,
    timerSeconds: 20,
    clues: {
        takim: null,
        ulke: null
    }
};

const createStadScreen = document.getElementById("createStadScreen");
const stadLobbyScreen = document.getElementById("stadLobbyScreen");
const stadGameScreen = document.getElementById("stadGameScreen");

// showScreen genişlet
const _prevShowScreenStad = showScreen;
showScreen = function(screenName) {
    _prevShowScreenStad(screenName);
    if (createStadScreen) createStadScreen.classList.add("hidden");
    if (stadLobbyScreen) stadLobbyScreen.classList.add("hidden");
    if (stadGameScreen) stadGameScreen.classList.add("hidden");

    if (screenName === "createStad") createStadScreen.classList.remove("hidden");
    if (screenName === "stadLobby") stadLobbyScreen.classList.remove("hidden");
    if (screenName === "stadGame") stadGameScreen.classList.remove("hidden");
};

// Mod kartı
const stadCard = document.querySelector('[data-mod="stadyum_tanima"]');
if (stadCard) {
    stadCard.addEventListener("click", () => {
        showScreen("createStad");
        setTimeout(() => {
            const input = document.getElementById("createStadNameInput");
            if (input) input.focus();
        }, 100);
    });
}

// Kayıtlı isim
const _savedNameStad = localStorage.getItem("playerName");
if (_savedNameStad) {
    const inp = document.getElementById("createStadNameInput");
    if (inp) inp.value = _savedNameStad;
}

// Oda oluştur
document.getElementById("createStadBtn").onclick = () => {
    const name = document.getElementById("createStadNameInput").value.trim();
    if (!name) {
        document.getElementById("createStadMsg").textContent = "İsim gir.";
        document.getElementById("createStadMsg").style.color = "#ff6b6b";
        return;
    }

    localStorage.setItem("playerName", name);
    myName = name;

    const turnSec = parseInt(document.getElementById("stadTurnSecondsSelect").value) || 30;
    send({
        type: "stad_create_room",
        name: name,
        turn_seconds: turnSec
    });
};

document.getElementById("createStadBackBtn").onclick = () => {
    showScreen("modselect");
};

// Lobby
document.getElementById("stadStartBtn").onclick = () => {
    send({ type: "stad_start_game" });
};

document.getElementById("stadLobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("stadRoomCodeText").onclick = () => {
    navigator.clipboard.writeText(stadData.roomCode).then(() => {
        const hint = document.getElementById("stadCopyHint");
        hint.textContent = "✓ Kopyalandı!";
        hint.classList.add("show");
        setTimeout(() => hint.classList.remove("show"), 2000);
    });
};

// Oyun butonları
document.getElementById("stadBackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("stadBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("stadRematchBtn").onclick = () => {
    document.getElementById("stadGameOverBox").classList.add("hidden");
    send({ type: "stad_rematch" });
};

// Şık tıklama
document.querySelectorAll(".stadOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (stadData.currentPlayer !== stadData.playerId) return;
        if (stadData.answered) return;

        const idx = parseInt(btn.dataset.index);
        if (stadData.eliminatedIndices.includes(idx)) return;

        send({
            type: "stad_submit_answer",
            index: idx
        });
    };
});

// Jokerler
document.getElementById("stadJokerTakimBtn").onclick = () => {
    if (stadData.currentPlayer !== stadData.playerId || stadData.answered) return;
    send({ type: "stad_use_joker", joker: "takim" });
};

document.getElementById("stadJokerUlkeBtn").onclick = () => {
    if (stadData.currentPlayer !== stadData.playerId || stadData.answered) return;
    send({ type: "stad_use_joker", joker: "ulke" });
};

// (SİLİNDİ - harf jokeri kaldırıldı)

document.getElementById("stadJoker5050Btn").onclick = () => {
    if (stadData.currentPlayer !== stadData.playerId || stadData.answered) return;
    send({ type: "stad_use_joker", joker: "5050" });
};

// Timer
function startStadTimer(seconds) {
    stopStadTimer();
    stadData.timerSeconds = seconds;
    updateStadTimerDisplay();
    stadData.timerInterval = setInterval(() => {
        stadData.timerSeconds--;
        updateStadTimerDisplay();
        if (stadData.timerSeconds <= 0) stopStadTimer();
    }, 1000);
}

function stopStadTimer() {
    if (stadData.timerInterval) {
        clearInterval(stadData.timerInterval);
        stadData.timerInterval = null;
    }
}

function updateStadTimerDisplay() {
    const el = document.getElementById("stadTimer");
    el.textContent = stadData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (stadData.timerSeconds <= 5) el.classList.add("danger");
    else if (stadData.timerSeconds <= 10) el.classList.add("warning");
}

function getStadPlayerName(id) {
    const p = stadData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateStadLobby() {
    document.getElementById("stadRoomCodeText").textContent = stadData.roomCode;
    document.getElementById("stadLobbyTurnSeconds").textContent = stadData.turnSeconds || 30;

    const list = document.getElementById("stadPlayersList");
    list.innerHTML = "";
    stadData.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === stadData.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });

    const startBtn = document.getElementById("stadStartBtn");
    const msg = document.getElementById("stadLobbyMsg");

    if (stadData.playerId === 1 && stadData.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (stadData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

function setStadStatus(text, color) {
    const el = document.getElementById("stadStatusMsg");
    el.textContent = text || "";
    el.style.color = color || "#ffd43b";
}

function renderStadTopBar() {
    document.getElementById("stadRoundInfo").textContent =
        `Tur ${stadData.roundNo + 1}/${stadData.totalRounds}`;

    const turnName = getStadPlayerName(stadData.currentPlayer);
    const turnColor = stadData.currentPlayer === stadData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("stadTurnInfo").innerHTML =
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;

    document.getElementById("stadP1Name").textContent = getStadPlayerName(1);
    document.getElementById("stadP2Name").textContent = getStadPlayerName(2);
    document.getElementById("stadScore").textContent =
        `${stadData.scores[1]} - ${stadData.scores[2]}`;
}

function resetStadClues() {
    stadData.clues = {
        takim: null,
        ulke: null
    };
    stadData.eliminatedIndices = [];
}

function renderStadClues() {
    const takimEl = document.getElementById("stadHintTakim");
    const ulkeEl = document.getElementById("stadHintUlke");

    takimEl.classList.add("hidden");
    ulkeEl.classList.add("hidden");

    if (stadData.clues.takim) {
        takimEl.textContent = `🏆 Takım: ${stadData.clues.takim}`;
        takimEl.classList.remove("hidden");
    }
    if (stadData.clues.ulke) {
        ulkeEl.textContent = `🌍 Ülke: ${stadData.clues.ulke}`;
        ulkeEl.classList.remove("hidden");
    }
}

function renderStadJokers() {
    const myJokerCount = (stadData.jokersLeft[stadData.playerId] ?? 0);
    document.getElementById("stadJokerCount").textContent = myJokerCount;

    const myTurn = stadData.currentPlayer === stadData.playerId;
    const canUse = myTurn && !stadData.answered && myJokerCount > 0;

    document.getElementById("stadJokerTakimBtn").disabled = !canUse;
    document.getElementById("stadJokerUlkeBtn").disabled = !canUse;
    document.getElementById("stadJoker5050Btn").disabled = !canUse;
}

function renderStadGame() {
    renderStadTopBar();
    renderStadJokers();
    renderStadClues();
    renderStadOptions();

    const img = document.getElementById("stadImage");
    const reveal = document.getElementById("stadAnswerReveal");

    reveal.classList.add("hidden");
    reveal.textContent = "";

    if (stadData.stadium) {
        img.src = `/stadyum_images/${stadData.stadium.img_file}`;
    }

    const myTurn = stadData.currentPlayer === stadData.playerId;

    if (myTurn) {
        setStadStatus("Senin sıran! Doğru şıkkı seç.", "#51cf66");
    } else {
        setStadStatus(`${getStadPlayerName(stadData.currentPlayer)} cevaplıyor...`, "#ffa94d");
    }
}

function renderStadOptions() {
    const buttons = document.querySelectorAll(".stadOptBtn");
    const myTurn = stadData.currentPlayer === stadData.playerId;

    buttons.forEach((btn, i) => {
        btn.classList.remove("correct", "wrong", "eliminated");
        const opt = stadData.options[i] || "---";
        btn.querySelector(".optText").textContent = opt;

        btn.disabled = !myTurn || stadData.answered;

        if (stadData.eliminatedIndices.includes(i)) {
            btn.classList.add("eliminated");
            btn.disabled = true;
        }
    });
}

function showStadResultMessage(msg) {
    const reveal = document.getElementById("stadAnswerReveal");
    reveal.classList.remove("hidden");

    if (msg.timeout) {
        reveal.textContent = `⏰ Süre doldu! Doğru cevap: ${msg.correct_answer}`;
        reveal.style.color = "#ff6b6b";
    } else if (msg.correct) {
        reveal.textContent = `✅ Doğru! ${msg.correct_answer} | +${msg.earned}`;
        reveal.style.color = "#51cf66";
    } else {
        reveal.textContent = `❌ Yanlış! Doğru: ${msg.correct_answer} | ${msg.earned}`;
        reveal.style.color = "#ff6b6b";
    }

    // Şıkları renklendirmek için
    const buttons = document.querySelectorAll(".stadOptBtn");
    buttons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === msg.correct_index) {
            btn.classList.add("correct");
        } else if (i === msg.selected_index && !msg.correct) {
            btn.classList.add("wrong");
        }
    });
}

// Mesaj handler
const _prevHandleMessageStad = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "stad_room_created" || msg.type === "stad_room_joined") {
        stadData.playerId = msg.player_id;
        stadData.roomCode = msg.room_code;
        stadData.turnSeconds = msg.turn_seconds || 30;
        stadData.inGame = true;
        inRoom = true;
        showScreen("stadLobby");
        updateStadLobby();
        return;
    }

    if (msg.type === "stad_lobby_update") {
        stadData.roomCode = msg.room_code;
        stadData.players = msg.players;
        stadData.turnSeconds = msg.turn_seconds || 30;
        stadData.totalRounds = msg.total_rounds || 10;
        updateStadLobby();
        return;
    }

    if (msg.type === "stad_game_started") {
        stadData.playerId = msg.player_id;
        stadData.players = msg.players;
        stadData.turnSeconds = msg.turn_seconds || 20;
        stadData.totalRounds = msg.total_rounds || 10;
        stadData.currentPlayer = msg.current_player;
        stadData.roundNo = msg.round_no;
        stadData.stadium = msg.stadium;
        stadData.options = msg.options || [];
        stadData.scores = msg.scores;
        stadData.jokersLeft = msg.jokers_left || { 1: 3, 2: 3 };
        stadData.answered = false;
        resetStadClues();

        showScreen("stadGame");
        renderStadGame();
        startStadTimer(stadData.turnSeconds);
        return;
    }

    if (msg.type === "stad_new_round") {
        stadData.roundNo = msg.round_no;
        stadData.totalRounds = msg.total_rounds || 10;
        stadData.currentPlayer = msg.current_player;
        stadData.stadium = msg.stadium;
        stadData.options = msg.options || [];
        stadData.scores = msg.scores;
        stadData.jokersLeft = msg.jokers_left || stadData.jokersLeft;
        stadData.answered = false;
        resetStadClues();

        renderStadGame();
        startStadTimer(stadData.turnSeconds);
        return;
    }

    if (msg.type === "stad_joker_result") {
        stadData.jokersLeft = msg.jokers_left || stadData.jokersLeft;

        if (msg.joker_type === "takim") {
            stadData.clues.takim = msg.value;
        } else if (msg.joker_type === "ulke") {
            stadData.clues.ulke = msg.value;
        } else if (msg.joker_type === "5050") {
            stadData.eliminatedIndices = msg.eliminated_indices || [];
        }

        setStadStatus(`${getStadPlayerName(msg.player_id)} joker kullandı: ${msg.joker_type.toUpperCase()}`, "#ffd43b");

        renderStadJokers();
        renderStadClues();
        renderStadOptions();
        return;
    }

    if (msg.type === "stad_answer_result") {
        stadData.answered = true;
        stadData.scores = msg.scores;
        stopStadTimer();
        renderStadTopBar();
        showStadResultMessage(msg);

        if (msg.correct) {
            setStadStatus(`${getStadPlayerName(msg.player_id)} doğru bildi!`, "#51cf66");
        } else if (msg.timeout) {
            setStadStatus(`${getStadPlayerName(msg.player_id)} süresini kaçırdı.`, "#ff6b6b");
        } else {
            setStadStatus(`${getStadPlayerName(msg.player_id)} yanlış bildi.`, "#ff6b6b");
        }
        return;
    }

    if (msg.type === "stad_game_over") {
        stadData.scores = msg.scores;
        stopStadTimer();
        renderStadTopBar();

        const title = document.getElementById("stadGameOverTitle");
        const text = document.getElementById("stadGameOverText");

        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === stadData.playerId) {
            title.textContent = "KAZANDIN! 🏆";
            title.style.color = "#51cf66";
            startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }

        const p1 = getStadPlayerName(1);
        const p2 = getStadPlayerName(2);
        text.innerHTML = `
            <div style="font-size:20px; margin:15px 0;">
                <span style="color:#51cf66;">${p1}</span>: <b>${stadData.scores[1]}</b><br>
                <span style="color:#ff6b6b;">${p2}</span>: <b>${stadData.scores[2]}</b>
            </div>
        `;

        const rematchBtn = document.getElementById("stadRematchBtn");
        if (stadData.playerId === 1) rematchBtn.classList.remove("hidden");
        else rematchBtn.classList.add("hidden");

        document.getElementById("stadGameOverBox").classList.remove("hidden");
        return;
    }

    _prevHandleMessageStad(msg);
};

// room mode join desteği
const _origHandleForModeStad = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }

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

    _origHandleForModeStad(msg);
};

// başlangıç gizle
document.getElementById("stadGameOverBox").classList.add("hidden");