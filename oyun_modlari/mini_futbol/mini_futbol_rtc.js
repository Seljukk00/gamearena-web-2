// ==========================================
// 🌐 WEBRTC MANAGER (Çoklu Oyuncu P2P - Star Mesh)
// ==========================================

const MiniRTC = {
    peers: {},          // { targetPid: { pc, channel, connected } }
    connected: false,   // Genel P2P durumu
    isHost: false,
    
    config: {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    },

    // Host: Belirli bir misafir oyuncu için P2P tüneli aç
    async createPeerForGuest(targetPid) {
        if (miniData.playerId !== 1) return;
        if (this.peers[targetPid] && this.peers[targetPid].connected) return;

        console.log(`[WebRTC] Host: Oyuncu ${targetPid} için P2P bağlantısı başlatılıyor...`);
        this.isHost = true;

        if (this.peers[targetPid]) {
            this.closePeer(targetPid);
        }

        const pc = new RTCPeerConnection(this.config);
        const channel = pc.createDataChannel(`mini_${targetPid}`, {
            ordered: false,
            maxRetransmits: 0
        });

        const peerObj = { pc, channel, connected: false, pid: targetPid };
        this.peers[targetPid] = peerObj;

        this._setupChannel(channel, targetPid);

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                send({
                    type: "mini_webrtc_ice",
                    target_pid: targetPid,
                    candidate: e.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Oyuncu ${targetPid} durum:`, pc.connectionState);
            if (pc.connectionState === "connected") {
                peerObj.connected = true;
                this.updateOverallStatus();
                console.log(`[WebRTC] ✅ Oyuncu ${targetPid} ile P2P kuruldu!`);
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                peerObj.connected = false;
                this.updateOverallStatus();
                console.log(`[WebRTC] ❌ Oyuncu ${targetPid} P2P koptu.`);
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        send({
            type: "mini_webrtc_offer",
            target_pid: targetPid,
            offer: offer
        });
    },

    // Misafir: Host'tan gelen offer'ı al
    async handleOffer(fromPid, offer) {
        console.log(`[WebRTC] Misafir: Host'tan (${fromPid}) offer alındı...`);
        this.isHost = false;
        this.reset();

        const pc = new RTCPeerConnection(this.config);
        const peerObj = { pc, channel: null, connected: false, pid: fromPid };
        this.peers[fromPid] = peerObj;

        pc.ondatachannel = (e) => {
            console.log("[WebRTC] Host DataChannel yakalandı");
            peerObj.channel = e.channel;
            this._setupChannel(e.channel, fromPid);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                send({
                    type: "mini_webrtc_ice",
                    target_pid: fromPid,
                    candidate: e.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                peerObj.connected = true;
                this.updateOverallStatus();
                console.log("[WebRTC] ✅ Host ile P2P bağlantı kuruldu!");
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                peerObj.connected = false;
                this.updateOverallStatus();
            }
        };

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        send({
            type: "mini_webrtc_answer",
            target_pid: fromPid,
            answer: answer
        });
    },

    async handleAnswer(fromPid, answer) {
        if (this.peers[fromPid] && this.peers[fromPid].pc) {
            await this.peers[fromPid].pc.setRemoteDescription(answer);
        }
    },

    async handleIce(fromPid, candidate) {
        if (this.peers[fromPid] && this.peers[fromPid].pc && candidate) {
            try {
                await this.peers[fromPid].pc.addIceCandidate(candidate);
            } catch(e) {}
        }
    },

    _setupChannel(channel, peerPid) {
        channel.onopen = () => {
            console.log(`[WebRTC] Peer ${peerPid} DataChannel AÇIK!`);
            if (this.peers[peerPid]) this.peers[peerPid].connected = true;
            this.updateOverallStatus();
        };

        channel.onclose = () => {
            if (this.peers[peerPid]) this.peers[peerPid].connected = false;
            this.updateOverallStatus();
        };

        channel.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);

                if (msg.type === "mini_ping_p2p") {
                    this.sendMessageToPeer(peerPid, { type: "mini_pong_p2p", ts: msg.ts });
                    return;
                }

                if (msg.type === "mini_pong_p2p") {
                    const rtt = Date.now() - msg.ts;
                    if (!miniData.pings) miniData.pings = {};
                    miniData.pings[miniData.playerId] = rtt;
                    send({ type: "mini_ping_report", ping: rtt });
                    if (typeof updateMiniPingDisplay === "function") {
                        updateMiniPingDisplay();
                    }
                    return;
                }

                // HOST: Misafirden gelen tuş girdisini işle
                if (miniData.playerId === 1 && msg.type === "mini_key") {
                    const targetPid = msg.from_player_id || peerPid;
                    if (targetPid && typeof HP !== 'undefined' && HP.running) {
                        HP.setKey(targetPid, msg.key, msg.pressed);
                    }
                    return;
                }

                // ✨ HOST: Misafirden P2P üzerinden gelen "Skip" (Atla) komutunu işle
                if (miniData.playerId === 1 && msg.type === "mini_skip_replay") {
                    if (typeof HP !== 'undefined' && HP.running) {
                        HP.registerSkip(msg.from_pid || peerPid);
                    }
                    return;
                }

                if (miniData.playerId === 1 && msg.type === "mini_set_celebration") {
                    if (typeof HP !== 'undefined' && HP.running) {
                        HP.applyCelebrationChoice(msg.from_pid || peerPid, msg.celebration_type);
                    }
                    return;
                }

                // MİSAFİR: Host'tan gelen oyun durumunu işle
                if (miniData.playerId !== 1 && msg.type === "mini_state") {
                    if (typeof handleMiniMessage === "function") {
                        handleMiniMessage(msg);
                    }
                    return;
                }

                if (typeof handleMiniMessage === "function") {
                    handleMiniMessage(msg);
                }
            } catch(err) {}
        };
    },

    // Host tüm bağlı misafirlere durum (state) gönderir
    sendMessage(data) {
        let sentAny = false;
        const jsonStr = JSON.stringify(data);

        for (const pid in this.peers) {
            const p = this.peers[pid];
            if (p.connected && p.channel && p.channel.readyState === "open") {
                try {
                    p.channel.send(jsonStr);
                    sentAny = true;
                } catch(e) {}
            }
        }

        if (!sentAny && miniData.playerId !== 1) {
            send(data); // Fallback: WS
        }
        return sentAny;
    },

    sendMessageToPeer(targetPid, data) {
        if (this.peers[targetPid] && this.peers[targetPid].connected && this.peers[targetPid].channel) {
            try {
                this.peers[targetPid].channel.send(JSON.stringify(data));
                return true;
            } catch(e) {}
        }
        send(data);
        return false;
    },

    updateOverallStatus() {
        let anyConnected = false;
        for (const pid in this.peers) {
            if (this.peers[pid].connected) {
                anyConnected = true;
                break;
            }
        }
        this.connected = anyConnected;
        if (typeof updateMiniConnectionBadge === "function") {
            updateMiniConnectionBadge();
        }
    },

    closePeer(pid) {
        if (this.peers[pid]) {
            try { this.peers[pid].channel.close(); } catch(e) {}
            try { this.peers[pid].pc.close(); } catch(e) {}
            delete this.peers[pid];
        }
        this.updateOverallStatus();
    },

    reset() {
        for (const pid in this.peers) {
            this.closePeer(pid);
        }
        this.peers = {};
        this.connected = false;
        this.isHost = false;
        this.updateOverallStatus();
    }
};