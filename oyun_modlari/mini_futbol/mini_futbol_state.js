// ==========================================
// ⚽ MİNİ FUTBOL - GLOBAL STATE & AYARLAR
// ==========================================

let miniAnimFrame = null;

let miniData = {
    roomCode: "",
    playerId: null,
    players: [],
    goalTarget: 3,
    matchDuration: 180,
    gameSpeed: "normal",
    playerCount: 2,  // ✨ Default 1v1
    spectatorCount: 0,  // ✨ Default izleyici yok
    redTeamName: "Kırmızı Takım",
    blueTeamName: "Mavi Takım",
    redTeamColor: "#ff6b6b",
    blueTeamColor: "#4dabf7",
    redSprintColor: "#ffd43b",
    blueSprintColor: "#ffd43b",
    splitScreen: false,
    splitOwner: null,        // ✨ Split sahibi (playerId 1)
    splitSlaveId: null,      // ✨ Split'in 2. oyuncu ID'si
    keysPressed2: {},        // ✨ P2 için ayrı tuş takibi (split-screen)
    // Oyun state
    playerNames: {},
    fieldConfig: null,
    gameState: null,
    keysPressed: {},
    currentPositions: {},
    targetPositions: {},
    // ✨ SNAPSHOT INTERPOLATION - Server jitter'ı yok etmek için
    snapshots: [],           // {t: timestamp, players: {pid: {x,y}}, ball: {x,y}}
    interpDelay: 50,         // ✨ 50ms buffer: ağ jitter'ını yutar, akıcılık artar (hâlâ düşük gecikme)
    serverTimeOffset: null,  // İlk paket geldiğinde ayarlanır
    // ✨ PING sistemi
    pings: {},           // {playerId: ping_ms}
    pingInterval: null,  // setInterval handle
    lastPingSent: 0,
    
    // ✨ CLIENT-SIDE PREDICTION (misafir için)
    predictedSelf: null,     // {x, y, vx, vy} - kendi karakterimin tahmini pozisyonu
    predictedKeys: {up:false, down:false, left:false, right:false, sprint:false},
    predictionActive: false, // Sadece misafirse aktif olur
    iceImage: null, // ❄️ Buz dokusu resmi
    persistentJerseys: (() => {
        try {
            const saved = localStorage.getItem("miniPersistentJerseys");
            return saved ? JSON.parse(saved) : {};
        } catch(e) { return {}; }
    })(),
    // ✨ GOL VİDEOSU KAYDEDİCİ
    isExportingVideo: false,
    audioBuffers: {},
    // 🎉 Gol sevinci seçici (1/2)
    celebPickerOpen: false,
    celebPickerIndex: 0,
    preferredCelebration: (() => {
        try {
            return localStorage.getItem("miniPreferredCelebration") || null;
        } catch (e) { return null; }
    })(),
    // 🎵 Gol Müziği Modu: "team" (takıma göre) veya "mixed" (karışık)
    goalMusicMode: (() => {
        try {
            return localStorage.getItem("miniGoalMusicMode") || "team";
        } catch (e) { return "team"; }
    })(),
    // 🎭 Oyuncuların anlık gol sevinci tercihleri tablosu
    playerCelebrationChoices: {}
};

// ✨ Kalıcı forma numaralarını sunucudan gelen listeye giydirme yardımcısı
function syncPersistentJerseys() {
    if (!miniData.players || !miniData.persistentJerseys) return;
    miniData.players.forEach(p => {
        const savedNum = miniData.persistentJerseys[String(p.id)];
        if (savedNum !== undefined) {
            p.jersey_number = savedNum;
        }
    });
}

// ========================================
// 🎥 REPLAY SİSTEMİ (v10 Özel - 10 Saniye Tamponlu)
// ========================================
let miniReplay = {
    buffer: [],          // Frame kayıtları
    lockedBuffer: null,  // Gol anında dondurulan klip
    replayStartTime: 0,  // Replay başlangıç zamanı
    maxDuration: 10000   // 10 saniyelik net tampon (8.2sn gol öncesi + 1.8sn gol sonrası)
};

// ========================================
// 💬 CHAT SİSTEMİ
// ========================================
let miniChat = {
    open: false,
    unread: 0,
    messages: [],    // {sender_id, sender_name, text, team, ts}
    maxMessages: 50,
    typingPlayers: {},  // {playerId: true} - şu an yazan oyuncular
    lastTypingSent: 0    // spam engeli
};

// ========================================
// 🎮 GAMEPAD DESTEĞİ
// ========================================
let miniGamepad = {
    connected: false,      // Kontrolcü bağlı mı
    index: -1,             // navigator.getGamepads() içindeki index
    name: "",              // Kontrolcü adı
    slot: "off",           // "off" / "p1" / "p2"
    pollInterval: null,    // Polling loop handle
    enabled: true          // ✨ Kullanıcı tarafından etkinleştirilmiş mi (default: true)
};

// Önceki tuş state (basıldı/bırakıldı algılamak için)
let gpPrevState = {
    up: false, down: false, left: false, right: false,
    kick: false, sprint: false,
    start: false, select: false,  // ✨ START (ESC) ve SELECT (TAB)
    l1: false, r1: false
};

const GP_DEADZONE = 0.25;  // Analog stick ölü bölge

// ✨ localStorage'dan enabled durumunu oku
function loadGamepadEnabled() {
    try {
        const saved = localStorage.getItem("miniGamepadEnabled");
        if (saved !== null) miniGamepad.enabled = (saved !== "false");
    } catch(e) {}
}

function saveGamepadEnabled() {
    try {
        localStorage.setItem("miniGamepadEnabled", miniGamepad.enabled ? "true" : "false");
    } catch(e) {}
}

loadGamepadEnabled();

// ========================================
// 🎨 COLOR & HEX HELPERS
// ========================================

function hexToRgba(hex, alpha) {
    const h = (hex || "#ffffff").replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ✨ Hex rengi {r,g,b} bileşenlerine ayır (alevli şut / glow efektleri için)
function hexToRgbParts(hex) {
    const h = (hex || "#ffffff").replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ✨ Hex rengi aç/koyulaştır (percent: -1..0 koyulaştır, 0..1 açar)
function shadeHexColor(hex, percent) {
    const { r, g, b } = hexToRgbParts(hex);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    const nr = Math.round((t - r) * p) + r;
    const ng = Math.round((t - g) * p) + g;
    const nb = Math.round((t - b) * p) + b;
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

// ========================================
// 🔒 SELJUK ÖZEL İSİM KORUMASI
// ========================================
const SELJUK_LOCK_KEY = "seljukLockUntil";
const SELJUK_ATTEMPTS_KEY = "seljukAttempts";
const SELJUK_VERIFIED_KEY = "seljukVerified";

function isSeljukName(name) {
    const n = (name || "").trim();
    return n === "Seljuk" || n === "seljuk" || n === "SELJUK";
}

function isSeljukLocked() {
    try {
        const until = parseInt(localStorage.getItem(SELJUK_LOCK_KEY) || "0");
        if (until && Date.now() < until) {
            return until - Date.now();  // Kalan ms
        }
    } catch(e) {}
    return 0;
}

function isSeljukVerified() {
    try {
        const verifiedUntil = parseInt(localStorage.getItem(SELJUK_VERIFIED_KEY) || "0");
        if (verifiedUntil && Date.now() < verifiedUntil) {
            return true;
        }
    } catch(e) {}
    return false;
}

function markSeljukVerified() {
    try {
        const until = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem(SELJUK_VERIFIED_KEY, String(until));
        localStorage.setItem(SELJUK_ATTEMPTS_KEY, "0");  // Denemeleri sıfırla
    } catch(e) {}
}

function formatLockTime(ms) {
    const mins = Math.ceil(ms / 60000);
    if (mins >= 60) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h} saat ${m} dakika`;
    }
    return `${mins} dakika`;
}

function showSeljukLockedPopup(remainingMs) {
    const existing = document.getElementById("seljukLockedBox");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "seljukLockedBox";
    overlay.className = "overlay";
    overlay.style.zIndex = "9999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #e03131; 
                                         box-shadow: 0 0 40px rgba(224,49,49,0.5);">
            <div style="font-size:60px; margin:10px 0;">⛔</div>
            <h2 style="color:#e03131; margin:10px 0 15px 0;">Kilitli!</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Çok fazla yanlış deneme yaptın.<br>
                <b style="color:#ffd43b;">${formatLockTime(remainingMs)}</b> sonra tekrar dene.
            </p>
            <div class="confirmButtons">
                <button id="seljukLockedOkBtn" class="bigBtn redBtn">Anladım</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("seljukLockedOkBtn").onclick = () => {
        overlay.remove();
    };
}

function showSeljukPasswordPopup() {
    return new Promise((resolve) => {
        const lockedMs = isSeljukLocked();
        if (lockedMs > 0) {
            showSeljukLockedPopup(lockedMs);
            resolve(false);
            return;
        }
        
        const existing = document.getElementById("seljukPasswordBox");
        if (existing) existing.remove();
        
        const attempts = parseInt(localStorage.getItem(SELJUK_ATTEMPTS_KEY) || "0");
        const remaining = 3 - attempts;
        
        const overlay = document.createElement("div");
        overlay.id = "seljukPasswordBox";
        overlay.className = "overlay";
        overlay.style.zIndex = "9999999";
        overlay.innerHTML = `
            <div class="overlayCard" style="max-width:450px; border:2px solid #ff6b6b; 
                                             box-shadow: 0 0 40px rgba(255,107,107,0.5);">
                <div style="font-size:60px; margin:10px 0;">🔒</div>
                <h2 style="color:#ff6b6b; margin:10px 0 15px 0;">Korumalı İsim</h2>
                <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                    <b style="color:#fff;">Seljuk</b> ismi korumalı.<br>
                    <span style="font-size:12px;">Devam etmek için şifre gir.</span>
                </p>
                <input id="seljukPwInput" type="password" 
                       placeholder="Şifre"
                       maxlength="20"
                       style="width:100%; padding:14px; font-size:20px; font-weight:bold;
                              border-radius:10px; border:2px solid #ff6b6b; 
                              background:#1a1e2e; color:#fff; text-align:center;
                              font-family:monospace; letter-spacing:5px; outline:none;">
                <p style="color:#ffd43b; font-size:12px; text-align:center; margin:10px 0 15px 0;">
                    Kalan hak: <b>${remaining}/3</b>
                </p>
                <div class="confirmButtons">
                    <button id="seljukPwOkBtn" class="bigBtn greenBtn">✓ TAMAM</button>
                    <button id="seljukPwCancelBtn" class="bigBtn redBtn">✗ İPTAL</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const input = document.getElementById("seljukPwInput");
        setTimeout(() => input.focus(), 50);
        
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("seljukPwOkBtn").click();
            } else if (e.key === "Escape") {
                e.preventDefault();
                document.getElementById("seljukPwCancelBtn").click();
            }
        });
        
        document.getElementById("seljukPwOkBtn").onclick = async () => {
            const password = input.value.trim();
            if (!password) {
                input.style.borderColor = "#ff3333";
                input.focus();
                return;
            }
            
            try {
                const resp = await fetch("/verify-seljuk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: password })
                });
                const data = await resp.json();
                
                if (data.ok) {
                    markSeljukVerified();
                    overlay.remove();
                    resolve(true);
                } else {
                    let newAttempts = parseInt(localStorage.getItem(SELJUK_ATTEMPTS_KEY) || "0") + 1;
                    localStorage.setItem(SELJUK_ATTEMPTS_KEY, String(newAttempts));
                    
                    if (newAttempts >= 3) {
                        const lockUntil = Date.now() + (60 * 60 * 1000);  // 1 saat
                        localStorage.setItem(SELJUK_LOCK_KEY, String(lockUntil));
                        localStorage.setItem(SELJUK_ATTEMPTS_KEY, "0");
                        overlay.remove();
                        showSeljukLockedPopup(60 * 60 * 1000);
                        resolve(false);
                    } else {
                        const remaining = 3 - newAttempts;
                        input.value = "";
                        input.style.borderColor = "#ff3333";
                        input.style.animation = "shake 0.4s";
                        setTimeout(() => { input.style.animation = ""; }, 400);
                        
                        const warnP = overlay.querySelector("p[style*='ffd43b']");
                        if (warnP) {
                            warnP.innerHTML = `❌ Yanlış! Kalan hak: <b>${remaining}/3</b>`;
                            warnP.style.color = "#ff6b6b";
                        }
                        input.focus();
                    }
                }
            } catch(e) {
                console.error("Şifre doğrulama hatası:", e);
                showToast("❌ Hata", "Bağlantı sorunu, tekrar dene", null, "error");
            }
        };
        
        document.getElementById("seljukPwCancelBtn").onclick = () => {
            overlay.remove();
            resolve(false);
        };
    });
}

// Shake CSS'i ekle
(function addShakeStyle() {
    if (document.getElementById("seljukShakeStyle")) return;
    const style = document.createElement("style");
    style.id = "seljukShakeStyle";
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
        }
    `;
    document.head.appendChild(style);
})();