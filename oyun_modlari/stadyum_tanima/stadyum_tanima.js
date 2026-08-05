// ==========================================
// STADYUM TANIMA - MODÜL JS
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
    showEscPopup();
};

// Oda Ayarları butonu
document.getElementById("stadRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Stadyum Tanıma - Oda Ayarları",
        fields: [
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: stadData.turnSeconds || 20,
                options: [
                    {value: 15, label: "15 saniye"},
                    {value: 20, label: "20 saniye"},
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "stad_update_settings",
                turn_seconds: parseInt(values.turnSec) || 20
            });
        }
    });
};

const stadRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "stadRoomCodeText",
    codeEyeBtnId: "stadRoomCodeEyeBtn",
    copyHintId: "stadCopyHint",
    linkTextId: "stadInviteLinkText",
    linkEyeBtnId: "stadInviteLinkEyeBtn",
    linkHintId: "stadInviteLinkHint",
    getRoomCode: () => stadData.roomCode,
    getPlayerId: () => stadData.playerId
});

// Oyun butonları
document.getElementById("stadBackBtn").onclick = () => {
    showEscPopup();
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
    if (stadRoomHelper) { stadRoomHelper.renderCode(); stadRoomHelper.renderLink(); }
    document.getElementById("stadLobbyTurnSeconds").textContent = stadData.turnSeconds || 30;

    const list = document.getElementById("stadPlayersList");
    list.innerHTML = "";
    stadData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === stadData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);
        
        if (p.id !== stadData.playerId && stadData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === stadData.playerId) {
            li.classList.add("playerMine");
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
    
    const settingsBtn = document.getElementById("stadRoomSettingsBtn");
    if (settingsBtn) {
        if (stadData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
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

// (Bu blok silindi - app.js zaten room_mode_result işliyor)

// başlangıç gizle
document.getElementById("stadGameOverBox").classList.add("hidden");