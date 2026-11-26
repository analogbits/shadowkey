# The Elder Scrolls Travels: Shadowkey (Web Version)

Play **The Elder Scrolls Travels: Shadowkey** (2004, Nokia N-Gage) directly in modern web browsers via WebAssembly.

Hosted online on GitHub Pages: **[https://analogbits.github.io/shadowkey/](https://analogbits.github.io/shadowkey/)**

---

## Features

- **Zero Install:** Runs directly in Chrome, Firefox, Safari, and Edge on desktop and mobile.
- **Hardware Acceleration & WASM:** Powered by a WebAssembly build of the [EKA2L1](https://github.com/EKA2L1/EKA2L1) Symbian OS emulator via [EKA2L1-WEB](https://github.com/zixing131/EKA2L1-WEB).
- **Persistent Local Saves:** Game progress is automatically synchronized to your browser's IndexedDB storage.
- **Save Backup & Restore:** Export your game save states as a JSON backup at any time, or import existing saves.
- **Responsive Controls:** Full physical keyboard bindings, on-screen clickable keypad, and mobile touch support.
- **GitHub Pages Ready:** Includes `coi-serviceworker.js` to enable `SharedArrayBuffer` and `crossOriginIsolated` on static hosts without server-side header configuration.

---

## Controls

| Action | Keyboard | On-Screen / Touch |
| :--- | :--- | :--- |
| **Move / Look (D-Pad)** | <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> (Arrow Keys) | Directional buttons |
| **Action / Attack / OK** | <kbd>Enter</kbd> | Center **OK** button |
| **Left Menu (Softkey 1)** | <kbd>F1</kbd> | Left Menu button |
| **Right Menu (Softkey 2)** | <kbd>F2</kbd> or <kbd>Esc</kbd> | Right Menu button |
| **Number Keys (1–9, 0)** | <kbd>0</kbd> – <kbd>9</kbd> | Number keypad |
| **Star (\*) / Hash (#)** | <kbd>[</kbd> / <kbd>]</kbd> (or <kbd>*</kbd> / <kbd>#</kbd>) | <kbd>*</kbd> and <kbd>#</kbd> buttons |
| **Clear / Back** | <kbd>Backspace</kbd> | — |

---

## How to Enable on GitHub Pages

1. In your GitHub repository (`analogbits/shadowkey`), click on **Settings** (top tab).
2. On the left sidebar, click **Pages** (under *Code and automation*).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`
   - **Branch**: Select `main` and folder `/ (root)`
   - Click **Save**
4. Wait 1–2 minutes for GitHub Actions to build and deploy.
5. Your game will be live at:
   ```
   https://analogbits.github.io/shadowkey/
   ```

---

## Technical Details

- **WASM Core:** `eka2l1.wasm` and `eka2l1.js` compiled via Emscripten.
- **COOP/COEP Headers:** Emscripten's multithreading and high-performance audio/video loops require `SharedArrayBuffer`. Because GitHub Pages does not allow custom response headers, [`coi-serviceworker.js`](https://github.com/gzuidhof/coi-serviceworker) is used to intercept requests and inject `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on the fly.
- **Storage:** Mounts the Emscripten IDBFS filesystem at `/eka2l1/drives/c`, maintaining persistent saves between sessions.

---

## Credits & License

- **The Elder Scrolls Travels: Shadowkey** © 2004 Bethesda Softworks LLC / Vir2L Studios / SilverBack Entertainment.
- **EKA2L1 Emulator Core:** Licensed under the GNU Affero General Public License v3 (AGPL-3.0). See [LICENSE.txt](LICENSE.txt).
- WebAssembly port based on work by [zixing131/EKA2L1-WEB](https://github.com/zixing131/EKA2L1-WEB).
