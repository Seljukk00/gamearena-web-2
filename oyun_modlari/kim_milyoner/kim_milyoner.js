// ==========================================
// KİM MİLYONER - MODÜL JS
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
        
        const saved = localStorage.getItem("mlVolume");
        const savedVol = saved !== null ? parseInt(saved) : 0;
        updateAllVolumes(savedVol);
        
        if (mlSounds.question) mlSounds.question.loop = true;
        if (mlSounds.menu) mlSounds.menu.loop = true;
    } catch (e) {
        console.error("Ses yükleme hatası:", e);
    }
}

function updateAllVolumes(val) {
    val = parseInt(val);
    if (isNaN(val)) val = 0;
    const volume = val / 100;
    Object.values(mlSounds).forEach(s => { if (s) s.volume = volume; });
    
    const range = document.getElementById("mlVolumeRange");
    const text = document.getElementById("mlVolumeVal");
    const button = document.getElementById("volumeButton");
    const track = document.getElementById("volumeTrack");
    const thumb = document.getElementById("volumeThumb");
    
    if (range) range.value = val;
    if (text) text.textContent = val;
    
    const percent = val / 100;
    if (track) track.style.setProperty('--volume-percent', percent);
    if (thumb) thumb.style.setProperty('--volume-percent', percent);
    
    if (button) {
        if (val == 0) button.classList.add("muted");
        else button.classList.remove("muted");
        
        let level = 0;
        if (val == 0) level = 0;
        else if (val <= 33) level = 1;
        else if (val <= 66) level = 2;
        else level = 3;
        button.setAttribute("data-level", level);
    }
}

document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "mlVolumeRange") {
        const val = e.target.value;
        updateAllVolumes(val);
        localStorage.setItem("mlVolume", val);
    }
});

function initVolumeTrack() {
    const track = document.getElementById("volumeTrack");
    if (!track) return;
    let isDragging = false;
    function updateFromPosition(clientY) {
        const rect = track.getBoundingClientRect();
        const trackHeight = rect.height - 20;
        const relativeY = clientY - rect.top - 10;
        let percent = 100 - (relativeY / trackHeight * 100);
        percent = Math.max(0, Math.min(100, Math.round(percent)));
        updateAllVolumes(percent);
        localStorage.setItem("mlVolume", percent);
    }
    track.addEventListener("mousedown", (e) => { isDragging = true; updateFromPosition(e.clientY); e.preventDefault(); });
    document.addEventListener("mousemove", (e) => { if (isDragging) updateFromPosition(e.clientY); });
    document.addEventListener("mouseup", () => { isDragging = false; });
}

document.addEventListener("DOMContentLoaded", () => {
    initVolumeTrack();
    const button = document.getElementById("volumeButton");
    if (button) {
        button.addEventListener("click", () => {
            const range = document.getElementById("mlVolumeRange");
            const currentVal = parseInt(range.value);
            if (currentVal > 0) {
                localStorage.setItem("mlVolumeBackup", currentVal);
                updateAllVolumes(0);
                localStorage.setItem("mlVolume", 0);
            } else {
                const backup = parseInt(localStorage.getItem("mlVolumeBackup") || "30");
                updateAllVolumes(backup);
                localStorage.setItem("mlVolume", backup);
            }
        });
    }
});

// Seyirci jokeri - Gelişmiş animasyon
function showAudienceAnimated(finalResult) {
    const box = document.getElementById("mlAudienceBox");
    box.classList.remove("hidden");
    
    const bars = document.querySelectorAll(".mlAudBar");
    
    // Doğru cevabı bul (en yüksek yüzde)
    let maxLetter = "A";
    let maxPct = 0;
    Object.entries(finalResult).forEach(([letter, pct]) => {
        if (pct > maxPct) { maxPct = pct; maxLetter = letter; }
    });
    
    // Animasyon başlasın (dalgalanma)
    bars.forEach(bar => {
        bar.classList.remove("final", "correct-final");
        bar.classList.add("animating");
    });
    
    let ticks = 0;
    const maxTicks = 20; // 4 saniye dalgalanma (20 * 200ms)
    
    const animInterval = setInterval(() => {
        ticks++;
        
        if (ticks < maxTicks) {
            // Rastgele yüzdeler
            bars.forEach(bar => {
                const randomPct = Math.floor(Math.random() * 90) + 5;
                bar.querySelector(".mlAudBarFill").style.height = randomPct + "%";
                bar.querySelector(".mlAudPct").textContent = "%" + randomPct;
            });
        } else {
            // Bitiş - final değerler
            clearInterval(animInterval);
            bars.forEach(bar => {
                bar.classList.remove("animating");
                const letter = bar.dataset.letter;
                const pct = finalResult[letter] || 0;
                bar.querySelector(".mlAudBarFill").style.height = pct + "%";
                bar.querySelector(".mlAudPct").textContent = "%" + pct;
                
                if (letter === maxLetter) {
                    bar.classList.add("correct-final");
                } else {
                    bar.classList.add("final");
                }
            });
        }
    }, 200);  // 100 → 200 ms yaptım
}

// Telefon jokeri - Popup göster
const PHONE_CONTACTS = [
    { name: "🧠 Bilge Amca", desc: "Emekli tarih öğretmeni" },
    { name: "⚽ Futbolcu Kuzen", desc: "20 Senedir Bal ligi oyuncusu" },
    { name: "📚 Kütüphaneci Ayşe", desc: "5 senedir Mezun" },
    { name: "🎓 Profesör Cemal", desc: "Üniversite hocası" },
    { name: "🎯 Zeki Dayım", desc: "Annemin Dolandırıcısı" },
    { name: "📺 Annem", desc: "Bilgi yarışmalarını kaçırmaz" },
    { name: "🎪 Caky TV", desc: "Demokratik Kongolu Bir Yayıncı" },
    { name: "🍺 Minnak Başkan", desc: "Bilgi Yarışmalarının Mumla Aranan Adamı" },
    { name: "🎣 Balıkçı Rıza", desc: "Denizden başka bir şey bilmez" },
    { name: "😴 Neriman Halam", desc: "Annemin Baş Düşmanı" },
    { name: "🃏 Kumarbaz Selim", desc: "Kumarbazın Teki" },
    { name: "🔮 Falcı Neriman", desc: "Mahalle Dolandırıcısı" },
    { name: "🎮 GAYmer Kerem", desc: "Sabah Akşam LoL oynar" },
    { name: "💇 Kuaför Fatma Teyze", desc: "Herkesin dedikodusunu Yapar" }
];

function showPhoneBox() {
    const box = document.getElementById("mlPhoneBox");
    const list = document.getElementById("mlPhoneList");
    const answerBox = document.getElementById("mlPhoneAnswer");
    
    // 5 rastgele karakter seç (isim önemsiz)
    const shuffled = PHONE_CONTACTS.slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
    
    // 5 kişiden 1 tanesi "kötü" (%20 doğru), 4'ü "iyi" (%80 doğru)
    // Kötü olan index rastgele seçilir
    const badIndex = Math.floor(Math.random() * 5);
    shuffled.forEach((c, i) => {
        c._isBad = (i === badIndex);
    });
    
    // Liste doldur
    list.innerHTML = "";
    answerBox.classList.add("hidden");
    answerBox.innerHTML = "";
    
    shuffled.forEach(contact => {
        const div = document.createElement("div");
        div.className = "mlPhoneContact";
        div.innerHTML = `
            <div class="mlPhoneIcon">📞</div>
            <div class="mlPhoneInfo">
                <div class="mlPhoneName">${contact.name}</div>
                <div class="mlPhoneDesc">${contact.desc}</div>
            </div>
            <button class="mlPhoneCallBtn">ARA</button>
        `;
        div.onclick = () => callPhoneContact(contact, shuffled);
        list.appendChild(div);
    });
    
    box.classList.remove("hidden");
}

function callPhoneContact(contact, allContacts) {
    // Diğerlerini disable et
    document.querySelectorAll(".mlPhoneContact").forEach(el => {
        el.classList.add("disabled");
    });
    
    // Backend'e söyle: isBad true ise kötü karakter (%20 doğru), false ise iyi (%80 doğru)
    send({ type: "ml_joker", joker: "phone", is_bad: contact._isBad });
    
    // Loading göster
    const answerBox = document.getElementById("mlPhoneAnswer");
    answerBox.classList.remove("hidden");
    answerBox.innerHTML = `
        <div class="mlPhoneCallingText">📞 ${contact.name} aranıyor...</div>
    `;
}

// 50:50 animasyonu
function animateFifty(removedLetters) {
    document.querySelectorAll(".mlOptBtn").forEach(btn => {
        if (removedLetters.includes(btn.dataset.letter)) {
            btn.classList.add("removing");
            setTimeout(() => {
                btn.classList.add("eliminated");
                btn.classList.remove("removing");
                btn.disabled = true;
            }, 600);
        }
    });
}

loadMlSounds();

function playMlSound(name) {
    const s = mlSounds[name];
    if (!s) return;
    try { s.currentTime = 0; s.play().catch(() => {}); } catch (e) {}
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

const _originalShowScreenML = showScreen;
showScreen = function(screenName) {
    _originalShowScreenML(screenName);
    createMlScreen.classList.add("hidden");
    mlLobbyScreen.classList.add("hidden");
    mlGameScreen.classList.add("hidden");
    if (screenName === "createMl") createMlScreen.classList.remove("hidden");
    if (screenName === "mlLobby") mlLobbyScreen.classList.remove("hidden");
    if (screenName === "mlGame") mlGameScreen.classList.remove("hidden");
    
    if (screenName !== "mlGame") stopMlSound("question");
    if (screenName === "createMl" || screenName === "mlLobby") playMlSound("menu");
    else stopMlSound("menu");
};

// Mod kartına tıklama - Kim Milyoner
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
const _savedNameML = localStorage.getItem("playerName");
if (_savedNameML) {
    const inp = document.getElementById("createMlNameInput");
    if (inp) inp.value = _savedNameML;
}

// Turnstile
let mlTurnstileToken = null;
window.onTurnstileSuccess = function(token) {
    mlTurnstileToken = token;
    const msg = document.getElementById("createMlMsg");
    if (msg && msg.textContent.includes("güvenlik")) msg.textContent = "";
};
window.onTurnstileError = () => { mlTurnstileToken = null; };
window.onTurnstileExpired = () => { mlTurnstileToken = null; };

document.getElementById("createMlBtn").onclick = () => {
    const name = document.getElementById("createMlNameInput").value.trim();
    if (!name) { document.getElementById("createMlMsg").textContent = "İsim gir."; return; }
    if (!mlTurnstileToken) { document.getElementById("createMlMsg").textContent = "⏳ Güvenlik doğrulaması bekleniyor..."; return; }
    
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
        turn_seconds: turnSec,
        turnstile_token: mlTurnstileToken
    });
    mlTurnstileToken = null;
    if (window.turnstile) window.turnstile.reset("#mlTurnstileWidget");
};

document.getElementById("createMlBackBtn").onclick = () => showScreen("modselect");
document.getElementById("mlStartBtn").onclick = () => send({ type: "ml_start_game" });
document.getElementById("mlLobbyLeaveBtn").onclick = () => { showEscPopup(); };

// Oda Ayarları butonu
document.getElementById("mlRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Kim Milyoner - Oda Ayarları",
        fields: [
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: mlData.turnSeconds || 60,
                options: [
                    {value: 15, label: "15 saniye"},
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 120, label: "120 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "ml_update_settings",
                turn_seconds: parseInt(values.turnSec) || 60
            });
        }
    });
};
// Ortak setup
const mlRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "mlRoomCodeText",
    codeEyeBtnId: "mlRoomCodeEyeBtn",
    copyHintId: "mlCopyHint",
    linkTextId: "mlInviteLinkText",
    linkEyeBtnId: "mlInviteLinkEyeBtn",
    linkHintId: "mlInviteLinkHint",
    getRoomCode: () => mlData.roomCode,
    getPlayerId: () => mlData.playerId
});
document.getElementById("mlBackBtn").onclick = () => { showEscPopup(); };
document.getElementById("mlBackToMenuBtn").onclick = () => location.reload();
document.getElementById("mlRematchBtn").onclick = () => { document.getElementById("mlGameOverBox").classList.add("hidden"); send({ type: "ml_rematch" }); };

document.querySelectorAll(".mlOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
        const letter = btn.dataset.letter;
        if (mlData.removed.includes(letter)) return;
        send({ type: "ml_answer", letter: letter });
    };
});

document.getElementById("mlJokerFifty").onclick = () => {
    if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
    if (mlData.jokers[mlData.playerId] && !mlData.jokers[mlData.playerId].fifty) return;
    send({ type: "ml_joker", joker: "fifty" });
};
document.getElementById("mlJokerAudience").onclick = () => {
    if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
    if (mlData.jokers[mlData.playerId] && !mlData.jokers[mlData.playerId].audience) return;
    send({ type: "ml_joker", joker: "audience" });
};
document.getElementById("mlJokerPhone").onclick = () => {
    if (mlData.currentPlayer !== mlData.playerId || mlData.answered) return;
    if (mlData.jokers[mlData.playerId] && !mlData.jokers[mlData.playerId].phone) return;
    showPhoneBox();
};

function startMlTimer(seconds) {
    stopMlTimer();
    mlData.timerSeconds = seconds;
    updateMlTimerDisplay();
    mlData.timerInterval = setInterval(() => {
        mlData.timerSeconds--; updateMlTimerDisplay();
        if (mlData.timerSeconds <= 0) stopMlTimer();
    }, 1000);
}
function stopMlTimer() { clearInterval(mlData.timerInterval); mlData.timerInterval = null; }
function updateMlTimerDisplay() {
    const el = document.getElementById("mlTimer");
    el.textContent = mlData.timerSeconds;
    el.className = "mlTimerBig " + (mlData.timerSeconds <= 10 ? "danger" : mlData.timerSeconds <= 20 ? "warning" : "");
}

function updateMlLobby() {
    if (mlRoomHelper) { mlRoomHelper.renderCode(); mlRoomHelper.renderLink(); }
    document.getElementById("mlLobbyTurnSeconds").textContent = mlData.turnSeconds;
    const aiStatusEl = document.getElementById("mlAiStatus");
    if (aiStatusEl) {
        aiStatusEl.textContent = mlData.aiReady ? "✅ Sorular hazır!" : "⏳ Sorular hazırlanıyor...";
        aiStatusEl.style.color = mlData.aiReady ? "#51cf66" : "#ffa94d";
    }
    const list = document.getElementById("mlPlayersList");
    list.innerHTML = "";
    mlData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        nameCell.textContent = p.id === mlData.playerId ? `${p.id}. ${p.name} (Sen)` : `${p.id}. ${p.name}`;
        li.appendChild(nameCell);
        
        if (p.id !== mlData.playerId && mlData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === mlData.playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    const startBtn = document.getElementById("mlStartBtn");
    if (mlData.playerId === 1) {
        startBtn.classList.remove("hidden");
        startBtn.disabled = !mlData.aiReady || mlData.players.length < 2;
        startBtn.style.opacity = startBtn.disabled ? "0.5" : "1";
    }
    
    // Oda Ayarları butonu - sadece host
    const settingsBtn = document.getElementById("mlRoomSettingsBtn");
    if (settingsBtn) {
        if (mlData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
}

function renderMlJokers() {
    const myJokers = mlData.jokers[mlData.playerId] || {};
    const isMyTurn = mlData.currentPlayer === mlData.playerId && !mlData.answered;
    
    const fiftyBtn = document.getElementById("mlJokerFifty");
    const audBtn = document.getElementById("mlJokerAudience");
    const phoneBtn = document.getElementById("mlJokerPhone");
    
    // 50:50
    fiftyBtn.classList.remove("used");
    if (!myJokers.fifty) fiftyBtn.classList.add("used");
    fiftyBtn.disabled = !myJokers.fifty || !isMyTurn;
    
    // Seyirci
    audBtn.classList.remove("used");
    if (!myJokers.audience) audBtn.classList.add("used");
    audBtn.disabled = !myJokers.audience || !isMyTurn;
    
    // Telefon
    phoneBtn.classList.remove("used");
    if (!myJokers.phone) phoneBtn.classList.add("used");
    phoneBtn.disabled = !myJokers.phone || !isMyTurn;
}

function getMlPlayerName(id) {
    const p = mlData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function renderMlParaAgaci() {
    const box = document.getElementById("mlParaAgaci");
    if (!box) return;
    box.innerHTML = "";
    // Tersten (yüksek para üstte)
    for (let i = 11; i >= 0; i--) {
        const row = document.createElement("div");
        row.className = "mlParaSatir";
        if (i === mlData.qIdx) row.classList.add("aktif");
        const para = (mlData.paraAgaci && mlData.paraAgaci[i]) || "0";
        row.innerHTML = `<span><span class="paraSira">${i+1}.</span> ${para} TL</span>`;
        box.appendChild(row);
    }
}

function renderMlAll() {
    // İsimleri set et
    document.getElementById("mlP1Name").textContent = getMlPlayerName(1);
    document.getElementById("mlP2Name").textContent = getMlPlayerName(2);
    
    document.getElementById("mlP1Money").textContent = mlData.scores[1].toLocaleString() + " TL";
    document.getElementById("mlP2Money").textContent = mlData.scores[2].toLocaleString() + " TL";
    
    // Sıradaki oyuncu göster (0-0 yerine)
    const turnName = getMlPlayerName(mlData.currentPlayer);
    const turnColor = mlData.currentPlayer === mlData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("mlScoreLine").innerHTML = `Sıra: <span style="color:${turnColor}; font-weight:bold;">${turnName}</span>`;
    
    // Soru ve ödül
    document.getElementById("mlQuestionInfo").textContent = `Soru ${(mlData.qIdx || 0) + 1}/12`;
    document.getElementById("mlPrizeInfo").textContent = `Ödül: ${mlData.prizeStr || "0"} TL`;
    document.getElementById("mlQuestionText").textContent = mlData.question;
    
    // Şıklar
    document.querySelectorAll(".mlOptBtn").forEach((btn, i) => {
        const letter = btn.dataset.letter;
        btn.classList.remove("correct", "wrong", "eliminated", "removing");
        btn.querySelector(".optText").textContent = (mlData.options[i] || "").replace(/^[A-D]\)\s*/, "");
        if (mlData.removed.includes(letter)) btn.classList.add("eliminated");
        btn.disabled = mlData.currentPlayer !== mlData.playerId || mlData.answered || mlData.removed.includes(letter);
    });
    
    // Para ağacı
    renderMlParaAgaci();
    
    renderMlJokers();
    
    // Yeni soruda telefon ve seyirci kutularını gizle
    document.getElementById("mlPhoneBox").classList.add("hidden");
    document.getElementById("mlAudienceBox").classList.add("hidden");
}

const _originalHandleMessageML = handleMessage;
handleMessage = function(msg) {
    if (msg.type && msg.type.startsWith("ml_")) {
        if (msg.type === "ml_room_created" || msg.type === "ml_room_joined") {
            mlData.playerId = msg.player_id; mlData.roomCode = msg.room_code;
            mlData.turnSeconds = msg.turn_seconds; 
            mlData.category = msg.category || "futbol";
            mlData.difficulty = msg.difficulty || "karisik";
            mlData.aiReady = false;
            inRoom = true;
            showScreen("mlLobby"); updateMlLobby();
        } else if (msg.type === "ml_lobby_update") {
            mlData.roomCode = msg.room_code;
            mlData.players = msg.players; 
            mlData.aiReady = msg.ai_ready === true; 
            updateMlLobby();
        } else if (msg.type === "ml_game_started" || msg.type === "ml_new_question") {
            if (msg.player_id !== undefined) mlData.playerId = msg.player_id;
            if (msg.players) mlData.players = msg.players;
            if (msg.current_player !== undefined) mlData.currentPlayer = msg.current_player;
            if (msg.q_idx !== undefined) mlData.qIdx = msg.q_idx;
            if (msg.question !== undefined) mlData.question = msg.question;
            if (msg.options !== undefined) mlData.options = msg.options;
            if (msg.prize !== undefined) mlData.prize = msg.prize;
            if (msg.prize_str !== undefined) mlData.prizeStr = msg.prize_str;
            if (msg.level !== undefined) mlData.level = msg.level;
            if (msg.scores) mlData.scores = msg.scores;
            if (msg.jokers) mlData.jokers = msg.jokers;
            if (msg.para_agaci) mlData.paraAgaci = msg.para_agaci;
            if (msg.turn_seconds !== undefined) mlData.turnSeconds = msg.turn_seconds;
            if (msg.category !== undefined) mlData.category = msg.category;
            mlData.answered = false; 
            mlData.removed = [];
            document.getElementById("mlAudienceBox").classList.add("hidden");
            showScreen("mlGame"); playMlSound("question"); renderMlAll(); startMlTimer(mlData.turnSeconds);
        } else if (msg.type === "ml_answer_result") {
            mlData.answered = true; mlData.scores = msg.scores; stopMlTimer(); stopMlSound("question");
            document.querySelectorAll(".mlOptBtn").forEach(btn => {
                if (btn.dataset.letter === msg.correct_answer) btn.classList.add("correct");
                else if (btn.dataset.letter === msg.selected && !msg.correct) btn.classList.add("wrong");
            });
            playMlSound(msg.correct ? "correct" : "wrong");
        } else if (msg.type === "ml_joker_result") {
            if (msg.jokers) mlData.jokers = msg.jokers;
            
            if (msg.joker === "fifty") { 
                mlData.removed = msg.removed;
                animateFifty(msg.removed);
                renderMlJokers();
            }
            else if (msg.joker === "audience") {
                showAudienceAnimated(msg.result);
                renderMlJokers();
            }
            else if (msg.joker === "phone_calling") {
                // Loading zaten showPhoneBox'ta gösteriliyor
            }
            else if (msg.joker === "phone_result") {
                const answerBox = document.getElementById("mlPhoneAnswer");
                answerBox.innerHTML = `
                    <span class="callerName">📞 Telefondaki kişi diyor ki:</span>
                    "${msg.result}"
                `;
                renderMlJokers();
            }
        } else if (msg.type === "ml_game_over") {
            stopAllMlSounds(); document.getElementById("mlGameOverBox").classList.remove("hidden");
        }
        return;
    }
    _originalHandleMessageML(msg);
};