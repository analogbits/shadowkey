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
  $('log').textContent = lines.join('\n');
}
function progress(value, text) {
  $('progress').hidden = false; $('progress').value = value;
  $('overlay-text').textContent = text; $('status').textContent = text;
}
function fail(error) {
  running = false; $('overlay').hidden = false;
  document.querySelectorAll('[data-scan]').forEach(button => { button.disabled = true; });
  $('overlay-title').textContent = 'Unable to start Shadowkey';
  $('overlay-text').textContent = String(error?.message || error);
  $('status').textContent = 'Stopped'; $('progress').hidden = true;
  $('start').hidden = false; $('start').textContent = 'Reload and retry';
  $('start').onclick = () => location.reload(); log(error?.stack || error);
}
function call(name, ret = null, types = [], args = []) { return mod.ccall(name, ret, types, args); }
function sync(populate = false) {
  if (syncing) return syncing;
  syncing = new Promise((resolve, reject) => mod.FS.syncfs(populate, e => e ? reject(e) : resolve()));
  return syncing.finally(() => { syncing = null; });
}
async function persist() {
  if (!mod) return;
  try { await sync(); }
  catch (e) { $('message').textContent = 'Browser storage could not be updated. Export saves to keep a backup.'; log(e); }
}
function loadScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'eka2l1.js';
    script.onload = resolve; script.onerror = () => reject(new Error('The emulator download failed. Reload to retry.'));
    document.head.append(script);
  });
}
// Stored ZIP inside gzip: no additional ZIP runtime, and bounded installation paths.
function extract(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0, count = 0;
  while (p + 30 <= bytes.length && view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true), n = view.getUint16(p + 26, true), extra = view.getUint16(p + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + n));
    const start = p + 30 + n + extra, end = start + size;
    if (view.getUint16(p + 8, true) !== 0 || end > bytes.length || !name || name.split('/').some(x => x === '..') || name.startsWith('/') || name.includes('\\')) throw new Error('Invalid game-data package.');
    const path = '/eka2l1/' + name;
    // Seed baseline C-drive settings without replacing a visitor's saved files.
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
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        result.push({path: child.slice(SAVE_ROOT.length + 1), data: btoa(binary)});
      }
    }
  }
  visit(SAVE_ROOT); return result;
}
function exportSaves(suffix = '') {
  const blob = new Blob([JSON.stringify({format: 'ynnarg-shadowkey-saves', version: 1, files: saveFiles()})], {type: 'application/json'});
  const link = document.createElement('a'), url = URL.createObjectURL(blob);
  link.href = url; link.download = 'shadowkey-saves' + suffix + '.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
    imported = data.files; $('message').textContent = 'Save import prepared. Start the game to apply it. Existing saves will be exported as a backup first.';
  } catch (e) { imported = null; $('message').textContent = e.message; }
});
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
  if (!window.WebAssembly || !window.DecompressionStream) throw new Error('This browser does not support the required emulator features.');
  progress(5, 'Loading emulator…'); await loadScript();
  mod = await createEKA2L1Module({canvas: $('canvas'), noInitialRun: true, locateFile: name => name,
    print: log, printErr: log, onAbort: why => fail(new Error(String(why)))});
  // Shadowkey is verified with the ARM interpreter; the experimental JIT is disabled.
  call('wasm_set_jit', null, ['number'], [acceleration]);
  mod.FS.mkdirTree(SAVE_ROOT); mod.FS.mount(mod.FS.filesystems.IDBFS, {}, SAVE_ROOT);
  progress(25, 'Restoring local saves…'); await sync(true);
  progress(35, 'Loading game data…');
  const response = await fetch('game.zip.gz');
  if (!response.ok || !response.body) throw new Error('The game-data download failed. Reload to retry.');
  extract(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));
  if (imported) {
    if (saveFiles().length) exportSaves('-before-import');
    for (const file of imported) {
      const path = SAVE_ROOT + '/System/Apps/6R51/' + file.path.split('/').pop();
      mod.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
      mod.FS.writeFile(path, Uint8Array.from(atob(file.data), c => c.charCodeAt(0)));
    }
    await sync(); $('message').textContent = 'Saves imported.';
  }
  mod.FS.writeFile('/eka2l1/config.yml', 'cpu: dyncom\ndevice: 0\nlanguage: 1\nenable-nearest-neighbor-filter: true\n');
  progress(75, 'Starting N-Gage…');
  try { mod.callMain([]); } catch (e) { if (e !== 'unwind' && e?.name !== 'ExitStatus') throw e; }
  call('wasm_set_jit', null, ['number'], [acceleration]);
  const init = call('wasm_init_with_rom', 'number', ['string', 'string'], ['', '']);
  if (init !== 0) throw new Error('N-Gage initialization failed (' + init + ').');
  // The pinned frontend starts with a 360x640 window. Refit it to the N-Gage
  // screen aspect ratio so the guest picture fills the displayed canvas.
  call('wasm_set_screen_rotation', null, ['number'], [0]);
  const launch = call('wasm_launch_app', 'number', ['number'], [270521334]);
  if (launch !== 0) throw new Error('Shadowkey could not be launched (' + launch + ').');
  running = true;
  document.querySelectorAll('[data-scan]').forEach(button => { button.disabled = false; });
  $('pause').disabled = false; $('sound').disabled = false; $('export').disabled = false; $('import').disabled = true;
  $('overlay').hidden = true; $('status').textContent = 'Starting game…'; $('canvas').focus({preventScroll:true});
  await persist();
  setInterval(() => { if (running) void persist(); }, 15000);
  const startedAt = performance.now();
  const monitor = setInterval(() => {
    if (!running) { clearInterval(monitor); return; }
    const info = JSON.parse(call('wasm_last_app_exit', 'string') || '{}');
    if (info.exited) { clearInterval(monitor); fail(new Error('The game stopped. Export saves before reloading.')); return; }
    const fps = call('wasm_get_fps', 'number');
    const redraws = call('wasm_get_redraw_count', 'number');
    $('status').textContent = paused ? 'Paused' : redraws > 0 ? 'Running' : 'Starting game…';
    if (!redraws && performance.now() - startedAt > 120000) fail(new Error('The game did not produce a display. Reload to retry.'));
    document.title = 'The Elder Scrolls Travels: Shadowkey';
  }, 1000);
}
$('start').onclick = () => {
  $('start').hidden = true;
  if (navigator.locks) navigator.locks.request('ynnarg-shadowkey-saves', {ifAvailable: true}, async lock => {
    if (!lock) { fail(new Error('Shadowkey is already open in another tab. Close that session, then reload this page.')); return; }
    try { await boot(); await new Promise(() => {}); } catch (e) { fail(e); }
  }).catch(fail);
  else boot().catch(fail);
};
function keyDown(scan, source) {
  clearTimeout(releaseTimers.get(source)); releaseTimers.delete(source);
  if (!running || paused || pressed.has(source)) return;
  if (![...pressed.values()].includes(scan)) call('wasm_send_key', null, ['number', 'number'], [scan, 1]);
  pressed.set(source, scan); keyTimes.set(source, performance.now());
  log('Input down: ' + scan);
}
function keyUp(source, force = false) {
  const scan = pressed.get(source); if (!scan) return;
  // Native games poll held keys. A synthetic click may end before the guest
  // gets a CPU slice; preserve a short tap for at least one emulated frame.
  const remaining = 90 - (performance.now() - keyTimes.get(source));
  if (!force && remaining > 0) { clearTimeout(releaseTimers.get(source)); releaseTimers.set(source, setTimeout(() => keyUp(source, true), remaining)); return; }
  clearTimeout(releaseTimers.get(source)); releaseTimers.delete(source);
  pressed.delete(source); keyTimes.delete(source);
  log('Input up: ' + scan);
  if (![...pressed.values()].includes(scan)) call('wasm_send_key', null, ['number', 'number'], [scan, 0]);
}
function releaseKeys() { for (const source of [...pressed.keys()]) keyUp(source, true); document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed')); }
const keyMap = {ArrowUp:16, ArrowDown:17, ArrowLeft:14, ArrowRight:15, Enter:167, F1:164, F2:165, Escape:165, Backspace:1, '[':133, ']':127, '*':133, '#':127};
for (let i = 0; i < 10; i++) keyMap[String(i)] = 48 + i;
for (const name of ['keydown', 'keyup']) window.addEventListener(name, e => {
  if (!running || e.target !== $('canvas') || e.ctrlKey || e.metaKey || e.altKey) return;
  const scan = keyMap[e.key]; if (!scan) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (name === 'keydown') { window.__ekAudio?.ctx?.resume(); keyDown(scan, 'key:' + e.code); }
  else keyUp('key:' + e.code);
}, true);
document.querySelectorAll('[data-scan]').forEach(button => {
  button.disabled = true;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); window.__ekAudio?.ctx?.resume(); keyDown(Number(button.dataset.scan), 'pointer:' + e.pointerId); button.classList.add('pressed'); $('canvas').focus({preventScroll:true}); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, e => { keyUp('pointer:' + e.pointerId); button.classList.remove('pressed'); });
  button.addEventListener('contextmenu', e => e.preventDefault());
  button.addEventListener('click', e => { if (e.detail === 0) { const source = 'accessible:' + button.dataset.scan; keyDown(Number(button.dataset.scan), source); keyUp(source); } });
});
$('pause').onclick = () => { releaseKeys(); paused = !paused; call('wasm_set_paused', null, ['number'], [Number(paused)]); $('pause').textContent = paused ? 'Resume' : 'Pause'; $('status').textContent = paused ? 'Paused' : 'Running'; void persist(); if (!paused) $('canvas').focus({preventScroll:true}); };
$('sound').onclick = () => { muted = !muted; window.__ekAudio?.ctx?.resume(); call('wasm_set_volume', null, ['number'], [muted ? 0 : 100]); $('sound').textContent = muted ? 'Unmute' : 'Mute'; $('sound').setAttribute('aria-pressed', String(muted)); };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('player').requestFullscreen(); $('canvas').focus({preventScroll:true}); } catch { $('message').textContent = 'Fullscreen is unavailable in this browser.'; } };
$('export').onclick = () => { releaseKeys(); exportSaves(); void persist(); $('message').textContent = 'Save backup exported.'; };
window.addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { releaseKeys(); paused = true; call('wasm_set_paused', null, ['number'], [1]); $('pause').textContent = 'Resume'; $('status').textContent = 'Paused'; void persist(); } });
window.addEventListener('pagehide', () => { releaseKeys(); void persist(); });

$('diagnose').onclick = () => { if (mod) call('wasm_debug_dump'); };



