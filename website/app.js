(() => {
  'use strict';
  // The Windows sharing window plays only while on screen; .still (Pause demo) holds it in place from CSS.
  const hassle = document.querySelector('.hassle');
  if (hassle) {
    let seen = false;
    const run = () => hassle.classList.toggle('on', seen && !document.hidden);
    new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; run(); }).observe(hassle);
    document.addEventListener('visibilitychange', run);
  }

  const demo = document.querySelector('#demo');
  if (!demo) return;
  const root = document.documentElement;
  const modes = [...document.querySelectorAll('.demo-modes button')];
  const steps = [...document.querySelectorAll('.demo-steps button')];
  const motionButton = document.querySelector('#motion');
  const motionButtons = [motionButton, document.querySelector('#hassle-motion')].filter(Boolean);
  const description = document.querySelector('#demo-description');
  const grid = demo.querySelector('.scene-grid');
  const cursor = demo.querySelector('.demo-cursor');
  if (cursor.parentElement !== grid) grid.append(cursor); // the cursor shares the scenes' coordinates and clipping
  const views = { file: demo.querySelector('.transfer'), folder: demo.querySelector('.review') };
  const bar = views.file.querySelector('.copy-progress i');
  const flags = ['picked-file', 'menu-open', 'pc-picked', 'copying', 'has-copy', 'folder-picked', 'read-only-on', 'shared-on', 'network-picked', 'folder-open', 'rewind'];
  // Cursor targets in the current mode's scenes: a selector and a point inside its box. The right-clicked row
  // (file or folder) is finally placed by placeMenu, so the menu opens at the click.
  const targets = {
    home: ['.source-explorer .file-list', .78, .86],
    file: ['[data-target="file"]', .42, .55],
    folder: ['[data-target="folder"]', .42, .55],
    'share-file': ['[data-target="share-file"]', .5, .55],
    'share-folder': ['[data-target="share-folder"]', .5, .55],
    pc: ['[data-target="pc"]', .62, .55],
    continue: ['[data-target="continue"]', .5, .6],
    save: ['[data-target="save"]', .5, .6],
    'read-only': ['[data-target="read-only"] .checkbox', .5, .55],
    approve: ['[data-target="approve"]', .5, .6],
    yes: ['[data-target="yes"]', .5, .6],
    'open-folder': ['[data-target="open-folder"]', .3, .55],
    'rest-file': ['.receive .file-list', .74, .7],
    'rest-folder': ['.network .file-list', .76, .82]
  };
  // One clock per mode, in ms. moves: [start, end, target, bend]; clicks: [time, target, double-click];
  // events: [time, changes] in order. starts: where a step begins while playing; holds: what a step shows paused.
  const script = {
    file: {
      steps: ['Right-click a file', 'Choose the PC and save', 'Open it on the other PC'],
      owners: ['Your PC · File Explorer', 'Your PC · FuckingShareIT', 'Home PC · File Explorer'],
      description: 'Example: right-click Letter.docx in File Explorer and choose FuckingShareIT. Choose Home PC, then save. The copy appears in Received files on Home PC.',
      length: 11800, starts: [0, 2230, 8200], holds: [2000, 5500, 10400], copy: [5600, 7100],
      first: { phase: 1, view: 'pc' },
      moves: [[350, 1050, 'file', .12], [1500, 1950, 'share-file', -.1], [2400, 3150, 'pc', .14], [3600, 4150, 'continue', -.1], [4900, 5450, 'save', .1], [8200, 8900, 'rest-file', .12]],
      clicks: [[1150, 'file'], [2150, 'share-file'], [3300, 'pc'], [4300, 'continue'], [5600, 'save']],
      events: [
        [1150, { 'picked-file': true }], [1210, { 'menu-open': true }], [2230, { 'menu-open': false, phase: 2 }],
        [3300, { 'pc-picked': true }], [4420, { view: 'save' }], [5600, { copying: true }], [7100, { view: 'done' }],
        [8200, { phase: 3 }], [8600, { 'has-copy': true }], [11420, { rewind: true }]
      ]
    },
    folder: {
      steps: ['Right-click a folder', 'Review and approve', 'Open it on the other PC'],
      owners: ['Laptop · File Explorer', 'Laptop · Sharing review', 'Other PC · File Explorer'],
      description: 'Example: right-click Photos in File Explorer and choose FuckingShareIT. Review read-only sharing and approve the Windows changes. Open Photos from the other PC. Files stay on Laptop.',
      length: 11380, starts: [0, 2230, 7100], holds: [2000, 3500, 10000],
      first: { phase: 1, view: 'review' },
      moves: [[350, 1050, 'folder', .12], [1500, 1950, 'share-folder', -.1], [2400, 3150, 'read-only', .14], [3650, 4250, 'approve', -.1], [5000, 5600, 'yes', .1], [7100, 7850, 'open-folder', .14], [8600, 9200, 'rest-folder', -.1]],
      clicks: [[1150, 'folder'], [2150, 'share-folder'], [3300, 'read-only'], [4400, 'approve'], [5750, 'yes'], [8000, 'open-folder', true]],
      events: [
        [1150, { 'folder-picked': true }], [1210, { 'menu-open': true }], [2230, { 'menu-open': false, phase: 2 }],
        [3300, { 'read-only-on': true }], [4520, { view: 'approval' }], [5870, { view: 'shared', 'shared-on': true }],
        [7100, { phase: 3 }], [8000, { 'network-picked': true }], [8280, { 'folder-open': true }], [11000, { rewind: true }]
      ]
    }
  };
  let mode = 'file', current = script.file, motion = true, visible = false;
  let clock = 0, frame = 0, last = 0, dirty = true;
  let points = {}, elements = {}, entries = [], shown = {}, pressed = null, hot = null;
  document.querySelectorAll('[data-inert]').forEach(button => button.addEventListener('click', event => event.preventDefault()));

  // Layout position inside the scene grid. Offsets ignore transforms, so a scene mid-entrance measures where it lands.
  function offset(element) {
    let x = 0, y = 0;
    for (let node = element; node && node !== grid; node = node.offsetParent) {
      x += node.offsetLeft;
      y += node.offsetTop;
      const parent = node.offsetParent;
      if (parent && parent !== grid) { x += parent.clientLeft; y += parent.clientTop; }
    }
    return [x, y];
  }
  // The right-click lands on the row where the menu fits; the menu opens with its corner there, kept inside the window.
  function placeMenu(scope) {
    const [selector, fx, fy] = targets[mode], row = scope.querySelector(selector);
    const menu = scope.querySelector('.context-menu'), win = menu.offsetParent;
    const [wx, wy] = offset(win), [rx, ry] = offset(row), w = menu.offsetWidth, h = menu.offsetHeight;
    const left = rx - wx - win.clientLeft, top = ry - wy - win.clientTop, room = win.clientWidth - 4 - w;
    const x = Math.round(Math.max(left + 12, Math.min(left + row.offsetWidth * fx, room)));
    const y = Math.round(top + row.offsetHeight * fy), down = y + h <= win.clientHeight - 4;
    menu.style.left = Math.max(4, Math.min(x, room)) + 'px';
    menu.style.top = (down ? y : Math.max(4, y - h)) + 'px';
    menu.style.right = 'auto';
    menu.style.transformOrigin = 'left ' + (down ? 'top' : 'bottom');
    points[mode] = [wx + win.clientLeft + x, wy + win.clientTop + y];
    elements[mode] = row;
  }
  function measure() {
    dirty = false;
    const scope = demo.querySelector('.' + mode + '-demo');
    placeMenu(scope); // Position the menu before measuring its command targets.
    for (const key in targets) {
      if (key === mode) continue; // Keep the menu origin as the right-click point.
      const [selector, fx, fy] = targets[key], element = demo.querySelector('.' + mode + '-demo ' + selector);
      if (!element || !element.offsetParent) continue; // not laid out: keep the last good point
      const [x, y] = offset(element);
      points[key] = [x + element.offsetWidth * fx, y + element.offsetHeight * fy];
      elements[key] = element;
    }
    entries = [...scope.querySelectorAll('.context-menu > span')].map(element => {
      const [x, y] = offset(element);
      return [element, x, y, x + element.offsetWidth, y + element.offsetHeight];
    });
  }
  function stateAt(t) {
    const state = { ...current.first };
    for (const [time, changes] of current.events) {
      if (time > t) break;
      Object.assign(state, changes);
    }
    return state;
  }
  // Writes only what changed since the last frame.
  function apply(state) {
    for (const flag of flags) {
      const on = Boolean(state[flag]);
      if (shown[flag] !== on) { shown[flag] = on; demo.classList.toggle(flag, on); }
    }
    if (shown.phase !== state.phase) { shown.phase = state.phase; demo.dataset.phase = state.phase; }
    const step = state.step || state.phase;
    if (shown.step !== step) {
      shown.step = step;
      steps.forEach((button, index) => {
        if (index + 1 === step) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    if (shown.view !== state.view) { shown.view = state.view; views[mode].dataset.view = state.view; }
  }
  // A hand doesn't move in straight lines: bow the path sideways by `bend` of its length, leave quickly, land gently.
  function curve(from, to, u, bend) {
    const e = u * u * u * (10 + u * (6 * u - 15)), v = 1 - e;
    const cx = (from[0] + to[0]) / 2 - (to[1] - from[1]) * bend, cy = (from[1] + to[1]) / 2 + (to[0] - from[0]) * bend;
    return [v * v * from[0] + 2 * v * e * cx + e * e * to[0], v * v * from[1] + 2 * v * e * cy + e * e * to[1]];
  }
  function cursorAt(t) {
    let at = points.home || [0, 0];
    for (const [start, end, key, bend] of current.moves) {
      const to = points[key] || at;
      if (t >= end) { at = to; continue; }
      if (t > start) return curve(at, to, (t - start) / (end - start), bend);
      break;
    }
    return at;
  }
  function render() {
    const t = clock;
    apply(stateAt(t));
    if (dirty) measure();
    if (current.copy) {
      const [start, end] = current.copy, u = Math.min(1, Math.max(0, (t - start) / (end - start)));
      const value = ((1 - Math.cos(Math.PI * u)) / 2).toFixed(3);
      if (value !== shown.bar) { shown.bar = value; bar.style.transform = 'scaleX(' + value + ')'; }
    }
    let press = null, scale = 1;
    for (const [time, key, double] of current.clicks) {
      for (const at of double ? [time, time + 170] : [time]) {
        const d = t - at;
        if (d >= 0 && d < 140) { press = elements[key] || null; scale = d < 60 ? 1 - .15 * d / 60 : .85 + .15 * (d - 60) / 80; }
      }
    }
    if (press !== pressed) {
      if (pressed) pressed.classList.remove('press');
      if (press) press.classList.add('press');
      pressed = press;
    }
    const [x, y] = cursorAt(t);
    let over = null;
    for (const [element, left, top, right, bottom] of entries) if (x >= left && x <= right && y >= top && y <= bottom) over = element;
    if (over !== hot) {
      if (hot) hot.classList.remove('hot');
      if (over) over.classList.add('hot');
      hot = over;
    }
    const transform = 'translate(' + (x - 3).toFixed(1) + 'px,' + (y - 2).toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
    if (transform !== shown.cursor) { shown.cursor = transform; cursor.style.transform = transform; }
  }
  // Jumps (loop restart, step clicks, mode changes) land without transitions on the state just before t, then play
  // t's own changes normally, so a step's entrance still runs. aria-current names the new step from the start.
  function seek(t) {
    clock = t;
    const before = stateAt(Math.max(0, t - 1));
    before.step = stateAt(t).phase;
    if (demo.classList.contains('rewind')) before.rewind = true; // Keep the new run covered until its state is ready.
    demo.classList.add('snap');
    apply(before);
    void grid.offsetWidth;
    demo.classList.remove('snap');
    render();
  }
  // A long frame slows the clock instead of skipping ahead. Each finished run starts the other flow.
  function tick(now) {
    frame = requestAnimationFrame(tick);
    const step = Math.max(0, Math.min(now - last, 50));
    last = now;
    if (clock + step < current.length) { clock += step; render(); }
    else chooseMode(modes[(modes.findIndex(button => button.dataset.mode === mode) + 1) % modes.length].dataset.mode);
  }
  function sync() {
    const run = motion && visible && !document.hidden;
    demo.classList.toggle('is-playing', run);
    if (run && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    else if (!run && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  function go(index) { seek(motion ? current.starts[index] : current.holds[index]); }
  function chooseMode(value) {
    mode = value;
    current = script[mode];
    demo.dataset.mode = mode;
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    steps.forEach((button, index) => { button.querySelector('b').textContent = current.steps[index]; });
    demo.querySelectorAll('[data-owner]').forEach((label, index) => { label.textContent = current.owners[index]; });
    description.textContent = current.description;
    if (pressed) pressed.classList.remove('press');
    if (hot) hot.classList.remove('hot');
    pressed = hot = null;
    shown = {};
    points = {};
    elements = {};
    entries = [];
    dirty = true;
    go(0);
  }
  modes.forEach(button => button.addEventListener('click', () => chooseMode(button.dataset.mode)));
  steps.forEach((button, index) => {
    button.addEventListener('click', () => go(index));
    button.addEventListener('keydown', event => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      const next = (index + delta + steps.length) % steps.length;
      steps[next].focus();
      go(next);
    });
  });
  function toggleMotion() {
    motion = !motion;
    root.classList.toggle('still', !motion);
    motionButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(!motion));
      button.setAttribute('aria-label', motion ? 'Pause animations' : 'Play animations');
      button.querySelector('span').textContent = motion ? 'Pause' : 'Play';
    });
    if (!motion && stateAt(clock).rewind) seek(current.holds[2]); // never freeze on the blank between loops
    sync();
  }
  motionButtons.forEach(button => button.addEventListener('click', toggleMotion));
  demo.classList.add('live');
  chooseMode('file');
  new ResizeObserver(() => { dirty = true; if (!frame) render(); }).observe(grid);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .1 }).observe(demo);
  document.addEventListener('visibilitychange', sync);
})();
