// ==========================================
// İLK 11 CHALLENGE - MODÜL JS
// ==========================================

let ilk11Data = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 120,
    positions: {},
    myTeam: {},
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

document.getElementById("ilk11StartBtn").onclick = () => {
    send({ type: "ilk11_start_game" });
};

document.getElementById("ilk11LobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

const ilk11RoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "ilk11RoomCodeText",
    codeEyeBtnId: "ilk11RoomCodeEyeBtn",
    copyHintId: "ilk11CopyHint",
    linkTextId: "ilk11InviteLinkText",
    linkEyeBtnId: "ilk11InviteLinkEyeBtn",
    linkHintId: "ilk11InviteLinkHint",
    getRoomCode: () => ilk11Data.roomCode
});

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

function getIlk11PlayerName(id) {
    const p = ilk11Data.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateIlk11Lobby() {
    if (ilk11RoomHelper) { ilk11RoomHelper.renderCode(); ilk11RoomHelper.renderLink(); }
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

            slot.addEventListener("click", () => {
                openIlk11Popup(posId, posData);
            });
        }

        slotsContainer.appendChild(slot);
    });
}

function openIlk11Popup(posId, posData) {
    document.getElementById("ilk11PopupTitle").textContent =
        `${posData.name} için futbolcu seç`;

    const grid = document.getElementById("ilk11PopupOptions");
    grid.innerHTML = "";

    const loading = document.createElement("div");
    loading.textContent = "Yükleniyor...";
    loading.style.color = "#ffd43b";
    loading.style.padding = "20px";
    grid.appendChild(loading);

    ilk11PopupBox.classList.remove("hidden");

    send({ type: "ilk11_get_options", pos_id: posId });

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

function renderIlk11Result(data) {
    stopIlk11Timer();

    document.getElementById("ilk11ResultMyName").textContent = data.player1.name;
    document.getElementById("ilk11ResultOppName").textContent = data.player2.name;

    document.getElementById("ilk11ResultMyRating").textContent = data.player1.total_rating;
    document.getElementById("ilk11ResultMyChem").textContent = data.player1.chemistry;
    document.getElementById("ilk11ResultMyTotal").textContent = data.player1.total_score;

    document.getElementById("ilk11ResultOppRating").textContent = data.player2.total_rating;
    document.getElementById("ilk11ResultOppChem").textContent = data.player2.chemistry;
    document.getElementById("ilk11ResultOppTotal").textContent = data.player2.total_score;

    renderIlk11MiniField("ilk11ResultMyField", data.player1.team, "#51cf66");
    renderIlk11MiniField("ilk11ResultOppField", data.player2.team, "#ffa94d");

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

// Mesaj handler
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

// (Bu blok silindi - app.js zaten room_mode_result işliyor)

// Başlangıçta popup'ları kapat
ilk11PopupBox.classList.add("hidden");
ilk11ResultBox.classList.add("hidden");