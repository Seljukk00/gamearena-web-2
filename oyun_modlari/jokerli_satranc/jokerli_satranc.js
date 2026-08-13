// ==========================================
// ♟️ JOKERLİ SATRANÇ - Frontend
// ==========================================

let satrancData = {
    playerId: null,
    roomCode: "",
    inGame: false,
    timeMode: "blitz",
    jokerCount: 3,
    pickMode: "karisik",
    pickSeconds: 60,
    players: [],
    myColor: null,       // "w" veya "b"
    whiteId: null,
    blackId: null,
    whiteName: "",
    blackName: "",
    legalMoves: [],
    selectedSquare: null,
    board: null,         // chessboard.js instance
    game: null,          // chess.js instance
    clocks: {},
    clockInterval: null,
    increment: 0,
    moveHistory: [],
    // ✨ Joker seçim state
    jokerPool: [],           // Tüm 26 joker
    myJokers: [],            // Seçili/dağıtılmış jokerlerim
    oppJokerCount: 0,        // Rakibin joker sayısı
    jokerSelectMode: "karisik",
    jokerSelectDeadline: 0,
    jokerSelectInterval: null,
    usedJokers: [],       // Benim kullanılmış joker id'lerim
    oppUsedJokers: [],    // Rakibin kullanılmış joker id'leri (üstü çizik)
    invisibleDetails: {}, // {square: kalan_half_move} - kendi görünmez taşlarım
    lastInvisibleSquares: [],  // Bir önceki turdaki görünmez kareler (kaybolan → reappear tespiti)
    shieldedDetails: {}, // {square: kalan_tur} - kalkanlı taşlar
    frozenDetails: {}, // {square: kalan_tur} - dondurulmuş taşlar
    ajanDisguised: {}, // {square: "w"|"b"} - sadece görsel sahte renk
};

let _satrancRoomHelper = null;

// ==========================================
// YARDIMCI: Saniyeyi MM:SS'e çevir
// ==========================================
function formatClock(seconds) {
    if (seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ==========================================
// JOKER SEÇİM EKRANI
// ==========================================

function renderJokerCard(joker, container, mode) {
    const card = document.createElement("div");
    card.className = "satrancJokerCard";
    card.dataset.jokerId = joker.id;
    card.dataset.category = joker.category;

    // ✨ Süresiz modda saat jokerleri devre dışı
    const isTimeMode = satrancData.jokerSelectTimeMode || satrancData.timeMode || "blitz";
    const isTimeless = isTimeMode === "suresiz";
    const isClockJoker = (joker.id === "zaman_cal" || joker.id === "zamani_durdur");
    const isDisabled = isTimeless && isClockJoker;

    let disabledBadge = "";
    if (isDisabled) {
        card.classList.add("satrancJokerDisabled");
        disabledBadge = `<div class="satrancJcDisabledBadge">🔒 Süresiz modda kapalı</div>`;
    }

    card.innerHTML = `
        ${disabledBadge}
        <div class="satrancJcIcon">${joker.icon}</div>
        <div class="satrancJcName">${joker.name}</div>
        <div class="satrancJcCategory">${joker.category}</div>
        <div class="satrancJcDesc">${joker.desc}</div>
    `;
    if (mode === "pool") {
        card.onclick = () => {
            if (isDisabled) {
                satrancInfo({
                    icon: "🔒",
                    title: "Bu Joker Kapalı",
                    message: "Süresiz modda saat ile ilgili jokerler kullanılamaz.",
                    type: "warning",
                    okText: "Anladım"
                });
                return;
            }

            const alreadySelected = card.classList.contains("selected");
            if (alreadySelected) return;

            // ✨ Slot dolu mu kontrol
            const currentSelected = document.querySelectorAll("#satrancJsSlots .satrancJsSlotFilled").length;
            const totalNeeded = satrancData.jokerCount || 3;
            if (currentSelected >= totalNeeded) {
                satrancInfo({
                    icon: "🎴",
                    title: "Slotlar Dolu!",
                    message: `Zaten ${totalNeeded} joker seçtin.`,
                    detail: "Yeni bir tane eklemek için önce mevcut jokerlerinden birini X ile kaldır.",
                    type: "warning",
                    okText: "Anladım"
                });
                return;
            }

            send({ type: "satranc_select_joker", joker_id: joker.id });
        };
    }
    container.appendChild(card);
    return card;
}

function renderJokerSlots(selected, totalNeeded) {
    const slotsEl = document.getElementById("satrancJsSlots");
    if (!slotsEl) return;
    slotsEl.innerHTML = "";

    // Dolu slotlar
    selected.forEach(joker => {
        const slot = document.createElement("div");
        slot.className = "satrancJsSlotFilled";
        slot.innerHTML = `
            <span class="satrancJsSlotIcon">${joker.icon}</span>
            <span class="satrancJsSlotName">${joker.name}</span>
            <button class="satrancJsSlotRemove" title="Kaldır">✕</button>
        `;
        slot.querySelector(".satrancJsSlotRemove").onclick = () => {
            send({ type: "satranc_remove_joker", joker_id: joker.id });
        };
        slotsEl.appendChild(slot);
    });

    // Boş slotlar
    const empty = totalNeeded - selected.length;
    for (let i = 0; i < empty; i++) {
        const slot = document.createElement("div");
        slot.className = "satrancJsSlotEmpty";
        slot.textContent = `Boş Slot #${selected.length + i + 1}`;
        slotsEl.appendChild(slot);
    }

    // Havuzda seçili olanları işaretle
    const poolCards = document.querySelectorAll("#satrancJsPool .satrancJokerCard");
    const selectedIds = new Set(selected.map(j => j.id));
    poolCards.forEach(card => {
        if (selectedIds.has(card.dataset.jokerId)) {
            card.classList.add("selected");
        } else {
            card.classList.remove("selected");
        }
    });

    // Tamamla butonu aktifleştir
    const confirmBtn = document.getElementById("satrancJsConfirmBtn");
    if (confirmBtn) {
        // İster eksik ister tam, her zaman tıklanabilir (eksikleri otomatik doldurur)
        confirmBtn.disabled = false;
        if (selected.length >= totalNeeded) {
            confirmBtn.textContent = "✅ TAMAMLA VE BAŞLA";
        } else {
            confirmBtn.textContent = `⚡ ATLA (Eksikler Random) - ${selected.length}/${totalNeeded}`;
        }
    }
}

function startJokerSelectTimer(seconds) {
    stopJokerSelectTimer();
    const timerEl = document.getElementById("satrancJsTimer");
    if (!timerEl) return;

    // Sınırsız (0)
    if (seconds <= 0) {
        timerEl.textContent = "♾️";
        timerEl.classList.remove("warning", "danger");
        return;
    }

    let remaining = seconds;
    function updateDisplay() {
        timerEl.textContent = remaining;
        timerEl.classList.remove("warning", "danger");
        if (remaining <= 10) timerEl.classList.add("danger");
        else if (remaining <= 20) timerEl.classList.add("warning");
    }
    updateDisplay();

    satrancData.jokerSelectInterval = setInterval(() => {
        remaining--;
        updateDisplay();
        if (remaining <= 0) {
            stopJokerSelectTimer();
        }
    }, 1000);
}

function stopJokerSelectTimer() {
    if (satrancData.jokerSelectInterval) {
        clearInterval(satrancData.jokerSelectInterval);
        satrancData.jokerSelectInterval = null;
    }
}

function openJokerSelectScreen(msg) {
    satrancData.jokerPool = msg.all_jokers || [];
    satrancData.jokerSelectMode = msg.pick_mode;
    satrancData.jokerSelectDeadline = Date.now() + (msg.pick_seconds * 1000);
    satrancData.jokerSelectTimeMode = msg.time_mode || satrancData.timeMode || "blitz";

    showScreen("satrancJokerSelect");

    // Bilgi barı
    const modeEl = document.getElementById("satrancJsMode");
    const countEl = document.getElementById("satrancJsCount");
    if (modeEl) modeEl.textContent = msg.pick_mode === "karisik" ? "🎲 Karışık" : "📋 Manuel";
    if (countEl) countEl.textContent = msg.joker_count;

    // Sınırsız süre için timer'ı sakla
    const timerParent = document.getElementById("satrancJsTimer");
    if (timerParent && msg.pick_seconds <= 0) {
        timerParent.textContent = "♾️";
    }

    const randomBox = document.getElementById("satrancJsRandomBox");
    const manualBox = document.getElementById("satrancJsManualBox");

    if (msg.pick_mode === "karisik") {
        // Karışık: hazır jokerleri göster
        if (randomBox) randomBox.classList.remove("hidden");
        if (manualBox) manualBox.classList.add("hidden");

        const cardsEl = document.getElementById("satrancJsRandomCards");
        if (cardsEl) {
            cardsEl.innerHTML = "";
            (msg.my_jokers || []).forEach(j => renderJokerCard(j, cardsEl, "display"));
        }

        // 3-2-1 sayaç
        const cdEl = document.getElementById("satrancJsCountdown");
        let cd = 3;
        if (cdEl) cdEl.textContent = cd;
        const cdInt = setInterval(() => {
            cd--;
            if (cdEl) cdEl.textContent = cd;
            if (cd <= 0) clearInterval(cdInt);
        }, 1000);

        stopJokerSelectTimer(); // Karışıkta timer yok

    } else {
        // Manuel: havuzu göster
        if (randomBox) randomBox.classList.add("hidden");
        if (manualBox) manualBox.classList.remove("hidden");

        const poolEl = document.getElementById("satrancJsPool");
        if (poolEl) {
            poolEl.innerHTML = "";
            satrancData.jokerPool.forEach(j => renderJokerCard(j, poolEl, "pool"));
        }

        // Boş slotları başlangıçta göster
        renderJokerSlots([], msg.joker_count);

        // Rakip status
        const oppEl = document.getElementById("satrancJsOppProgress");
        if (oppEl) oppEl.textContent = `0/${msg.joker_count}`;

        // Timer başlat
        startJokerSelectTimer(msg.pick_seconds);
    }
}

// ==========================================
// OYUN İÇİ JOKER PANELLERİ
// ==========================================

function isMyTurn() {
    if (!satrancData.game || !satrancData.myColor) return false;
    return satrancData.game.turn() === satrancData.myColor;
}

function renderMyJokers() {
    const container = document.getElementById("satrancMyJokers");
    if (!container) return;
    container.innerHTML = "";

    if (!satrancData.myJokers || satrancData.myJokers.length === 0) {
        container.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:12px;">Joker yok</p>';
        return;
    }

    const usedIds = new Set(satrancData.usedJokers || []);
    const myTurn = isMyTurn();

    // Panel başlığına sıra bilgisi ekle
    const panelHeader = document.querySelector("#satrancMyJokerPanel h3");
    if (panelHeader) {
        if (myTurn) {
            panelHeader.innerHTML = "🃏 Jokerlerim <span style='color:#51cf66; font-size:12px;'>(AKTİF)</span>";
        } else {
            panelHeader.innerHTML = "🃏 Jokerlerim <span style='color:#ff6b6b; font-size:12px;'>(SIRA RAKİPTE)</span>";
        }
    }

    satrancData.myJokers.forEach(joker => {
        const card = document.createElement("div");
        card.className = "satrancJokerCard satrancJokerGameCard";
        card.dataset.jokerId = joker.id;
        card.dataset.category = joker.category;

        const isUsed = usedIds.has(joker.id);
        if (isUsed) card.classList.add("used");

        // ✨ Sıra bende değilse joker soluk
        if (!isUsed && !myTurn) {
            card.classList.add("not-my-turn");
            card.title = "⏳ Sıra rakipte, jokerlerini kullanamazsın";
        } else if (isUsed) {
            card.title = "✓ Bu jokeri zaten kullandın";
        } else {
            card.title = joker.desc;
        }

        // ✨ Görünmez aktif ise kart üzerinde göster
        let extraInfo = "";
        let cardTopBadge = "";
        let cardChargeBar = "";
        if (joker.id === "gorunmez" && isUsed) {
            const invDetails = satrancData.invisibleDetails || {};
            const activeSquares = Object.keys(invDetails);
            if (activeSquares.length > 0) {
                const turnsLeft = invDetails[activeSquares[0]] || 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge">🧙 Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("gorunmezActive");
                }
            }
        }

        if (joker.id === "kalkan" && isUsed) {
            const shDetails = satrancData.shieldedDetails || {};
            const activeSquares = Object.keys(shDetails);
            if (activeSquares.length > 0) {
                const turnsLeft = shDetails[activeSquares[0]] || 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge kalkanBadge">🛡️ Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("kalkanActive");
                }
            }
        }

        if (joker.id === "dondur" && isUsed) {
            const frDetails = satrancData.frozenDetails || {};
            const activeSquares = Object.keys(frDetails);
            if (activeSquares.length > 0) {
                const turnsLeft = frDetails[activeSquares[0]] || 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge dondurBadge">❄️ Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("dondurActive");
                }
            }
        }

        if (joker.id === "ajan" && isUsed) {
            const ajanDetails = satrancData.ajanDisguised || {};
            const activeSquares = Object.keys(ajanDetails);
            if (activeSquares.length > 0) {
                const data = ajanDetails[activeSquares[0]];
                const turnsLeft = (typeof data === "object") ? data.turns : 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge ajanBadge">🕵️ Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("ajanActive");
                }
            }
        }

        card.innerHTML = `
            ${cardTopBadge}
            ${cardChargeBar}
            <div class="satrancJcIcon">${joker.icon}</div>
            <div class="satrancJcName">${joker.name}</div>
        `;

        // ✨ Sadece kullanılmamış VE sıra bendeyken tıklanabilir
        if (!isUsed && myTurn) {
            card.onclick = () => tryUseJoker(joker);
        } else if (!isUsed && !myTurn) {
            card.onclick = () => {
                showToast("⏳ Sıra Sende Değil", "Rakip oynuyor, bekle.", null, "warning");
            };
        }
        container.appendChild(card);
    });
}

// ==========================================
// JOKER KULLANMA
// ==========================================

// Hedef gerektiren jokerler
const SINGLE_TARGET_JOKERS = ["vezire_yukselt", "kalkan", "dondur", "bomba", "gorunmez",
                              "kilitle", "ajan"];
const DOUBLE_TARGET_JOKERS = ["isinlan", "klon", "rakip_tas_yerlestir", "yer_degistir"];
// Özel: Taş Dönüştür - kare seç + tür seç popup
const SPECIAL_TARGET_JOKERS = ["tas_donustur"];

// Aktif kare seçim modu
let satrancPendingJoker = null;   // { joker, phase: 1|2, target1: null }

function tryUseJoker(joker) {
    // Kullanılmış mı?
    const usedIds = new Set(satrancData.usedJokers || []);
    if (usedIds.has(joker.id)) {
        showToast("⚠️ Kullanıldı", "Bu jokeri zaten kullandın.", null, "warning");
        return;
    }

    // Özel: Taş Dönüştür
    if (SPECIAL_TARGET_JOKERS.includes(joker.id)) {
        startTasDonusturFlow(joker);
        return;
    }

    // Hedef gerektiriyor mu?
    if (SINGLE_TARGET_JOKERS.includes(joker.id) || DOUBLE_TARGET_JOKERS.includes(joker.id)) {
        startSquareSelectMode(joker);
        return;
    }

    // Hedefsiz - onay iste ve gönder
    satrancConfirm({
        icon: joker.icon,
        title: joker.name,
        subtitle: `Kategori: ${joker.category.toUpperCase()}`,
        message: joker.desc,
        type: "joker",
        yesText: "🃏 Kullan",
        noText: "İptal"
    }).then(ok => {
        if (ok) send({ type: "satranc_use_joker", joker_id: joker.id });
    });
}

// Taş Dönüştür özel akışı
function startTasDonusturFlow(joker) {
    satrancPendingJoker = {
        joker: joker,
        phase: 1,
        target1: null,
        _isTasDonustur: true
    };
    showJokerTargetBanner(`🃏 ${joker.name}`, "Dönüştürülecek kendi taşını seç");

    $("#satrancBoard .square-55d63").off("click.jokerTarget").on("click.jokerTarget", function() {
        const square = $(this).attr("data-square");
        if (!square) return;
        // Kare seçildi, tür seçim popup göster
        satrancChoice({
            icon: "🃏",
            title: "Taş Dönüştür",
            message: `${square} karesindeki taşı neye dönüştürmek istiyorsun?`,
            choices: [
                { value: "q", icon: "♛", label: "Vezir" },
                { value: "r", icon: "♜", label: "Kale" },
                { value: "b", icon: "♝", label: "Fil" },
                { value: "n", icon: "♞", label: "At" },
                { value: "p", icon: "♟", label: "Piyon" }
            ]
        }).then(type => {
            if (!type) {
                cancelSquareSelectMode();
                return;
            }
            send({
                type: "satranc_use_joker_target",
                joker_id: joker.id,
                target1: square,
                piece_type: type
            });
            cancelSquareSelectMode();
        });
    });

    document.addEventListener("keydown", jokerCancelKeyHandler, true);
}

function startSquareSelectMode(joker) {
    satrancPendingJoker = {
        joker: joker,
        phase: 1,
        target1: null
    };

    const isDouble = DOUBLE_TARGET_JOKERS.includes(joker.id);
    const hint = _getJokerTargetHint(joker.id, 1);

    // Ekranın üstüne büyük banner
    showJokerTargetBanner(`${joker.icon} ${joker.name}`, hint);

    // ✨ Hedeflenebilir kareleri highlight et
    highlightTargetableSquares(joker.id, 1);

    // Tahtaya tıklama dinleyici ekle
    $("#satrancBoard .square-55d63").off("click.jokerTarget").on("click.jokerTarget", function(e) {
        const square = $(this).attr("data-square");
        if (!square) return;

        // ✨ Bu kare targetable değilse tıklamayı yoksay
        if (!isSquareTargetable(square, satrancPendingJoker.joker.id, satrancPendingJoker.phase, satrancPendingJoker.target1)) {
            return;
        }

        handleSquareSelectClick(square);
    });

    // ESC ile iptal (capture phase - app.js ESC popup'tan ÖNCE yakala)
    document.addEventListener("keydown", jokerCancelKeyHandler, true);
}

// ✨ Belirli joker için tıklanabilir karelerin kontrolü
function isSquareTargetable(square, jokerId, phase, prevTarget) {
    if (!satrancData.game) return true;
    const piece = satrancData.game.get(square);
    const myColor = satrancData.myColor;

    switch (jokerId) {
        case "bomba":
            // Sadece şah OLMAYAN taş (kendi veya rakip)
            return piece && piece.type !== "k";
        case "vezire_yukselt":
            // Sadece kendi piyon
            return piece && piece.color === myColor && piece.type === "p";
        case "kalkan":
        case "gorunmez":
            // Kendi taş (şah dahil)
            return piece && piece.color === myColor;
        case "dondur":
        case "kilitle":
            // Rakip taş (şah hariç)
            return piece && piece.color !== myColor && piece.type !== "k";
        case "ajan":
            // Kendi taş (şah hariç)
            return piece && piece.color === myColor && piece.type !== "k";
        case "isinlan":
            if (phase === 1) return piece && piece.color === myColor;
            // Phase 2: boş kare
            return !piece;
        case "klon":
            if (phase === 1) return piece && piece.color === myColor && piece.type !== "k";
            // Phase 2: boş komşu kare
            return !piece;
        case "rakip_tas_yerlestir":
            if (phase === 1) return piece && piece.color !== myColor && piece.type !== "k";
            return !piece;
        case "yer_degistir":
            // Kendi 2 taş (şah dahil)
            if (phase === 1) return piece && piece.color === myColor;
            return piece && piece.color === myColor && square !== prevTarget;
        case "tas_donustur":
            return piece && piece.color === myColor && piece.type !== "k";
        default:
            return true;
    }
}

// ✨ Tahtada hedeflenebilir kareleri highlight et
function highlightTargetableSquares(jokerId, phase, prevTarget) {
    // Önce tüm eski targetable classları temizle
    $("#satrancBoard .square-55d63").removeClass("joker-targetable joker-not-targetable");

    if (!satrancData.game) return;
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = files[c] + (r + 1);
            if (isSquareTargetable(sq, jokerId, phase, prevTarget)) {
                $(`#satrancBoard .square-${sq}`).addClass("joker-targetable");
            }
        }
    }
}

function _getJokerTargetHint(jokerId, phase) {
    const hints = {
        "vezire_yukselt": ["Yükseltmek istediğin piyonu seç"],
        "kalkan": ["Kalkan vereceğin kendi taşını seç"],
        "dondur": ["Donduracağın rakip taşını seç"],
        "bomba": ["Bombanın merkezini seç (şah hariç)"],
        "gorunmez": ["Görünmez yapacağın kendi taşını seç"],
        "kilitle": ["Kilitleyeceğin rakip taşını seç"],
        "ajan": ["Ajan yapacağın kendi taşını seç"],
        "isinlan": ["Işınlayacağın kendi taşını seç", "Hedef boş kareyi seç"],
        "klon": ["Klonlanacak kendi taşını seç", "Klon için komşu boş kareyi seç"],
        "rakip_tas_yerlestir": ["Taşınacak rakip taşı seç", "Hedef boş kareyi seç"],
        "yer_degistir": ["1. kendi taşını seç", "2. kendi taşını seç"],
    };
    const list = hints[jokerId] || ["Kare seç"];
    return list[phase - 1] || list[0];
}

function handleSquareSelectClick(square) {
    if (!satrancPendingJoker) return;
    const jokerId = satrancPendingJoker.joker.id;

    // Tek hedefli
    if (SINGLE_TARGET_JOKERS.includes(jokerId)) {
        // ✨ Hedef karedeki taşın adını al
        let subtitle = `Hedef Kare: ${square.toUpperCase()}`;
        if (satrancData.game) {
            const p = satrancData.game.get(square);
            if (p) {
                const pieceNames = {
                    "p": "Piyon", "r": "Kale", "n": "At",
                    "b": "Fil", "q": "Vezir", "k": "Şah"
                };
                const colorName = p.color === "w" ? "Beyaz" : "Siyah";
                const pName = pieceNames[p.type] || "Taş";
                subtitle = `Hedef: ${colorName} ${pName} (${square.toUpperCase()})`;
            } else {
                subtitle = `Hedef Kare: ${square.toUpperCase()} (boş)`;
            }
        }
        satrancConfirm({
            icon: satrancPendingJoker.joker.icon,
            title: satrancPendingJoker.joker.name,
            subtitle: subtitle,
            message: satrancPendingJoker.joker.desc,
            type: "joker",
            yesText: "🎯 Uygula",
            noText: "İptal"
        }).then(ok => {
            if (ok) {
                send({
                    type: "satranc_use_joker_target",
                    joker_id: jokerId,
                    target1: square
                });
                cancelSquareSelectMode();
            }
        });
        return;
    }

    // Çift hedefli
    if (DOUBLE_TARGET_JOKERS.includes(jokerId)) {
        if (satrancPendingJoker.phase === 1) {
            satrancPendingJoker.target1 = square;
            satrancPendingJoker.phase = 2;
            const hint = _getJokerTargetHint(jokerId, 2);
            showJokerTargetBanner(`${satrancPendingJoker.joker.icon} ${satrancPendingJoker.joker.name}`, `1. Seçilen: ${square} | ${hint}`);
            // 1. hedefi vurgula + phase 2 için hedeflenebilir kareler
            highlightTargetableSquares(jokerId, 2, square);
            $(`#satrancBoard .square-${square}`).addClass("highlight-from");
            return;
        }
        if (satrancPendingJoker.phase === 2) {
            const target1 = satrancPendingJoker.target1;
            if (square === target1) {
                showToast("⚠️", "Farklı bir kare seç!", null, "warning");
                return;
            }
            satrancConfirm({
                icon: satrancPendingJoker.joker.icon,
                title: satrancPendingJoker.joker.name,
                subtitle: `${target1.toUpperCase()} → ${square.toUpperCase()}`,
                message: satrancPendingJoker.joker.desc,
                type: "joker",
                yesText: "🎯 Uygula",
                noText: "İptal"
            }).then(ok => {
                if (ok) {
                    send({
                        type: "satranc_use_joker_target",
                        joker_id: jokerId,
                        target1: target1,
                        target2: square
                    });
                    cancelSquareSelectMode();
                }
            });
            return;
        }
    }
}

function jokerCancelKeyHandler(e) {
    if (e.key === "Escape") {
        // ESC event'in başka handler'lara gitmesini engelle (app.js ESC popup)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cancelSquareSelectMode();
    }
}

function cancelSquareSelectMode() {
    satrancPendingJoker = null;
    hideJokerTargetBanner();
    hideJokerCancelButton();
    $("#satrancBoard .square-55d63").off("click.jokerTarget");
    $("#satrancBoard .square-55d63").removeClass("highlight-from highlight-to joker-targetable joker-not-targetable");
    document.removeEventListener("keydown", jokerCancelKeyHandler, true);
}

function showJokerTargetBanner(title, hint) {
    let banner = document.getElementById("satrancJokerBanner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "satrancJokerBanner";
        banner.className = "satrancJokerBanner";
        document.body.appendChild(banner);
    }
    banner.innerHTML = `
        <div class="satrancJbTitle">${title}</div>
        <div class="satrancJbHint">${hint}</div>
        <div class="satrancJbCancel">ESC ile iptal</div>
    `;
    banner.classList.remove("hidden");

    // ✨ Sol alt "İptal Et" butonunu göster
    showJokerCancelButton();
}

function hideJokerTargetBanner() {
    const banner = document.getElementById("satrancJokerBanner");
    if (banner) banner.classList.add("hidden");
}

// ✨ Joker aktifken Jokerlerim kutusunun ALTINA "İPTAL ET" butonu
function showJokerCancelButton() {
    let btn = document.getElementById("satrancJokerCancelBtn");
    if (!btn) {
        btn = document.createElement("button");
        btn.id = "satrancJokerCancelBtn";
        btn.className = "satrancJokerCancelBtn";
        btn.innerHTML = "❌ Jokeri İptal Et";
        btn.onclick = () => cancelSquareSelectMode();
    }
    // Her seferinde doğru yere yerleştir (panel her renderMyJokers'ta yenilenir)
    const panel = document.getElementById("satrancMyJokerPanel");
    if (panel && btn.parentNode !== panel) {
        panel.appendChild(btn);
    }
    btn.style.display = "block";
}

function hideJokerCancelButton() {
    const btn = document.getElementById("satrancJokerCancelBtn");
    if (btn) btn.style.display = "none";
}

// Rakibin kullandığı jokerleri açığa çıkar (kart olarak sakla)
if (!window._satrancRevealedOppJokers) window._satrancRevealedOppJokers = [];

function revealOppJokerAsUsed(jokerId, jokerName, jokerIcon) {
    // Zaten reveal edilmiş mi?
    if (window._satrancRevealedOppJokers.some(j => j.id === jokerId)) return;
    // Havuzdan tam bilgiyi bulmaya çalış
    let jokerInfo = null;
    if (satrancData.jokerPool) {
        jokerInfo = satrancData.jokerPool.find(j => j.id === jokerId);
    }
    if (!jokerInfo) {
        jokerInfo = { id: jokerId, name: jokerName || "?", icon: jokerIcon || "🃏", category: "used" };
    }
    window._satrancRevealedOppJokers.push(jokerInfo);
}

function renderOppJokers() {
    const container = document.getElementById("satrancOppJokers");
    if (!container) return;
    container.innerHTML = "";

    const totalCount = satrancData.oppJokerCount || 0;
    const revealed = window._satrancRevealedOppJokers || [];
    const usedIds = new Set(satrancData.oppUsedJokers || []);
    const hiddenCount = Math.max(0, totalCount - revealed.length);

    if (totalCount === 0) {
        container.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:12px;">Joker yok</p>';
        return;
    }

    // Açığa çıkanları göster
    revealed.forEach(joker => {
        const card = document.createElement("div");
        const isUsed = usedIds.has(joker.id) || joker.used;
        card.className = "satrancJokerCard satrancJokerGameCard" + (isUsed ? " used" : "");
        card.dataset.category = joker.category || "revealed";

        if (joker._revealed && !isUsed) {
            card.title = `👁️ Görüldü: ${joker.name} - ${joker.desc || ""}`;
            card.classList.add("revealed-visible");
        } else if (isUsed) {
            card.title = `Kullanıldı: ${joker.name}`;
        }

        card.innerHTML = `
            <div class="satrancJcIcon">${joker.icon}</div>
            <div class="satrancJcName">${joker.name}</div>
        `;
        container.appendChild(card);
    });

    // Gizli olanlar
    for (let i = 0; i < hiddenCount; i++) {
        const card = document.createElement("div");
        card.className = "satrancJokerCard satrancJokerHiddenCard";
        card.innerHTML = `
            <div class="satrancJcIcon">🎴</div>
            <div class="satrancJcName">???</div>
        `;
        container.appendChild(card);
    }
}

// ==========================================
// MODERN POPUP SİSTEMİ
// ==========================================

// Confirm popup (Evet/Hayır sorusu)
function satrancConfirm(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "satrancModalOverlay";
        overlay.innerHTML = `
            <div class="satrancModalCard ${options.type || 'info'}">
                <div class="satrancModalIcon">${options.icon || '❓'}</div>
                <h2 class="satrancModalTitle">${options.title || 'Onay'}</h2>
                ${options.subtitle ? `<div class="satrancModalSubtitle">${options.subtitle}</div>` : ''}
                ${options.message ? `<p class="satrancModalMsg">${options.message}</p>` : ''}
                ${options.detail ? `<div class="satrancModalDetail">${options.detail}</div>` : ''}
                <div class="satrancModalButtons">
                    <button class="satrancModalBtn satrancModalYes">
                        ${options.yesText || '✅ Onayla'}
                    </button>
                    <button class="satrancModalBtn satrancModalNo">
                        ${options.noText || '❌ İptal'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Animasyonlu giriş
        setTimeout(() => overlay.classList.add("show"), 10);

        const close = (result) => {
            overlay.classList.remove("show");
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 250);
            resolve(result);
        };

        overlay.querySelector(".satrancModalYes").onclick = () => close(true);
        overlay.querySelector(".satrancModalNo").onclick = () => close(false);
        overlay.onclick = (e) => { if (e.target === overlay) close(false); };

        // ESC tuşu
        const escHandler = (e) => {
            if (e.key === "Escape") {
                close(false);
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);
    });
}

// Info popup (sadece bilgi göster, tek buton)
function satrancInfo(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "satrancModalOverlay";
        overlay.innerHTML = `
            <div class="satrancModalCard ${options.type || 'info'}">
                <div class="satrancModalIcon">${options.icon || 'ℹ️'}</div>
                <h2 class="satrancModalTitle">${options.title || 'Bilgi'}</h2>
                ${options.message ? `<p class="satrancModalMsg">${options.message}</p>` : ''}
                ${options.detail ? `<div class="satrancModalDetail">${options.detail}</div>` : ''}
                <div class="satrancModalButtons">
                    <button class="satrancModalBtn satrancModalYes single">
                        ${options.okText || 'Tamam'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add("show"), 10);

        const close = () => {
            overlay.classList.remove("show");
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 250);
            resolve();
        };

        overlay.querySelector(".satrancModalYes").onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    });
}

// Choice popup (seçenek listesi - Taş Dönüştür için)
function satrancChoice(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "satrancModalOverlay";
        let choicesHtml = "";
        (options.choices || []).forEach(c => {
            choicesHtml += `
                <button class="satrancChoiceBtn" data-value="${c.value}">
                    <span class="satrancChoiceIcon">${c.icon || ''}</span>
                    <span class="satrancChoiceLabel">${c.label}</span>
                </button>
            `;
        });
        overlay.innerHTML = `
            <div class="satrancModalCard choice">
                <div class="satrancModalIcon">${options.icon || '🎴'}</div>
                <h2 class="satrancModalTitle">${options.title || 'Seç'}</h2>
                ${options.message ? `<p class="satrancModalMsg">${options.message}</p>` : ''}
                <div class="satrancChoiceGrid">${choicesHtml}</div>
                <div class="satrancModalButtons">
                    <button class="satrancModalBtn satrancModalNo single">
                        ❌ İptal
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add("show"), 10);

        const close = (val) => {
            overlay.classList.remove("show");
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 250);
            resolve(val);
        };

        overlay.querySelectorAll(".satrancChoiceBtn").forEach(btn => {
            btn.onclick = () => close(btn.dataset.value);
        });
        overlay.querySelector(".satrancModalNo").onclick = () => close(null);
        overlay.onclick = (e) => { if (e.target === overlay) close(null); };

        const escHandler = (e) => {
            if (e.key === "Escape") {
                close(null);
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);
    });
}

// ==========================================
// RULET ANİMASYONU
// ==========================================
function showRuletAnimation(msg) {
    // Basit versiyon: popup göster
    let overlay = document.getElementById("satrancRuletOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "satrancRuletOverlay";
        overlay.className = "satrancRuletOverlay";
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div class="satrancRuletBox">
            <h1 style="color:#ffd43b; margin:0 0 15px 0;">🎰 RULET!</h1>
            <div class="satrancRuletSpinner">🎰</div>
            <div class="satrancRuletResult">
                <div style="font-size:28px; color:#51cf66; font-weight:bold; margin:15px 0;">
                    ${msg.rulet_label}
                </div>
                <div style="color:#adb5bd; font-size:16px;">
                    ${msg.rulet_result || ""}
                </div>
            </div>
            <button class="bigBtn greenBtn" onclick="document.getElementById('satrancRuletOverlay').remove()">Tamam</button>
        </div>
    `;
    overlay.classList.remove("hidden");

    // 4 saniye sonra otomatik kapan
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
    }, 5000);
}

// ==========================================
// BOMBA PATLAMA ANİMASYONU
// ==========================================
function playExplosionAnimation(square) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;

    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const rect = squareEl.getBoundingClientRect();

    // ✨ Sadece küçük patlama emojisi + kare flash
    const explosion = document.createElement("div");
    explosion.className = "satrancBombaExplosion";
    explosion.textContent = "💥";
    explosion.style.left = (rect.left + rect.width / 2) + "px";
    explosion.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(explosion);

    // Kareyi flash yap
    squareEl.classList.add("bombaFlash");
    setTimeout(() => squareEl.classList.remove("bombaFlash"), 600);
    setTimeout(() => explosion.remove(), 700);
}

// ==========================================
// GÖRÜNMEZ TAŞ - Sadece küçük 🧙 puf efekti
// (Kendi taşımız normal görünmeye devam eder, badge kartta zaten var)
// ==========================================
function playInvisibleFadeAnimation(square) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;
    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const puf = document.createElement("div");
    puf.className = "satrancInvisiblePuf";
    puf.textContent = "🧙";
    const rect = squareEl.getBoundingClientRect();
    puf.style.left = (rect.left + rect.width / 2) + "px";
    puf.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(puf);
    setTimeout(() => puf.remove(), 1000);
}

function playPieceTransformAnimation(square, label, icon) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;

    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const rect = squareEl.getBoundingClientRect();
    const pieceImg = squareEl.querySelector("img");

    if (pieceImg) {
        pieceImg.style.transition = "transform 0.45s ease, filter 0.45s ease, opacity 0.45s ease";
        pieceImg.style.transform = "scale(1.22)";
        pieceImg.style.filter = "drop-shadow(0 0 12px rgba(255, 212, 59, 0.95))";
        setTimeout(() => {
            pieceImg.style.transform = "";
            pieceImg.style.filter = "";
        }, 480);
    }

    squareEl.style.transition = "box-shadow 0.45s ease";
    squareEl.style.boxShadow = "inset 0 0 0 3px rgba(255,212,59,0.95), 0 0 22px rgba(255,212,59,0.55)";
    setTimeout(() => {
        squareEl.style.boxShadow = "";
    }, 520);

    const fx = document.createElement("div");
    fx.textContent = icon || "♛";
    fx.style.position = "fixed";
    fx.style.left = (rect.left + rect.width / 2) + "px";
    fx.style.top = (rect.top + rect.height / 2) + "px";
    fx.style.transform = "translate(-50%, -50%) scale(0.5)";
    fx.style.fontSize = "38px";
    fx.style.fontWeight = "bold";
    fx.style.pointerEvents = "none";
    fx.style.zIndex = "999999";
    fx.style.textShadow = "0 0 18px rgba(255,212,59,0.95)";
    fx.style.transition = "transform 0.5s ease, opacity 0.5s ease";
    fx.style.opacity = "0";
    document.body.appendChild(fx);

    const text = document.createElement("div");
    text.textContent = label || "Dönüştü!";
    text.style.position = "fixed";
    text.style.left = (rect.left + rect.width / 2) + "px";
    text.style.top = (rect.top + rect.height / 2 + 34) + "px";
    text.style.transform = "translate(-50%, -50%) scale(0.85)";
    text.style.fontSize = "14px";
    text.style.fontWeight = "700";
    text.style.color = "#ffd43b";
    text.style.pointerEvents = "none";
    text.style.zIndex = "999999";
    text.style.textShadow = "0 0 12px rgba(0,0,0,0.9)";
    text.style.transition = "transform 0.5s ease, opacity 0.5s ease";
    text.style.opacity = "0";
    document.body.appendChild(text);

    requestAnimationFrame(() => {
        fx.style.opacity = "1";
        fx.style.transform = "translate(-50%, -50%) scale(1.25) rotate(10deg)";
        text.style.opacity = "1";
        text.style.transform = "translate(-50%, -50%) scale(1)";
    });

    setTimeout(() => {
        fx.style.opacity = "0";
        fx.style.transform = "translate(-50%, -50%) scale(1.8) rotate(-8deg)";
        text.style.opacity = "0";
        text.style.transform = "translate(-50%, -50%) scale(1.06)";
    }, 320);

    setTimeout(() => {
        if (fx.parentNode) fx.remove();
        if (text.parentNode) text.remove();
    }, 900);
}

// ✨ Görünmez taş YENİLDİ - 3 kez yanıp sön, sonra kaybol
function playInvisibleRevealKillAnimation(square, onDone) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) { if (onDone) onDone(); return; }
    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) { if (onDone) onDone(); return; }
    const pieceImg = squareEl.querySelector("img");
    if (!pieceImg) { if (onDone) onDone(); return; }

    // 🧙 Puf: "Yakalandın!"
    const puf = document.createElement("div");
    puf.className = "satrancInvisiblePuf";
    puf.textContent = "🧙";
    const rect = squareEl.getBoundingClientRect();
    puf.style.left = (rect.left + rect.width / 2) + "px";
    puf.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(puf);

    // Taş şu an %30 opacity gösteriliyor (sahibi için) veya hiç görünmüyordu (rakibe göre)
    // Rakip için: taşı önce görünür yap
    pieceImg.style.transition = "opacity 0.2s ease";
    pieceImg.style.opacity = "1";

    // 3 kez yanıp sön: 0.2s -> 1.0, 0.2s -> 0.2, 0.2s -> 1.0, ...
    let blinkCount = 0;
    const maxBlinks = 6;  // 3 tam yanıp-sönme
    const blinkInterval = setInterval(() => {
        if (blinkCount >= maxBlinks) {
            clearInterval(blinkInterval);
            // Son olarak yok ol
            pieceImg.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            pieceImg.style.opacity = "0";
            pieceImg.style.transform = "scale(0.5)";
            setTimeout(() => {
                if (puf.parentNode) puf.remove();
                if (onDone) onDone();
            }, 400);
            return;
        }
        pieceImg.style.opacity = (blinkCount % 2 === 0) ? "0.2" : "1";
        blinkCount++;
    }, 200);
}

// Görünmez taş süresi bittiğinde - kısa ✨ efekti
function playInvisibleReappearAnimation(square) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;
    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const sparkle = document.createElement("div");
    sparkle.className = "satrancInvisiblePuf";
    sparkle.textContent = "✨";
    const rect = squareEl.getBoundingClientRect();
    sparkle.style.left = (rect.left + rect.width / 2) + "px";
    sparkle.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 900);
}

function applyAjanDisguiseVisuals(effects) {
    const disguised = (effects && effects.ajan_disguised) ? effects.ajan_disguised : {};
    satrancData.ajanDisguised = disguised;

    // Eski ajan görsellerini temizle
    $("#satrancBoard .squareAjanCharge").remove();
    $("#satrancBoard .ajanSquareEmoji").remove();
    $("#satrancBoard .invisibleSquareEmoji").remove();

    Object.keys(disguised).forEach(square => {
        const data = disguised[square];
        const fakeColor = (typeof data === "object") ? data.color : data;
        const turnsLeft = (typeof data === "object") ? data.turns : 6;

        const piece = satrancData.game ? satrancData.game.get(square) : null;
        if (!piece) return;

        const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
        const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
        const $sq = $(`#satrancBoard .square-${square}`);
        const $img = $sq.find("img");

        if ($img.length) {
            $img.attr("src", `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`);
        }

        // Sol üstte 🕵️ emoji
        $sq.append(`<div class="ajanSquareEmoji" title="Ajan taş">🕵️</div>`);

        // Sağ üstte şarj çubukları (max 6 diş)
        const maxTurns = 6;
        const colorClass = `ajanCharge-${Math.min(turnsLeft, 6)}`;
        let bars = "";
        for (let i = 0; i < maxTurns; i++) {
            const filled = i < turnsLeft ? "filled" : "empty";
            bars += `<div class="squareChargeBar ${filled}"></div>`;
        }
        $sq.append(`<div class="squareAjanCharge ${colorClass}" title="Ajan kalan: ${turnsLeft}">${bars}</div>`);
    });
}

// ==========================================
// MİNİ ÇARKIFELEK (Taş silme için)
// ==========================================
function showMiniCarkifelek(msg) {
    let overlay = document.getElementById("satrancMiniCarkOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancMiniCarkOverlay";
    overlay.className = "satrancCarkOverlay";
    document.body.appendChild(overlay);

    const pieces = msg.pieces || [];
    if (pieces.length === 0) {
        overlay.remove();
        return;
    }

    // Kurban indeksi
    const winnerIdx = pieces.findIndex(p =>
        p.square === msg.victim_square && p.type === msg.victim_type
    );

    const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
    const pieceColors = {
        p: "#8e8e8e", r: "#4dabf7", n: "#ffa94d",
        b: "#c084fc", q: "#ffd43b", n: "#ffa94d"
    };

    // Renk paleti (dilim başına)
    const palette = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
                     "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b",
                     "#8e44ad", "#27ae60", "#d35400", "#7f8c8d", "#2980b9"];

    const anglePerSlice = 360 / pieces.length;
    let sliceHtml = "";
    pieces.forEach((p, i) => {
        const color = palette[i % palette.length];
        const startAngle = i * anglePerSlice;
        const endAngle = (i + 1) * anglePerSlice;
        const largeArc = anglePerSlice > 180 ? 1 : 0;
        const x1 = 175 + 165 * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1 = 175 + 165 * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2 = 175 + 165 * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2 = 175 + 165 * Math.sin((endAngle - 90) * Math.PI / 180);
        const midAngle = (startAngle + endAngle) / 2 - 90;
        const textX = 175 + 105 * Math.cos(midAngle * Math.PI / 180);
        const textY = 175 + 105 * Math.sin(midAngle * Math.PI / 180);

        const pieceCode = `${p.color}${typeMap[p.type] || "P"}`;
        const imgSize = pieces.length <= 8 ? 42 : pieces.length <= 16 ? 32 : 24;

        sliceHtml += `
            <path d="M 175 175 L ${x1} ${y1} A 165 165 0 ${largeArc} 1 ${x2} ${y2} Z"
                  fill="${color}" stroke="#1a1e2e" stroke-width="1.5"/>
            <image href="/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png"
                   x="${textX - imgSize/2}" y="${textY - imgSize/2}"
                   width="${imgSize}" height="${imgSize}"
                   transform="rotate(${startAngle + anglePerSlice/2}, ${textX}, ${textY})" />
            <text x="${textX}" y="${textY + imgSize/2 + 12}"
                  fill="white" font-size="10" text-anchor="middle" font-weight="bold"
                  transform="rotate(${startAngle + anglePerSlice/2}, ${textX}, ${textY + imgSize/2 + 12})">
                ${p.square}
            </text>
        `;
    });

    const targetAngle = -(winnerIdx * anglePerSlice + anglePerSlice / 2);
    const spinAmount = 360 * 6 + targetAngle;

    overlay.innerHTML = `
        <div class="satrancCarkBox">
            <h1 style="color:#ff6b6b; margin:0 0 10px 0;">💀 TAŞ KATLİAMI</h1>
            <p style="color:#adb5bd; margin:0 0 15px 0;">
                ${msg.user_name} - Çark taşlarından birini seçiyor...
            </p>

            <div class="satrancCarkWrap">
                <div class="satrancCarkPointer">▼</div>
                <svg id="satrancMiniCarkSvg" width="350" height="350" viewBox="0 0 350 350"
                     style="transform: rotate(0deg); transition: transform 4s cubic-bezier(0.17, 0.67, 0.16, 0.99);">
                    ${sliceHtml}
                    <circle cx="175" cy="175" r="22" fill="#ff6b6b" stroke="#1a1e2e" stroke-width="3"/>
                </svg>
            </div>

            <div id="satrancMiniCarkResult" style="margin-top:20px; opacity:0; transition: opacity 0.5s;">
                <div style="font-size:22px; color:#ff6b6b; font-weight:bold;">
                    💥 ${msg.victim_name} (${msg.victim_square.toUpperCase()}) silindi!
                </div>
            </div>
        </div>
    `;

    // Animasyonu başlat
    setTimeout(() => {
        const svg = document.getElementById("satrancMiniCarkSvg");
        if (svg) svg.style.transform = `rotate(${spinAmount}deg)`;
    }, 100);

    // Sonucu göster
    setTimeout(() => {
        const result = document.getElementById("satrancMiniCarkResult");
        if (result) result.style.opacity = "1";
    }, 4200);

    // 5 saniye sonra kapat
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
    }, 5500);
}

// ==========================================
// ÇARKIFELEK ANİMASYONU
// ==========================================
function showCarkifelekAnimation(msg) {
    // Overlay oluştur
    let overlay = document.getElementById("satrancCarkOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancCarkOverlay";
    overlay.className = "satrancCarkOverlay";
    document.body.appendChild(overlay);

    const dilimler = msg.all_dilimler || [];
    const winnerIdx = dilimler.findIndex(d => d.id === msg.dilim_id);

    // 13 dilim SVG oluştur
    const anglePerSlice = 360 / dilimler.length;
    let sliceHtml = "";
    dilimler.forEach((d, i) => {
        const startAngle = i * anglePerSlice;
        const endAngle = (i + 1) * anglePerSlice;
        const largeArc = anglePerSlice > 180 ? 1 : 0;
        const x1 = 150 + 145 * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1 = 150 + 145 * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2 = 150 + 145 * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2 = 150 + 145 * Math.sin((endAngle - 90) * Math.PI / 180);
        const midAngle = (startAngle + endAngle) / 2 - 90;
        const textX = 150 + 90 * Math.cos(midAngle * Math.PI / 180);
        const textY = 150 + 90 * Math.sin(midAngle * Math.PI / 180);

        sliceHtml += `
            <path d="M 150 150 L ${x1} ${y1} A 145 145 0 ${largeArc} 1 ${x2} ${y2} Z"
                  fill="${d.color}" stroke="#1a1e2e" stroke-width="2"/>
            <text x="${textX}" y="${textY}" fill="white" font-size="20" text-anchor="middle"
                  transform="rotate(${startAngle + anglePerSlice/2}, ${textX}, ${textY})">
                ${d.icon}
            </text>
        `;
    });

    // Çarkın winner dilimine dönmesi için hesap
    // Ok yukarıda (0°), kazanan dilimin ortasına dönmeli
    const targetAngle = -(winnerIdx * anglePerSlice + anglePerSlice / 2);
    const spinAmount = 360 * 5 + targetAngle; // 5 tam tur + hedef

    overlay.innerHTML = `
        <div class="satrancCarkBox">
            <h1 style="color:#ffd43b; margin:0 0 10px 0;">🎡 ÇARKIFELEK</h1>
            <p style="color:#adb5bd; margin:0 0 15px 0;">
                ${msg.user_name} çarkı çevirdi...
            </p>

            <div class="satrancCarkWrap">
                <div class="satrancCarkPointer">▼</div>
                <svg id="satrancCarkSvg" width="300" height="300" viewBox="0 0 300 300"
                     style="transform: rotate(0deg); transition: transform 3.2s cubic-bezier(0.17, 0.67, 0.16, 0.99);">
                    ${sliceHtml}
                    <circle cx="150" cy="150" r="20" fill="#ffd43b" stroke="#1a1e2e" stroke-width="3"/>
                </svg>
            </div>

            <div id="satrancCarkResult" style="margin-top:20px; opacity:0; transition: opacity 0.5s;">
                <div style="font-size:32px; margin-bottom:5px;">${msg.dilim_icon}</div>
                <div style="font-size:22px; color:${msg.dilim_color}; font-weight:bold;">
                    ${msg.dilim_label}
                </div>
            </div>
        </div>
    `;

    // Animasyonu başlat
    setTimeout(() => {
        const svg = document.getElementById("satrancCarkSvg");
        if (svg) svg.style.transform = `rotate(${spinAmount}deg)`;
    }, 100);

    // Sonucu göster
    setTimeout(() => {
        const result = document.getElementById("satrancCarkResult");
        if (result) result.style.opacity = "1";
    }, 3400);

    // 6 saniye sonra kapat
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
    }, 6500);
}

// ==========================================
// LOBBY
// ==========================================
function updateSatrancLobby() {
    if (window.setupRoomCodeAndLink && !_satrancRoomHelper) {
        _satrancRoomHelper = window.setupRoomCodeAndLink({
            codeTextId: "satrancRoomCodeText",
            codeEyeBtnId: "satrancRoomCodeEyeBtn",
            copyHintId: "satrancCopyHint",
            linkTextId: "satrancInviteLinkText",
            linkEyeBtnId: "satrancInviteLinkEyeBtn",
            linkHintId: "satrancInviteLinkHint",
            getRoomCode: () => satrancData.roomCode,
            getPlayerId: () => satrancData.playerId
        });
    }
    if (_satrancRoomHelper) {
        _satrancRoomHelper.renderCode();
        _satrancRoomHelper.renderLink();
    }

    const timeModeNames = {
        "bullet": "⚡ 1 Dakika", "blitz": "🔥 3 Dakika",
        "rapid": "🏃 10 Dakika", "klasik": "🎩 30 Dakika", "suresiz": "♾️ Süresiz"
    };
    const pickModeNames = { "karisik": "🎲 Karışık", "manuel": "📋 Manuel" };

    const tmEl = document.getElementById("satrancLobbyTimeMode");
    const jcEl = document.getElementById("satrancLobbyJokerCount");
    const pmEl = document.getElementById("satrancLobbyPickMode");
    const psEl = document.getElementById("satrancLobbyPickSeconds");
    if (tmEl) tmEl.textContent = timeModeNames[satrancData.timeMode] || satrancData.timeMode;
    if (jcEl) jcEl.textContent = satrancData.jokerCount;
    if (pmEl) pmEl.textContent = pickModeNames[satrancData.pickMode] || satrancData.pickMode;
    if (psEl) psEl.textContent = satrancData.pickSeconds === 0 ? "♾️ Sınırsız" : satrancData.pickSeconds;

    const list = document.getElementById("satrancPlayersList");
    if (list) {
        list.innerHTML = "";
        satrancData.players.forEach(p => {
            const li = document.createElement("li");
            li.classList.add("playerRow");
            const nameCell = document.createElement("span");
            nameCell.className = "nameCell";
            nameCell.style.cssText = "flex:1; text-align:left; padding-left:10px;";
            const crown = p.id === 1 ? " 👑" : "";
            nameCell.textContent = p.id === satrancData.playerId
                ? `${p.id}. ${p.name} (Sen)${crown}`
                : `${p.id}. ${p.name}${crown}`;
            li.appendChild(nameCell);

            if (p.id !== satrancData.playerId && satrancData.playerId === 1) {
                const kickBtn = document.createElement("button");
                kickBtn.className = "kickBtnNew";
                kickBtn.textContent = "Oyuncuyu At";
                kickBtn.onclick = () => {
                    if (typeof openKickConfirm === "function") openKickConfirm(p.id, p.name);
                };
                li.appendChild(kickBtn);
            }
            li.classList.add(p.id === satrancData.playerId ? "playerMine" : "playerOpp");
            list.appendChild(li);
        });
    }

    const isHost = satrancData.playerId === 1;
    const startBtn = document.getElementById("satrancStartBtn");
    const settingsBtn = document.getElementById("satrancRoomSettingsBtn");
    const lobbyMsg = document.getElementById("satrancLobbyMsg");

    if (startBtn) startBtn.classList.toggle("hidden", !(isHost && satrancData.players.length === 2));
    if (settingsBtn) settingsBtn.classList.toggle("hidden", !isHost);
    if (window.updateChangeModeBtnVisibility) {
        window.updateChangeModeBtnVisibility("satrancChangeModeBtn", isHost);
    }

    if (lobbyMsg) {
        if (isHost && satrancData.players.length === 2) {
            lobbyMsg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
            lobbyMsg.style.color = "#51cf66";
        } else if (isHost) {
            lobbyMsg.textContent = "Rakip bekleniyor...";
            lobbyMsg.style.color = "#ff6b6b";
        } else {
            lobbyMsg.textContent = "Host'un oyunu başlatması bekleniyor...";
            lobbyMsg.style.color = "#51cf66";
        }
    }
}

// ==========================================
// TAHTA KURULUM
// ==========================================
function initSatrancBoard(fen, myColor, legalMoves) {
    satrancData.legalMoves = legalMoves || [];
    satrancData.selectedSquare = null;

    // chess.js instance
    satrancData.game = new Chess(fen);

    // Highlight kareler
    function removeHighlights() {
        $("#satrancBoard .square-55d63").removeClass("highlight-from highlight-to highlight-legal");
    }

    function highlightLegal(square) {
        removeHighlights();
        $(`#satrancBoard .square-${square}`).addClass("highlight-from");
        satrancData.legalMoves.forEach(move => {
            if (move.startsWith(square)) {
                const to = move.slice(2, 4);
                $(`#satrancBoard .square-${to}`).addClass("highlight-legal");
            }
        });
    }

    // chessboard.js config
    const config = {
        draggable: false,  // ✨ Sürükle-bırak kapalı, sadece tıklama
        position: fen,
        orientation: myColor === "b" ? "black" : "white",
        pieceTheme: "/satranc_vendor/img/chesspieces/wikipedia/{piece}.png",
        moveSpeed: 500,        // Taş kaydırma hızı (ms) - yavaş ve akıcı
        snapSpeed: 100,
        snapbackSpeed: 200,
        appearSpeed: 200,
        trashSpeed: 150,

        // onDragStart ve onDrop kapalı - sadece tıklama modu

        // Hover ile hamle noktaları KAPALI - sadece tıklayınca gösterilecek
        // onMouseoverSquare ve onMouseoutSquare kaldırıldı

        };

    // Eğer önceki board varsa temizle
    if (satrancData.board) {
        satrancData.board.destroy();
        satrancData.board = null;
    }

    satrancData.board = Chessboard("satrancBoard", config);

    // ✨ Board boyutunu container'a fit et
    setTimeout(() => {
        if (satrancData.board) satrancData.board.resize();
    }, 50);

    // ✨ TIKLAMA İLE TAŞ SEÇ / HAMLE YAP (event delegation - img de dahil)
    setTimeout(() => {
        const boardEl = document.getElementById("satrancBoard");
        if (!boardEl) return;

        // Delegated click: img tıklansa bile parent square yakalanır
        $(boardEl).off("click.satrancMove").on("click.satrancMove", ".square-55d63", function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Joker seçim modundaysa satrancMove tıklaması çalışmasın
            if (satrancPendingJoker) return;

            const square = $(this).attr("data-square");
            if (!square) {
                console.warn("[SATRANC] data-square yok:", this);
                return;
            }
            if (!satrancData.myColor) return;
            if (!satrancData.game) return;
            if (satrancData.game.game_over()) return;

            const myTurn = satrancData.game.turn() === satrancData.myColor;
            if (!myTurn) return;

            const piece = satrancData.game.get(square);

            // ✨ Donmuş taşa tıklanamaz - hiç hamle gösterilmesin
            const frozenSquares = Object.keys(satrancData.frozenDetails || {});
            if (frozenSquares.includes(square) && piece && piece.color === satrancData.myColor) {
                showToast("❄️ Donmuş!", "Bu taş donmuş, oynayamazsın.", null, "warning");
                clearSquareSelection();
                return;
            }

            // Zaten bir taş seçiliyse ve tıklanan kare hedef mi?
            if (satrancData.selectedSquare) {
                const uci = satrancData.selectedSquare + square;
                // Direkt eşleşme
                if (satrancData.legalMoves.includes(uci)) {
                    sendMove(uci);
                    clearSquareSelection();
                    return;
                }
                // Promosyon hamlesi (c7b8q gibi 5 karakter)
                const promoMove = satrancData.legalMoves.find(m => m.length === 5 && m.startsWith(uci));
                if (promoMove) {
                    // Backend'e sadece from+to gönder; backend promotion_needed dönecek
                    sendMove(uci);
                    clearSquareSelection();
                    return;
                }
                // Aynı kareye tekrar tıklandı → seçimi iptal
                if (satrancData.selectedSquare === square) {
                    clearSquareSelection();
                    return;
                }
                // Kendi başka taşına tıklandı → seçimi değiştir
                if (piece && piece.color === satrancData.myColor) {
                    clearSquareSelection();
                    selectSquare(square);
                    return;
                }
                // Geçersiz tıklama → seçimi iptal
                clearSquareSelection();
                return;
            }

            // Hiç seçili yok, kendi taşımı seçiyorum
            if (piece && piece.color === satrancData.myColor) {
                selectSquare(square);
            }
        });

        // Taş img'lerinin drag'ini kapat (chess.js hover'ı ile karışıklık önlensin)
        $(boardEl).find("img.piece-417db").css({
            "pointer-events": "none",
            "-webkit-user-drag": "none"
        });

        if (satrancData.board) satrancData.board.resize();
    }, 100);
}

// Kareyi seç ve highlight göster
function selectSquare(square) {
    satrancData.selectedSquare = square;
    // Highlight
    $("#satrancBoard .square-55d63").removeClass("highlight-from highlight-legal square-selected invisible-capture");
    $(`#satrancBoard .square-${square}`).addClass("square-selected");

    // ✨ Kalkanlı hedef kareleri hesapla (rakibin kalkanlı taşları)
    const shieldedSquares = Object.keys(satrancData.shieldedDetails || {});
    // Kendi seçtiğim taş kalkanlı mı? (kimseyi yiyemez)
    const iAmShielded = shieldedSquares.includes(square) &&
        (satrancData.game && satrancData.game.get(square)?.color === satrancData.myColor);

    // Legal hamleleri göster
    const invCapSquares = satrancData.invisibleCaptureSquares || [];
    
    const shownTargets = new Set();
    satrancData.legalMoves.forEach(move => {
        if (move.startsWith(square)) {
            const to = move.slice(2, 4);
            if (shownTargets.has(to)) return;  // aynı hedefi 4 kez gösterme (promo varyantları için)
            shownTargets.add(to);
            const $sq = $(`#satrancBoard .square-${to}`);

            // Hedef karede taş var mı?
            const targetPiece = satrancData.game ? satrancData.game.get(to) : null;
            const isCapture = targetPiece && targetPiece.color !== satrancData.myColor;

            // 🛡️ KRİTİK FİX: Eğer hedef kare kalkanlıysa, bu hamle HİÇ YOKMUŞ gibi davran
            if (shieldedSquares.includes(to)) {
                return;
            }

            // ✨ Kendi taşım kalkanlıysa kimseyi yiyemez
            if (iAmShielded && (isCapture || invCapSquares.includes(to))) {
                return;
            }

            $sq.addClass("highlight-legal");
            // ✨ Rakibin görünmez taşı barındırıyorsa yeme halkası göster
            if (invCapSquares.includes(to)) {
                $sq.addClass("invisible-capture");
            }
        }
    });
}

// Seçimi temizle
function clearSquareSelection() {
    satrancData.selectedSquare = null;
    $("#satrancBoard .square-55d63").removeClass("highlight-legal square-selected invisible-capture");
}

// ==========================================
// HAMLEYİ GÖNDER
// ==========================================
function sendMove(uci, promotion) {
    console.log("[MOVE SEND]", uci, "promo:", promotion);
    send({
        type: "satranc_make_move",
        move: uci,
        promotion: promotion || "q"
    });
    // Optimistik güncelleme (backend onaylayınca gerçek güncelleme gelir)
    satrancData.legalMoves = [];
}

// ==========================================
// BOARD GÜNCELLE
// ==========================================
function updateSatrancBoard(boardState, lastMove, effects) {
    if (!satrancData.board || !satrancData.game) return;

    // ✨ Animasyon başlamadan ÖNCE: ajan taşını sahte renkle hazırla
    if (lastMove && lastMove.length >= 4 && effects && effects.ajan_disguised) {
        const from = lastMove.slice(0, 2);
        if (effects.ajan_disguised[from]) {
            // Ajan taşın hareket edeceği img'yi sahte renkte yap
            // Böylece animasyon sırasında da sahte renk göstersin
        }
    }

    // ✨ Animasyon başlamadan ÖNCE: eğer hareket eden taş görünmezse, ona flag ekle
    // Bu sayede body'ye taşındığında opacity 0.3 kalır
    if (lastMove && lastMove.length >= 4 && effects && effects.invisible) {
        const from = lastMove.slice(0, 2);
        const to = lastMove.slice(2, 4);
        // Görünmez kareler yeni pozisyonda mı?
        if (effects.invisible.includes(to)) {
            const $movingImg = $(`#satrancBoard .square-${from} img`);
            $movingImg.addClass("animatingInvisible");
        }
    }

    // ✨ Ajan taşı hareket edecekse animasyondan ÖNCE src'yi sahte renge çevir
    // Böylece chessboard.js body'ye taşırken sahte src ile taşır
    if (lastMove && lastMove.length >= 4) {
        const from = lastMove.slice(0, 2);
        const ajanState = satrancData.ajanDisguised || {};
        const effectsAjan = (effects && effects.ajan_disguised) ? effects.ajan_disguised : {};
        const ajanData = ajanState[from] || effectsAjan[from];

        if (ajanData) {
            const fakeColor = (typeof ajanData === "object") ? ajanData.color : ajanData;
            const piece = satrancData.game.get(from);
            if (piece) {
                const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
                const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
                const $img = $(`#satrancBoard .square-${from} img`);
                if ($img.length) {
                    $img.attr("src", `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`);
                    console.log(`[AJAN] Animasyon öncesi src fake yapıldı: ${from} -> ${pieceCode}`);
                }
            }
        }
    }

    // ✨ Ajan taşı hareket edecekse animasyondan ÖNCE src'yi sahte renge çevir
    let ajanMoveInfo = null;
    if (lastMove && lastMove.length >= 4) {
        const from = lastMove.slice(0, 2);
        const ajanState = satrancData.ajanDisguised || {};
        const effectsAjan = (effects && effects.ajan_disguised) ? effects.ajan_disguised : {};
        const ajanData = ajanState[from] || effectsAjan[from];

        if (ajanData) {
            const fakeColor = (typeof ajanData === "object") ? ajanData.color : ajanData;
            const piece = satrancData.game.get(from);
            if (piece) {
                const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
                const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
                const fakeSrc = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
                ajanMoveInfo = { from: from, to: lastMove.slice(2, 4), fakeSrc: fakeSrc };

                const $img = $(`#satrancBoard .square-${from} img`);
                if ($img.length) {
                    $img.attr("src", fakeSrc);
                }
            }
        }
    }

    satrancData.game.load(boardState.fen);
    // ✨ true = animate, false = instant
    satrancData.board.position(boardState.fen, true);

    // ✨ Chessboard.js body'ye img taşırken kendi src'sini yazıyor - override edelim
    // Her board update sonrası TÜM ajan karelerini süreki override et
    const ajanOverrideMap = {};  // {square: fakeSrc}
    const allAjan = Object.assign({}, satrancData.ajanDisguised || {}, (effects && effects.ajan_disguised) || {});
    const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };

    Object.keys(allAjan).forEach(sq => {
        const data = allAjan[sq];
        const fakeColor = (typeof data === "object") ? data.color : data;
        const piece = satrancData.game.get(sq);
        if (piece) {
            const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
            ajanOverrideMap[sq] = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
        }
    });

    if (Object.keys(ajanOverrideMap).length > 0) {
        const overrideInterval = setInterval(() => {
            // Body'deki taşınan img'ler (hareket sırasında)
            if (ajanMoveInfo) {
                $("body > img.piece-417db").each(function() {
                    const $this = $(this);
                    const currentSrc = $this.attr("src");
                    if (currentSrc && currentSrc !== ajanMoveInfo.fakeSrc) {
                        $this.attr("src", ajanMoveInfo.fakeSrc);
                    }
                });
            }
            // Tahtadaki tüm ajan karelerini sahte src ile zorla
            Object.keys(ajanOverrideMap).forEach(sq => {
                const $img = $(`#satrancBoard .square-${sq} img`);
                if ($img.length) {
                    const currentSrc = $img.attr("src");
                    if (currentSrc !== ajanOverrideMap[sq]) {
                        $img.attr("src", ajanOverrideMap[sq]);
                    }
                }
            });
        }, 20);

        setTimeout(() => {
            clearInterval(overrideInterval);
            // Son bir kez kesin uygula
            Object.keys(ajanOverrideMap).forEach(sq => {
                const $img = $(`#satrancBoard .square-${sq} img`);
                if ($img.length) {
                    $img.attr("src", ajanOverrideMap[sq]);
                }
            });
        }, 900);
    }

    // Tüm efekt sınıflarını temizle
    $("#satrancBoard .square-55d63").removeClass(
        "highlight-from highlight-to highlight-check effect-shielded effect-frozen effect-invisible effect-locked"
    );
    // Eski badge'leri sil
    $("#satrancBoard .invisibleTurnBadge").remove();
    // ✨ Eski şarj çubuklarını sil (yeni karelere yeniden eklenecek)
    $("#satrancBoard .squareInvisibleCharge").remove();
    $("#satrancBoard .squareShieldCharge").remove();
    $("#satrancBoard .squareFrozenCharge").remove();
    $("#satrancBoard .squareAjanCharge").remove();
    $("#satrancBoard .ajanSquareEmoji").remove();
    $("#satrancBoard .invisibleSquareEmoji").remove();

    // ✨ Efektleri animasyondan SONRA uygula (board.position animasyonu ~500ms)
    // Bu sırada img'ler yeniden yaratıldığı için efektin yeni img'e binmesi lazım
    const applyEffectsDelayed = () => {
        // İnline style temizle - opacity hariç (görünmez taş için lazım)
        $("#satrancBoard .square-55d63 img").css({
            "filter": "",
            "transform": "",
            "transition": ""
        });
        // Opacity sıfırla ama sonra effects.invisible varsa geri koyacağız
        $("#satrancBoard .square-55d63 img").css("opacity", "");

        // Son hamleyi vurgula (sadece geçerliyse)
        if (lastMove && lastMove.length >= 4) {
            const from = lastMove.slice(0, 2);
            const to = lastMove.slice(2, 4);
            $(`#satrancBoard .square-${from}`).addClass("highlight-from");
            $(`#satrancBoard .square-${to}`).addClass("highlight-to");
        }

        // Şah
        if (boardState.is_check) {
            const turn = boardState.turn;
            const board = satrancData.game.board();
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = board[r][c];
                    if (piece && piece.type === "k" &&
                        ((turn === "w" && piece.color === "w") ||
                         (turn === "b" && piece.color === "b"))) {
                        const files = "abcdefgh";
                        const sq = files[c] + (8 - r);
                        $(`#satrancBoard .square-${sq}`).addClass("highlight-check");
                    }
                }
            }
        }

        // Efektleri uygula
        if (effects) {
            (effects.shielded || []).forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-shielded");
                // ✨ Sağ üste şarj çubukları (max 4 diş)
                const turnsLeft = (effects.shielded_details || {})[sq] || 0;
                const maxTurns = 4;
                const colorClass = `shieldCharge-${Math.min(turnsLeft, 4)}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareShieldCharge").remove();
                $sq.append(`<div class="squareShieldCharge ${colorClass}" title="Kalkan kalan: ${turnsLeft}">${bars}</div>`);
            });
            (effects.frozen || []).forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-frozen");
                // Şarj çubukları (max 2 diş)
                const turnsLeft = (effects.frozen_details || {})[sq] || 0;
                const maxTurns = 2;
                const colorClass = `frozenCharge-${turnsLeft}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareFrozenCharge").remove();
                $sq.append(`<div class="squareFrozenCharge ${colorClass}" title="Donmuş: ${turnsLeft} tur">${bars}</div>`);
            });
            (effects.invisible || []).forEach(sq => {
                console.log("[SATRANC INVISIBLE] class ekleniyor:", sq);
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-invisible");
                // ✨ Görünmez karede highlight (sarı) OLMASIN - ipucu vermesin
                $sq.removeClass("highlight-from highlight-to");
                // ✨ Taşa direkt inline opacity ver (class binmezse bile çalışsın)
                $sq.find("img").css("opacity", "0.3");
                // ✨ Sağ üste şarj çubukları (max 5 diş, kalan tur kadar dolu)
                const turnsLeft = (effects.invisible_details || {})[sq] || 0;
                const maxTurns = 5;
                const colorClass = `charge-${turnsLeft}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareInvisibleCharge").remove();
                $sq.find(".invisibleSquareEmoji").remove();
                $sq.append(`<div class="invisibleSquareEmoji" title="Görünmez taş">🧙</div>`);
                $sq.append(`<div class="squareInvisibleCharge ${colorClass}" title="Kalan tur: ${turnsLeft}">${bars}</div>`);
            });
            (effects.locked || []).forEach(sq => {
                $(`#satrancBoard .square-${sq}`).addClass("effect-locked");
            });

            // ✨ Reappear tespiti - SADECE aktif hiç görünmez kalmadıysa oynasın
            // (hamle sonrası kare değişince değil, süre bitince)
            const prevInv = satrancData.lastInvisibleSquares || [];
            const currInv = effects.invisible || [];
            if (prevInv.length > 0 && currInv.length === 0) {
                // Tüm görünmezler bitmiş → son karede sparkle
                prevInv.forEach(sq => {
                    setTimeout(() => playInvisibleReappearAnimation(sq), 100);
                });
            }
            satrancData.lastInvisibleSquares = currInv.slice();
            satrancData.invisibleDetails = effects.invisible_details || {};
            satrancData.shieldedDetails = effects.shielded_details || {};
            satrancData.frozenDetails = effects.frozen_details || {};

            applyAjanDisguiseVisuals(effects);

            // ✨ invisibleDetails değişti, kart görünümünü güncelle (üstü çizik olabilir)
            renderMyJokers();
        }
    };

    // chessboard.js animasyonu bitmeden efekt uygularsak class yeni img'e binmez
    // Birkaç kere uygula: hızlı, animasyon ortası, animasyon sonu ve sonrası
    setTimeout(applyEffectsDelayed, 50);
    setTimeout(applyEffectsDelayed, 300);
    setTimeout(applyEffectsDelayed, 600);
    setTimeout(applyEffectsDelayed, 900);
    // ✨ Ajan görselini ekstra kere daha uygula (animasyon sonrası src reset olmasın)
    setTimeout(() => applyAjanDisguiseVisuals(effects), 700);
    setTimeout(() => applyAjanDisguiseVisuals(effects), 1000);
    setTimeout(() => applyAjanDisguiseVisuals(effects), 1400);
}

// ==========================================
// YENİLEN TAŞLAR
// ==========================================
function renderCapturedPieces(capturedByMe, capturedByOpp) {
    const myEl = document.getElementById("satrancMyCaptured");
    const oppEl = document.getElementById("satrancOppCaptured");
    if (!myEl || !oppEl) return;

    const pieceOrder = { q: 1, r: 2, b: 3, n: 4, p: 5 };
    const pieceValues = { q: 9, r: 5, b: 3, n: 3, p: 1 };
    const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
    const pieceNames = { p: "Piyon", r: "Kale", n: "At", b: "Fil", q: "Vezir", k: "Şah" };

    function renderOne(container, pieces) {
        container.innerHTML = "";

        const sorted = [...(pieces || [])].sort((a, b) => {
            return (pieceOrder[a.type] || 99) - (pieceOrder[b.type] || 99);
        });

        sorted.forEach(p => {
            const pieceCode = `${p.color || "b"}${typeMap[p.type] || "P"}`;
            const img = document.createElement("img");
            img.src = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
            img.alt = p.type || "piece";
            img.title = `${p.color === "w" ? "Beyaz" : "Siyah"} ${pieceNames[p.type] || "Taş"}`;
            container.appendChild(img);
        });

        }

    const myList = capturedByMe || [];
    const oppList = capturedByOpp || [];

    renderOne(myEl, myList);
    renderOne(oppEl, oppList);

    // Toplam sayacı güncelle
    const myTotalEl = document.getElementById("satrancMyCapturedTotal");
    const oppTotalEl = document.getElementById("satrancOppCapturedTotal");
    if (myTotalEl) myTotalEl.textContent = String(myList.length);
    if (oppTotalEl) oppTotalEl.textContent = String(oppList.length);

    console.log("[SATRANC CAPTURED] Yediklerim:", myList.length, "Kaybettiklerim:", oppList.length);
}

// ==========================================
// SAAT
// ==========================================
function startSatrancClock() {
    stopSatrancClock();
    satrancData.clockInterval = setInterval(() => {
        updateClockDisplay();
    }, 1000);
}

function stopSatrancClock() {
    if (satrancData.clockInterval) {
        clearInterval(satrancData.clockInterval);
        satrancData.clockInterval = null;
    }
}

function updateClockDisplay() {
    const myEl = document.getElementById("satrancP1Clock");
    const oppEl = document.getElementById("satrancP2Clock");
    if (!myEl || !oppEl) return;

    const myPid = satrancData.playerId;
    const oppPid = satrancData.players.find(p => p.id !== myPid)?.id;

    if (myEl) myEl.textContent = formatClock(satrancData.clocks[myPid] || 0);
    if (oppEl) oppEl.textContent = formatClock(satrancData.clocks[oppPid] || 0);

    // ✨ Aktif oyuncunun saati parlasın
    const activeTurn = satrancData.game?.turn();
    if (activeTurn) {
        const activePid = activeTurn === "w" ? satrancData.whiteId : satrancData.blackId;
        if (activePid === myPid) {
            myEl.style.color = "#51cf66";
            myEl.style.boxShadow = "0 0 15px rgba(81,207,102,0.5)";
            oppEl.style.color = "#adb5bd";
            oppEl.style.boxShadow = "none";
        } else {
            oppEl.style.color = "#ff8a8a";
            oppEl.style.boxShadow = "0 0 15px rgba(255,107,107,0.5)";
            myEl.style.color = "#adb5bd";
            myEl.style.boxShadow = "none";
        }
    }
}

function renderClocks(clocks) {
    Object.keys(clocks).forEach(pid => {
        satrancData.clocks[parseInt(pid)] = clocks[pid];
    });
    updateClockDisplay();
}

// ==========================================
// SIRA BİLGİSİ
// ==========================================
function updateTurnInfo(boardState) {
    const turnEl = document.getElementById("satrancTurnInfo");
    if (!turnEl) return;

    const myTurn = boardState.turn === satrancData.myColor;
    if (myTurn) {
        turnEl.textContent = "🟢 SENİN SIRAN!";
        turnEl.style.color = "#51cf66";
    } else {
        const oppName = satrancData.myColor === "w" ? satrancData.blackName : satrancData.whiteName;
        turnEl.textContent = `⏳ ${oppName} oynuyor...`;
        turnEl.style.color = "#ff6b6b";
    }
}

// ==========================================
// HAMLE GEÇMİŞİ
// ==========================================
function addMoveToHistory(sanMove) {
    satrancData.moveHistory.push(sanMove);
    const histEl = document.getElementById("satrancMoveHistory");
    if (!histEl) return;
    histEl.innerHTML = "";
    satrancData.moveHistory.forEach((m, i) => {
        const span = document.createElement("span");
        span.className = "satrancMoveChip";
        if (i % 2 === 0) {
            const num = document.createElement("span");
            num.className = "satrancMoveNum";
            num.textContent = `${Math.floor(i / 2) + 1}.`;
            histEl.appendChild(num);
        }
        span.textContent = m;
        histEl.appendChild(span);
    });
    histEl.scrollLeft = histEl.scrollWidth;
}

// ==========================================
// TERFİ POPUP - Her zaman 4 tür göster (Vezir/Kale/Fil/At)
// ==========================================
function showCapturedPromotionPopup(from, to, capturedPieces) {
    // Yenilen taş sayılarını grupla (sadece bilgi amaçlı - "×N" rozetleri için)
    const grouped = {};
    (capturedPieces || []).forEach(p => {
        const key = p.type;
        if (key === "k" || key === "p") return;
        grouped[key] = (grouped[key] || 0) + 1;
    });

    // Kendi rengim
    const myColor = satrancData.myColor || "w";
    const typeMap = { q: "Q", r: "R", b: "B", n: "N" };
    const pieceNames = { q: "Vezir", r: "Kale", b: "Fil", n: "At" };
    const allTypes = ["q", "r", "b", "n"];  // Her zaman 4 seçenek

    // Overlay oluştur
    let overlay = document.getElementById("satrancPromoOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancPromoOverlay";
    overlay.className = "satrancPromoOverlay";

    let piecesHtml = "";
    allTypes.forEach(type => {
        const pieceCode = myColor + typeMap[type];
        const count = grouped[type] || 0;
        const countHtml = count > 0
            ? `<div class="satrancPromoCount">×${count}</div>`
            : "";
        piecesHtml += `
            <div class="satrancPromoPiece" data-piece="${type}">
                <img src="/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png" alt="${type}">
                <div class="satrancPromoName">${pieceNames[type]}</div>
                ${countHtml}
            </div>
        `;
    });

    overlay.innerHTML = `
        <div class="satrancPromoBox">
            <div class="satrancPromoIcon">👑</div>
            <h2 class="satrancPromoTitle">Piyon Sona Ulaştı!</h2>
            <p class="satrancPromoDesc">
                Piyonunu neye dönüştürmek istiyorsun?<br>
                <span style="color:#ffd43b; font-weight:bold;">${from.toUpperCase()} → ${to.toUpperCase()}</span>
            </p>
            <div class="satrancPromoPieces">${piecesHtml}</div>
            <div class="satrancPromoHint">💡 Tıklayarak seç</div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);

    // Taş tıklama
    overlay.querySelectorAll(".satrancPromoPiece").forEach(el => {
        el.onclick = () => {
            const chosen = el.dataset.piece;
            overlay.classList.remove("show");
            setTimeout(() => overlay.remove(), 300);
            sendMoveWithPromotion(from, to, chosen);
        };
    });
}

function sendMoveWithPromotion(from, to, pieceType) {
    // Animasyon için beklet
    satrancData.pendingPromotion = { from: from, to: to, pieceType: pieceType };

    send({
        type: "satranc_make_move",
        move: from + to,
        promotion: pieceType,
        promotion_confirmed: true
    });
    satrancData.legalMoves = [];
}

// Eski showPromotionBox (kullanılmıyor artık ama uyumluluk için)
function showPromotionBox(from, to) {
    // Kullanıcı boş listeyle çağırdığında yedeklik
    showCapturedPromotionPopup(from, to, []);
}

// ==========================================
// OYUN SONU
// ==========================================
function showSatrancGameOver(msg) {
    stopSatrancClock();

    const box = document.getElementById("satrancGameOverBox");
    const title = document.getElementById("satrancGameOverTitle");
    const text = document.getElementById("satrancGameOverText");
    const rematchBtn = document.getElementById("satrancRematchBtn");
    const lobbyBtn = document.getElementById("satrancBackToLobbyBtn");

    if (!box) return;

    const isWinner = msg.winner_id === satrancData.playerId;
    const isDraw = !msg.winner_id;

    if (title) {
        if (isDraw) {
            title.textContent = "🤝 Berabere!";
            title.style.color = "#ffd43b";
        } else if (isWinner) {
            title.textContent = "🏆 KAZANDIN!";
            title.style.color = "#51cf66";
            if (typeof startConfetti === "function") startConfetti();
        } else {
            title.textContent = "😢 KAYBETTİN!";
            title.style.color = "#ff6b6b";
        }
    }

    if (text) text.textContent = msg.message || "";
    if (rematchBtn) rematchBtn.classList.toggle("hidden", satrancData.playerId !== 1);
    if (lobbyBtn) lobbyBtn.classList.remove("hidden");

    box.classList.remove("hidden");
}

// ==========================================
// ODA AYARLARI
// ==========================================
function openSatrancRoomSettings() {
    window.openRoomSettingsGeneric({
        title: "Jokerli Satranç - Oda Ayarları",
        readonly: satrancData.playerId !== 1,
        fields: [
            {
                id: "timeMode", label: "⏱️ Süre Modu",
                current: satrancData.timeMode,
                options: [
                    {value: "bullet", label: "⚡ 1 Dakika"},
                    {value: "blitz", label: "🔥 3 Dakika"},
                    {value: "rapid", label: "🏃 10 Dakika"},
                    {value: "klasik", label: "🎩 30 Dakika"},
                    {value: "suresiz", label: "♾️ Süresiz"}
                ]
            },
            {
                id: "jokerCount", label: "🃏 Joker Sayısı",
                current: satrancData.jokerCount,
                options: [1,2,3,4,5,6].map(v => ({value: v, label: String(v)}))
            },
            {
                id: "pickMode", label: "🎴 Joker Seçim Modu",
                current: satrancData.pickMode,
                options: [
                    {value: "karisik", label: "🎲 Karışık"},
                    {value: "manuel", label: "📋 Manuel"}
                ]
            },
            {
                id: "pickSeconds", label: "⏳ Joker Seçim Süresi",
                current: satrancData.pickSeconds,
                options: [
                    {value: 30, label: "30 sn"}, {value: 60, label: "60 sn"},
                    {value: 90, label: "90 sn"}, {value: 120, label: "120 sn"},
                    {value: 180, label: "3 dakika"}, {value: 300, label: "5 dakika"},
                    {value: 0, label: "♾️ Sınırsız"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "satranc_update_settings",
                time_mode: values.timeMode,
                joker_count: parseInt(values.jokerCount),
                pick_mode: values.pickMode,
                pick_seconds: parseInt(values.pickSeconds)
            });
        }
    });
}

// ==========================================
// CHAT
// ==========================================
let satrancChat = { open: false, unread: 0, messages: [], maxMessages: 50 };

function showSatrancChat() {
    const c = document.getElementById("satrancChatContainer");
    if (c) c.style.display = "block";
}

function hideSatrancChat() {
    const c = document.getElementById("satrancChatContainer");
    if (c) c.style.display = "none";
    satrancChat.messages = [];
    satrancChat.unread = 0;
}

// ==========================================
// WRAP: showScreen
// ==========================================
const _prevShowScreenSatranc = showScreen;
showScreen = function(name) {
    _prevShowScreenSatranc(name);

    const screens = ["createSatrancScreen", "satrancLobbyScreen",
                     "satrancJokerSelectScreen", "satrancGameScreen"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    if (name === "createSatranc") {
        document.getElementById("createSatrancScreen").classList.remove("hidden");
    }
    if (name === "satrancLobby") {
        document.getElementById("satrancLobbyScreen").classList.remove("hidden");
    }
    if (name === "satrancJokerSelect") {
        document.getElementById("satrancJokerSelectScreen").classList.remove("hidden");
    }
    if (name === "satrancGame") {
        document.getElementById("satrancGameScreen").classList.remove("hidden");
        setTimeout(() => {
            if (satrancData.board) satrancData.board.resize();
        }, 200);
    }

    const satrancScreens = ["createSatranc", "satrancLobby",
                            "satrancJokerSelect", "satrancGame"];
    if (satrancScreens.includes(name)) showSatrancChat();
    else hideSatrancChat();
};

// ==========================================
// WRAP: handleMessage
// ==========================================
const _prevHandleSatranc = handleMessage;
handleMessage = function(msg) {

    if (msg.type === "satranc_room_created") {
        satrancData.playerId = msg.player_id;
        satrancData.roomCode = msg.room_code;
        satrancData.timeMode = msg.time_mode;
        satrancData.jokerCount = msg.joker_count;
        satrancData.pickMode = msg.pick_mode;
        satrancData.pickSeconds = msg.pick_seconds;
        satrancData.inGame = true;
        playerId = msg.player_id;
        roomCode = msg.room_code;
        inRoom = true;
        _satrancRoomHelper = null;
        showScreen("satrancLobby");
        updateSatrancLobby();
        return;
    }

    if (msg.type === "satranc_room_joined") {
        satrancData.playerId = msg.player_id;
        satrancData.roomCode = msg.room_code;
        satrancData.timeMode = msg.time_mode;
        satrancData.jokerCount = msg.joker_count;
        satrancData.pickMode = msg.pick_mode;
        satrancData.pickSeconds = msg.pick_seconds;
        satrancData.inGame = true;
        playerId = msg.player_id;
        roomCode = msg.room_code;
        inRoom = true;
        _satrancRoomHelper = null;
        showScreen("satrancLobby");
        updateSatrancLobby();
        return;
    }

    if (msg.type === "satranc_lobby_update") {
        satrancData.roomCode = msg.room_code;
        satrancData.players = msg.players;
        satrancData.timeMode = msg.time_mode;
        satrancData.jokerCount = msg.joker_count;
        satrancData.pickMode = msg.pick_mode;
        satrancData.pickSeconds = msg.pick_seconds;
        updateSatrancLobby();
        return;
    }

    // ✨ Joker seçim başladı
    if (msg.type === "satranc_joker_selection_start") {
        openJokerSelectScreen(msg);
        return;
    }

    // ✨ Slotlar güncellendi (kart ekle/sil sonrası)
    if (msg.type === "satranc_joker_slot_update") {
        const joker_count = satrancData.jokerCount;
        renderJokerSlots(msg.selected || [], joker_count);
        return;
    }

    // ✨ Rakip seçim yapıyor
    if (msg.type === "satranc_opponent_selecting") {
        const oppEl = document.getElementById("satrancJsOppProgress");
        if (oppEl) oppEl.textContent = `${msg.selected_count}/${msg.total_needed}`;
        return;
    }

    // ✨ Rakip hazır
    if (msg.type === "satranc_opponent_ready") {
        const oppEl = document.getElementById("satrancJsOppProgress");
        if (oppEl) {
            oppEl.textContent = `✅ HAZIR!`;
            oppEl.style.color = "#51cf66";
            oppEl.style.fontWeight = "bold";
        }
        return;
    }

    // ✨ Kendi jokerlerim hazır (manuel confirm veya timeout sonrası)
    if (msg.type === "satranc_your_jokers_ready") {
        satrancData.myJokers = msg.my_jokers || [];
        if (msg.time_up) {
            const cnt = satrancData.myJokers.length;
            if (cnt === 0) {
                showToast("⏰ Süre Bitti!", "Hiç joker seçmediğin için oyuna jokersiz başlıyorsun.", null, "warning");
            } else {
                showToast("⏰ Süre Bitti!", `Seçtiğin ${cnt} joker ile devam ediliyor.`, null, "warning");
            }
        }
        // Confirm butonunu disable et
        const confirmBtn = document.getElementById("satrancJsConfirmBtn");
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "✅ HAZIR - Rakip bekleniyor...";
            confirmBtn.style.opacity = "0.6";
        }
        return;
    }

    if (msg.type === "satranc_game_started") {
        stopJokerSelectTimer();
        satrancData.myJokers = msg.my_jokers || [];
        satrancData.oppJokerCount = msg.opp_joker_count || 0;
        satrancData.usedJokers = [];
        satrancData.oppUsedJokers = [];
        window._satrancRevealedOppJokers = [];  // ✨ reveal listesi sıfırla

        // ✨ Joker panellerini render et
        setTimeout(() => {
            renderMyJokers();
            renderOppJokers();

            const myPidStr = String(satrancData.playerId);
            const oppPidStr = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
            const capturedMap = msg.captured_pieces || {};
            renderCapturedPieces(
                capturedMap[myPidStr] || [],
                capturedMap[oppPidStr] || []
            );
        }, 400);

        satrancData.myColor = msg.my_color;
        satrancData.whiteId = msg.white_id;
        satrancData.blackId = msg.black_id;
        satrancData.whiteName = msg.white_name;
        satrancData.blackName = msg.black_name;
        satrancData.legalMoves = msg.legal_moves || [];
        satrancData.increment = msg.increment || 0;
        satrancData.moveHistory = [];

        // Saatleri ayarla
        const clocks = msg.clocks || {};
        Object.keys(clocks).forEach(pid => {
            satrancData.clocks[parseInt(pid)] = clocks[pid];
        });

        // ✨ Sol panel = SEN, Sağ panel = RAKİP
        const myEl = document.getElementById("satrancP1Name");
        const oppEl = document.getElementById("satrancP2Name");
        const myPid = satrancData.playerId;
        const oppPid = satrancData.players.find(p => p.id !== myPid)?.id;

        const myName = satrancData.players.find(p => p.id === myPid)?.name || "Sen";
        const oppName = satrancData.players.find(p => p.id === oppPid)?.name || "Rakip";

        if (myEl) myEl.textContent = `👤 ${myName} (Sen)`;
        if (oppEl) oppEl.textContent = `👤 ${oppName}`;

        showScreen("satrancGame");

        // Tahta kur
        setTimeout(() => {
            initSatrancBoard(msg.board.fen, msg.my_color, msg.legal_moves);
            updateTurnInfo(msg.board);
            updateClockDisplay();
            if (msg.time_mode !== "suresiz") startSatrancClock();
        }, 300);

        showToast("♟️ Oyun Başladı!", 
            msg.my_color === "w" ? "Sen Beyazsın - İlk hamle sende!" : "Sen Siyahsın - Rakip başlıyor",
            null, "success");
        return;
    }

    if (msg.type === "satranc_board_update") {
        // ✨ Görünmez taş yenildiyse ÖNCE flash animasyonu göster, sonra board güncelle
        if (msg.invisible_revealed_kill) {
            const killSquare = msg.invisible_revealed_kill.square;
            const isVictim = (msg.invisible_revealed_kill.owner_id === satrancData.playerId);

            // ✨ Sahip için: taşı önce görünür yap ki animasyon yakalayabilsin
            if (isVictim) {
                const $sq = $(`#satrancBoard .square-${killSquare}`);
                $sq.find("img").css("opacity", "1");
                $sq.removeClass("effect-invisible");
                $sq.find(".squareInvisibleCharge").remove();
            }

            playInvisibleRevealKillAnimation(
                killSquare,
                () => {
                    updateSatrancBoard(msg.board, msg.last_move, msg.effects);
                    if (msg.san_move) addMoveToHistory(msg.san_move);
                    renderClocks(msg.clocks || {});
                    updateTurnInfo(msg.board);
                    renderMyJokers();
                    if (msg.captured_pieces) {
                        const myPid = String(satrancData.playerId);
                        const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                        renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
                    }
                }
            );
            return;
        }
        updateSatrancBoard(msg.board, msg.last_move, msg.effects);
        if (msg.san_move) addMoveToHistory(msg.san_move);
        renderClocks(msg.clocks || {});
        updateTurnInfo(msg.board);
        renderMyJokers();  // ✨ Sıra değişti, jokerleri yenile
        if (msg.captured_pieces) {
            const myPid = String(satrancData.playerId);
            const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
            renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
        }

        // ✨ Promosyon animasyonu (sade fade + hafif büyüme)
        if (satrancData.pendingPromotion) {
            const pp = satrancData.pendingPromotion;
            satrancData.pendingPromotion = null;
            setTimeout(() => {
                const $sq = $(`#satrancBoard .square-${pp.to}`);
                $sq.addClass("satrancPromoFade");
                setTimeout(() => $sq.removeClass("satrancPromoFade"), 700);
            }, 550);
        }

        return;
    }

    // ✨ Çarkıfelek çark döndü
    if (msg.type === "satranc_carkifelek_spin") {
        showCarkifelekAnimation(msg);
        return;
    }

    // ✨ Mini Çarkıfelek (Taş katliamı için)
    if (msg.type === "satranc_mini_carkifelek") {
        showMiniCarkifelek(msg);
        return;
    }

    // ✨ Lobiye dön (herkese)
    if (msg.type === "satranc_back_to_lobby_broadcast") {
        // Board'u temizle
        if (satrancData.board) {
            try { satrancData.board.destroy(); } catch(e) {}
            satrancData.board = null;
        }
        satrancData.myJokers = [];
        satrancData.oppJokerCount = 0;
        satrancData.usedJokers = [];
        satrancData.moveHistory = [];
        stopSatrancClock();
        cancelSquareSelectMode();
        showToast("🏠 Lobiye Döndü", msg.message || "Oyun sonlandırıldı.", null, "info");
        showScreen("satrancLobby");
        updateSatrancLobby();
        return;
    }

    // ✨ Error mesajlarını yakala - joker seçim hataları için özel popup
    if (msg.type === "error" && msg.message) {
        const m = msg.message.toLowerCase();
        // Slot dolu hatası
        if (m.includes("tüm slotlar dolu") || m.includes("slotlar dolu")) {
            satrancInfo({
                icon: "🎴",
                title: "Slotlar Dolu!",
                message: msg.message,
                type: "warning",
                okText: "Anladım"
            });
            return;  // orijinal handler'a gitme
        }
        // Zaten seçili
        if (m.includes("zaten seçtin")) {
            showToast("⚠️", msg.message, null, "warning");
            return;
        }
        // Sıra sende değil
        if (m.includes("sıra sende değil") || m.includes("sadece kendi sıranda")) {
            satrancInfo({
                icon: "⏳",
                title: "Sıra Sende Değil",
                message: msg.message,
                detail: "Jokerlerini sadece kendi sırandayken kullanabilirsin.",
                type: "warning",
                okText: "Anladım"
            });
            return;
        }
        // Taşınız yendi geri alınamaz
        if (m.includes("taşınız yendi")) {
            satrancInfo({
                icon: "❌",
                title: "Geri Al Kullanılamaz",
                message: msg.message,
                detail: "Rakip senin taşını yediyse Geri Al ile eski hâline dönemezsin.",
                type: "danger",
                okText: "Tamam"
            });
            return;
        }
        // Diğer hatalar için orijinal toast'a bırak (app.js'deki genel error handler)
    }

    // ✨ Zaman Durdur tetiklendi (rakip hamlesi iptal)
    if (msg.type === "satranc_zaman_durdur_triggered") {
        showToast("🛑 Zaman Durduruldu!", msg.message, null, "warning");
        return;
    }

    // ✨ Yeni joker kazandın (Karşılıklı Ekstra Joker / Joker Hırsızlığı)
    if (msg.type === "satranc_new_joker_gained") {
        if (msg.new_joker) {
            if (!satrancData.myJokers) satrancData.myJokers = [];
            satrancData.myJokers.push(msg.new_joker);
            renderMyJokers();
        }
        showToast("🎁 Yeni Joker!", msg.message, null, "success");
        return;
    }

    // ✨ Joker çalındı (Joker Hırsızlığı - kurban tarafı)
    if (msg.type === "satranc_joker_stolen") {
        // Kendi joker listemden çalınan jokeri kaldır
        if (msg.stolen_joker && satrancData.myJokers) {
            const idx = satrancData.myJokers.findIndex(j => j.id === msg.stolen_joker.id);
            if (idx >= 0) satrancData.myJokers.splice(idx, 1);
            renderMyJokers();
        }
        showToast("💀 Joker Çalındı!", msg.message, null, "warning");
        return;
    }

    // ✨ Joker Gör → sağ panelde kalıcı açık göster
    if (msg.type === "satranc_reveal_opp_jokers_panel") {
        window._satrancRevealedOppJokers = (msg.jokers || []).map(j => ({
            ...j,
            _revealed: true
        }));
        satrancData.oppJokerCount = (msg.jokers || []).length;
        satrancData.oppUsedJokers = (msg.jokers || []).filter(j => j.used).map(j => j.id);
        renderOppJokers();
        showToast("👁️ Joker Gör", `${msg.opponent_name}'in tüm jokerleri artık görünür!`, null, "success");
        return;
    }

    // ✨ Sessiz joker kullanımı (sadece sayaç güncelle)
    if (msg.type === "satranc_joker_used_silent") {
        if (msg.user_id === satrancData.playerId) {
            if (!satrancData.usedJokers) satrancData.usedJokers = [];
            if (!satrancData.usedJokers.includes(msg.joker_id)) {
                satrancData.usedJokers.push(msg.joker_id);
            }
            renderMyJokers();
        }
        return;
    }

    // ✨ Sadece toast göster (Joker Gör hedefi için)
    if (msg.type === "satranc_toast_only") {
        showToast(msg.title || "Bildirim", msg.message || "", null, msg.toast_type || "info");
        return;
    }

    // ✨ Rulet sonucu (özel animasyonlu popup)
    if (msg.type === "satranc_joker_used" && msg.joker_id === "rulet") {
        // Rulet animasyonu göster
        showRuletAnimation(msg);
        // Diğer joker_used mantığı devam etsin ↓
    }

    // ✨ Joker kullanıldı bildirimi
    if (msg.type === "satranc_joker_used") {
        // Kendi kullandıysam kullanılan listesine ekle
        if (msg.user_id === satrancData.playerId) {
            if (!satrancData.usedJokers) satrancData.usedJokers = [];
            if (!satrancData.usedJokers.includes(msg.joker_id)) {
                satrancData.usedJokers.push(msg.joker_id);
            }
            renderMyJokers();
        } else {
            // ✨ Rakip kullandı - kullanılan joker id'sini kaydet + rakibin jokerini aç
            if (!satrancData.oppUsedJokers) satrancData.oppUsedJokers = [];
            if (msg.joker_id && !satrancData.oppUsedJokers.includes(msg.joker_id)) {
                satrancData.oppUsedJokers.push(msg.joker_id);
            }
            // Rakibin jokerlerini görüyor muyuz? Görünen listeye ekleyelim (üstü çizik)
            if (msg.joker_id) {
                revealOppJokerAsUsed(msg.joker_id, msg.joker_name, msg.joker_icon);
            }
            renderOppJokers();
        }

        // Rakip joker sayısı güncelle
        if (msg.opp_joker_counts) {
            // Karşılıklı Ekstra Joker gibi durumlar
            const myId = satrancData.playerId;
            Object.keys(msg.opp_joker_counts).forEach(pid => {
                if (parseInt(pid) !== myId) {
                    satrancData.oppJokerCount = msg.opp_joker_counts[pid];
                }
            });
            renderOppJokers();
        }
        // ✨ Joker kullanınca artık sayacı azaltmıyoruz (üstü çizik gösterilecek)

        // Saat güncelle (Zaman Çal için)
        if (msg.clocks) {
            renderClocks(msg.clocks);
        }

        // ✨ Bomba animasyonu (board güncellemesinden ÖNCE)
        if (msg.joker_id === "bomba" && msg.explosion_square) {
            playExplosionAnimation(msg.explosion_square);
        }

        // ✨ Görünmez animasyonu + anında effect class'ı ekle
        if (msg.joker_id === "gorunmez") {
            if (msg.invisible_hidden_from_you) {
                // Rakibin görünmez jokeri - taş rakip için silinmiş, animasyon yok
            } else if (msg.target) {
                // Kendi görünmez taşımız - fade animasyonu + hemen soluk yap
                playInvisibleFadeAnimation(msg.target);
                // ✨ Class ve opacity'yi HEMEN uygula (board update beklemeden)
                const $sq = $(`#satrancBoard .square-${msg.target}`);
                $sq.addClass("effect-invisible");
                $sq.find("img").css("opacity", "0.3");
                $sq.removeClass("highlight-from highlight-to");

                // Detayları da güncelle
                if (msg.effects && msg.effects.invisible_details) {
                    satrancData.invisibleDetails = msg.effects.invisible_details;
                }
                satrancData.lastInvisibleSquares = [msg.target];

                // ✨ Sağ üste şarj çubukları HEMEN göster
                const turnsLeft = (msg.effects && msg.effects.invisible_details) ? (msg.effects.invisible_details[msg.target] || 5) : 5;
                const maxTurns = 5;
                const colorClass = `charge-${turnsLeft}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareInvisibleCharge").remove();
                $sq.append(`<div class="squareInvisibleCharge ${colorClass}" title="Kalan tur: ${turnsLeft}">${bars}</div>`);

                // Kart üzerindeki badge'i de yenile
                renderMyJokers();
            }
        }

        // ✨ Ajan uygulandı - animasyonlu renk değişimi (SADECE sahibi görür)
        if (msg.joker_id === "ajan" && msg.target && msg.ajan_fake_color) {
            const fakeColor = msg.ajan_fake_color;
            const turnsLeft = msg.ajan_turns || 6;
            const square = msg.target;
            const piece = satrancData.game ? satrancData.game.get(square) : null;

            if (!satrancData.ajanDisguised) satrancData.ajanDisguised = {};
            satrancData.ajanDisguised[square] = {color: fakeColor, turns: turnsLeft};

            if (piece) {
                const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
                const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
                const $sq = $(`#satrancBoard .square-${square}`);
                const $img = $sq.find("img");

                // Animasyon: taş büyüsün + parla + renk değişsin
                if ($img.length) {
                    $img.css({
                        "transition": "transform 0.5s ease, filter 0.5s ease",
                        "transform": "scale(1.3)",
                        "filter": "drop-shadow(0 0 12px rgba(192,132,252,0.95))"
                    });
                    setTimeout(() => {
                        $img.attr("src", `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`);
                        $img.css({"transform": "scale(1)", "filter": ""});
                    }, 500);
                }

                // Puf emoji
                const rect = $sq[0].getBoundingClientRect();
                const puf = document.createElement("div");
                puf.className = "satrancInvisiblePuf";
                puf.textContent = "🕵️";
                puf.style.left = (rect.left + rect.width / 2) + "px";
                puf.style.top = (rect.top + rect.height / 2) + "px";
                document.body.appendChild(puf);
                setTimeout(() => puf.remove(), 1000);

                // Sağ üst şarj + sol üst emoji HEMEN göster
                setTimeout(() => {
                    $sq.find(".squareAjanCharge").remove();
                    $sq.find(".ajanSquareEmoji").remove();

                    $sq.append(`<div class="ajanSquareEmoji" title="Ajan taş">🕵️</div>`);

                    const maxTurns = 6;
                    const colorClass = `ajanCharge-${Math.min(turnsLeft, 6)}`;
                    let bars = "";
                    for (let i = 0; i < maxTurns; i++) {
                        const filled = i < turnsLeft ? "filled" : "empty";
                        bars += `<div class="squareChargeBar ${filled}"></div>`;
                    }
                    $sq.append(`<div class="squareAjanCharge ${colorClass}" title="Ajan kalan: ${turnsLeft}">${bars}</div>`);
                }, 600);
            }
            renderMyJokers();
        }

        // ✨ Dondur uygulandı - anında görsel (herkes için)
        if (msg.joker_id === "dondur" && msg.target) {
            const $sq = $(`#satrancBoard .square-${msg.target}`);
            $sq.addClass("effect-frozen");

            if (msg.effects && msg.effects.frozen_details) {
                satrancData.frozenDetails = msg.effects.frozen_details;
            }

            const turnsLeft = (msg.effects && msg.effects.frozen_details) ? (msg.effects.frozen_details[msg.target] || 2) : 2;
            const maxTurns = 2;
            const colorClass = `frozenCharge-${turnsLeft}`;
            let bars = "";
            for (let i = 0; i < maxTurns; i++) {
                const filled = i < turnsLeft ? "filled" : "empty";
                bars += `<div class="squareChargeBar ${filled}"></div>`;
            }
            $sq.find(".squareFrozenCharge").remove();
            $sq.append(`<div class="squareFrozenCharge ${colorClass}" title="Donmuş: ${turnsLeft} tur">${bars}</div>`);

            renderMyJokers();
        }
   

        // ✨ Kalkan uygulandı - anında görsel (herkes için)
        if (msg.joker_id === "kalkan" && msg.target) {
            const $sq = $(`#satrancBoard .square-${msg.target}`);
            $sq.addClass("effect-shielded");

            // Detayları güncelle
            if (msg.effects && msg.effects.shielded_details) {
                satrancData.shieldedDetails = msg.effects.shielded_details;
            }

            // Sağ üste şarj çubukları HEMEN göster
            const turnsLeft = (msg.effects && msg.effects.shielded_details) ? (msg.effects.shielded_details[msg.target] || 4) : 4;
            const maxTurns = 4;
            const colorClass = `shieldCharge-${Math.min(turnsLeft, 4)}`;
            let bars = "";
            for (let i = 0; i < maxTurns; i++) {
                const filled = i < turnsLeft ? "filled" : "empty";
                bars += `<div class="squareChargeBar ${filled}"></div>`;
            }
            $sq.find(".squareShieldCharge").remove();
            $sq.append(`<div class="squareShieldCharge ${colorClass}" title="Kalkan kalan: ${turnsLeft}">${bars}</div>`);

            // Kart badge'ini yenile
            renderMyJokers();
        }

        const applyJokerBoardUpdate = () => {
            if (!msg.board) return;

            updateSatrancBoard(msg.board, null, msg.effects);
            updateTurnInfo(msg.board);
            renderMyJokers();

            if (msg.captured_pieces) {
                const myPidStr = String(satrancData.playerId);
                const oppPidStr = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                renderCapturedPieces(
                    msg.captured_pieces[myPidStr] || [],
                    msg.captured_pieces[oppPidStr] || []
                );
            }
            if (msg.captured_pieces) {
                const myPid = String(satrancData.playerId);
                const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
            }

            const undoCount = msg.undo_count || (msg.undo_moves ? msg.undo_moves.length : 0);
            if (undoCount > 0 && satrancData.moveHistory.length > 0) {
                for (let i = 0; i < undoCount; i++) {
                    if (satrancData.moveHistory.length > 0) {
                        satrancData.moveHistory.pop();
                    }
                }
                const histEl = document.getElementById("satrancMoveHistory");
                if (histEl) {
                    histEl.innerHTML = "";
                    satrancData.moveHistory.forEach((m, i) => {
                        if (i % 2 === 0) {
                            const num = document.createElement("span");
                            num.className = "satrancMoveNum";
                            num.textContent = `${Math.floor(i / 2) + 1}.`;
                            histEl.appendChild(num);
                        }
                        const span = document.createElement("span");
                        span.className = "satrancMoveChip";
                        span.textContent = m;
                        histEl.appendChild(span);
                    });
                }
            }
        };

        if (msg.board && (msg.joker_id === "vezire_yukselt" || msg.joker_id === "tas_donustur") && msg.target) {
            satrancData.legalMoves = [];
            playPieceTransformAnimation(msg.target, msg.transform_label, msg.transform_icon);

            setTimeout(() => {
                applyJokerBoardUpdate();
                showToast(
                    `${msg.joker_icon} ${msg.joker_name}`,
                    msg.message,
                    null,
                    msg.user_id === satrancData.playerId ? "success" : "warning"
                );
            }, 520);
            return;
        }

        applyJokerBoardUpdate();

        showToast(
            `${msg.joker_icon} ${msg.joker_name}`,
            msg.message,
            null,
            msg.user_id === satrancData.playerId ? "success" : "warning"
        );
        return;
    }

    if (msg.type === "satranc_your_turn") {
        satrancData.legalMoves = msg.legal_moves || [];
        satrancData.invisibleCaptureSquares = msg.invisible_capture_squares || [];
        renderMyJokers();  // ✨ Sıra bende, jokerleri güncelle
        if (msg.is_check) {
            showToast("⚠️ ŞAH!", "Şahtan çıkman lazım!", null, "warning");
        }
        return;
    }

    // ✨ Promosyon gerekli - yenilen taşlardan seç
    if (msg.type === "satranc_promotion_needed") {
        showCapturedPromotionPopup(msg.from, msg.to, msg.captured_pieces || []);
        return;
    }

    if (msg.type === "satranc_clock_update") {
        renderClocks(msg.clocks || {});
        return;
    }

    if (msg.type === "satranc_game_over") {
        showSatrancGameOver(msg);
        return;
    }

    _prevHandleSatranc(msg);
};

// ==========================================
// BUTON EVENT'LERİ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // ✨ Pick mode'a göre süre alanını gizle/göster
    function _updateSatrancPickSecondsVisibility() {
        const pmSel = document.getElementById("satrancPickModeSelect");
        const psBox = document.getElementById("satrancPickSecondsBox");
        if (!pmSel || !psBox) return;
        if (pmSel.value === "karisik") {
            psBox.style.display = "none";
        } else {
            psBox.style.display = "";
        }
    }

    // Dropdown değişince göster/gizle
    const pmSelListener = document.getElementById("satrancPickModeSelect");
    if (pmSelListener) {
        pmSelListener.addEventListener("change", _updateSatrancPickSecondsVisibility);
    }

    // Mod kartı
    const modCard = document.querySelector('.mod-card[data-mod="jokerli_satranc"]');
    if (modCard) {
        modCard.addEventListener("click", () => {
            showScreen("createSatranc");
            const nameInput = document.getElementById("createSatrancNameInput");
            if (nameInput) {
                const saved = localStorage.getItem("playerName");
                if (saved) nameInput.value = saved;
                nameInput.focus();
            }

            // ✨ Eski ayarları yükle
            const savedTimeMode = localStorage.getItem("satrancTimeMode");
            const savedJokerCount = localStorage.getItem("satrancJokerCount");
            const savedPickMode = localStorage.getItem("satrancPickMode");
            const savedPickSeconds = localStorage.getItem("satrancPickSeconds");

            const tmSel = document.getElementById("satrancTimeModeSelect");
            const jcSel = document.getElementById("satrancJokerCountSelect");
            const pmSel = document.getElementById("satrancPickModeSelect");
            const psSel = document.getElementById("satrancPickSecondsSelect");

            if (tmSel && savedTimeMode) tmSel.value = savedTimeMode;
            if (jcSel && savedJokerCount) jcSel.value = savedJokerCount;
            if (pmSel && savedPickMode) pmSel.value = savedPickMode;
            if (psSel && savedPickSeconds) psSel.value = savedPickSeconds;

            // ✨ Sayfa açılışında da göster/gizle uygula
            _updateSatrancPickSecondsVisibility();
        });
    }

    // Oda oluştur
    const createBtn = document.getElementById("createSatrancBtn");
    if (createBtn) {
        createBtn.onclick = () => {
            const nameInput = document.getElementById("createSatrancNameInput");
            const name = nameInput ? nameInput.value.trim() : "";
            if (!name) {
                const msgEl = document.getElementById("createSatrancMsg");
                if (msgEl) { msgEl.textContent = "İsim gir."; msgEl.style.color = "#ff6b6b"; }
                return;
            }
            localStorage.setItem("playerName", name);

            const timeMode = document.getElementById("satrancTimeModeSelect").value;
            const jokerCount = parseInt(document.getElementById("satrancJokerCountSelect").value);
            const pickMode = document.getElementById("satrancPickModeSelect").value;
            const pickSeconds = parseInt(document.getElementById("satrancPickSecondsSelect").value);

            // ✨ Ayarları kaydet (sonraki oda kurulumunda hatırla)
            localStorage.setItem("satrancTimeMode", timeMode);
            localStorage.setItem("satrancJokerCount", String(jokerCount));
            localStorage.setItem("satrancPickMode", pickMode);
            localStorage.setItem("satrancPickSeconds", String(pickSeconds));

            send({
                type: "satranc_create_room",
                name: name,
                time_mode: timeMode,
                joker_count: jokerCount,
                pick_mode: pickMode,
                pick_seconds: pickSeconds
            });
        };
    }

    // Geri
    const backBtn = document.getElementById("createSatrancBackBtn");
    if (backBtn) backBtn.onclick = () => showScreen("modselect");

    // Başlat
    const startBtn = document.getElementById("satrancStartBtn");
    if (startBtn) startBtn.onclick = () => send({ type: "satranc_start_game" });

    // Ayrıl
    const leaveBtn = document.getElementById("satrancLobbyLeaveBtn");
    if (leaveBtn) leaveBtn.onclick = () => {
        if (typeof window._showLeaveConfirmPopup === "function") window._showLeaveConfirmPopup();
    };

    // Oda ayarları
    const settingsBtn = document.getElementById("satrancRoomSettingsBtn");
    if (settingsBtn) settingsBtn.onclick = () => openSatrancRoomSettings();

    // İstifa
    const resignBtn = document.getElementById("satrancResignBtn");
    if (resignBtn) {
        resignBtn.onclick = () => {
            satrancConfirm({
                icon: "🏳️",
                title: "Terk Et",
                message: "Oyundan çekilmek istediğine emin misin?",
                detail: "Oyunu Terk Edersen Rakinin Kazanacak.",
                type: "danger",
                yesText: "Evet, Terk Et",
                noText: "❌ Vazgeç"
            }).then(ok => {	
                if (ok) send({ type: "satranc_resign" });
            });
        };
    }

    // Oyun sonu - Tekrar Oyna
    const rematchBtn = document.getElementById("satrancRematchBtn");
    if (rematchBtn) rematchBtn.onclick = () => send({ type: "satranc_rematch" });

    // Oyun sonu - Lobiye Dön
    const lobbyBtn = document.getElementById("satrancBackToLobbyBtn");
    if (lobbyBtn) {
        lobbyBtn.onclick = () => {
            document.getElementById("satrancGameOverBox").classList.add("hidden");
            stopSatrancClock();
            if (satrancData.playerId === 1) {
                send({ type: "satranc_rematch" });
            } else {
                showScreen("satrancLobby");
                updateSatrancLobby();
            }
        };
    }

    // Oyun sonu - Ana Menü
    const menuBtn = document.getElementById("satrancBackToMenuBtn");
    if (menuBtn) {
        menuBtn.onclick = () => {
            document.getElementById("satrancGameOverBox").classList.add("hidden");
            stopSatrancClock();
            inRoom = false;
            satrancData.inGame = false;
            if (ws) { try { ws.close(); } catch(e) {} }
            connectWS();
            showScreen("home");
        };
    }

    // Oyun içi geri
    const gameBackBtn = document.getElementById("satrancBackBtn");
    if (gameBackBtn) {
        gameBackBtn.onclick = () => {
            if (typeof window._showLeaveConfirmPopup === "function") {
                window._showLeaveConfirmPopup();
            }
        };
    }

    // ✨ Joker seçim confirm butonu
    const confirmBtn = document.getElementById("satrancJsConfirmBtn");
    if (confirmBtn) {
        confirmBtn.onclick = () => send({ type: "satranc_confirm_jokers" });
    }
});

// Pencere yeniden boyutlanınca tahtayı fit et
window.addEventListener("resize", () => {
    if (satrancData.board) {
        try { satrancData.board.resize(); } catch(e) {}
    }
});

console.log("♟️ Jokerli Satranç JS yüklendi ✓");