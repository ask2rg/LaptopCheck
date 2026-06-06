/* ===========================================================
   LaptopCheck — in-browser test toolkit
   Real client-side hardware tests. All results stay on this
   device (localStorage). Nothing is uploaded.
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
  function measureRefresh(cb) {
    var frames = 0, start = performance.now(), last = start;
    function loop(now) { frames++; last = now; if (now - start < 1000) requestAnimationFrame(loop); else cb(Math.round(frames * 1000 / (last - start))); }
    requestAnimationFrame(loop);
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
    measureRefresh(function (hz) { var n = document.getElementById("cfg-hz"); if (n) n.textContent = hz + " Hz (≈)"; });
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        var n = document.getElementById("cfg-batt"); if (n) n.textContent = Math.round(b.level * 100) + "% · " + (b.charging ? "charging" : "on battery");
      }).catch(function () { var n = document.getElementById("cfg-batt"); if (n) n.textContent = "Not available"; });
    } else { var n = document.getElementById("cfg-batt"); if (n) n.textContent = "Not supported"; }
  }

  /* ---------------- Fullscreen colour overlay (shared) ---------------- */
  var fsOverlay, fsHud, fsColors = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#808080"], fsNames = ["Black (stuck pixels / bleed)", "White (dead pixels / dust)", "Red", "Green", "Blue", "Grey (uniformity)"], fsIdx = 0;
  function ensureOverlay() {
    if (fsOverlay) return;
    fsOverlay = el("div", "fs-overlay");
    fsHud = el("div", "fs-hud");
    document.body.appendChild(fsOverlay);
    document.body.appendChild(fsHud);
    fsOverlay.addEventListener("click", nextColor);
    document.addEventListener("keydown", function (e) {
      if (!fsOverlay.classList.contains("show")) return;
      if (e.key === "Escape") exitColor();
      else { e.preventDefault(); nextColor(); }
    });
  }
  function paint() { fsOverlay.style.background = fsColors[fsIdx]; fsHud.textContent = (fsIdx + 1) + "/" + fsColors.length + " · " + fsNames[fsIdx] + "  —  click / any key = next · Esc = exit"; }
  function nextColor() { fsIdx = (fsIdx + 1) % fsColors.length; paint(); }
  function startColor() { ensureOverlay(); fsIdx = 0; paint(); fsOverlay.classList.add("show"); fsHud.style.display = "block"; if (fsOverlay.requestFullscreen) fsOverlay.requestFullscreen().catch(function () {}); }
  function exitColor() { fsOverlay.classList.remove("show"); fsHud.style.display = "none"; if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); }

  /* ---------------- Tests ---------------- */
  var kbdActive = false;
  var TESTS = [
    {
      id: "display", icon: "🖥️", title: "Display — dead pixels, bleed & uniformity",
      desc: "Fullscreen solid colours to spot dead/stuck pixels, backlight bleed and patchiness.",
      how: ["Click <b>Start fullscreen test</b> and dim the room a little.", "It cycles Black → White → Red → Green → Blue → Grey. Click or press any key to advance.", "<b>Black:</b> look for bright dots (stuck pixels) and glowing edges (bleed). <b>White:</b> look for dark dots (dead pixels) and patchiness.", "Press <b>Esc</b> to exit, then mark the result."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "▶ Start fullscreen test");
        btn.addEventListener("click", startColor);
        s.appendChild(btn);
        s.appendChild(el("p", "note-soft", "Tip: clean the screen first so dust isn't mistaken for a dead pixel."));
      }
    },
    {
      id: "keyboard", icon: "⌨️", title: "Keyboard",
      desc: "Press every key and confirm each one registers — no dead or sticky keys.",
      how: ["Click inside the area below, then press <b>every key</b> one by one.", "Each key lights up <b>green</b> when detected. A key stuck <b>amber</b> after you release it may be sticky.", "Check the function row, arrows and modifiers too."],
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
        layout.forEach(function (row) {
          var r = el("div", "kbd-row");
          row.forEach(function (k) {
            var key = el("div", "kbd-key" + (k[2] ? " " + k[2] : ""), k[0]);
            key.setAttribute("data-code", k[1]);
            r.appendChild(key);
          });
          kbd.appendChild(r);
        });
        s.appendChild(kbd);
        var readout = el("div", "kbd-readout", 'Keys detected: <b class="kc">0</b>. Click here and start pressing keys.');
        s.appendChild(readout);
        var pressed = {};
        function setHz() { readout.querySelector(".kc").textContent = Object.keys(pressed).length; }
        function down(e) {
          if (!kbdActive) return;
          if (["Tab", "Space", "Backspace", "ArrowUp", "ArrowDown", "F1", "F5", "F11", "'", "/"].indexOf(e.key) >= 0 || /^Arrow/.test(e.code) || e.code === "Space" || e.code === "Tab") e.preventDefault();
          var n = kbd.querySelector('[data-code="' + e.code + '"]');
          if (n) { n.classList.add("hit", "held"); pressed[e.code] = 1; setHz(); }
        }
        function up(e) { var n = kbd.querySelector('[data-code="' + e.code + '"]'); if (n) n.classList.remove("held"); }
        window.addEventListener("keydown", down, true);
        window.addEventListener("keyup", up, true);
        s.addEventListener("pointerdown", function () { kbdActive = true; });
        kbdActive = true;
        return function () { kbdActive = false; window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); };
      }
    },
    {
      id: "mouse", icon: "🖱️", title: "Mouse / trackpad",
      desc: "Test every click type, scroll and cursor tracking.",
      how: ["Perform each action inside the pad — the box turns green when detected.", "Left-click, right-click, middle-click, double-click, and scroll up & down.", "Move the cursor to all corners to check tracking."],
      mount: function (s) {
        var pad = el("div", "mouse-pad");
        var zones = el("div", "mouse-zones");
        var defs = [["left", "Left click"], ["right", "Right click"], ["middle", "Middle click"], ["dbl", "Double-click"], ["up", "Scroll up"], ["down", "Scroll down"]];
        var done = {};
        defs.forEach(function (d) { var z = el("div", "mzone", d[1]); z.setAttribute("data-z", d[0]); zones.appendChild(z); });
        pad.appendChild(zones);
        s.appendChild(pad);
        var info = el("div", "mouse-cursor-info", "Cursor: move over the pad · 0/6 actions done");
        s.appendChild(info);
        function mark(z) { if (done[z]) return; done[z] = 1; var n = zones.querySelector('[data-z="' + z + '"]'); if (n) n.classList.add("done"); info.textContent = "Cursor tracking OK · " + Object.keys(done).length + "/6 actions done"; }
        pad.addEventListener("mousedown", function (e) { if (e.button === 0) mark("left"); else if (e.button === 1) { e.preventDefault(); mark("middle"); } else if (e.button === 2) mark("right"); });
        pad.addEventListener("contextmenu", function (e) { e.preventDefault(); mark("right"); });
        pad.addEventListener("dblclick", function () { mark("dbl"); });
        pad.addEventListener("wheel", function (e) { e.preventDefault(); if (e.deltaY < 0) mark("up"); else if (e.deltaY > 0) mark("down"); }, { passive: false });
        pad.addEventListener("mousemove", function (e) { var r = pad.getBoundingClientRect(); info.dataset.xy = Math.round(e.clientX - r.left) + "," + Math.round(e.clientY - r.top); });
      }
    },
    {
      id: "touch", icon: "✍️", title: "Touchscreen (if applicable)",
      desc: "Draw across the whole surface to find dead touch zones. Skip on non-touch laptops.",
      how: ["Drag your finger across every part of the box below — a line should follow with no gaps.", "Try multiple fingers; the readout shows how many touch points are detected.", "If this isn't a touchscreen, just Skip."],
      mount: function (s) {
        if (!("ontouchstart" in window) && !navigator.maxTouchPoints) {
          s.appendChild(el("p", "note-soft", "No touchscreen detected by the browser. If this laptop isn't a touch model, mark Skip."));
        }
        var wrap = el("div", "draw-wrap");
        var cv = el("canvas");
        wrap.appendChild(cv); s.appendChild(wrap);
        var info = el("div", "readout", 'Max touch points: <b>' + (navigator.maxTouchPoints || 0) + "</b> · active: <b class='tp'>0</b>");
        s.appendChild(info);
        var clr = el("button", "btn btn-ghost", "Clear"); clr.style.marginTop = "10px"; s.appendChild(clr);
        var ctx, drawing = false;
        function size() { cv.width = wrap.clientWidth; cv.height = 220; ctx = cv.getContext("2d"); ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#4f46e5"; ctx.lineWidth = 3; ctx.lineCap = "round"; }
        setTimeout(size, 0);
        function pos(e) { var r = cv.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
        function start(e) { drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        function move(e) { if (e.touches) info.querySelector(".tp").textContent = e.touches.length; if (!drawing) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
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
      how: ["Click <b>Enable camera</b> and allow access when the browser asks.", "Check for a clear, correctly-coloured picture. Wave to confirm it's live.", "Click <b>Stop</b> when done. (Permission is per-site and stays on your device.)"],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Enable camera");
        var stopBtn = el("button", "btn btn-ghost", "Stop"); stopBtn.style.display = "none"; stopBtn.style.marginLeft = "10px";
        var wrap = el("div", "cam-wrap"); wrap.style.display = "none"; wrap.style.marginTop = "12px";
        var video = document.createElement("video"); video.autoplay = true; video.playsInline = true; video.muted = true;
        wrap.appendChild(video);
        var errEl = el("div", "err-text"); errEl.style.display = "none";
        s.appendChild(btn); s.appendChild(stopBtn); s.appendChild(wrap); s.appendChild(errEl);
        var stream = null;
        function stop() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } wrap.style.display = "none"; stopBtn.style.display = "none"; btn.style.display = ""; }
        btn.addEventListener("click", function () {
          errEl.style.display = "none";
          navigator.mediaDevices.getUserMedia({ video: true }).then(function (st) {
            stream = st; video.srcObject = st; wrap.style.display = "block"; stopBtn.style.display = ""; btn.style.display = "none";
          }).catch(function (e) { errEl.textContent = "Could not access camera: " + (e && e.message ? e.message : e) + " (check permissions)."; errEl.style.display = "block"; });
        });
        stopBtn.addEventListener("click", stop);
        return stop;
      }
    },
    {
      id: "mic", icon: "🎤", title: "Microphone",
      desc: "Live input meter — speak and watch the bar move.",
      how: ["Click <b>Enable mic</b> and allow access.", "Speak or tap the mic — the level bar should jump.", "No movement at all (with permission granted) means a mic problem."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Enable mic");
        var meter = el("div", "meter"); meter.style.marginTop = "12px"; meter.style.display = "none";
        var fill = el("div", "meter-fill"); meter.appendChild(fill);
        var errEl = el("div", "err-text"); errEl.style.display = "none";
        s.appendChild(btn); s.appendChild(meter); s.appendChild(errEl);
        var ctx, stream, raf;
        function stop() { if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); if (ctx) ctx.close(); ctx = stream = null; }
        btn.addEventListener("click", function () {
          errEl.style.display = "none";
          navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
            stream = st; ctx = new (window.AudioContext || window.webkitAudioContext)();
            var src = ctx.createMediaStreamSource(st); var an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
            var data = new Uint8Array(an.frequencyBinCount); meter.style.display = "block"; btn.textContent = "Listening… (speak now)";
            function loop() { an.getByteTimeDomainData(data); var peak = 0; for (var i = 0; i < data.length; i++) { var v = Math.abs(data[i] - 128); if (v > peak) peak = v; } fill.style.width = Math.min(100, Math.round(peak / 128 * 100 * 1.6)) + "%"; raf = requestAnimationFrame(loop); }
            loop();
          }).catch(function (e) { errEl.textContent = "Could not access microphone: " + (e && e.message ? e.message : e) + "."; errEl.style.display = "block"; });
        });
        return stop;
      }
    },
    {
      id: "speakers", icon: "🔊", title: "Speakers",
      desc: "Play test tones through the left, right and both channels.",
      how: ["Turn the volume up to a comfortable level.", "Play each channel — you should clearly hear Left only, Right only, then both.", "Listen for crackle or a dead side."],
      mount: function (s) {
        var row = el("div", "controls");
        ["Left", "Right", "Both"].forEach(function (side) {
          var b = el("button", "btn btn-ghost", "▶ " + side);
          b.addEventListener("click", function () { beep(side); });
          row.appendChild(b);
        });
        s.appendChild(row);
        s.appendChild(el("p", "note-soft", "Each plays a ~1-second tone. If you hear it on the wrong side, the channels are swapped."));
        function beep(side) {
          try {
            var ac = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ac.createOscillator(); var gain = ac.createGain(); gain.gain.value = 0.12; osc.frequency.value = 440; osc.type = "sine";
            var pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
            if (pan) { pan.pan.value = side === "Left" ? -1 : side === "Right" ? 1 : 0; osc.connect(gain); gain.connect(pan); pan.connect(ac.destination); }
            else { osc.connect(gain); gain.connect(ac.destination); }
            osc.start(); setTimeout(function () { osc.stop(); ac.close(); }, 1000);
          } catch (e) {}
        }
      }
    },
    {
      id: "fps", icon: "🎞️", title: "Refresh rate & smoothness",
      desc: "Measure how many frames per second the display is running.",
      how: ["Click <b>Measure</b> and wait ~2 seconds.", "60 Hz is standard; 90/120/144 Hz means a high-refresh panel.", "A number far below 60 can indicate a driver or performance issue."],
      mount: function (s) {
        var btn = el("button", "btn btn-primary", "Measure refresh rate");
        var out = el("div", "readout"); out.style.marginTop = "12px";
        s.appendChild(btn); s.appendChild(out);
        btn.addEventListener("click", function () {
          out.innerHTML = "Measuring…"; var frames = 0, start = performance.now(), last = start;
          (function loop(now) { frames++; last = now; if (now - start < 2000) requestAnimationFrame(loop); else { var fps = Math.round(frames * 1000 / (last - start)); out.innerHTML = '<span class="big-num">' + fps + ' Hz</span> &nbsp;(approx.)'; } })(start);
        });
      }
    },
    {
      id: "battery", icon: "🔋", title: "Battery status",
      desc: "Live charge level and charging state (where the browser exposes it).",
      how: ["The level and charging state appear automatically if supported.", "Unplug the charger and re-open this test — the state should change to 'on battery'.", "<b>Note:</b> browsers can't read battery <i>health/wear</i>. For real wear %, use the powercfg report in the <a href='battery.html'>Battery stage</a>."],
      mount: function (s) {
        var out = el("div", "readout", "Checking…");
        s.appendChild(out);
        if (navigator.getBattery) {
          navigator.getBattery().then(function (b) {
            function show() { out.innerHTML = '<span class="big-num">' + Math.round(b.level * 100) + '%</span> &nbsp;·&nbsp; ' + (b.charging ? "⚡ charging" : "🔋 on battery"); }
            show(); b.addEventListener("levelchange", show); b.addEventListener("chargingchange", show);
          }).catch(function () { out.textContent = "Battery API not available in this browser."; });
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
        btn.addEventListener("click", function () {
          out.textContent = "Running…";
          setTimeout(function () {
            var t0 = performance.now(), x = 0;
            for (var i = 0; i < 30000000; i++) { x += Math.sqrt(i) * 1.0000001; }
            var ms = performance.now() - t0;
            var score = Math.max(1, Math.round(3000 / ms * 100));
            out.innerHTML = '<span class="big-num">' + Math.round(ms) + ' ms</span> &nbsp;· rough score <b>' + score + '</b> (higher = faster)';
          }, 30);
        });
      }
    }
  ];

  /* ---------------- Render test cards ---------------- */
  function badgeText(st) { return st === "pass" ? "Passed" : st === "fail" ? "Failed" : st === "skip" ? "Skipped" : "Not tested"; }
  function applyState(card, st) {
    card.classList.remove("is-pass", "is-fail", "is-skip");
    if (st) card.classList.add("is-" + st);
    var badge = card.querySelector(".status-badge");
    badge.className = "status-badge" + (st ? " " + st : "");
    badge.textContent = badgeText(st);
    card.querySelectorAll(".vbtn").forEach(function (b) { b.classList.toggle("on", b.dataset.v === st); });
  }

  function renderTests() {
    var list = document.getElementById("test-list");
    if (!list) return;
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
          '<div class="verdicts">' +
            '<button class="vbtn pass" data-v="pass">✓ Pass</button>' +
            '<button class="vbtn fail" data-v="fail">✕ Fail</button>' +
            '<button class="vbtn skip" data-v="skip">Skip</button>' +
          '</div>' +
        '</div>';
      list.appendChild(card);

      var stage = card.querySelector(".stage");
      var mounted = false, cleanup = null;
      function openCard() {
        card.classList.add("open");
        if (!mounted) { mounted = true; try { cleanup = t.mount(stage); } catch (e) { stage.appendChild(el("p", "err-text", "This test couldn't start in your browser.")); } }
      }
      function closeCard() { card.classList.remove("open"); if (cleanup) { try { cleanup(); } catch (e) {} } if (t.id === "keyboard") kbdActive = false; }
      card.querySelector(".test-top").addEventListener("click", function () { card.classList.contains("open") ? closeCard() : openCard(); });

      card.querySelectorAll(".vbtn").forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.dataset.v;
          if (results[t.id] === v) { delete results[t.id]; v = null; } else { results[t.id] = v; }
          saveResults(); applyState(card, results[t.id]); updateSummary();
        });
      });

      applyState(card, results[t.id]);
    });
  }

  /* ---------------- Summary ---------------- */
  function updateSummary() {
    var total = TESTS.length, pass = 0, fail = 0, skip = 0;
    TESTS.forEach(function (t) { var r = results[t.id]; if (r === "pass") pass++; else if (r === "fail") fail++; else if (r === "skip") skip++; });
    var done = pass + fail + skip;
    var set = function (id, v) { var n = document.getElementById(id); if (n) n.textContent = v; };
    set("sc-pass", pass); set("sc-fail", fail); set("sc-skip", skip); set("sc-pend", total - done);
    var fill = document.getElementById("sum-fill"); if (fill) fill.style.width = Math.round(done / total * 100) + "%";
    var pct = document.getElementById("sum-pct"); if (pct) pct.textContent = done + " / " + total + " done";
  }

  function wireActions() {
    var reset = document.getElementById("btn-reset");
    if (reset) reset.addEventListener("click", function () {
      results = {}; saveResults();
      document.querySelectorAll(".test").forEach(function (c) { applyState(c, null); });
      updateSummary();
    });
    var exp = document.getElementById("btn-export");
    if (exp) exp.addEventListener("click", function () {
      var lines = ["LaptopCheck — browser test results", new Date().toLocaleString(), ""];
      TESTS.forEach(function (t, i) { lines.push((i + 1) + ". " + t.title + ": " + badgeText(results[t.id]).toUpperCase()); });
      var txt = lines.join("\n");
      navigator.clipboard.writeText(txt).then(function () { exp.textContent = "✓ Copied!"; setTimeout(function () { exp.textContent = "⧉ Copy results"; }, 1600); }).catch(function () { alert(txt); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderConfig();
    renderTests();
    updateSummary();
    wireActions();
  });
})();
