// Web Worker - Arka planda da 60 FPS tick atar
let tickInterval = null;

self.onmessage = function(e) {
    if (e.data === "start") {
        if (tickInterval) return;
        tickInterval = setInterval(() => {
            self.postMessage("tick");
        }, 1000 / 60);
    } else if (e.data === "stop") {
        if (tickInterval) {
            clearInterval(tickInterval);
            tickInterval = null;
        }
    }
};