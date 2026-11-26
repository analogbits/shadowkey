'use strict';
const $ = id => document.getElementById(id);
const SAVE_ROOT = '/eka2l1/drives/c';
const acceleration = 0;
let mod, running = false, paused = false, muted = false, syncing, imported;
const pressed = new Map(), keyTimes = new Map(), releaseTimers = new Map(), lines = [];

function log(value) {
  const text = String(value);
  if (/\[perf\]|\[jit\]|NULL\.wav|dyncom yielded/.test(text)) return;
  lines.push(text); if (lines.length > 50) lines.shift();
  if ($('log')) $('log').textContent = lines.join('\n');
}

function progress(value, text) {
  if ($('progress')) { $('progress').hidden = false; $('progress').value = value; }
  if ($('overlay-text')) $('overlay-text').textContent = text;
  if ($('status')) $('status').textContent = text;
}

function fail(error) {
  running = false;
  if ($('overlay')) $('overlay').hidden = false;
  document.querySelectorAll('[data-scan]').forEach(button => { button.disabled = true; });
  if ($('overlay-title')) $('overlay-title').textContent = 'Unable to start Shadowkey';
  if ($('overlay-text')) $('overlay-text').textContent = String(error?.message || error);
  if ($('status')) $('status').textContent = 'Stopped';
  if ($('progress')) $('progress').hidden = true;
  if ($('start')) {
    $('start').hidden = false;
    $('start').textContent = 'Reload and retry';
    $('start').onclick = () => location.reload();
  }
  log(error?.stack || error);
}

function call(name, ret = null, types = [], args = []) { return mod.ccall(name, ret, types, args); }

function sync(populate = false) {
  if (syncing) return syncing;
  syncing = new Promise((resolve, reject) => mod.FS.syncfs(populate, e => e ? reject(e) : resolve()));
  return syncing.finally(() => { syncing = null; });
}

async function persist() {
  if (!mod) return;
  try {
    await sync();
  } catch (e) {
    if ($('message')) $('message').textContent = 'Browser storage could not be updated. Export saves to keep a backup.';
    log(e);
  }
}

function loadScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'eka2l1.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('The emulator download failed. Reload to retry.'));
    document.head.append(script);
  });
}

function extract(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0, count = 0;
  while (p + 30 <= bytes.length && view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true), n = view.getUint16(p + 26, true), extra = view.getUint16(p + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + n));
    const start = p + 30 + n + extra, end = start + size;
    if (view.getUint16(p + 8, true) !== 0 || end > bytes.length || !name || name.split('/').some(x => x === '..') || name.startsWith('/') || name.includes('\\')) throw new Error('Invalid game-data package.');
    const path = '/eka2l1/' + name;
    if (!(name.startsWith('drives/c/') && mod.FS.analyzePath(path).exists)) {
      mod.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
      mod.FS.writeFile(path, bytes.subarray(start, end));
    }
    p = end; count++;
  }
  if (count < 100 || !mod.FS.analyzePath('/eka2l1/roms/rh-29/SYM.ROM').exists) throw new Error('The game-data package is incomplete.');
}

function saveFiles() {
  const result = [];
  function visit(path) {
    for (const name of mod.FS.readdir(path)) {
      if (name === '.' || name === '..') continue;
      const child = path + '/' + name, st = mod.FS.stat(child);
      if (mod.FS.isDir(st.mode)) visit(child);
      else if (/^system\/apps\/6r51\//i.test(child.slice(SAVE_ROOT.length + 1))) {
        const bytes = mod.FS.readFile(child);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        result.push({path: child.slice(SAVE_ROOT.length + 1), data: btoa(binary)});
      }
    }
  }
  visit(SAVE_ROOT);
  return result;
}

function exportSaves(suffix = '') {
  const blob = new Blob([JSON.stringify({format: 'ynnarg-shadowkey-saves', version: 1, files: saveFiles()})], {type: 'application/json'});
  const link = document.createElement('a'), url = URL.createObjectURL(blob);
  link.href = url;
  link.download = 'shadowkey-saves' + suffix + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if ($('import')) {
  $('import').addEventListener('change', async e => {
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 16 * 1024 * 1024) throw new Error('The save file is too large.');
      const data = JSON.parse(await file.text());
      if (data.format !== 'ynnarg-shadowkey-saves' || data.version !== 1 || !Array.isArray(data.files) || data.files.length > 256) throw new Error('Select a Shadowkey save export.');
      let total = 0;
      for (const f of data.files) {
        if (typeof f.path !== 'string' || !/^System\/Apps\/6R51\/[^/\\]+$/i.test(f.path) || f.path.split('/').some(p => p === '.' || p === '..') || typeof f.data !== 'string') throw new Error('Invalid save entry.');
        total += atob(f.data).length; if (total > 8 * 1024 * 1024) throw new Error('The save data is too large.');
      }
      imported = data.files;
      if ($('message')) $('message').textContent = 'Save import prepared. Start the game to apply it.';
    } catch (e) {
      imported = null;
      if ($('message')) $('message').textContent = e.message;
    }
  });
}

// Display Scaling & Shader Filters
function initDisplayOptions() {
  const savedScale = localStorage.getItem('shadowkey-scale') || '3x';
  const savedFilter = localStorage.getItem('shadowkey-filter') || 'sharp';
  setScale(savedScale);
  setFilter(savedFilter);

  document.querySelectorAll('[data-scale]').forEach(btn => {
    btn.onclick = () => setScale(btn.dataset.scale);
  });
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.onclick = () => setFilter(btn.dataset.filter);
  });
}

function setScale(scale) {
  const canvas = $('canvas');
  if (!canvas) return;
  canvas.classList.remove('scale-2x', 'scale-3x', 'scale-4x', 'scale-fit');
  canvas.classList.add('scale-' + scale);
  document.querySelectorAll('[data-scale]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scale === scale);
  });
  localStorage.setItem('shadowkey-scale', scale);
}

function setFilter(filter) {
  const canvas = $('canvas');
  const crt = $('crt-overlay');
  if (!canvas) return;
  canvas.classList.remove('filter-sharp', 'filter-smooth');
  canvas.classList.add(filter === 'smooth' ? 'filter-smooth' : 'filter-sharp');
  if (crt) crt.hidden = (filter !== 'crt');
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  localStorage.setItem('shadowkey-filter', filter);
}

async function boot() {
  if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    progress(10, 'Activating security context for emulator…');
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        window.location.reload();
        return;
      }
      try {
        await navigator.serviceWorker.ready;
        window.location.reload();
        return;
      } catch (e) {
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
    }
    throw new Error('This browser could not enable the emulator. Open this page directly over HTTPS in a modern browser (Chrome, Edge, Safari, Firefox).');
  }

  if (!window.WebAssembly || !window.DecompressionStream) {
    throw new Error('This browser does not support the required emulator features.');
  }

  progress(5, 'Loading emulator…');
  await loadScript();

  mod = await createEKA2L1Module({
    canvas: $('canvas'),
    noInitialRun: true,
    locateFile: name => name,
    print: log,
    printErr: log,
    onAbort: why => fail(new Error(String(why)))
  });

  call('wasm_set_jit', null, ['number'], [acceleration]);
  mod.FS.mkdirTree(SAVE_ROOT);
  mod.FS.mount(mod.FS.filesystems.IDBFS, {}, SAVE_ROOT);
  
  progress(25, 'Restoring local saves…');
  await sync(true);

  progress(35, 'Loading game data…');
  const response = await fetch('game.zip.gz?v=7');
  if (!response.ok || !response.body) throw new Error('The game-data download failed. Reload to retry.');
  extract(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));

  if (imported) {
    if (saveFiles().length) exportSaves('-before-import');
    for (const file of imported) {
      const path = SAVE_ROOT + '/System/Apps/6R51/' + file.path.split('/').pop();
      mod.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
      mod.FS.writeFile(path, Uint8Array.from(atob(file.data), c => c.charCodeAt(0)));
    }
    await sync();
    if ($('message')) $('message').textContent = 'Saves imported.';
  }

  mod.FS.writeFile('/eka2l1/config.yml', 'cpu: dyncom\ndevice: 0\nlanguage: 1\nenable-nearest-neighbor-filter: true\n');
  progress(75, 'Starting N-Gage…');

  try {
    mod.callMain([]);
  } catch (e) {
    if (e !== 'unwind' && e?.name !== 'ExitStatus') throw e;
  }

  call('wasm_set_jit', null, ['number'], [acceleration]);
  const init = call('wasm_init_with_rom', 'number', ['string', 'string'], ['', '']);
  if (init !== 0) throw new Error('N-Gage initialization failed (' + init + ').');

  call('wasm_set_screen_rotation', null, ['number'], [0]);
  const launch = call('wasm_launch_app', 'number', ['number'], [270521334]);
  if (launch !== 0) throw new Error('Shadowkey could not be launched (' + launch + ').');

  running = true;
  document.querySelectorAll('[data-scan]').forEach(button => { button.disabled = false; });
  if ($('pause')) $('pause').disabled = false;
  if ($('sound')) $('sound').disabled = false;
  if ($('export')) $('export').disabled = false;
  if ($('import')) $('import').disabled = true;
  if ($('overlay')) $('overlay').hidden = true;
  if ($('status')) $('status').textContent = 'Running';
  $('canvas').focus({preventScroll:true});

  await persist();
  setInterval(() => { if (running) void persist(); }, 15000);

  const startedAt = performance.now();
  const monitor = setInterval(() => {
    if (!running) { clearInterval(monitor); return; }
    const info = JSON.parse(call('wasm_last_app_exit', 'string') || '{}');
    if (info.exited) { clearInterval(monitor); fail(new Error('The game stopped. Export saves before reloading.')); return; }
    const fps = call('wasm_get_fps', 'number');
    const redraws = call('wasm_get_redraw_count', 'number');
    if ($('status')) {
      $('status').textContent = paused ? 'Paused' : redraws > 0 ? (fps > 0 ? `Running (${fps} FPS)` : 'Running') : 'Starting game…';
    }
    if (!redraws && performance.now() - startedAt > 120000) fail(new Error('The game did not produce a display. Reload to retry.'));
    document.title = 'The Elder Scrolls Travels: Shadowkey';
  }, 1000);
}

function unlockAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      if (!window.__globalAudioCtx) {
        window.__globalAudioCtx = new AudioContext();
      }
      if (window.__globalAudioCtx.state === 'suspended' || window.__globalAudioCtx.state === 'interrupted') {
        window.__globalAudioCtx.resume().catch(() => {});
      }
    }
    if (window.__ekAudio?.ctx && (window.__ekAudio.ctx.state === 'suspended' || window.__ekAudio.ctx.state === 'interrupted')) {
      window.__ekAudio.ctx.resume().catch(() => {});
    }
  } catch (e) {}
}

function setPaused(shouldPause) {
  if (!running) return;
  paused = Boolean(shouldPause);
  releaseKeys();
  call('wasm_set_paused', null, ['number'], [Number(paused)]);
  if ($('pause')) $('pause').textContent = paused ? 'Resume' : 'Pause';
  if ($('status')) $('status').textContent = paused ? 'Paused' : 'Running';
  if ($('pause-overlay')) $('pause-overlay').hidden = !paused;
  unlockAudio();
  void persist();
  if (!paused) {
    $('canvas')?.focus({preventScroll:true});
  }
}

['touchstart', 'touchend', 'pointerdown', 'click'].forEach(evt => {
  window.addEventListener(evt, unlockAudio, { passive: true });
});

if ($('pause-overlay')) {
  $('pause-overlay').addEventListener('pointerdown', e => {
    e.preventDefault();
    setPaused(false);
  });
}

if ($('stage')) {
  $('stage').addEventListener('pointerdown', () => {
    unlockAudio();
    if (paused) setPaused(false);
  });
}

if ($('start')) {
  $('start').onclick = () => {
    unlockAudio();
    $('start').hidden = true;
    if (navigator.locks) {
      navigator.locks.request('ynnarg-shadowkey-saves', {ifAvailable: true}, async lock => {
        if (!lock) { fail(new Error('Shadowkey is already open in another tab. Close that session, then reload this page.')); return; }
        try { await boot(); await new Promise(() => {}); } catch (e) { fail(e); }
      }).catch(fail);
    } else {
      boot().catch(fail);
    }
  };
}

function keyDown(scan, source) {
  clearTimeout(releaseTimers.get(source));
  releaseTimers.delete(source);
  if (!running) return;
  if (paused) {
    setPaused(false);
  }
  if (pressed.has(source)) return;
  if (![...pressed.values()].includes(scan)) call('wasm_send_key', null, ['number', 'number'], [scan, 1]);
  pressed.set(source, scan);
  keyTimes.set(source, performance.now());
  log('Input down: ' + scan);
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}

function keyUp(source, force = false) {
  const scan = pressed.get(source);
  if (!scan) return;
  const remaining = 90 - (performance.now() - keyTimes.get(source));
  if (!force && remaining > 0) {
    clearTimeout(releaseTimers.get(source));
    releaseTimers.set(source, setTimeout(() => keyUp(source, true), remaining));
    return;
  }
  clearTimeout(releaseTimers.get(source));
  releaseTimers.delete(source);
  pressed.delete(source);
  keyTimes.delete(source);
  log('Input up: ' + scan);
  if (![...pressed.values()].includes(scan)) call('wasm_send_key', null, ['number', 'number'], [scan, 0]);
}

function releaseKeys() {
  for (const source of [...pressed.keys()]) keyUp(source, true);
  document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed'));
}

// MacBook Pro & PC Keyboard Mapping
const keyMap = {
  // Movement (WASD & Inverted-T Arrows)
  ArrowUp: 16, w: 16, W: 16,
  ArrowDown: 17, s: 17, S: 17,
  ArrowLeft: 14, a: 14, A: 14,
  ArrowRight: 15, d: 15, D: 15,

  // Camera & Turning (IJKL)
  i: 50, I: 50,          // Look Up (Key 2)
  k: 56, K: 56,          // Look Down (Key 8)
  j: 52, J: 52,          // Turn Left (Key 4)
  l: 54, L: 54,          // Turn Right (Key 6)

  // Actions & Combat
  ' ': 167,              // Space = Attack / Interact
  Enter: 167,            // Return = Confirm / Attack
  f: 55, F: 55,          // F = Cast Spell (Key 7)

  // Menus & Interface (Mac friendly: Esc, Tab, Q, E)
  Escape: 164,           // esc = System Menu (Left Softkey)
  q: 164, Q: 164,        // Q = System Menu
  F1: 164,
  Tab: 165,              // tab = Inventory / Back (Right Softkey)
  e: 165, E: 165,        // E = Inventory
  F2: 165,

  // RPG Hotkeys
  m: 49, M: 49,          // M = Map & Journal (Key 1)
  c: 51, C: 51,          // C = Character Stats (Key 3)
  r: 57, R: 57,          // R = Rest / Camp (Key 9)

  // Standard N-Gage Keypad Numbers & Symbols
  Backspace: 1,
  '[': 133, '*': 133,
  ']': 127, '#': 127
};
for (let i = 0; i < 10; i++) keyMap[String(i)] = 48 + i;

for (const name of ['keydown', 'keyup']) {
  window.addEventListener(name, e => {
    if (!running || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const scan = keyMap[e.key];
    if (!scan) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (name === 'keydown') {
      window.__ekAudio?.ctx?.resume();
      keyDown(scan, 'key:' + e.code);
      // Highlight matching on-screen button
      document.querySelectorAll(`[data-scan="${scan}"]`).forEach(b => b.classList.add('pressed'));
    } else {
      keyUp('key:' + e.code);
      document.querySelectorAll(`[data-scan="${scan}"]`).forEach(b => b.classList.remove('pressed'));
    }
  }, true);
}

// On-screen clickable buttons with robust multi-touch support
document.querySelectorAll('[data-scan]').forEach(button => {
  button.disabled = true;
  const scan = Number(button.dataset.scan);
  if (!scan) return;

  const activePointers = new Set();

  const press = (pointerId) => {
    unlockAudio();
    activePointers.add(pointerId);
    keyDown(scan, 'btn:' + scan + ':' + pointerId);
    button.classList.add('pressed');
  };

  const release = (pointerId) => {
    activePointers.delete(pointerId);
    keyUp('btn:' + scan + ':' + pointerId);
    if (activePointers.size === 0) {
      button.classList.remove('pressed');
    }
  };

  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { button.setPointerCapture(e.pointerId); } catch {}
    press(e.pointerId);
  });

  button.addEventListener('pointerup', e => {
    e.preventDefault();
    release(e.pointerId);
  });

  button.addEventListener('pointercancel', e => {
    e.preventDefault();
    release(e.pointerId);
  });

  button.addEventListener('lostpointercapture', e => {
    release(e.pointerId);
  });

  button.addEventListener('pointerleave', e => {
    if (!button.hasPointerCapture || !button.hasPointerCapture(e.pointerId)) {
      release(e.pointerId);
    }
  });

  button.addEventListener('contextmenu', e => e.preventDefault());
});

if ($('pause')) {
  $('pause').onclick = () => {
    setPaused(!paused);
  };
}

if ($('sound')) {
  $('sound').onclick = () => {
    muted = !muted;
    unlockAudio();
    call('wasm_set_volume', null, ['number'], [muted ? 0 : 100]);
    $('sound').textContent = muted ? 'Unmute' : 'Mute';
    $('sound').setAttribute('aria-pressed', String(muted));
  };
}

if ($('fullscreen')) {
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        document.body.classList.remove('mobile-fullscreen');
      } else if ($('stage') && ($('stage').requestFullscreen || $('stage').webkitRequestFullscreen)) {
        if ($('stage').requestFullscreen) await $('stage').requestFullscreen();
        else if ($('stage').webkitRequestFullscreen) await $('stage').webkitRequestFullscreen();
      } else {
        document.body.classList.toggle('mobile-fullscreen');
        window.scrollTo(0, 0);
      }
      $('canvas')?.focus({preventScroll:true});
    } catch {
      document.body.classList.toggle('mobile-fullscreen');
      window.scrollTo(0, 0);
    }
  };
}

if ($('export')) {
  $('export').onclick = () => {
    releaseKeys();
    exportSaves();
    void persist();
    if ($('message')) $('message').textContent = 'Save backup exported to your downloads.';
  };
}

// Window focus, sleep/wake, and visibility management
window.addEventListener('blur', releaseKeys);

window.addEventListener('focus', () => {
  unlockAudio();
  releaseKeys();
  if (running && paused) {
    setPaused(false);
  }
});

window.addEventListener('pageshow', () => {
  unlockAudio();
  releaseKeys();
  if (running && paused) {
    setPaused(false);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseKeys();
    void persist();
  } else {
    unlockAudio();
    releaseKeys();
    if (running && paused) {
      setPaused(false);
    }
    $('canvas')?.focus({preventScroll:true});
  }
});

window.addEventListener('pagehide', () => { releaseKeys(); void persist(); });

// Sleep & system wake watchdog: detect time skips caused by macOS laptop sleep
let lastHeartbeat = performance.now();
setInterval(() => {
  const now = performance.now();
  const delta = now - lastHeartbeat;
  lastHeartbeat = now;
  if (delta > 3500) {
    log('System wake detected (sleep gap: ' + Math.round(delta / 1000) + 's)');
    unlockAudio();
    releaseKeys();
    if (running) {
      setPaused(false);
    }
  }
}, 1000);

if ($('diagnose')) {
  $('diagnose').onclick = () => { if (mod) call('wasm_debug_dump'); };
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', initDisplayOptions);
