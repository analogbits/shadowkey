# The Elder Scrolls Travels: Shadowkey (Web Version)

Play **The Elder Scrolls Travels: Shadowkey** (2004, Nokia N-Gage) directly in modern web browsers via WebAssembly.

Hosted online on GitHub Pages: **[https://analogbits.github.io/shadowkey/](https://analogbits.github.io/shadowkey/)**

---

## What's New in this Build

- **Split Handheld Chassis:** An authentic N-Gage console shell with a dedicated D-Pad & Left Menu wing, upscaled central display, and an Action & Keypad wing.
- **Natural PC Controls (WASD + Space):** Move with `W/A/S/D` or Arrow Keys, attack with `Space` or `Enter`, cast spells with `7`, and open menus with `Q` and `E`.
- **Keyboard Badges on Buttons:** Every button shows its corresponding keyboard shortcut and game function directly on the button face.
- **Integer Upscaling Modes:** One-click toggling between `2x` (352×416), `3x` (528×624, Default), `4x` (704×832), and `Fit Window`.
- **Retro LCD Filter:** Toggleable authentic retro LCD subpixel grid and scanline overlay.
- **Persistent Local Saves:** Automatic sync to IndexedDB with one-click JSON backup export and restore.
- **Zero Click-to-Focus Friction:** Keyboard controls now work seamlessly without requiring you to click inside the canvas first.

---

## Controls

| Action | PC Keyboard | Handheld Keypad |
| :--- | :--- | :--- |
| **Move / Walk / Strafe** | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | D-Pad |
| **Attack / Confirm / Action** | <kbd>Space</kbd> or <kbd>Enter</kbd> | Keypad **5** or Center **OK** |
| **Cast Active Spell** | <kbd>7</kbd> | Keypad **7** |
| **Look Up / Look Down** | <kbd>2</kbd> / <kbd>8</kbd> | Keypad **2** / **8** |
| **Turn Left / Turn Right** | <kbd>4</kbd> / <kbd>6</kbd> | Keypad **4** / **6** |
| **Map & Quest Log** | <kbd>1</kbd> | Keypad **1** |
| **Character Stats** | <kbd>3</kbd> | Keypad **3** |
| **Rest / Camp** | <kbd>9</kbd> | Keypad **9** |
| **Left Softkey (System Menu)** | <kbd>Q</kbd> or <kbd>F1</kbd> | Left Menu button |
| **Right Softkey (Inventory)** | <kbd>E</kbd> or <kbd>F2</kbd> or <kbd>Esc</kbd> | Right Menu button |

---

## Display & Upscaling Presets

- **2x (352×416):** Compact integer scale.
- **3x (528×624):** Default balanced high-resolution integer scale for laptops and desktop monitors.
- **4x (704×832):** Maximum high-res crisp integer presentation.
- **Fit:** Proportional aspect-ratio fit matching browser window dimensions.
- **Sharp vs. LCD vs. Smooth:** Switch between pixel-perfect nearest neighbor, authentic backlit LCD matrix scanlines, or smoothed bilinear filtering.

---

## Credits & License

- **The Elder Scrolls Travels: Shadowkey** © 2004 Bethesda Softworks LLC / Vir2L Studios / SilverBack Entertainment.
- **EKA2L1 Emulator Core:** Licensed under the GNU Affero General Public License v3 (AGPL-3.0). See [LICENSE.txt](LICENSE.txt).
- WebAssembly port based on work by [zixing131/EKA2L1-WEB](https://github.com/zixing131/EKA2L1-WEB).
