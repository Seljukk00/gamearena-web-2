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
    maxPlayers: 2,
    totalQuestions: 12,
    players: [],
    currentPlayer: null,
    q_idx: 0,
    question: "",
    options: [],
    prize: 0,
    prizeStr: "500",
    level: "kolay",
    scores: {},
    jokers: {},
    paraAgaci: [],
    answered: false,
    removed: [],
    timerInterval: null,
    timerSeconds: 60,
    audienceMode: false,
    rightPanelPage: "money"  // "money" veya "board"
};

const mlSounds = {
    correct: null,
    wrong: null,
    question: null,
    menu: null
};

// ========================================
// 💬 KİM MİLYONER CHAT
// ========================================
let mlChat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

function showMlChat() {
    const c = document.getElementById("mlChatContainer");
    if (c) c.style.display = "block";
}

function hideMlChat() {
    const c = document.getElementById("mlChatContainer");
    if (c) c.style.display = "none";
    closeMlChatPanel();
    mlChat.messages = [];
    mlChat.unread = 0;
    const box = document.getElementById("mlChatMessages");
    if (box) box.innerHTML = "";
    clearMlChatPopups();
}

function toggleMlChatPanel() {
    if (mlChat.open) closeMlChatPanel();
    else openMlChatPanel();
}

function openMlChatPanel() {
    mlChat.open = true;
    mlChat.unread = 0;
    const panel = document.getElementById("mlChatPanel");
    const badge = document.getElementById("mlChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearMlChatPopups();
    const box = document.getElementById("mlChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("mlChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", mlChatOutsideClickHandler, true);
    }, 100);
}

function closeMlChatPanel() {
    mlChat.open = false;
    const panel = document.getElementById("mlChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", mlChatOutsideClickHandler, true);
    const input = document.getElementById("mlChatInput");
    if (input && input.value) input.value = "";
}

function mlChatOutsideClickHandler(e) {
    const c = document.getElementById("mlChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeMlChatPanel();
}

function sendMlChatMessage() {
    const input = document.getElementById("mlChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "ml_chat_send", text: text });
}

function showMlChatPopup(msg) {
    if (mlChat.open) return;
    const stack = document.getElementById("mlChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";
    
    const popup = document.createElement("div");
    popup.className = "miniChatPopup";
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

function clearMlChatPopups() {
    const stack = document.getElementById("mlChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addMlChatMessage(msg) {
    // ✨ Chat bildirim sesi (yazan dahil herkese tam ses)
    try {
        const sound = new Audio("/static/sounds/chat_notify.mp3");
        sound.volume = 1.0;
        sound.play().catch(() => {});
    } catch(e) {}

    mlChat.messages.push(msg);
    if (mlChat.messages.length > mlChat.maxMessages) mlChat.messages.shift();
    
    const box = document.getElementById("mlChatMessages");
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
    
    while (box.children.length > mlChat.maxMessages) box.removeChild(box.firstChild);
    
    if (mlChat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        mlChat.unread++;
        const badge = document.getElementById("mlChatBadge");
        if (badge) {
            badge.textContent = mlChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showMlChatPopup(msg);
    }
}

// ========================================
// ✨ SORU HISTORY SİSTEMİ (localStorage)
// ========================================
const ML_HISTORY_KEY = "ml_seen_questions";

function getMlHistory() {
    try {
        const raw = localStorage.getItem(ML_HISTORY_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch(e) {
        return [];
    }
}

function addMlHistory(questionText) {
    if (!questionText) return;
    let history = getMlHistory();
    
    // Zaten varsa ekleme
    if (history.includes(questionText)) return;
    
    history.push(questionText);
    
    // ✨ Sınır yok - kullanıcı istediği kadar soru görebilir
    // Havuz büyürken tümünü hatırlar
    
    try {
        localStorage.setItem(ML_HISTORY_KEY, JSON.stringify(history));
        console.log(`[ML HISTORY] Toplam görülen: ${history.length} soru`);
    } catch(e) {
        console.error("[ML HISTORY] Kayıt hatası:", e);
    }
}

function clearMlHistory() {
    try {
        localStorage.removeItem(ML_HISTORY_KEY);
        console.log("[ML HISTORY] Geçmiş sıfırlandı");
    } catch(e) {}
}

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
    { name: "🧠 Harun Hoca", desc: "Emekli tarih öğretmeni" },
    { name: "⚽ Futbolcu Kuzen", desc: "20 Senedir Bal ligi oyuncusu" },
    { name: "📚 Kütüphaneci Ayşe", desc: "5 senedir Mezun" },
    { name: "🎓 Profesör Cemal", desc: "Üniversite hocası" },
    { name: "🎯 Zeki Dayım", desc: "Annemin Dolandırıcısı" },
    { name: "📺 Annem", desc: "Bilgi yarışmalarını kaçırmaz" },
    { name: "🎪 Caky TV", desc: "Demokratik Kongolu Bir Yayıncı" },
    { name: "🍺 Minnak Başkan", desc: "Bilgi Yarışmalarının Mumla Aranan Adamı" },
    { name: "🎣 Trabzonlu Talha", desc: "Trabzon'un En akıllı Adamı" },
    { name: "😴 Neriman Halam", desc: "Annemin Baş Düşmanı" },
    { name: "🃏 Kumarbaz Selim", desc: "Kumarbazın Teki" },
    { name: "🔮 Falcı Neriman", desc: "Mahalle Dolandırıcısı" },
    { name: "🎮 GAYmer Kerem", desc: "Sabah Akşam LoL oynar" },
    { name: "💇 Kuaför Fatma", desc: "Facebook evlilik grupları üyesi" },
    { name: "🍆 prof. dr Ürolog Oğuzhan", desc: "Nam salmış Ürolog" }
];

function showPhoneBox(fromNetwork = false, networkContacts = null) {
    const box = document.getElementById("mlPhoneBox");
    const list = document.getElementById("mlPhoneList");
    const answerBox = document.getElementById("mlPhoneAnswer");
    
    let shuffled;
    if (fromNetwork && networkContacts) {
        // ✨ Ağdan geldi (izleyici) → aynı listeyi kullan
        shuffled = networkContacts;
    } else {
        // Kendim oynuyorum → yeni liste oluştur
        shuffled = PHONE_CONTACTS.slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        
        // 5 kişiden 1 tanesi "kötü" (%20 doğru), 4'ü "iyi" (%80 doğru)
        const badIndex = Math.floor(Math.random() * 5);
        shuffled.forEach((c, i) => {
            c._isBad = (i === badIndex);
        });
        
        // ✨ İzleyiciye de bu listeyi gönder (backend relay)
        send({ 
            type: "ml_phone_popup_show", 
            contacts: shuffled 
        });
    }
    
    // Liste doldur
    list.innerHTML = "";
    answerBox.classList.add("hidden");
    answerBox.innerHTML = "";
    
    shuffled.forEach((contact, i) => {
        const div = document.createElement("div");
        div.className = "mlPhoneContact";
        div.dataset.contactIndex = i;
        div.innerHTML = `
            <div class="mlPhoneIcon">📞</div>
            <div class="mlPhoneInfo">
                <div class="mlPhoneName">${contact.name}</div>
                <div class="mlPhoneDesc">${contact.desc}</div>
            </div>
            <button class="mlPhoneCallBtn">${fromNetwork ? '👁️ İZLİYORSUN' : 'ARA'}</button>
        `;
        
        // ✨ Sadece oynayan tıklayabilir
        if (!fromNetwork) {
            div.onclick = () => callPhoneContact(contact, shuffled, i);
        } else {
            div.style.cursor = "not-allowed";
            div.style.opacity = "0.9";
        }
        list.appendChild(div);
    });
    
    box.classList.remove("hidden");
}

function callPhoneContact(contact, allContacts, contactIndex) {
    // Diğerlerini disable et
    document.querySelectorAll(".mlPhoneContact").forEach(el => {
        el.classList.add("disabled");
    });
    
    // ✨ Seçilen kişiyi vurgula
    document.querySelectorAll(".mlPhoneContact").forEach((el, i) => {
        if (i === contactIndex) {
            el.classList.add("selected");
            el.style.border = "2px solid #51cf66";
            el.style.background = "rgba(81, 207, 102, 0.2)";
        }
    });
    
    // ✨ İzleyiciye de hangi kişi seçildiğini bildir
    send({ 
        type: "ml_phone_contact_selected", 
        contact_index: contactIndex 
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
    
    // 💬 Kim Milyoner chat: sadece mlLobby/mlGame'de görünür
    const mlScreens = ["mlLobby", "mlGame"];
    if (!mlScreens.includes(screenName)) {
        hideMlChat();
    }
};

// Mod kartına tıklama - Kim Milyoner
document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    const mod = card.dataset.mod;
    if (mod === "kim_milyoner") {
        card.addEventListener("click", () => {
            // ✨ Normal giriş: isim + buton + turnstile normale döndür
            const nameInput = document.getElementById("createMlNameInput");
            if (nameInput) {
                const nameBox = nameInput.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            const createBtnEl = document.getElementById("createMlBtn");
            if (createBtnEl) createBtnEl.textContent = "Oda Oluştur";
            // Turnstile widget'ını göster
            const turnstileBox = document.getElementById("mlTurnstileWidget");
            if (turnstileBox) {
                const box = turnstileBox.closest(".centerBox");
                if (box) box.style.display = "";
            }
            window._pendingModeChangeCtx = null;

            // ✨ Kaydedilmiş ayarları yükle
            try {
                const savedMaxP = localStorage.getItem("mlMaxPlayers");
                const savedCat = localStorage.getItem("mlCategory");
                const savedDiff = localStorage.getItem("mlDifficulty");
                const savedTurnSec = localStorage.getItem("mlTurnSeconds");
                const savedTotalQ = localStorage.getItem("mlTotalQuestions");

                const maxPSel = document.getElementById("mlMaxPlayersSelect");
                const catSel = document.getElementById("mlCategorySelect");
                const diffSel = document.getElementById("mlDifficultySelect");
                const turnSecSel = document.getElementById("mlTurnSecondsSelect");
                const totalQSel = document.getElementById("mlTotalQuestionsSelect");

                if (maxPSel && savedMaxP) maxPSel.value = savedMaxP;
                if (catSel && savedCat) catSel.value = savedCat;
                if (diffSel && savedDiff) diffSel.value = savedDiff;
                if (turnSecSel && savedTurnSec) turnSecSel.value = savedTurnSec;
                if (totalQSel && savedTotalQ) totalQSel.value = savedTotalQ;
            } catch(e) {}

            showScreen("createMl");
            if (nameInput) nameInput.focus();
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
    const nameInput = document.getElementById("createMlNameInput");
    const enteredName = nameInput ? nameInput.value.trim() : "";
    const msgEl = document.getElementById("createMlMsg");

    const category = document.getElementById("mlCategorySelect").value;
    const difficulty = document.getElementById("mlDifficultySelect").value;
    const turnSec = parseInt(document.getElementById("mlTurnSecondsSelect").value) || 60;
    const maxPlayers = parseInt(document.getElementById("mlMaxPlayersSelect").value) || 2;
    const totalQuestions = parseInt(document.getElementById("mlTotalQuestionsSelect").value) || 12;

    // ✨ Ayarları hafızaya kaydet
    try {
        localStorage.setItem("mlCategory", category);
        localStorage.setItem("mlDifficulty", difficulty);
        localStorage.setItem("mlTurnSeconds", String(turnSec));
        localStorage.setItem("mlMaxPlayers", String(maxPlayers));
        localStorage.setItem("mlTotalQuestions", String(totalQuestions));
    } catch(e) {}

    // ✨ MOD DEĞİŞİMİ mi? (Turnstile es geçilir, host zaten odada)
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "kim_milyoner" && pendingModeChange.createScreen === "createMl") {
        console.log("[MODE CHANGE] Kim Milyoner için mod_change_room gönderiliyor");
        if (msgEl) {
            msgEl.textContent = "Mod değiştiriliyor...";
            msgEl.style.color = "#51cf66";
        }
        send({
            type: "mod_change_room",
            new_mode: "kim_milyoner",
            mode_settings: {
                category: category,
                difficulty: difficulty,
                turn_seconds: turnSec,
                max_players: maxPlayers,
                total_questions: totalQuestions
            }
        });
        return;
    }

    // Normal akış (Turnstile gerekli)
    if (!enteredName) { if (msgEl) msgEl.textContent = "İsim gir."; return; }
    if (!mlTurnstileToken) { if (msgEl) msgEl.textContent = "⏳ Güvenlik doğrulaması bekleniyor..."; return; }
    
    localStorage.setItem("playerName", enteredName);
    myName = enteredName;
    
    send({
        type: "ml_create_room",
        name: enteredName,
        category: category,
        difficulty: difficulty,
        turn_seconds: turnSec,
        max_players: maxPlayers,
        total_questions: totalQuestions,
        turnstile_token: mlTurnstileToken
    });
    mlTurnstileToken = null;
    if (window.turnstile) window.turnstile.reset("#mlTurnstileWidget");
};

document.getElementById("createMlBackBtn").onclick = () => {
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "kim_milyoner" && pendingModeChange.createScreen === "createMl") {
        const returnScreen = pendingModeChange.returnScreen || "mlLobby";
        window._pendingModeChangeCtx = null;
        const msgEl = document.getElementById("createMlMsg");
        if (msgEl) msgEl.textContent = "";

        showScreen(returnScreen);

        setTimeout(() => {
            if (typeof openChangeModeModal === "function") openChangeModeModal();
        }, 200);
        return;
    }
    showScreen("modselect");
};
document.getElementById("mlStartBtn").onclick = () => {
    const seenHashes = getMlHistory();
    console.log(`[ML] Başlatılıyor - ${seenHashes.length} önceden görülmüş soru gönderiliyor`);
    send({ 
        type: "ml_start_game",
        seen_hashes: seenHashes
    });
};
document.getElementById("mlLobbyLeaveBtn").onclick = () => { window._showLeaveConfirmPopup(); };

// ✨ Mod Değiştir butonu
const _mlChangeModeBtn = document.getElementById("mlChangeModeBtn");
if (_mlChangeModeBtn) {
    _mlChangeModeBtn.onclick = () => {
        if (typeof openChangeModeModal === "function") {
            openChangeModeModal();
        }
    };
}

// Oda Ayarları butonu
document.getElementById("mlRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Kim Milyoner - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: mlData.maxPlayers || 2,
                minValue: (mlData.players && mlData.players.length > 1) ? mlData.players.length : null,
                options: [
                    {value: 1, label: "1 Oyuncu"},
                    {value: 2, label: "2 Oyuncu"},
                    {value: 3, label: "3 Oyuncu"},
                    {value: 4, label: "4 Oyuncu"},
                    {value: 5, label: "5 Oyuncu"}
                ]
            },
            {
                id: "totalQ",
                label: "❓ Soru Sayısı",
                current: mlData.totalQuestions || 12,
                options: [
                    {value: 6, label: "6 Soru"},
                    {value: 8, label: "8 Soru"},
                    {value: 10, label: "10 Soru"},
                    {value: 12, label: "12 Soru"},
                    {value: 15, label: "15 Soru"},
                    {value: 20, label: "20 Soru"},
                    {value: 25, label: "25 Soru"}
                ]
            },
            {
                id: "category",
                label: "📚 Kategori",
                current: mlData.category || "futbol",
                options: [
                    {value: "futbol", label: "⚽ Futbol"},
                    {value: "genel_kultur", label: "📚 Genel Kültür"},
                    {value: "karisik", label: "🎲 Karışık"}
                ]
            },
            {
                id: "difficulty",
                label: "🎯 Zorluk",
                current: mlData.difficulty || "karisik",
                options: [
                    {value: "kolay", label: "🟢 Kolay"},
                    {value: "orta", label: "🟡 Orta"},
                    {value: "zor", label: "🔴 Zor"},
                    {value: "cok_zor", label: "💀 Çok Zor"},
                    {value: "karisik", label: "🎯 Karışık"}
                ]
            },
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
            try {
                localStorage.setItem("mlCategory", values.category);
                localStorage.setItem("mlDifficulty", values.difficulty);
                localStorage.setItem("mlTurnSeconds", String(values.turnSec));
                localStorage.setItem("mlMaxPlayers", String(values.maxPlayers));
                localStorage.setItem("mlTotalQuestions", String(values.totalQ));
            } catch(e) {}
            send({
                type: "ml_update_settings",
                turn_seconds: parseInt(values.turnSec) || 60,
                max_players: parseInt(values.maxPlayers) || 2,
                total_questions: parseInt(values.totalQ) || 12,
                category: values.category,
                difficulty: values.difficulty
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
document.getElementById("mlRematchBtn").onclick = () => { 
    document.getElementById("mlGameOverBox").classList.add("hidden"); 
    const seenHashes = getMlHistory();
    send({ 
        type: "ml_rematch",
        seen_hashes: seenHashes
    });
};

document.getElementById("mlBackToLobbyBtn").onclick = () => {
    send({ type: "ml_back_to_lobby" });
};

// Sağ panel geçiş butonları
document.getElementById("mlRightPrevBtn").onclick = () => {
    mlData.rightPanelPage = "money";
    updateRightPanelUI();
};
document.getElementById("mlRightNextBtn").onclick = () => {
    mlData.rightPanelPage = "board";
    updateRightPanelUI();
};

function updateRightPanelUI() {
    const inner = document.getElementById("mlRightSliderInner");
    const title = document.getElementById("mlRightPanelTitle");
    const prevBtn = document.getElementById("mlRightPrevBtn");
    const nextBtn = document.getElementById("mlRightNextBtn");
    if (mlData.rightPanelPage === "board") {
        inner.classList.add("showBoard");
        title.innerHTML = "🏆 SIRALAMA";
        prevBtn.classList.remove("hidden");
        nextBtn.classList.add("hidden");
    } else {
        inner.classList.remove("showBoard");
        title.innerHTML = "💰 PARA AĞACI";
        prevBtn.classList.add("hidden");
        nextBtn.classList.remove("hidden");
    }
}

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
    const _maxEl = document.getElementById("mlLobbyMaxPlayers");
    if (_maxEl) _maxEl.textContent = mlData.maxPlayers || 2;
    const _totEl = document.getElementById("mlLobbyTotalQuestions");
    if (_totEl) _totEl.textContent = mlData.totalQuestions || 12;
    
    // ✨ Kategori göster
    const catEl = document.getElementById("mlLobbyCategory");
    if (catEl) {
        const catLabels = {
            "futbol": "⚽ Futbol",
            "genel_kultur": "📚 Genel Kültür",
            "karisik": "🎲 Karışık"
        };
        catEl.textContent = catLabels[mlData.category] || "⚽ Futbol";
    }
    
    // ✨ Zorluk göster
    const diffEl = document.getElementById("mlLobbyDifficulty");
    if (diffEl) {
        const diffLabels = {
            "kolay": "🟢 Kolay",
            "orta": "🟡 Orta",
            "zor": "🔴 Zor",
            "cok_zor": "💀 Çok Zor",
            "karisik": "🎯 Karışık"
        };
        diffEl.textContent = diffLabels[mlData.difficulty] || "🎯 Karışık";
    }
    
    const aiStatusEl = document.getElementById("mlAiStatus");
    if (aiStatusEl) {
        // ✨ Havuz her zaman hazır (questions.py + Supabase)
        aiStatusEl.textContent = "✅ Sorular hazır!";
        aiStatusEl.style.color = "#51cf66";
    }
    const list = document.getElementById("mlPlayersList");
    list.innerHTML = "";
    mlData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === mlData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
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
    const maxP = mlData.maxPlayers || 2;
    const curP = mlData.players.length;
    if (mlData.playerId === 1) {
        startBtn.classList.remove("hidden");
        const canStart = (maxP === 1) ? (curP >= 1) : (curP === maxP);
        startBtn.disabled = !canStart;
        startBtn.style.opacity = startBtn.disabled ? "0.5" : "1";
        if (maxP === 1) {
            startBtn.textContent = "Tek Başına Başlat";
        } else {
            startBtn.textContent = curP < maxP ? `Oyuncu bekleniyor (${curP}/${maxP})` : "Oyunu Başlat";
        }
    } else {
        startBtn.classList.add("hidden");
    }
    
    // Oda Ayarları butonu - sadece host
    const settingsBtn = document.getElementById("mlRoomSettingsBtn");
    if (settingsBtn) {
        if (mlData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("mlChangeModeBtn");
    if (changeModeBtn) {
        if (mlData.playerId === 1) changeModeBtn.classList.remove("hidden");
        else changeModeBtn.classList.add("hidden");
    }
}

function renderMlJokers() {
    // ✨ Şu an sırası kimdeyse ONUN jokerlerini göster (izleyici de rakibin jokerlerini görsün)
    const currentPlayerId = mlData.currentPlayer;
    const activeJokers = mlData.jokers[currentPlayerId] || mlData.jokers[String(currentPlayerId)] || {};
    
    // Sıra bende mi? (buton tıklanabilir mi kontrolü için)
    const isMyTurn = mlData.currentPlayer === mlData.playerId && !mlData.answered;
    
    const fiftyBtn = document.getElementById("mlJokerFifty");
    const audBtn = document.getElementById("mlJokerAudience");
    const phoneBtn = document.getElementById("mlJokerPhone");
    
    // ✨ Yardımcı: buton state'ini ayarla
    // - Kullanılmış → soluk (used class)
    // - Kullanılmamış + sıra bende → tam parlak, tıklanabilir
    // - Kullanılmamış + sıra rakibimde → tam parlak ama tıklanamaz (izleyici görünümü)
    function styleJokerBtn(btn, isAvailable) {
        btn.classList.remove("used");
        if (!isAvailable) {
            // Kullanılmış → soluk
            btn.classList.add("used");
            btn.disabled = true;
            btn.style.opacity = "";  // CSS "used" class'ı halleder
        } else {
            // Kullanılmamış → tam parlak
            btn.style.opacity = "1";  // ✨ İzleyici de tam görsün
            btn.disabled = !isMyTurn;  // Sadece sıra bende ise tıklanabilir
            if (!isMyTurn) {
                btn.style.cursor = "not-allowed";
            } else {
                btn.style.cursor = "pointer";
            }
        }
    }
    
    styleJokerBtn(fiftyBtn, activeJokers.fifty);
    styleJokerBtn(audBtn, activeJokers.audience);
    styleJokerBtn(phoneBtn, activeJokers.phone);
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
    const isMulti = (mlData.maxPlayers || 2) >= 3;
    const isSolo = (mlData.maxPlayers || 2) === 1 || (mlData.players && mlData.players.length === 1);
    const topBar = document.querySelector(".mlTopBar");
    
    if (topBar) {
        if (isMulti) topBar.classList.add("multiMode");
        else topBar.classList.remove("multiMode");
    }
    
    const p1El = document.getElementById("mlP1Money");
    const p2El = document.getElementById("mlP2Money");
    const topSide1 = document.getElementById("mlTopSide1");
    const topSide2 = document.getElementById("mlTopSide2");

    if (isSolo) {
        // Solo modda sadece sol taraf görünür (Skor yerine Para ağacı var ama olsun)
        if (topSide2) topSide2.style.display = "none";
        if (topSide1) topSide1.style.display = "";
        
        document.getElementById("mlP1Name").textContent = getMlPlayerName(mlData.playerId);
        
        const myScore = mlData.scores[mlData.playerId] || 0;
        p1El.textContent = myScore.toLocaleString() + " TL";
        if (myScore < 0) {
            p1El.style.color = "#ff3333";
            p1El.style.textShadow = "0 0 10px rgba(255, 51, 51, 0.5)";
        } else {
            p1El.style.color = "";
            p1El.style.textShadow = "";
        }
        
        document.getElementById("mlScoreLine").innerHTML = `Sıra: <span style="color:#51cf66; font-weight:bold;">SEN (Solo)</span>`;
    } else {
        // 2 veya çok oyunculu eski davranış
        if (topSide2) topSide2.style.display = "";
        if (topSide1) topSide1.style.display = "";
        
        document.getElementById("mlP1Name").textContent = getMlPlayerName(1);
        document.getElementById("mlP2Name").textContent = getMlPlayerName(2);
        
        const s1 = mlData.scores[1] || 0;
        const s2 = mlData.scores[2] || 0;
        
        p1El.textContent = s1.toLocaleString() + " TL";
        p2El.textContent = s2.toLocaleString() + " TL";
        
        if (s1 < 0) { p1El.style.color = "#ff3333"; p1El.style.textShadow = "0 0 10px rgba(255, 51, 51, 0.5)"; }
        else { p1El.style.color = ""; p1El.style.textShadow = ""; }
        
        if (s2 < 0) { p2El.style.color = "#ff3333"; p2El.style.textShadow = "0 0 10px rgba(255, 51, 51, 0.5)"; }
        else { p2El.style.color = ""; p2El.style.textShadow = ""; }
        
        const turnName = getMlPlayerName(mlData.currentPlayer);
        const turnColor = mlData.currentPlayer === mlData.playerId ? "#51cf66" : "#ffa94d";
        document.getElementById("mlScoreLine").innerHTML = `Sıra: <span style="color:${turnColor}; font-weight:bold;">${turnName}</span>`;
    }
    
    // ✨ Soru + zorluk (kolay/orta/zor/çok zor)
    const levelLabels = {
        "kolay": "🟢 Kolay",
        "orta": "🟡 Orta",
        "zor": "🔴 Zor",
        "cok_zor": "💀 Çok Zor"
    };
    const levelText = levelLabels[mlData.level] || "";
    const qInfoEl = document.getElementById("mlQuestionInfo");
    const totalQ = mlData.totalQuestions || 12;
    qInfoEl.innerHTML = `Soru ${(mlData.qIdx || 0) + 1}/${totalQ} &nbsp;•&nbsp; <span style="font-size:13px;">${levelText}</span>`;
    
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
    
    // Sağ panel: multiMode ise skorbord kullanılabilir
    renderMlScoreboardList();
    updateRightPanelUI();
    
    // Yeni soruda telefon ve seyirci kutularını gizle
    document.getElementById("mlPhoneBox").classList.add("hidden");
    document.getElementById("mlAudienceBox").classList.add("hidden");
}

function renderMlScoreboardList() {
    const listEl = document.getElementById("mlScoreboardList");
    if (!listEl) return;
    
    const rows = mlData.players.map(p => ({
        id: p.id,
        name: p.name,
        score: mlData.scores[p.id] ?? 0
    }));
    rows.sort((a, b) => b.score - a.score);
    
    // FLIP animasyonu için eski pozisyonları al
    const oldPositions = {};
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        oldPositions[pid] = li.getBoundingClientRect().top;
    });
    
    listEl.innerHTML = "";
    rows.forEach((row, idx) => {
        const li = document.createElement("li");
        li.dataset.pid = row.id;
        li.className = "mlScoreRow";
        if (row.id === mlData.currentPlayer) li.classList.add("activeTurn");
        if (row.id === mlData.playerId) li.classList.add("meRow");
        
        const rankBadge = document.createElement("span");
        rankBadge.className = "mlRankBadge";
        const medals = ["🥇", "🥈", "🥉"];
        rankBadge.textContent = medals[idx] || `${idx + 1}.`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "mlScoreName";
        nameSpan.textContent = row.name + (row.id === mlData.playerId ? " (Sen)" : "");
        
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "mlScoreVal";
        if (row.score < 0) scoreSpan.classList.add("negative");
        scoreSpan.textContent = row.score.toLocaleString() + " TL";
        
        li.appendChild(rankBadge);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        listEl.appendChild(li);
    });
    
    // FLIP animasyonu
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        const newTop = li.getBoundingClientRect().top;
        const oldTop = oldPositions[pid];
        if (oldTop !== undefined && oldTop !== newTop) {
            const diff = oldTop - newTop;
            li.style.transform = `translateY(${diff}px)`;
            li.style.transition = "none";
            requestAnimationFrame(() => {
                li.style.transform = "";
                li.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
            });
        }
    });
}

const _originalHandleMessageML = handleMessage;
handleMessage = function(msg) {
    if (msg.type && msg.type.startsWith("ml_")) {
        if (msg.type === "ml_room_created" || msg.type === "ml_room_joined") {
            try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
            mlData.playerId = msg.player_id; mlData.roomCode = msg.room_code;
            mlData.turnSeconds = msg.turn_seconds; 
            mlData.category = msg.category || "futbol";
            mlData.difficulty = msg.difficulty || "karisik";
            if (msg.max_players !== undefined) mlData.maxPlayers = msg.max_players;
            if (msg.total_questions !== undefined) mlData.totalQuestions = msg.total_questions;
            mlData.aiReady = false;
            inRoom = true;
            showMlChat();
            showScreen("mlLobby"); updateMlLobby();
        } else if (msg.type === "ml_lobby_update") {
            // ✨ Lobiye yeni biri geldiyse katılma sesi çal + Toast göster
            if (mlData.players && msg.players && mlData.players.length < msg.players.length && msg.players.length > 1) {
                try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
                const oldPids = new Set(mlData.players.map(p => p.id));
                const newPlayer = msg.players.find(p => !oldPids.has(p.id));
                if (newPlayer && newPlayer.id !== mlData.playerId) {
                    showToast("👋 Odaya Katıldı", `${newPlayer.name} odaya katıldı!`, null, "success");
                }
            }
            showMlChat();
            mlData.roomCode = msg.room_code;
            mlData.players = msg.players; 
            mlData.aiReady = msg.ai_ready === true;
            if (msg.category !== undefined) mlData.category = msg.category;
            if (msg.difficulty !== undefined) mlData.difficulty = msg.difficulty;
            if (msg.turn_seconds !== undefined) mlData.turnSeconds = msg.turn_seconds;
            if (msg.max_players !== undefined) mlData.maxPlayers = msg.max_players;
            if (msg.total_questions !== undefined) mlData.totalQuestions = msg.total_questions;
            updateMlLobby();
        } else if (msg.type === "ml_chat_msg") {
            addMlChatMessage({
                sender_id: msg.sender_id,
                sender_name: msg.sender_name,
                text: msg.text,
                ts: msg.ts
            });
        } else if (msg.type === "ml_chat_history") {
            if (msg.messages && Array.isArray(msg.messages)) {
                const wasOpen = mlChat.open;
                mlChat.open = true;
                msg.messages.forEach(m => addMlChatMessage(m));
                mlChat.open = wasOpen;
                mlChat.unread = 0;
                const badge = document.getElementById("mlChatBadge");
                if (badge) badge.style.display = "none";
            }
        } else if (msg.type === "ml_player_left") {
            try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
            // Bir oyuncu ayrıldı
            if (msg.players) mlData.players = msg.players;
            if (msg.scores) mlData.scores = msg.scores;
            if (msg.player_id !== undefined) {
                delete mlData.jokers[msg.player_id];
            }
            renderMlAll();
            if (typeof showToast === "function") {
                showToast(`${msg.name || "Bir oyuncu"} oyundan ayrıldı`, "warn");
            }
        } else if (msg.type === "ml_back_to_lobby") {
            document.getElementById("mlGameOverBox").classList.add("hidden");
            document.getElementById("mlPhoneBox").classList.add("hidden");
            document.getElementById("mlAudienceBox").classList.add("hidden");
            stopAllMlSounds();
            showScreen("mlLobby");
            updateMlLobby();
        } else if (msg.type === "ml_game_started" || msg.type === "ml_new_question") {
            if (msg.player_id !== undefined) mlData.playerId = msg.player_id;
            if (msg.players) mlData.players = msg.players;
            if (msg.current_player !== undefined) mlData.currentPlayer = msg.current_player;
            if (msg.q_idx !== undefined) mlData.qIdx = msg.q_idx;
            if (msg.question !== undefined) {
                mlData.question = msg.question;
                // ✨ Yeni soruyu history'e ekle (bir daha çıkmasın)
                addMlHistory(msg.question);
            }
            if (msg.options !== undefined) mlData.options = msg.options;
            if (msg.prize !== undefined) mlData.prize = msg.prize;
            if (msg.prize_str !== undefined) mlData.prizeStr = msg.prize_str;
            if (msg.level !== undefined) mlData.level = msg.level;
            if (msg.scores) mlData.scores = msg.scores;
            if (msg.jokers) mlData.jokers = msg.jokers;
            if (msg.para_agaci) mlData.paraAgaci = msg.para_agaci;
            if (msg.turn_seconds !== undefined) mlData.turnSeconds = msg.turn_seconds;
            if (msg.category !== undefined) mlData.category = msg.category;
            if (msg.total_questions !== undefined) mlData.totalQuestions = msg.total_questions;
            if (msg.max_players !== undefined) mlData.maxPlayers = msg.max_players;
            mlData.answered = false; 
            mlData.removed = [];
            document.getElementById("mlGameOverBox").classList.add("hidden");
            document.getElementById("mlAudienceBox").classList.add("hidden");
            document.getElementById("mlPhoneBox").classList.add("hidden");
            mlData.rightPanelPage = "money";
            showScreen("mlGame"); playMlSound("question"); renderMlAll(); startMlTimer(mlData.turnSeconds);
        } else if (msg.type === "ml_answer_result") {
            mlData.answered = true; mlData.scores = msg.scores; stopMlTimer(); stopMlSound("question");
            document.querySelectorAll(".mlOptBtn").forEach(btn => {
                if (btn.dataset.letter === msg.correct_answer) btn.classList.add("correct");
                else if (btn.dataset.letter === msg.selected && !msg.correct) btn.classList.add("wrong");
            });
            playMlSound(msg.correct ? "correct" : "wrong");
        } else if (msg.type === "ml_phone_popup_show") {
            // ✨ Oynayan telefon jokerini kullandı - izleyici olarak biz de popup'ı görüyoruz
            console.log("[ML] İzleyici modu: Telefon popup'ı gösteriliyor");
            showPhoneBox(true, msg.contacts);
        } else if (msg.type === "ml_phone_contact_selected") {
            // ✨ Oynayan bir kişi seçti - biz de vurgula
            console.log("[ML] İzleyici modu: Kişi seçildi, index:", msg.contact_index);
            const idx = msg.contact_index;
            document.querySelectorAll(".mlPhoneContact").forEach((el, i) => {
                el.classList.add("disabled");
                if (i === idx) {
                    el.classList.add("selected");
                    el.style.border = "2px solid #51cf66";
                    el.style.background = "rgba(81, 207, 102, 0.2)";
                    
                    // Loading göster
                    const answerBox = document.getElementById("mlPhoneAnswer");
                    const contactName = el.querySelector(".mlPhoneName")?.textContent || "?";
                    answerBox.classList.remove("hidden");
                    answerBox.innerHTML = `
                        <div class="mlPhoneCallingText">📞 ${contactName} aranıyor...</div>
                    `;
                }
            });
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
            stopAllMlSounds();
            
            const title = document.getElementById("mlGameOverTitle");
            const text = document.getElementById("mlGameOverText");
            
            const isSolo = (mlData.maxPlayers || 2) === 1 || (mlData.players && mlData.players.length === 1);

            if (isSolo) {
                title.textContent = "SOLO BİTTİ! 🎯";
                title.style.color = "#51cf66";
                if (typeof startConfetti === "function") startConfetti();
            } else if (msg.winner_id === 0) { 
                title.textContent = "BERABERE!"; 
                title.style.color = "#74c0fc"; 
            } else if (msg.winner_id === mlData.playerId) { 
                title.textContent = "KAZANDIN! 🏆"; 
                title.style.color = "#51cf66"; 
                if (typeof startConfetti === "function") startConfetti(); 
            } else { 
                title.textContent = "KAYBETTİN 😢"; 
                title.style.color = "#ff6b6b"; 
            }
            
            // Sıralama listesi
            let ranking = msg.ranking;
            if (!ranking || !Array.isArray(ranking)) {
                ranking = [];
                for (const [pidStr, sc] of Object.entries(mlData.scores || {})) {
                    const pid = parseInt(pidStr);
                    ranking.push({ player_id: pid, name: getMlPlayerName(pid), score: sc });
                }
                ranking.sort((a, b) => b.score - a.score);
            }
            
            const listEl = document.getElementById("mlGameOverList");
            if (listEl) {
                listEl.innerHTML = "";
                const medals = ["🥇", "🥈", "🥉"];
                ranking.forEach((row, idx) => {
                    const li = document.createElement("li");
                    li.className = "mlGameOverItem";
                    if (idx === 0) li.classList.add("goldRank");
                    if (row.player_id === mlData.playerId) li.classList.add("meRow");
                    const medal = medals[idx] || `${idx + 1}.`;
                    const scoreCls = row.score < 0 ? "rankScore negative" : "rankScore";
                    li.innerHTML = `<span class="rankIcon">${medal}</span> <span class="rankName">${row.name}</span> <span class="${scoreCls}">${row.score.toLocaleString()} TL</span>`;
                    listEl.appendChild(li);
                });
            }
            
            if (isSolo) {
                const soloScore = mlData.scores[mlData.playerId] ?? (ranking[0] ? ranking[0].score : 0);
                text.innerHTML = `Solo skorun: <b style="color:#51cf66">${soloScore.toLocaleString()} TL</b>`;
            } else if (ranking.length === 2) {
                text.innerHTML = `Skor: <b>${ranking[0].score.toLocaleString()} TL - ${ranking[1].score.toLocaleString()} TL</b>`;
            } else {
                text.innerHTML = `<b>${ranking.length}</b> oyuncu yarıştı`;
            }
            
            const rematchBtn = document.getElementById("mlRematchBtn");
            const lobbyBtn = document.getElementById("mlBackToLobbyBtn");
            if (mlData.playerId === 1) {
                rematchBtn.classList.remove("hidden");
                lobbyBtn.classList.remove("hidden");
            } else {
                rematchBtn.classList.add("hidden");
                lobbyBtn.classList.add("hidden");
            }
            
            document.getElementById("mlGameOverBox").classList.remove("hidden");
        }
        return;
    }
    _originalHandleMessageML(msg);
};

// ========================================
// 💬 KİM MİLYONER CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("mlChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleMlChatPanel);
    
    const closeBtn = document.getElementById("mlChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeMlChatPanel);
    
    const sendBtn = document.getElementById("mlChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendMlChatMessage);
    
    const input = document.getElementById("mlChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendMlChatMessage();
                closeMlChatPanel();
                return;
            }
            e.stopPropagation();
        });
    }
    
    // T tuşu → chat aç + focus
    document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k !== "t") return;
        
        // Sadece Kim Milyoner ekranlarında
        const current = getCurrentScreen();
        if (!["mlLobby", "mlGame"].includes(current)) return;
        
        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        // Chat görünmüyorsa yoksay
        const container = document.getElementById("mlChatContainer");
        if (!container || container.style.display === "none") return;
        
        // Zaten açıksa yoksay
        if (mlChat.open) return;
        
        // Popup açıksa yoksay
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        e.preventDefault();
        e.stopPropagation();
        openMlChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (mlChat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeMlChatPanel();
        }
    }, true);
}, 200);