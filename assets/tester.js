/* ===========================================================
   LaptopCheck — in-browser test toolkit
   Real client-side hardware tests. Results stay on this device
   (localStorage). Only the optional Internet-speed test makes a
   network request (to Cloudflare's public speed endpoint).
   =========================================================== */
(function () {
  "use strict";

  var RESULTS_KEY = "lc-tester-results";
  var results = {};
  try { results = JSON.parse(localStorage.getItem(RESULTS_KEY) || "{}"); } catch (e) { results = {}; }
  function saveResults() { try { localStorage.setItem(RESULTS_KEY, JSON.stringify(results)); } catch (e) {} }
  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }

  /* ---------------- Config detection ---------------- */
  function getGPU() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return "Not available";
      var dbg = gl.getExtension("WEBGL_debug_renderer_info");
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || "Unknown");
    } catch (e) { return "Unknown"; }
  }
  function osGuess() {
    var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    var ua = navigator.userAgent;
    if (/Win/i.test(p) || /Windows/i.test(ua)) return "Windows";
    if (/Mac/i.test(p)) return "macOS";
    if (/Linux/i.test(p)) return "Linux";
    if (/Android/i.test(ua)) return "Android";
    return p || "Unknown";
  }
  function browserGuess() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
    return "Browser";
  }
  function renderConfig() {
    var grid = document.getElementById("config-grid");
    if (!grid) return;
    var dpr = window.devicePixelRatio || 1;
    var items = [
      { k: "💻 OS (browser-reported)", v: osGuess() + " · " + browserGuess() },
      { k: "🧠 CPU logical cores", v: (navigator.hardwareConcurrency || "—") + (navigator.hardwareConcurrency ? " threads" : "") },
      { k: "🎚️ Memory (approx.)", v: navigator.deviceMemory ? ("≥ " + navigator.deviceMemory + " GB") : "Not exposed" },
      { k: "🎮 GPU", v: getGPU(), small: true },
      { k: "🖥️ Screen", v: screen.width + " × " + screen.height + " px" },
      { k: "🔬 Pixel ratio / depth", v: dpr + "× · " + (screen.colorDepth || "—") + "-bit" },
      { k: "🔁 Refresh rate", v: '<span id="cfg-hz">measuring…</span>' },
      { k: "👆 Touch points", v: (navigator.maxTouchPoints || 0) + (navigator.maxTouchPoints ? " (touch)" : " (no touch)") },
      { k: "🌐 Network", v: (navigator.connection && navigator.connection.effectiveType) ? navigator.connection.effectiveType.toUpperCase() : "Unknown" },
      { k: "🔋 Battery", v: '<span id="cfg-batt">checking…</span>' },
      { k: "🌍 Language", v: navigator.language || "—" },
      { k: "🪟 Window", v: window.innerWidth + " × " + window.innerHeight }
    ];
    grid.innerHTML = "";
    items.forEach(function (it) {
      var card = el("div", "config-card");
      card.appendChild(el("div", "ck", it.k));
      card.appendChild(el("div", "cv" + (it.small ? " sm" : ""), it.v));
      grid.appendChild(card);
    });
    var frames = 0, start = performance.now(), last = start;
    (function loop(now) { frames++; last = now; if (now - start < 1000) requestAnimationFrame(loop); else { var n = document.getElementById("cfg-hz"); if (n) n.textContent = Math.round(frames * 1000 / (last - start)) + " Hz (≈)"; } })(start);
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) { var n = document.getElementById("cfg-batt"); if (n) n.textContent = Math.round(b.level * 100) + "% · " + (b.charging ? "charging" : "on battery"); })
        .catch(function () { var n = document.getElementById("cfg-batt"); if (n) n.textContent = "Not available"; });
    } else { var bn = document.getElementById("cfg-batt"); if (bn) bn.textContent = "Not supported"; }
  }

  /* ---------------- Fullscreen colour overlay (shared) ---------------- */
  var fsOverlay, fsHud, fsHudTimer, fsIdx = 0;
  var fsSlides = [
    { bg: "#000000", name: "Black — bright/stuck pixels & edge bleed" },
    { bg: "#ffffff", name: "White — dark/dead pixels & dust" },
    { bg: "#ff0000", name: "Red" },
    { bg: "#00ff00", name: "Green" },
    { bg: "#0000ff", name: "Blue" },
    { bg: "#808080", name: "Grey — uniformity / patchiness" },
    { bg: "linear-gradient(90deg,#000,#fff)", name: "Grayscale gradient — look for banding/steps" },
    { bg: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)", name: "Colour gradient — look for banding" }
  ];
  function ensureOverlay() {
    if (fsOverlay) return;
    fsOverlay = el("div", "fs-overlay");
    fsHud = el("div", "fs-hud");
    var exit = el("button", "fs-exit", "Exit ✕");
    fsOverlay.appendChild(fsHud);
    fsOverlay.appendChild(exit);           // HUD + exit are CHILDREN so they show in fullscreen
    document.body.appendChild(fsOverlay);
    fsOverlay.addEventListener("click", function (e) { if (e.target !== exit) nextColor(); });
    exit.addEventListener("click", function (e) { e.stopPropagation(); exitColor(); });
    fsOverlay.addEventListener("mousemove", showHud);
    document.addEventListener("keydown", function (e) {
      if (!fsOverlay.classList.contains("show")) return;
      if (e.key === "Escape") exitColor(); else { e.preventDefault(); nextColor(); }
    });
    document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement && fsOverlay.classList.contains("show")) exitColor(); });
  }
  function showHud() { if (!fsHud) return; fsHud.style.opacity = "1"; clearTimeout(fsHudTimer); fsHudTimer = setTimeout(function () { if (fsHud) fsHud.style.opacity = "0"; }, 2600); }
  function paint() { fsOverlay.style.background = fsSlides[fsIdx].bg; fsHud.innerHTML = "🔍 <b>" + (fsIdx + 1) + "/" + fsSlides.length + "</b> · " + fsSlides[fsIdx].name + "&nbsp;&nbsp;—&nbsp;&nbsp;click / any key = next · Esc = exit"; showHud(); }
  function nextColor() { fsIdx++; if (fsIdx >= fsSlides.length) { exitColor(); return; } paint(); }
  function startColor() { ensureOverlay(); fsIdx = 0; paint(); fsOverlay.classList.add("show"); if (fsOverlay.requestFullscreen) fsOverlay.requestFullscreen().catch(function () {}); }
  function exitColor() { if (!fsOverlay) return; fsOverlay.classList.remove("show"); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); }

  /* ---------------- Tests ---------------- */
  var kbdActive = false;
  var TESTS = [
    {
      id: "display", icon: "🖥️", title: "Display — pixels, bleed, banding",
      desc: "Fullscreen colours + gradients to spot dead/stuck pixels, backlight bleed and colour banding.",
      how: ["Click <b>Start fullscreen test</b> and dim the room a little.", "It cycles solid colours, then a grayscale and a colour gradient. Click or press any key to advance — <b>after the last slide it exits automatically</b>.", "<b>Black:</b> bright dots = stuck pixels, glowing edges = bleed. <b>White:</b> dark dots = dead pixels. <b>Gradients:</b> visible steps = banding.", "Press <b>Esc</b> or <b>Exit</b> any time, then mark the result."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "▶ Start fullscreen test");
        btn.addEventListener("click", startColor);
        s.appendChild(btn);
        s.appendChild(el("p", "note-soft", "Tip: clean the screen first so dust isn't mistaken for a dead pixel. Solids reveal dead pixels; gradients reveal colour banding."));
      }
    },
    {
      id: "keyboard", icon: "⌨️", title: "Keyboard",
      desc: "Press every key, check for dead/sticky keys and how many keys register at once (rollover).",
      how: ["Click inside the area below, then press <b>every key</b> one by one.", "Each key lights <b>green</b> when detected; a key stuck <b>amber</b> after release may be sticky.", "Hold several keys together — <b>max at once</b> shows the keyboard's rollover (more is better for gaming/typing)."],
      mount: function (s) {
        var layout = [
          [["Esc", "Escape"], ["F1", "F1"], ["F2", "F2"], ["F3", "F3"], ["F4", "F4"], ["F5", "F5"], ["F6", "F6"], ["F7", "F7"], ["F8", "F8"], ["F9", "F9"], ["F10", "F10"], ["F11", "F11"], ["F12", "F12"]],
          [["`", "Backquote"], ["1", "Digit1"], ["2", "Digit2"], ["3", "Digit3"], ["4", "Digit4"], ["5", "Digit5"], ["6", "Digit6"], ["7", "Digit7"], ["8", "Digit8"], ["9", "Digit9"], ["0", "Digit0"], ["-", "Minus"], ["=", "Equal"], ["⌫", "Backspace", "wide"]],
          [["Tab", "Tab", "wide"], ["Q", "KeyQ"], ["W", "KeyW"], ["E", "KeyE"], ["R", "KeyR"], ["T", "KeyT"], ["Y", "KeyY"], ["U", "KeyU"], ["I", "KeyI"], ["O", "KeyO"], ["P", "KeyP"], ["[", "BracketLeft"], ["]", "BracketRight"], ["\\", "Backslash"]],
          [["Caps", "CapsLock", "wide"], ["A", "KeyA"], ["S", "KeyS"], ["D", "KeyD"], ["F", "KeyF"], ["G", "KeyG"], ["H", "KeyH"], ["J", "KeyJ"], ["K", "KeyK"], ["L", "KeyL"], [";", "Semicolon"], ["'", "Quote"], ["Enter", "Enter", "wide"]],
          [["Shift", "ShiftLeft", "wide"], ["Z", "KeyZ"], ["X", "KeyX"], ["C", "KeyC"], ["V", "KeyV"], ["B", "KeyB"], ["N", "KeyN"], ["M", "KeyM"], [",", "Comma"], [".", "Period"], ["/", "Slash"], ["Shift", "ShiftRight", "wide"]],
          [["Ctrl", "ControlLeft"], ["Win", "MetaLeft"], ["Alt", "AltLeft"], ["Space", "Space", "xwide"], ["Alt", "AltRight"], ["Ctrl", "ControlRight"], ["←", "ArrowLeft"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["→", "ArrowRight"]]
        ];
        var kbd = el("div", "kbd");
        layout.forEach(function (row) { var r = el("div", "kbd-row"); row.forEach(function (k) { var key = el("div", "kbd-key" + (k[2] ? " " + k[2] : ""), k[0]); key.setAttribute("data-code", k[1]); r.appendChild(key); }); kbd.appendChild(r); });
        s.appendChild(kbd);
        var readout = el("div", "kbd-readout", 'Keys detected: <b class="kc">0</b> · held now: <b class="kh">0</b> · max at once: <b class="km">0</b>. Click here, then press keys.');
        s.appendChild(readout);
        var pressed = {}, held = {}, maxSim = 0;
        function upd() { var h = Object.keys(held).length; if (h > maxSim) maxSim = h; readout.querySelector(".kc").textContent = Object.keys(pressed).length; readout.querySelector(".kh").textContent = h; readout.querySelector(".km").textContent = maxSim; }
        function down(e) {
          if (!kbdActive) return;
          if (/^Arrow/.test(e.code) || e.code === "Space" || e.code === "Tab" || e.code === "Backspace" || /^F\d/.test(e.code) || e.code === "Quote" || e.code === "Slash") e.preventDefault();
          var n = kbd.querySelector('[data-code="' + e.code + '"]'); if (n) n.classList.add("hit", "held");
          pressed[e.code] = 1; held[e.code] = 1; upd();
        }
        function up(e) { delete held[e.code]; var n = kbd.querySelector('[data-code="' + e.code + '"]'); if (n) n.classList.remove("held"); upd(); }
        window.addEventListener("keydown", down, true);
        window.addEventListener("keyup", up, true);
        s.addEventListener("pointerdown", function () { kbdActive = true; });
        kbdActive = true;
        return function () { kbdActive = false; window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); };
      }
    },
    {
      id: "mouse", icon: "🖱️", title: "Mouse / trackpad",
      desc: "Every click type, scroll, pinch-zoom, live X/Y position and cursor tracking.",
      how: ["Perform each action inside the pad — boxes turn green when detected.", "Left, right, middle, double-click, scroll up & down. On a trackpad, try a two-finger pinch (zoom).", "Move around — the live <b>X / Y</b> and the crosshair follow your cursor; check there are no dead spots."],
      mount: function (s) {
        var pad = el("div", "mouse-pad");
        var zones = el("div", "mouse-zones");
        var defs = [["left", "Left click"], ["right", "Right click"], ["middle", "Middle click"], ["dbl", "Double-click"], ["up", "Scroll up"], ["down", "Scroll down"]];
        var done = {};
        defs.forEach(function (d) { var z = el("div", "mzone", d[1]); z.setAttribute("data-z", d[0]); zones.appendChild(z); });
        pad.appendChild(zones);
        var cross = el("div", "mouse-cross"); pad.appendChild(cross);
        s.appendChild(pad);
        var info = el("div", "mouse-cursor-info", 'X: <b>—</b>  Y: <b>—</b> · <b>0/6</b> actions');
        s.appendChild(info);
        var lastX = "—", lastY = "—", gest = "";
        function upd() { info.innerHTML = "X: <b>" + lastX + "</b>  Y: <b>" + lastY + "</b> · <b>" + Object.keys(done).length + "/6</b> actions" + (gest ? " · " + gest : ""); }
        function mark(z) { if (done[z]) return; done[z] = 1; var n = zones.querySelector('[data-z="' + z + '"]'); if (n) n.classList.add("done"); upd(); }
        pad.addEventListener("mousedown", function (e) { if (e.button === 0) mark("left"); else if (e.button === 1) { e.preventDefault(); mark("middle"); } else if (e.button === 2) mark("right"); });
        pad.addEventListener("contextmenu", function (e) { e.preventDefault(); mark("right"); });
        pad.addEventListener("dblclick", function () { mark("dbl"); });
        pad.addEventListener("wheel", function (e) { e.preventDefault(); if (e.ctrlKey) { gest = "pinch-zoom ✓"; } else if (e.deltaY < 0) mark("up"); else if (e.deltaY > 0) mark("down"); upd(); }, { passive: false });
        pad.addEventListener("mousemove", function (e) { var r = pad.getBoundingClientRect(); lastX = Math.round(e.clientX - r.left); lastY = Math.round(e.clientY - r.top); cross.style.left = lastX + "px"; cross.style.top = lastY + "px"; cross.style.opacity = "1"; upd(); });
        pad.addEventListener("mouseleave", function () { cross.style.opacity = "0"; });
      }
    },
    {
      id: "touch", icon: "✍️", title: "Touchscreen (if applicable)",
      desc: "Draw across the whole surface to find dead touch zones. Skip on non-touch laptops.",
      how: ["Drag your finger across every part of the box — a line should follow with no gaps.", "Try multiple fingers; the readout shows active touch points and live X / Y.", "If this isn't a touchscreen, just Skip."],
      mount: function (s) {
        if (!("ontouchstart" in window) && !navigator.maxTouchPoints) s.appendChild(el("p", "note-soft", "No touchscreen detected by the browser. If this laptop isn't a touch model, mark Skip."));
        var wrap = el("div", "draw-wrap"); var cv = el("canvas"); wrap.appendChild(cv); s.appendChild(wrap);
        var info = el("div", "readout", "Max touch points: <b>" + (navigator.maxTouchPoints || 0) + "</b> · active: <b class='tp'>0</b> · X:<b class='tx'>—</b> Y:<b class='ty'>—</b>");
        s.appendChild(info);
        var clr = el("button", "btn btn-ghost", "Clear"); clr.style.marginTop = "10px"; s.appendChild(clr);
        var ctx, drawing = false;
        function size() { cv.width = wrap.clientWidth; cv.height = 220; ctx = cv.getContext("2d"); ctx.strokeStyle = (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#4f46e5").trim(); ctx.lineWidth = 3; ctx.lineCap = "round"; }
        setTimeout(size, 0);
        function pos(e) { var r = cv.getBoundingClientRect(); var t = (e.touches && e.touches[0]) ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
        function start(e) { drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        function move(e) { var p = pos(e); if (e.touches) info.querySelector(".tp").textContent = e.touches.length; info.querySelector(".tx").textContent = Math.round(p.x); info.querySelector(".ty").textContent = Math.round(p.y); if (!drawing) return; e.preventDefault(); ctx.lineTo(p.x, p.y); ctx.stroke(); }
        function end() { drawing = false; }
        cv.addEventListener("pointerdown", start); cv.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
        cv.addEventListener("touchstart", start, { passive: false }); cv.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", end);
        clr.addEventListener("click", function () { ctx.clearRect(0, 0, cv.width, cv.height); });
        return function () { window.removeEventListener("pointerup", end); window.removeEventListener("touchend", end); };
      }
    },
    {
      id: "webcam", icon: "📷", title: "Webcam",
      desc: "Live preview to check the camera works and the image is clear.",
      how: ["Click <b>Enable camera</b> and allow access when asked.", "Check for a clear, correctly-coloured picture. Wave to confirm it's live.", "Click <b>Stop</b> when done. Permission stays on your device."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Enable camera");
        var stopBtn = el("button", "btn btn-ghost", "Stop"); stopBtn.style.display = "none"; stopBtn.style.marginLeft = "10px";
        var wrap = el("div", "cam-wrap"); wrap.style.display = "none"; wrap.style.marginTop = "12px";
        var video = document.createElement("video"); video.autoplay = true; video.playsInline = true; video.muted = true; wrap.appendChild(video);
        var errEl = el("div", "err-text"); errEl.style.display = "none";
        s.appendChild(btn); s.appendChild(stopBtn); s.appendChild(wrap); s.appendChild(errEl);
        var stream = null;
        function stop() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } wrap.style.display = "none"; stopBtn.style.display = "none"; btn.style.display = ""; }
        btn.addEventListener("click", function () {
          errEl.style.display = "none";
          navigator.mediaDevices.getUserMedia({ video: true }).then(function (st) { stream = st; video.srcObject = st; wrap.style.display = "block"; stopBtn.style.display = ""; btn.style.display = "none"; })
            .catch(function (e) { errEl.textContent = "Could not access camera: " + (e && e.message ? e.message : e) + " (check permissions)."; errEl.style.display = "block"; });
        });
        stopBtn.addEventListener("click", stop);
        return stop;
      }
    },
    {
      id: "mic", icon: "🎤", title: "Microphone",
      desc: "Live input meter, plus record-and-play-back to hear yourself.",
      how: ["Click <b>Enable mic</b> and allow access. Speak — the level bar should jump.", "Click <b>Record 3s & play back</b> to record a clip and hear it played back through the speakers.", "No movement (with permission granted) means a mic problem."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Enable mic");
        var meter = el("div", "meter"); meter.style.marginTop = "12px"; meter.style.display = "none";
        var fill = el("div", "meter-fill"); meter.appendChild(fill);
        var recRow = el("div", "controls"); recRow.style.marginTop = "12px"; recRow.style.display = "none";
        var recBtn = el("button", "btn btn-ghost", "● Record 3s & play back"); recRow.appendChild(recBtn);
        var player = document.createElement("audio"); player.controls = true; player.style.display = "none"; player.style.marginTop = "10px"; player.style.width = "100%";
        var errEl = el("div", "err-text"); errEl.style.display = "none";
        s.appendChild(btn); s.appendChild(meter); s.appendChild(recRow); s.appendChild(player); s.appendChild(errEl);
        var ctx, stream, raf;
        function stop() { if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); if (ctx) ctx.close(); ctx = stream = null; }
        btn.addEventListener("click", function () {
          errEl.style.display = "none";
          navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
            stream = st; ctx = new (window.AudioContext || window.webkitAudioContext)();
            var src = ctx.createMediaStreamSource(st), an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
            var data = new Uint8Array(an.frequencyBinCount); meter.style.display = "block"; recRow.style.display = "flex"; btn.textContent = "Listening… (speak now)";
            (function loop() { an.getByteTimeDomainData(data); var peak = 0; for (var i = 0; i < data.length; i++) { var v = Math.abs(data[i] - 128); if (v > peak) peak = v; } fill.style.width = Math.min(100, Math.round(peak / 128 * 160)) + "%"; raf = requestAnimationFrame(loop); })();
          }).catch(function (e) { errEl.textContent = "Could not access microphone: " + (e && e.message ? e.message : e) + "."; errEl.style.display = "block"; });
        });
        recBtn.addEventListener("click", function () {
          if (!stream || !window.MediaRecorder) { errEl.textContent = "Recording isn't supported in this browser."; errEl.style.display = "block"; return; }
          try {
            var chunks = [], mr = new MediaRecorder(stream);
            mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
            mr.onstop = function () { var blob = new Blob(chunks, { type: (chunks[0] && chunks[0].type) || "audio/webm" }); player.src = URL.createObjectURL(blob); player.style.display = "block"; player.play().catch(function () {}); recBtn.disabled = false; recBtn.textContent = "● Record 3s & play back"; };
            recBtn.disabled = true; recBtn.textContent = "● Recording…"; mr.start();
            setTimeout(function () { if (mr.state !== "inactive") mr.stop(); }, 3000);
          } catch (e) { errEl.textContent = "Recording failed: " + e; errEl.style.display = "block"; }
        });
        return stop;
      }
    },
    {
      id: "speakers", icon: "🔊", title: "Speakers",
      desc: "Play test tones through the left, right and both channels.",
      how: ["Turn the volume to a comfortable level.", "Play each channel — you should clearly hear Left only, Right only, then both.", "Listen for crackle or a dead side; wrong side = swapped channels."],
      mount: function (s) {
        var row = el("div", "controls");
        ["Left", "Right", "Both"].forEach(function (side) { var b = el("button", "btn btn-ghost", "▶ " + side); b.addEventListener("click", function () { beep(side); }); row.appendChild(b); });
        s.appendChild(row);
        s.appendChild(el("p", "note-soft", "Each plays a ~1-second tone."));
        function beep(side) {
          try {
            var ac = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ac.createOscillator(), gain = ac.createGain(); gain.gain.value = 0.12; osc.frequency.value = 440; osc.type = "sine";
            var pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
            if (pan) { pan.pan.value = side === "Left" ? -1 : side === "Right" ? 1 : 0; osc.connect(gain); gain.connect(pan); pan.connect(ac.destination); }
            else { osc.connect(gain); gain.connect(ac.destination); }
            osc.start(); setTimeout(function () { osc.stop(); ac.close(); }, 1000);
          } catch (e) {}
        }
      }
    },
    {
      id: "internet", icon: "🌐", title: "Internet speed",
      desc: "Download throughput and ping (uses Cloudflare's public speed endpoint).",
      how: ["Click <b>Run speed test</b> — it pings, then downloads test data and shows live Mbps.", "Needs an internet connection. This is the one test that makes a network request (to Cloudflare).", "Compare against the speed you're paying for."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Run speed test");
        var out = el("div", "readout"); out.style.marginTop = "12px"; out.innerHTML = "Ready.";
        var errEl = el("div", "err-text"); errEl.style.display = "none";
        s.appendChild(btn); s.appendChild(out); s.appendChild(errEl);
        s.appendChild(el("p", "note-soft", "Note: in-browser speed tests are approximate and depend on the server, your Wi-Fi and other traffic."));
        function ping(cb) {
          var t = performance.now();
          fetch("https://speed.cloudflare.com/__down?bytes=1000&t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.arrayBuffer(); }).then(function () { cb(Math.round(performance.now() - t)); }).catch(function () { cb(null); });
        }
        function download() {
          var bytes = 25000000; var url = "https://speed.cloudflare.com/__down?bytes=" + bytes + "&t=" + Date.now();
          var t0 = performance.now();
          fetch(url, { cache: "no-store" }).then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            if (!resp.body || !resp.body.getReader) {
              return resp.arrayBuffer().then(function (buf) { var sec = (performance.now() - t0) / 1000; finish(buf.byteLength * 8 / sec / 1e6); });
            }
            var reader = resp.body.getReader(), received = 0;
            (function pump() {
              return reader.read().then(function (res) {
                if (res.done) { var sec = (performance.now() - t0) / 1000; finish(received * 8 / sec / 1e6); return; }
                received += res.value.length; var sec = (performance.now() - t0) / 1000; if (sec > 0.15) out.innerHTML = '<span class="big-num">' + (received * 8 / sec / 1e6).toFixed(1) + '</span> Mbps &nbsp;· downloading… (' + Math.round(received / 1e6) + ' MB)';
                return pump();
              });
            })();
          }).catch(function (e) { errEl.textContent = "Speed test failed: " + (e && e.message ? e.message : e) + " (no internet, or the endpoint is blocked)."; errEl.style.display = "block"; btn.disabled = false; btn.textContent = "Run speed test"; });
        }
        var pingMs = null;
        function finish(mbps) { out.innerHTML = '<span class="big-num">' + mbps.toFixed(1) + '</span> Mbps download' + (pingMs != null ? ' &nbsp;·&nbsp; ping <b>' + pingMs + ' ms</b>' : ''); btn.disabled = false; btn.textContent = "Run again"; }
        btn.addEventListener("click", function () {
          errEl.style.display = "none"; btn.disabled = true; btn.textContent = "Testing…"; out.innerHTML = "Pinging…";
          ping(function (ms) { pingMs = ms; out.innerHTML = (ms != null ? "Ping " + ms + " ms · " : "") + "starting download…"; download(); });
        });
      }
    },
    {
      id: "battery", icon: "🔋", title: "Battery status",
      desc: "Live charge level and charging state (where the browser exposes it).",
      how: ["The level and charging state appear automatically if supported.", "Unplug the charger and re-open this test — the state should change.", "<b>Note:</b> browsers can't read battery <i>health/wear</i>. For that, use the powercfg report in the <a href='battery.html'>Battery stage</a>."],
      mount: function (s) {
        var out = el("div", "readout", "Checking…"); s.appendChild(out);
        if (navigator.getBattery) {
          navigator.getBattery().then(function (b) { function show() { out.innerHTML = '<span class="big-num">' + Math.round(b.level * 100) + '%</span> &nbsp;·&nbsp; ' + (b.charging ? "⚡ charging" : "🔋 on battery"); } show(); b.addEventListener("levelchange", show); b.addEventListener("chargingchange", show); })
            .catch(function () { out.textContent = "Battery API not available in this browser."; });
        } else { out.innerHTML = "Battery API isn't supported here (common on Firefox/Safari). Use the <a href='battery.html'>Battery stage</a> for the real check."; }
      }
    },
    {
      id: "perf", icon: "⚡", title: "Quick performance check",
      desc: "A rough CPU speed indicator (not a substitute for a real benchmark).",
      how: ["Click <b>Run</b> — it does a short burst of calculations.", "Lower time = faster. Compare against another laptop if you can.", "This is a rough single-thread indicator only."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Run quick benchmark");
        var out = el("div", "readout"); out.style.marginTop = "12px";
        s.appendChild(btn); s.appendChild(out);
        btn.addEventListener("click", function () { out.textContent = "Running…"; setTimeout(function () { var t0 = performance.now(), x = 0; for (var i = 0; i < 30000000; i++) { x += Math.sqrt(i) * 1.0000001; } var ms = performance.now() - t0; var score = Math.max(1, Math.round(3000 / ms * 100)); out.innerHTML = '<span class="big-num">' + Math.round(ms) + ' ms</span> &nbsp;· rough score <b>' + score + '</b> (higher = faster)'; }, 30); });
      }
    }
  ];

  /* ---------------- Render ---------------- */
  function badgeText(st) { return st === "pass" ? "Passed" : st === "fail" ? "Failed" : st === "skip" ? "Skipped" : "Not tested"; }
  function applyState(card, st) {
    card.classList.remove("is-pass", "is-fail", "is-skip"); if (st) card.classList.add("is-" + st);
    var badge = card.querySelector(".status-badge"); badge.className = "status-badge" + (st ? " " + st : ""); badge.textContent = badgeText(st);
    card.querySelectorAll(".vbtn").forEach(function (b) { b.classList.toggle("on", b.dataset.v === st); });
  }
  function renderTests() {
    var list = document.getElementById("test-list"); if (!list) return;
    TESTS.forEach(function (t, i) {
      var card = el("div", "test"); card.setAttribute("data-test", t.id);
      var num = (i + 1 < 10 ? "0" : "") + (i + 1);
      card.innerHTML =
        '<div class="test-top">' +
          '<div class="test-ico">' + t.icon + '</div>' +
          '<div class="test-h"><h3><span class="tnum">' + num + '</span> ' + t.title + '</h3><p>' + t.desc + '</p></div>' +
          '<span class="status-badge">Not tested</span>' +
          '<svg class="test-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="test-body">' +
          '<div class="how"><h4>How to test</h4><ol>' + t.how.map(function (h) { return "<li>" + h + "</li>"; }).join("") + '</ol></div>' +
          '<div class="stage"></div>' +
          '<div class="verdicts"><button class="vbtn pass" data-v="pass">✓ Pass</button><button class="vbtn fail" data-v="fail">✕ Fail</button><button class="vbtn skip" data-v="skip">Skip</button></div>' +
        '</div>';
      list.appendChild(card);
      var stage = card.querySelector(".stage"); var mounted = false, cleanup = null;
      function openCard() { card.classList.add("open"); if (!mounted) { mounted = true; try { cleanup = t.mount(stage); } catch (e) { stage.appendChild(el("p", "err-text", "This test couldn't start in your browser.")); } } }
      function closeCard() { card.classList.remove("open"); if (cleanup) { try { cleanup(); } catch (e) {} } if (t.id === "keyboard") kbdActive = false; }
      card.querySelector(".test-top").addEventListener("click", function () { card.classList.contains("open") ? closeCard() : openCard(); });
      card.querySelectorAll(".vbtn").forEach(function (b) { b.addEventListener("click", function () { var v = b.dataset.v; if (results[t.id] === v) { delete results[t.id]; v = null; } else { results[t.id] = v; } saveResults(); applyState(card, results[t.id]); updateSummary(); }); });
      applyState(card, results[t.id]);
    });
  }
  function updateSummary() {
    var total = TESTS.length, pass = 0, fail = 0, skip = 0;
    TESTS.forEach(function (t) { var r = results[t.id]; if (r === "pass") pass++; else if (r === "fail") fail++; else if (r === "skip") skip++; });
    var done = pass + fail + skip, set = function (id, v) { var n = document.getElementById(id); if (n) n.textContent = v; };
    set("sc-pass", pass); set("sc-fail", fail); set("sc-skip", skip); set("sc-pend", total - done);
    var fill = document.getElementById("sum-fill"); if (fill) fill.style.width = Math.round(done / total * 100) + "%";
    var pct = document.getElementById("sum-pct"); if (pct) pct.textContent = done + " / " + total + " done";
  }
  function wireActions() {
    var reset = document.getElementById("btn-reset");
    if (reset) reset.addEventListener("click", function () { results = {}; saveResults(); document.querySelectorAll(".test").forEach(function (c) { applyState(c, null); }); updateSummary(); });
    var exp = document.getElementById("btn-export");
    if (exp) exp.addEventListener("click", function () {
      var lines = ["LaptopCheck — browser test results", new Date().toLocaleString(), ""];
      TESTS.forEach(function (t, i) { lines.push((i + 1) + ". " + t.title + ": " + badgeText(results[t.id]).toUpperCase()); });
      var txt = lines.join("\n");
      navigator.clipboard.writeText(txt).then(function () { exp.textContent = "✓ Copied!"; setTimeout(function () { exp.textContent = "⧉ Copy results"; }, 1600); }).catch(function () { alert(txt); });
    });
  }

  /* ---------------- Live metrics ---------------- */
  function lmCard(cls, icon, title, sub, id) {
    return '<div class="live-card">' +
      '<div class="live-head"><span class="live-ico ' + cls + '">' + icon + '</span><div><div class="live-title">' + title + '</div><div class="live-sub">' + sub + '</div></div></div>' +
      '<div class="live-val" id="' + id + '-val">—</div>' +
      '<div class="live-line" id="' + id + '-line" style="display:none"></div>' +
      '<div class="live-bar" id="' + id + '-barwrap" style="display:none"><div class="live-fill" id="' + id + '-bar"></div></div>' +
    '</div>';
  }
  function lmVal(id, txt) { var n = document.getElementById(id + "-val"); if (n) n.innerHTML = txt; }
  function lmLine(id, txt) { var n = document.getElementById(id + "-line"); if (n) { n.style.display = "block"; n.innerHTML = txt; } }
  function lmBar(id, pct, warn) { var w = document.getElementById(id + "-barwrap"), f = document.getElementById(id + "-bar"); if (!w || !f) return; w.style.display = "block"; f.style.width = Math.max(0, Math.min(100, pct)) + "%"; f.classList.toggle("warn", !!warn); }

  function startLiveMetrics() {
    var grid = document.getElementById("live-grid"); if (!grid) return;
    grid.innerHTML =
      lmCard("mem", "🧪", "Memory", "JS heap · this tab", "lm-mem") +
      lmCard("cpu", "⚡", "CPU load", "estimated", "lm-cpu") +
      lmCard("fps", "🎞️", "Frame rate", "live", "lm-fps") +
      lmCard("net", "📶", "Network", "connection", "lm-net") +
      lmCard("bat", "🔋", "Battery", "charge", "lm-bat");

    function updMem() {
      var m = performance.memory;
      if (!m) { lmVal("lm-mem", "Not exposed"); lmLine("lm-mem", "Use Task Manager for real RAM"); return; }
      var used = m.usedJSHeapSize / 1048576, lim = m.jsHeapSizeLimit / 1048576;
      lmVal("lm-mem", Math.round(used) + " MB <span style='font-size:0.9rem;color:var(--text-muted)'>/ " + Math.round(lim) + " MB</span>");
      lmBar("lm-mem", used / lim * 100, used / lim > 0.85);
    }
    updMem(); setInterval(updMem, 1000);

    var minLoop = Infinity;
    function sampleCpu() {
      var t0 = performance.now(), x = 0; for (var i = 0; i < 2000000; i++) { x += i * 1.000001; }
      var dt = performance.now() - t0; if (dt < minLoop) minLoop = dt;
      var load = Math.max(0, Math.min(100, Math.round((1 - minLoop / dt) * 100)));
      lmVal("lm-cpu", load + "%"); lmBar("lm-cpu", load, load > 75);
    }
    sampleCpu(); setInterval(sampleCpu, 1200);

    var ff = 0, ft = performance.now();
    (function fpsLoop(now) { ff++; if (now - ft >= 1000) { var fps = Math.round(ff * 1000 / (now - ft)); ff = 0; ft = now; lmVal("lm-fps", fps + " FPS"); lmBar("lm-fps", fps / 120 * 100); } requestAnimationFrame(fpsLoop); })(ft);

    function updNet() {
      var on = navigator.onLine, c = navigator.connection;
      lmVal("lm-net", on ? '<span class="live-dot" style="background:var(--green)"></span><span class="grn">Online</span>' : '<span class="live-dot" style="background:var(--red)"></span><span class="red">Offline</span>');
      var parts = [];
      if (c) { if (c.downlink) parts.push(c.downlink + " Mbps"); if (c.rtt) parts.push(c.rtt + " ms"); if (c.effectiveType) parts.push(c.effectiveType.toUpperCase()); }
      lmLine("lm-net", parts.length ? parts.join(" · ") : "details not exposed");
    }
    updNet(); setInterval(updNet, 3000);
    window.addEventListener("online", updNet); window.addEventListener("offline", updNet);
    if (navigator.connection && navigator.connection.addEventListener) navigator.connection.addEventListener("change", updNet);

    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        function show() { lmVal("lm-bat", Math.round(b.level * 100) + "%"); lmLine("lm-bat", b.charging ? "⚡ charging" : "on battery"); lmBar("lm-bat", b.level * 100, b.level < 0.2 && !b.charging); }
        show(); b.addEventListener("levelchange", show); b.addEventListener("chargingchange", show);
      }).catch(function () { lmVal("lm-bat", "—"); lmLine("lm-bat", "not available"); });
    } else { lmVal("lm-bat", "—"); lmLine("lm-bat", "not supported here"); }
  }

  document.addEventListener("DOMContentLoaded", function () { renderConfig(); startLiveMetrics(); renderTests(); updateSummary(); wireActions(); });
})();
