// ========================================
// ⏱️ HIGH-PRECISION WEB WORKER TICKER
// Tarayıcı sekmeyi uyutsa bile 60 FPS sinyal gönderir
// ========================================

let intervalId = null;

self.onmessage = function(e) {
    if (e.data === "start") {
        if (intervalId) clearInterval(intervalId);
        
        // 1000ms / 60 FPS = ~16.666ms
        // Web Worker içinde çalıştırıldığı için tarayıcı sekmesi uyusa bile CPU hızı düşmez!
        intervalId = setInterval(function() {
            self.postMessage("tick");
        }, 16.666);
        
    } else if (e.data === "stop") {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
};