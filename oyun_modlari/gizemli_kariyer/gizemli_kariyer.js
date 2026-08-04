// ==========================================
// GİZEMLİ KARİYER - MODÜL JS
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
        showScreen("createGizem");
        setTimeout(() => {
            const input = document.getElementById("createGizemNameInput");
            if (input) input.focus();
        }, 100);
    });
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
    showEscPopup();
};

// Oda Ayarları butonu
document.getElementById("gizemRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Gizemli Kariyer - Oda Ayarları",
        fields: [
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: gizemData.turnSeconds || 60,
                options: [
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 90, label: "90 saniye"},
                    {value: 120, label: "120 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "gizem_update_settings",
                turn_seconds: parseInt(values.turnSec) || 60
            });
        }
    });
};

const gizemRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "gizemRoomCodeText",
    codeEyeBtnId: "gizemRoomCodeEyeBtn",
    copyHintId: "gizemCopyHint",
    linkTextId: "gizemInviteLinkText",
    linkEyeBtnId: "gizemInviteLinkEyeBtn",
    linkHintId: "gizemInviteLinkHint",
    getRoomCode: () => gizemData.roomCode,
    getPlayerId: () => gizemData.playerId
});

// Oyun butonları
document.getElementById("gizemBackBtn").onclick = () => {
    showEscPopup();
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
    if (gizemRoomHelper) { gizemRoomHelper.renderCode(); gizemRoomHelper.renderLink(); }
    document.getElementById("gizemLobbyTurnSeconds").textContent = gizemData.turnSeconds || 60;

    const list = document.getElementById("gizemPlayersList");
    list.innerHTML = "";
    gizemData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        nameCell.textContent = p.id === gizemData.playerId ? `${p.id}. ${p.name} (Sen)` : `${p.id}. ${p.name}`;
        li.appendChild(nameCell);
        
        if (p.id !== gizemData.playerId && gizemData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === gizemData.playerId) {
            li.classList.add("playerMine");
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
    
    const settingsBtn = document.getElementById("gizemRoomSettingsBtn");
    if (settingsBtn) {
        if (gizemData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
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
            img.referrerPolicy = "no-referrer";
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

// (Bu blok silindi - app.js zaten room_mode_result işliyor)

// Başlangıçta popup'ları kapat
document.getElementById("gizemGameOverBox").classList.add("hidden");
document.getElementById("gizemPassConfirmBox").classList.add("hidden");