/* ===========================================================
   LaptopCheck — shared script
   Theme toggle, mobile nav, copy buttons, checklist persistence.
   =========================================================== */

(function () {
  "use strict";

  /* ---------- Theme (persists across pages) ---------- */
  var STORE_THEME = "lc-theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
  }
  try {
    var saved = localStorage.getItem(STORE_THEME);
    if (saved) applyTheme(saved);
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme("dark");
    }
  } catch (e) {}

  /* Sidebar initial state (closed on mobile, or if the user collapsed it) */
  try {
    var navState = localStorage.getItem("lc-nav");
    if (window.innerWidth <= 1024) document.documentElement.classList.add("nav-closed");
    else if (navState === "closed") document.documentElement.classList.add("nav-closed");
  } catch (e) {}

  document.addEventListener("DOMContentLoaded", function () {
    /* inject the Tester nav link once (after Quick) */
    var navUl = document.querySelector(".nav-links");
    if (navUl && !navUl.querySelector('a[href="tester.html"]')) {
      var quickA = navUl.querySelector('a[href="quick.html"]');
      var li = document.createElement("li");
      li.innerHTML = '<a href="tester.html">🧪 Tester</a>';
      if (quickA && quickA.parentElement) quickA.parentElement.insertAdjacentElement("afterend", li);
      else navUl.appendChild(li);
    }

    /* theme toggle button */
    var tBtn = document.querySelector(".theme-toggle");
    if (tBtn) {
      tBtn.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        var next = cur === "dark" ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem(STORE_THEME, next); } catch (e) {}
      });
    }

    /* ---------- Collapsible sidebar ---------- */
    if (!document.querySelector(".nav-toggle")) {
      var navToggle = document.createElement("button");
      navToggle.className = "nav-toggle"; navToggle.type = "button";
      navToggle.setAttribute("aria-label", "Toggle navigation");
      navToggle.innerHTML =
        '<svg class="ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '<svg class="ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
      document.body.appendChild(navToggle);

      var navBackdrop = document.createElement("div");
      navBackdrop.className = "nav-backdrop";
      document.body.appendChild(navBackdrop);

      function setNav(closed) {
        document.documentElement.classList.toggle("nav-closed", closed);
        try { localStorage.setItem("lc-nav", closed ? "closed" : "open"); } catch (e) {}
      }
      navToggle.addEventListener("click", function () {
        setNav(!document.documentElement.classList.contains("nav-closed"));
      });
      navBackdrop.addEventListener("click", function () { setNav(true); });
      document.querySelectorAll(".site-header .nav-links a").forEach(function (a) {
        a.addEventListener("click", function () { if (window.innerWidth <= 1024) setNav(true); });
      });
    }

    /* mobile menu (legacy hamburger — hidden in sidebar mode) */
    var menuBtn = document.querySelector(".menu-btn");
    var navLinks = document.querySelector(".nav-links");
    if (menuBtn && navLinks) {
      menuBtn.addEventListener("click", function () {
        navLinks.classList.toggle("open");
      });
      navLinks.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { navLinks.classList.remove("open"); });
      });
    }

    /* highlight active nav link */
    var here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      var href = a.getAttribute("href");
      if (href === here || (here === "" && href === "index.html")) a.classList.add("active");
    });

    /* copy buttons */
    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var container = btn.closest(".cmd, .cmd-mini") || btn.parentElement;
        var el = (container && (container.querySelector("[data-copy]") || container.querySelector("pre, code"))) || null;
        var text = el ? (el.getAttribute("data-copy") || el.innerText) : "";
        if (!text) return;
        navigator.clipboard.writeText(text.trim()).then(function () {
          var orig = btn.innerHTML;
          btn.classList.add("copied");
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied';
          setTimeout(function () { btn.classList.remove("copied"); btn.innerHTML = orig; }, 1600);
        }).catch(function () {});
      });
    });

    /* reveal on scroll */
    var reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && reveals.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.08 });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("in"); });
    }

    /* ---------- Checklist persistence ---------- */
    var checks = document.querySelectorAll(".check-item input[type=checkbox]");
    if (checks.length) {
      var STORE_CHECK = "lc-checklist";
      var state = {};
      try { state = JSON.parse(localStorage.getItem(STORE_CHECK) || "{}"); } catch (e) { state = {}; }

      function save() { try { localStorage.setItem(STORE_CHECK, JSON.stringify(state)); } catch (e) {} }
      function updateProgress() {
        var total = checks.length, done = 0;
        checks.forEach(function (c) { if (c.checked) done++; });
        var pct = total ? Math.round((done / total) * 100) : 0;
        var fill = document.querySelector(".progress-fill");
        var stats = document.querySelector(".progress-stats");
        if (fill) fill.style.width = pct + "%";
        if (stats) stats.textContent = done + " / " + total + " checks · " + pct + "%";
      }

      checks.forEach(function (c) {
        if (state[c.id]) c.checked = true;
        c.addEventListener("change", function () {
          state[c.id] = c.checked;
          save();
          updateProgress();
        });
      });
      updateProgress();

      var resetBtn = document.querySelector("[data-reset-checklist]");
      if (resetBtn) {
        resetBtn.addEventListener("click", function () {
          checks.forEach(function (c) { c.checked = false; state[c.id] = false; });
          save();
          updateProgress();
        });
      }
      var checkAllBtn = document.querySelector("[data-check-all]");
      if (checkAllBtn) {
        checkAllBtn.addEventListener("click", function () {
          checks.forEach(function (c) { c.checked = true; state[c.id] = true; });
          save();
          updateProgress();
        });
      }
    }

    /* ---------- Time-spent timer ---------- */
    var timerEl = document.querySelector("[data-timer]");
    if (timerEl) {
      var disp = timerEl.querySelector(".timer-display");
      var toggleBtn = timerEl.querySelector("[data-timer-toggle]");
      var tResetBtn = timerEl.querySelector("[data-timer-reset]");
      var TKEY = "lc-timer-" + (location.pathname.split("/").pop() || "index");
      var elapsed = parseInt(localStorage.getItem(TKEY) || "0", 10) || 0;
      var running = false, iv = null;
      function fmt(s) {
        var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
        var mm = (m < 10 ? "0" : "") + m, xx = (x < 10 ? "0" : "") + x;
        return h > 0 ? (h + ":" + mm + ":" + xx) : (mm + ":" + xx);
      }
      function tRender() { if (disp) disp.textContent = fmt(elapsed); }
      function tSave() { try { localStorage.setItem(TKEY, String(elapsed)); } catch (e) {} }
      function tTick() { elapsed++; tRender(); if (elapsed % 5 === 0) tSave(); }
      function tStart() { if (running) return; running = true; iv = setInterval(tTick, 1000); if (toggleBtn) toggleBtn.textContent = "⏸ Pause"; }
      function tPause() { running = false; if (iv) clearInterval(iv); tSave(); if (toggleBtn) toggleBtn.textContent = "▶ Resume"; }
      tRender();
      if (toggleBtn) {
        toggleBtn.textContent = elapsed > 0 ? "▶ Resume" : "▶ Start";
        toggleBtn.addEventListener("click", function () { running ? tPause() : tStart(); });
      }
      if (tResetBtn) {
        tResetBtn.addEventListener("click", function () {
          tPause(); elapsed = 0; tRender(); tSave();
          if (toggleBtn) toggleBtn.textContent = "▶ Start";
        });
      }
      /* auto-start the timer the first time a checkbox is ticked */
      document.querySelectorAll(".check-item input[type=checkbox]").forEach(function (c) {
        c.addEventListener("change", function () { if (!running && c.checked) tStart(); });
      });
      window.addEventListener("beforeunload", tSave);
      document.addEventListener("visibilitychange", function () { if (document.hidden) tSave(); });
    }

    /* ---------- Toast helper ---------- */
    function showToast(msg) {
      var t = document.querySelector(".toast");
      if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.classList.remove("show"); }, 3600);
    }

    /* ---------- OS switcher in nav (Windows active · Mac coming soon) ---------- */
    var navTools = document.querySelector(".nav-tools");
    if (navTools && !document.querySelector(".os-switch")) {
      var winSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.6 10.4 4.4v7.1H3V5.6zM11.5 4.2 21 2.8v8.7h-9.5V4.2zM3 12.6h7.4v7.1L3 18.5v-5.9zM11.5 12.6H21v8.6l-9.5-1.3v-7.3z"/></svg>';
      var appleSvg = '<svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C73.6 141.1 24 184.3 24 272.5c0 26.1 4.8 53 14.3 80.7 12.8 36.7 58.9 126.7 107 125.2 25.1-.6 42.8-17.8 75.5-17.8 31.7 0 48.1 17.8 76.4 17.8 48.5-.7 90.2-82.5 102.4-119.3-65.2-30.7-61-90.1-61-90.4zM262.1 104.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
      var os = document.createElement("div");
      os.className = "os-switch";
      os.innerHTML =
        '<button class="active" type="button" title="Windows guide" aria-label="Windows guide (active)">' + winSvg + '<span class="os-label">Windows</span></button>' +
        '<button class="soon" type="button" data-os-soon title="macOS guide coming soon" aria-label="macOS guide coming soon">' + appleSvg + '<span class="os-label">Mac</span><span class="soon-tag">soon</span></button>';
      navTools.insertBefore(os, navTools.firstChild);
      os.querySelector("[data-os-soon]").addEventListener("click", function () {
        showToast("🍎 The macOS guide is coming soon — this guide currently covers Windows laptops.");
      });
    }

    /* ---------- Feedback widget (demo — wire to Google Apps Script later) ---------- */
    if (!document.querySelector(".fab-feedback")) {
      var chatSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
      var fab = document.createElement("button");
      fab.className = "fab-feedback"; fab.type = "button"; fab.setAttribute("aria-label", "Send feedback");
      fab.innerHTML = chatSvg + '<span class="fab-label">Feedback</span>';
      document.body.appendChild(fab);

      var overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-label="Send feedback">' +
          '<div data-fb-form>' +
            '<h3>Spot something missing?</h3>' +
            '<p class="sub">Found a check we missed, a broken link, or have an idea? Tell us — it helps the next person buying on a budget.</p>' +
            '<label for="fbType">Type</label>' +
            '<select id="fbType" data-fb-type><option>Missing check / tip</option><option>Suggestion / improvement</option><option>Something is wrong (bug / broken link)</option><option>Other</option></select>' +
            '<label for="fbMsg">Your feedback</label>' +
            '<textarea id="fbMsg" data-fb-msg placeholder="What should we add, fix, or explain better?"></textarea>' +
            '<label for="fbEmail">Email (optional — if you\'d like a reply)</label>' +
            '<input id="fbEmail" type="email" data-fb-email placeholder="you@example.com">' +
            '<div class="modal-actions"><button class="btn btn-ghost" data-fb-cancel type="button">Cancel</button><button class="btn btn-primary" data-fb-send type="button">Send feedback</button></div>' +
            '<p class="demo-note">Demo form — submissions are saved locally for now and will connect to a Google Apps Script backend later.</p>' +
          '</div>' +
          '<div class="thanks" data-fb-thanks style="display:none;">' +
            '<div class="big">🙏</div><h3>Thank you!</h3>' +
            '<p class="sub">Your feedback was saved. Every note helps make this guide better and protects more buyers.</p>' +
            '<div class="modal-actions" style="justify-content:center;"><button class="btn btn-primary" data-fb-done type="button">Done</button></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      function openFb() { overlay.classList.add("open"); var m = overlay.querySelector("[data-fb-msg]"); if (m) setTimeout(function(){m.focus();},120); }
      function closeFb() { overlay.classList.remove("open"); }
      function resetFb() {
        overlay.querySelector("[data-fb-form]").style.display = "";
        overlay.querySelector("[data-fb-thanks]").style.display = "none";
        overlay.querySelector("[data-fb-msg]").value = "";
        overlay.querySelector("[data-fb-email]").value = "";
      }
      fab.addEventListener("click", openFb);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) closeFb(); });
      overlay.querySelector("[data-fb-cancel]").addEventListener("click", closeFb);
      overlay.querySelector("[data-fb-done]").addEventListener("click", function () { closeFb(); resetFb(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeFb(); });
      overlay.querySelector("[data-fb-send]").addEventListener("click", function () {
        var msgEl = overlay.querySelector("[data-fb-msg]");
        var msg = msgEl.value.trim();
        if (!msg) { msgEl.focus(); msgEl.style.borderColor = "var(--red)"; return; }
        msgEl.style.borderColor = "";
        var entry = {
          type: overlay.querySelector("[data-fb-type]").value,
          message: msg,
          email: overlay.querySelector("[data-fb-email]").value.trim(),
          page: location.pathname.split("/").pop() || "index.html",
          timestamp: new Date().toISOString()
        };
        try {
          var arr = JSON.parse(localStorage.getItem("lc-feedback") || "[]");
          arr.push(entry);
          localStorage.setItem("lc-feedback", JSON.stringify(arr));
        } catch (e) {}
        /* TODO (backend): POST to your Google Apps Script Web App URL, e.g.
           fetch("https://script.google.com/macros/s/XXXX/exec", {
             method: "POST", mode: "no-cors",
             headers: {"Content-Type": "application/json"},
             body: JSON.stringify(entry)
           }); */
        console.log("[LaptopCheck feedback]", entry);
        overlay.querySelector("[data-fb-form]").style.display = "none";
        overlay.querySelector("[data-fb-thanks]").style.display = "";
      });
    }

    /* footer year */
    var y = document.querySelector("[data-year]");
    if (y) y.textContent = new Date().getFullYear();
  });
})();
