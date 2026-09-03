// ==========================================================================
// 📱 MOBİL, KLAVYE VE GAMEPAD INPUT YÖNETİCİSİ
// ==========================================================================

const MiniMobileInput = {
    joystickActive: false,
    joystickTouchId: null,
    joystickStart: { x: 0, y: 0 },
    JOYSTICK_MAX_DIST: 45, // sanal topun ne kadar sürüklenebileceği (px)
    
    init() {
        this.destroy(); // Eski kalıntı varsa sil
        
        // 1. Ekran Yan Çevirme Uyarısı Ekle
        const warning = document.createElement("div");
        warning.id = "miniOrientationWarning";
        warning.innerHTML = `
            <div class="warning-content">
                <span class="warning-icon">🔄</span>
                <h3 style="color:#ffd43b; margin:10px 0;">Cihazı Yan Döndürün</h3>
                <p style="font-size:14px; color:#adb5bd; line-height:1.5;">
                    Mini Futbol oynamak için cihazınızı yan döndürün (Landscape) ve otomatik döndürmeyi açın.
                </p>
            </div>
        `;
        document.body.appendChild(warning);
        
        // 2. Joystick ve Butonları Ekle
        const controls = document.createElement("div");
        controls.id = "miniMobileControls";
        controls.innerHTML = `
            <div id="miniJoystickContainer">
                <div id="miniJoystickKnob"></div>
            </div>
            <div id="miniMobileButtons">
                <div id="miniBtnSprint" class="mobileBtn">🏃</div>
                <div id="miniBtnKick" class="mobileBtn">⚽</div>
            </div>
        `;
        document.body.appendChild(controls);
        
        this.setupListeners();
    },
    
    setupListeners() {
        const container = document.getElementById("miniJoystickContainer");
        const knob = document.getElementById("miniJoystickKnob");
        const btnSprint = document.getElementById("miniBtnSprint");
        const btnKick = document.getElementById("miniBtnKick");
        
        if (!container || !knob) return;
        
        // === 🕹️ JOYSTICK HAREKETLERİ ===
        container.addEventListener("touchstart", (e) => {
            e.preventDefault();
            if (this.joystickTouchId !== null) return;
            
            const touch = e.changedTouches[0];
            this.joystickTouchId = touch.identifier;
            this.joystickActive = true;
            
            const rect = container.getBoundingClientRect();
            this.joystickStart = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }, { passive: false });
        
        window.addEventListener("touchmove", (e) => {
            if (!this.joystickActive || this.joystickTouchId === null) return;
            
            let touch = null;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === this.joystickTouchId) {
                    touch = e.touches[i];
                    break;
                }
            }
            if (!touch) return;
            
            const dx = touch.clientX - this.joystickStart.x;
            const dy = touch.clientY - this.joystickStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            let knobX = dx;
            let knobY = dy;
            
            if (dist > this.JOYSTICK_MAX_DIST) {
                knobX = (dx / dist) * this.JOYSTICK_MAX_DIST;
                knobY = (dy / dist) * this.JOYSTICK_MAX_DIST;
            }
            
            knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
            
            const threshold = 0.35;
            const moveRight = dx > this.JOYSTICK_MAX_DIST * threshold;
            const moveLeft  = dx < -this.JOYSTICK_MAX_DIST * threshold;
            const moveDown  = dy > this.JOYSTICK_MAX_DIST * threshold;
            const moveUp    = dy < -this.JOYSTICK_MAX_DIST * threshold;
            
            this.sendMobileKey("left", moveLeft);
            this.sendMobileKey("right", moveRight);
            this.sendMobileKey("up", moveUp);
            this.sendMobileKey("down", moveDown);
        }, { passive: false });
        
        const resetJoystick = (e) => {
            if (this.joystickTouchId === null) return;
            
            let touchFinished = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.joystickTouchId) {
                    touchFinished = true;
                    break;
                }
            }
            
            if (touchFinished) {
                this.joystickTouchId = null;
                this.joystickActive = false;
                knob.style.transform = `translate(0px, 0px)`;
                
                this.sendMobileKey("left", false);
                this.sendMobileKey("right", false);
                this.sendMobileKey("up", false);
                this.sendMobileKey("down", false);
            }
        };
        
        container.addEventListener("touchend", resetJoystick, { passive: false });
        container.addEventListener("touchcancel", resetJoystick, { passive: false });
        
        // === 🏃 DEPAR BUTONU ===
        if (btnSprint) {
            btnSprint.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.sendMobileKey("sprint", true);
            }, { passive: false });
            
            const releaseSprint = (e) => {
                e.preventDefault();
                this.sendMobileKey("sprint", false);
            };
            btnSprint.addEventListener("touchend", releaseSprint, { passive: false });
            btnSprint.addEventListener("touchcancel", releaseSprint, { passive: false });
        }
        
        // === ⚽ ŞUT BUTONU ===
        if (btnKick) {
            btnKick.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.sendMobileKey("kick", true);
            }, { passive: false });
            
            const releaseKick = (e) => {
                e.preventDefault();
                this.sendMobileKey("kick", false);
            };
            btnKick.addEventListener("touchend", releaseKick, { passive: false });
            btnKick.addEventListener("touchcancel", releaseKick, { passive: false });
        }
    },
    
    sendMobileKey(key, pressed) {
        if (pressed) {
            const gcMob = miniData.gameState && miniData.gameState.goal_celebration;
            const rDurationMob = (gcMob && gcMob.replay_duration) || 10.0;
            const isReplayMob = miniData.gameState &&
                miniData.gameState.game_state === "goal_wait" &&
                gcMob &&
                typeof gcMob.wait_remaining === "number" &&
                gcMob.wait_remaining <= rDurationMob;

            if (isReplayMob) {
                return;
            }
        }

        const keyList = miniData.keysPressed;
        if (keyList[key] === pressed) return;
        
        keyList[key] = pressed;
        
        if (typeof HP !== 'undefined' && HP.running) {
            HP.setKey(miniData.playerId, key, pressed);
        }
        
        if (key === "kick" && pressed && miniData.playerId !== 1) {
            miniData._recentKickTime = performance.now();
            miniData._shotPredictionUntil = performance.now() + 200;
            miniData._wasNearBall = true;
        }
        
        const msg = { type: "mini_key", key: key, pressed: pressed };
        if (MiniRTC.connected && miniData.playerId !== 1) {
            msg.from_player_id = miniData.playerId;
            msg.target_pid = miniData.playerId;
            MiniRTC.sendMessage(msg);
        } else {
            send(msg);
        }
    },
    
    destroy() {
        this.joystickTouchId = null;
        this.joystickActive = false;
        
        const warning = document.getElementById("miniOrientationWarning");
        if (warning) warning.remove();
        
        const controls = document.getElementById("miniMobileControls");
        if (controls) controls.remove();
    }
};

// ========================================
// ⌨️ KLAVYE VE TUŞ ATAMALARI
// ========================================

function miniKeyDown(e) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
    }
    
    const openPopups = [
        "miniNameEditor", "miniTeamNameEditor", "miniResetNamesConfirm",
        "miniRestartConfirm", "miniLobbyReturnConfirm", "miniGuestLobbyConfirm",
        "miniKickConfirm", "miniControlSettings", "roomSettingsBox"
    ];
    for (const id of openPopups) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden")) {
            return;
        }
    }
    
    const gc = miniData.gameState && miniData.gameState.goal_celebration;
    const rDurationK = (gc && gc.replay_duration) || 10.0;
    const isReplayMode = miniData.gameState &&
        miniData.gameState.game_state === "goal_wait" &&
        gc &&
        typeof gc.wait_remaining === "number" &&
        gc.wait_remaining <= rDurationK;

    if (miniData.gameState &&
        miniData.gameState.game_state === "goal_wait" &&
        gc &&
        typeof gc.wait_remaining === "number" &&
        gc.wait_remaining > rDurationK) {
        miniData._hasSkippedReplay = false;
    }

    if (isReplayMode) {
        if (e.key === "Tab") return;

        if (!e.repeat && (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1" ||
                          e.key === "2" || e.code === "Digit2" || e.code === "Numpad2")) {
            e.preventDefault();
            e.stopPropagation();
            const dir = (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1") ? -1 : 1;
            if (typeof handleCelebPickerKey === "function") handleCelebPickerKey(dir);
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        
        const isEnterKey = (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter");
        
        if (isEnterKey && !miniData._hasSkippedReplay) {
            miniData._hasSkippedReplay = true;
            const myPid = parseInt(miniData.playerId, 10);
            
            if (myPid === 1 && typeof HP !== 'undefined' && HP.running) {
                HP.registerSkip(1);
            } else {
                const skipMsg = { type: "mini_skip_replay", from_pid: myPid };
                if (typeof MiniRTC !== "undefined" && MiniRTC.connected) {
                    MiniRTC.sendMessage(skipMsg);
                }
                send(skipMsg);
            }
        }
        return;
    }

    if (!e.repeat && (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1" ||
                      e.key === "2" || e.code === "Digit2" || e.code === "Numpad2")) {
        e.preventDefault();
        e.stopPropagation();
        const dir = (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1") ? -1 : 1;
        if (typeof handleCelebPickerKey === "function") handleCelebPickerKey(dir);
        return;
    }

    const result = getMiniKey(e);
    if (!result) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const { key, forPlayer } = result;
    const keyList = (forPlayer === 2) ? miniData.keysPressed2 : miniData.keysPressed;
    
    if (keyList[key]) return;
    
    keyList[key] = true;
    
    if (typeof HP !== 'undefined' && HP.running) {
        const targetPid = (forPlayer === 2 && miniData.splitSlaveId) ? miniData.splitSlaveId : miniData.playerId;
        HP.setKey(targetPid, key, true);
    }
    
    if (key === "kick" && miniData.playerId !== 1) {
        miniData._recentKickTime = performance.now();
        miniData._shotPredictionUntil = performance.now() + 200;
        miniData._wasNearBall = true;
    }
    
    const msg = { type: "mini_key", key: key, pressed: true };
    if (forPlayer === 2 && miniData.splitSlaveId) {
        msg.for_player_id = miniData.splitSlaveId;
    }
    if (MiniRTC.connected && miniData.playerId !== 1) {
        msg.from_player_id = miniData.playerId;
        msg.target_pid = miniData.playerId;
        MiniRTC.sendMessage(msg);
    } else {
        send(msg);
    }
}

function miniKeyUp(e) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
    }
    
    const result = getMiniKey(e);
    if (!result) return;
    
    e.preventDefault();
    
    const { key, forPlayer } = result;
    const keyList = (forPlayer === 2) ? miniData.keysPressed2 : miniData.keysPressed;
    
    if (!keyList[key]) return;
    
    keyList[key] = false;
    
    if (typeof HP !== 'undefined' && HP.running) {
        const targetPid = (forPlayer === 2 && miniData.splitSlaveId) ? miniData.splitSlaveId : miniData.playerId;
        HP.setKey(targetPid, key, false);
    }
    
    const msg = { type: "mini_key", key: key, pressed: false };
    if (forPlayer === 2 && miniData.splitSlaveId) {
        msg.for_player_id = miniData.splitSlaveId;
    }
    if (MiniRTC.connected && miniData.playerId !== 1) {
        msg.from_player_id = miniData.playerId;
        msg.target_pid = miniData.playerId;
        MiniRTC.sendMessage(msg);
    } else {
        send(msg);
    }
}

function getMiniKey(e) {
    const k = e.key.toLowerCase();
    const code = e.code;
    const isSplit = miniData.splitScreen && miniData.splitOwner === miniData.playerId;
    
    const p1Keys = getSavedKeys("p1");
    
    if (code === p1Keys.up || (p1Keys.up === "w" && k === "w")) return { key: "up", forPlayer: 1 };
    if (code === p1Keys.down || (p1Keys.down === "s" && k === "s")) return { key: "down", forPlayer: 1 };
    if (code === p1Keys.left || (p1Keys.left === "a" && k === "a")) return { key: "left", forPlayer: 1 };
    if (code === p1Keys.right || (p1Keys.right === "d" && k === "d")) return { key: "right", forPlayer: 1 };
    if (code === p1Keys.kick || (p1Keys.kick === "Space" && (k === " " || code === "Space"))) return { key: "kick", forPlayer: 1 };
    if (code === p1Keys.sprint) return { key: "sprint", forPlayer: 1 };
    
    if (isSplit) {
        if (k === "arrowup") return { key: "up", forPlayer: 2 };
        if (k === "arrowdown") return { key: "down", forPlayer: 2 };
        if (k === "arrowleft") return { key: "left", forPlayer: 2 };
        if (k === "arrowright") return { key: "right", forPlayer: 2 };
        if (code === "Numpad0" || code === "ControlRight") return { key: "kick", forPlayer: 2 };
        if (code === "ShiftRight" || code === "Numpad1") return { key: "sprint", forPlayer: 2 };
    } else {
        if (k === "arrowup") return { key: "up", forPlayer: 1 };
        if (k === "arrowdown") return { key: "down", forPlayer: 1 };
        if (k === "arrowleft") return { key: "left", forPlayer: 1 };
        if (k === "arrowright") return { key: "right", forPlayer: 1 };
        if (code === "Numpad0") return { key: "kick", forPlayer: 1 };
        if (code === "ShiftRight" || code === "Numpad1") return { key: "sprint", forPlayer: 1 };
    }
    
    return null;
}

function miniReleaseAllKeys() {
    for (const key in miniData.keysPressed) {
        if (miniData.keysPressed[key]) {
            miniData.keysPressed[key] = false;
            send({ type: "mini_key", key: key, pressed: false });
            if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
                HP.setKey(miniData.playerId, key, false);
            }
        }
    }
    for (const key in miniData.keysPressed2) {
        if (miniData.keysPressed2[key]) {
            miniData.keysPressed2[key] = false;
            const msg = { type: "mini_key", key: key, pressed: false };
            if (miniData.splitSlaveId) msg.for_player_id = miniData.splitSlaveId;
            send(msg);
            if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && miniData.splitSlaveId) {
                HP.setKey(miniData.splitSlaveId, key, false);
            }
        }
    }
    if (typeof gpPrevState !== "undefined") {
        for (const key in gpPrevState) {
            if (gpPrevState[key]) {
                gpPrevState[key] = false;
                sendGamepadKey(key, false);
            }
        }
    }
}

function miniPreventContextMenu(e) {
    const gameScreen = document.getElementById("miniGameScreen");
    if (gameScreen && !gameScreen.classList.contains("hidden")) {
        if (e.target && (e.target.closest(".miniPlayerRow") || e.target.closest("#miniJerseyEditor"))) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

// ========================================
// 🎮 GAMEPAD POLLING VE TEST DÖNGÜSÜ
// ========================================

function initGamepadListeners() {
    window.addEventListener("gamepadconnected", (e) => {
        console.log(`[GAMEPAD] Bağlandı: ${e.gamepad.id} (index: ${e.gamepad.index})`);
        miniGamepad.connected = true;
        miniGamepad.index = e.gamepad.index;
        miniGamepad.name = e.gamepad.id;
        miniGamepad.slot = "p1";
        if (typeof updateGamepadUI === "function") updateGamepadUI();
        
        if (miniGamepad.enabled) {
            const gameScreen = document.getElementById("miniGameScreen");
            if (gameScreen && !gameScreen.classList.contains("hidden")) {
                startGamepadPolling();
            }
        }
    });
    
    window.addEventListener("gamepaddisconnected", (e) => {
        console.log(`[GAMEPAD] Ayrıldı: ${e.gamepad.id}`);
        if (e.gamepad.index === miniGamepad.index) {
            miniGamepad.connected = false;
            miniGamepad.index = -1;
            miniGamepad.name = "";
            miniGamepad.slot = "off";
            stopGamepadPolling();
            if (typeof updateGamepadUI === "function") updateGamepadUI();
        }
    });
    
    checkExistingGamepads();
}

function checkExistingGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let found = false;
    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
            miniGamepad.connected = true;
            miniGamepad.index = pads[i].index;
            miniGamepad.name = pads[i].id;
            miniGamepad.slot = "p1";
            console.log(`[GAMEPAD] Kontrolcü hazır: ${pads[i].id} (P1)`);
            found = true;
            break;
        }
    }
    
    if (!found && miniGamepad.connected) {
        miniGamepad.connected = false;
        miniGamepad.index = -1;
        miniGamepad.name = "";
        miniGamepad.slot = "off";
        stopGamepadPolling();
    }
    
    if (typeof updateGamepadUI === "function") updateGamepadUI();
}

function startGamepadPolling() {
    if (miniGamepad.pollInterval) return;
    miniGamepad.pollInterval = setInterval(pollGamepad, 30);
    console.log("[GAMEPAD] Polling başladı");
}

function stopGamepadPolling() {
    if (miniGamepad.pollInterval) {
        clearInterval(miniGamepad.pollInterval);
        miniGamepad.pollInterval = null;
        console.log("[GAMEPAD] Polling durdu");
        releaseAllGamepadKeys();
    }
}

function releaseAllGamepadKeys() {
    ["up", "down", "left", "right", "kick", "sprint"].forEach(key => {
        if (gpPrevState[key]) {
            sendGamepadKey(key, false);
            gpPrevState[key] = false;
        }
    });
    gpPrevState.start = false;
    gpPrevState.select = false;
}

function pollGamepad() {
    if (!miniGamepad.connected) return;
    if (!miniGamepad.enabled) return;
    
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[miniGamepad.index];
    if (!pad) return;
    
    const gc = miniData.gameState && miniData.gameState.goal_celebration;
    const rDurationK = (gc && gc.replay_duration) || 10.0;
    const isReplayMode = miniData.gameState &&
        miniData.gameState.game_state === "goal_wait" &&
        gc &&
        typeof gc.wait_remaining === "number" &&
        gc.wait_remaining <= rDurationK;

    const btnStart = pad.buttons[9] && pad.buttons[9].pressed;
    if (btnStart && !gpPrevState.start) {
        gpPrevState.start = true;
        if (isReplayMode) {
            const enterEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(enterEvent);
            console.log("[GAMEPAD] START → ENTER (Replay Atla)");
        } else {
            const escEvent = new KeyboardEvent("keydown", {
                key: "Escape",
                code: "Escape",
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(escEvent);
            console.log("[GAMEPAD] START → ESC");
        }
    } else if (!btnStart && gpPrevState.start) {
        gpPrevState.start = false;
    }
    
    const btnL1 = pad.buttons[4] && pad.buttons[4].pressed;
    const btnR1 = pad.buttons[5] && pad.buttons[5].pressed;
    
    if (btnL1 && !gpPrevState.l1) {
        gpPrevState.l1 = true;
        if (typeof handleCelebPickerKey === "function") handleCelebPickerKey(-1);
    } else if (!btnL1) {
        gpPrevState.l1 = false;
    }
    
    if (btnR1 && !gpPrevState.r1) {
        gpPrevState.r1 = true;
        if (typeof handleCelebPickerKey === "function") handleCelebPickerKey(1);
    } else if (!btnR1) {
        gpPrevState.r1 = false;
    }

    const btnSelect = pad.buttons[8] && pad.buttons[8].pressed;
    if (btnSelect && !gpPrevState.select) {
        gpPrevState.select = true;
        const tabEvent = new KeyboardEvent("keydown", {
            key: "Tab",
            code: "Tab",
            keyCode: 9,
            which: 9,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(tabEvent);
    } else if (!btnSelect && gpPrevState.select) {
        gpPrevState.select = false;
        const tabUpEvent = new KeyboardEvent("keyup", {
            key: "Tab",
            code: "Tab",
            keyCode: 9,
            which: 9,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(tabUpEvent);
    }
    
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    if (pauseBox && !pauseBox.classList.contains("hidden")) return;
    if (isReplayMode) return;
    
    let leftX = pad.axes[0] || 0;
    let leftY = pad.axes[1] || 0;
    
    const dpadUp    = pad.buttons[12] && pad.buttons[12].pressed;
    const dpadDown  = pad.buttons[13] && pad.buttons[13].pressed;
    const dpadLeft  = pad.buttons[14] && pad.buttons[14].pressed;
    const dpadRight = pad.buttons[15] && pad.buttons[15].pressed;
    
    if (dpadUp) leftY = -1;
    else if (dpadDown) leftY = 1;
    if (dpadLeft) leftX = -1;
    else if (dpadRight) leftX = 1;
    
    const up    = leftY < -GP_DEADZONE;
    const down  = leftY > GP_DEADZONE;
    const left  = leftX < -GP_DEADZONE;
    const right = leftX > GP_DEADZONE;
    
    const btnX      = pad.buttons[0] && pad.buttons[0].pressed;
    const btnSquare = pad.buttons[2] && pad.buttons[2].pressed;
    const kick = btnX || btnSquare;
    
    const btnR2 = pad.buttons[7] && pad.buttons[7].pressed;
    const btnL2 = pad.buttons[6] && pad.buttons[6].pressed;
    const sprint = btnR2 || btnL2;
    
    const newState = { up, down, left, right, kick, sprint };
    
    for (const key in newState) {
        if (newState[key] !== gpPrevState[key]) {
            sendGamepadKey(key, newState[key]);
            gpPrevState[key] = newState[key];
        }
    }
}

function sendGamepadKey(key, pressed) {
    const msg = { type: "mini_key", key: key, pressed: pressed };
    const targetPid = miniData.playerId;
    
    if (typeof HP !== 'undefined' && HP.running) {
        HP.setKey(targetPid, key, pressed);
    }
    
    send(msg);
}

setTimeout(() => {
    initGamepadListeners();
}, 200);