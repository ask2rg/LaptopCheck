# 💻 LaptopCheck — Test a Used Laptop Before You Buy

A free, no-nonsense guide **and in-browser toolkit** for checking a second-hand **Windows** laptop before you hand over any money. Run a few commands, install a couple of trusted free tools, open a few tests — and walk away knowing exactly what you're paying for.

> Buying used usually means a real budget, and being sold a dud is gutting. LaptopCheck helps you catch the expensive problems — dying batteries and drives, overheating, screen defects, locked or stolen units, and dishonest specs — and turn what you find into a fair price.

**100% static. No build step. No tracking. No backend.** Everything runs in the browser; your progress and test results stay in your own browser's local storage.

---

## ✨ Features

- **7-stage guided inspection** — physical & ownership, display, input & ports, battery, storage, performance & thermals, and system/OS — each split into 🛠️ *Technical* checks (commands, free tools, websites) and 👁️ *General* checks (look & feel), with realistic first-timer time estimates.
- **⚡ Quick Essentials** — the fastest sensible full check (~25 min) plus a ~3-minute deal-breaker scan.
- **🧪 In-browser Test Toolkit** — real hardware tests that run client-side (see below), with a guided wizard and auto-saved results.
- **✅ Interactive checklist** — tick items off (progress + a time-spent timer persist locally), with a *Guide* link on every item and a red-flags + price-negotiation playbook.
- **Editorial, responsive UI** — book-style Table of Contents, serif display headings (Fraunces), collapsible left sidebar, and a **light / dark** theme toggle that remembers your choice.
- **OS switcher** in the nav (Windows today; macOS "coming soon").
- **Feedback widget** — a built-in form (currently saves locally; ready to wire to a Google Apps Script backend).

## 🧪 The in-browser Test Toolkit (`tester.html`)

Runs entirely in your browser — nothing is uploaded, including camera/mic streams.

| Test | What it checks | Browser API |
|------|----------------|-------------|
| Display | Dead/stuck pixels, backlight bleed, uniformity (fullscreen colour cycle) | Fullscreen API |
| Keyboard | Every key registers; sticky-key hints | `keydown`/`keyup` |
| Mouse / trackpad | Left/right/middle/double click, scroll, tracking | pointer/mouse events |
| Touchscreen | Draw to find dead zones; multi-touch count | Pointer/Touch events |
| Webcam | Live preview | `getUserMedia` |
| Microphone | Live input level meter | Web Audio `AnalyserNode` |
| Speakers | Left / right / both test tones | Web Audio `StereoPannerNode` |
| Refresh rate | Measured FPS / Hz | `requestAnimationFrame` |
| Battery | Charge level & charging state | Battery Status API* |
| Performance | Rough single-thread CPU indicator | `performance.now()` |
| Config panel | Cores, memory bucket, GPU, screen, DPR, touch, network | `navigator.*`, WebGL |

\* Battery level is supported mainly in Chromium browsers; **battery wear/health cannot be read from a browser** — use the `powercfg` report described in the Battery stage for that.

> ⚠️ **Honest scope:** the browser can only see *some* specs and can't read the true CPU model, full RAM size, disk S.M.A.R.T. health or battery wear. The toolkit is the fast convenience layer; the desktop tools below are the authoritative deep checks.

## 🔧 Free desktop tools referenced in the guide

- [CrystalDiskInfo](https://crystalmark.info/en/software/crystaldiskinfo/) — SSD/HDD S.M.A.R.T. health
- [BatteryInfoView](https://www.nirsoft.net/utils/battery_information_view.html) — battery wear & cycle count
- [HWiNFO](https://www.hwinfo.com/) — sensors & stress test
- [CPU-Z](https://www.cpuid.com/softwares/cpu-z.html) / [HWMonitor](https://www.cpuid.com/softwares/hwmonitor.html) — specs & temperatures
- Built-in Windows: `powercfg /batteryreport`, `msinfo32`, `dxdiag`, `mdsched`, `devmgmt.msc`, `slmgr /xpr`

## 📁 Project structure

```
laptop-test-guide/
├── index.html          # Home — overview + Table of Contents
├── quick.html          # Quick essentials + deal-breaker scan
├── tester.html         # 🧪 In-browser test toolkit
├── inspection.html     # Stage 1 — physical & ownership
├── display.html        # Stage 2 — display & screen
├── input.html          # Stage 3 — keyboard, ports & A/V
├── battery.html        # Stage 4 — battery health
├── storage.html        # Stage 5 — storage & drive health
├── performance.html    # Stage 6 — performance & thermals
├── system.html         # Stage 7 — system, Windows & drivers
├── checklist.html      # Final checklist + red flags + price playbook
└── assets/
    ├── style.css       # Shared design system, sidebar, themes
    ├── script.js       # Theme, sidebar, nav, copy buttons, timer, feedback
    ├── tester.css      # Toolkit styles
    └── tester.js       # Toolkit logic (tests + config + persistence)
```

## 🚀 Getting started

It's plain HTML/CSS/JS — no install or build required.

**Just open it:** double-click `index.html`. (A couple of tests — camera/mic — and the Fullscreen API work best when served over `http(s)` rather than `file://`.)

**Run a local server (recommended):**

```bash
# Python 3
python -m http.server 8000
# or Node
npx serve .
```

Then visit `http://localhost:8000`.

## 🌐 Deploy

Any static host works:

- **GitHub Pages** — push the repo, enable Pages on the `main` branch (root).
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the folder, or connect the repo (no build command, output dir = root).

## 💬 Wiring up the feedback form (optional)

The feedback widget currently stores submissions in `localStorage` and logs them to the console. To collect them centrally, point it at a [Google Apps Script Web App](https://developers.google.com/apps-script/guides/web):

1. Create an Apps Script bound to a Google Sheet with a `doPost(e)` that appends `JSON.parse(e.postData.contents)` as a row, and **Deploy → Web app** (Execute as *Me*, access *Anyone*).
2. In `assets/script.js`, find the `TODO (backend)` comment in the feedback handler and uncomment the `fetch(...)` call, pasting your Web App URL.

## 🗺️ Roadmap

- [ ] macOS guide (coconutBattery, built-in tools) — the nav switch is already stubbed
- [ ] Linux / Chromebook notes
- [ ] Connect feedback to Google Apps Script
- [ ] Optional printable / PDF one-page checklist
- [ ] i18n (translations)

## 🤝 Contributing

Contributions are very welcome — especially additional checks people wish they'd made, model-specific gotchas, and translations.

1. Fork and create a branch: `git checkout -b feature/your-idea`
2. Keep it dependency-free (vanilla HTML/CSS/JS; no frameworks/build step).
3. Match the existing design tokens in `style.css` (CSS variables) and the prose style.
4. Test in light & dark mode and on mobile.
5. Open a PR describing the change.

## 🧭 Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Some toolkit tests depend on APIs with partial support (Battery Status, `deviceMemory`, WebGL renderer info) and degrade gracefully with a note when unavailable.

## ⚖️ Disclaimer

Educational guide only — not affiliated with any tool vendor; tool names are trademarks of their respective owners. No test can guarantee the future condition of a used device. Always download software from official sources and respect local laws when verifying a device's ownership.

## 📝 License

Released under the [MIT License](LICENSE). You're free to use, modify, and distribute it — attribution appreciated.

---

*Made to help people buying on a budget avoid getting burned. If it saved you from a bad deal, consider starring the repo. ⭐*
