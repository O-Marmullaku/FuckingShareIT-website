(() => {
  'use strict';
  const demo = document.querySelector('#demo');
  if (!demo) return;
  const root = document.documentElement;
  const modes = [...document.querySelectorAll('.demo-modes button')];
  const steps = [...document.querySelectorAll('.demo-steps button')];
  const motionButton = document.querySelector('#motion');
  const cursor = demo.querySelector('.demo-cursor');
  const transfer = demo.querySelector('.transfer');
  const review = demo.querySelector('.review');
  const description = document.querySelector('#demo-description');
  const flags = ['picked-file', 'pc-picked', 'copying', 'has-copy', 'folder-picked', 'menu-open', 'read-only-on', 'network-picked', 'folder-open'];
  let mode = 'file', phase = 1, motion = true, visible = false, timers = [], position = [0, 0];
  const copy = {
    file: {
      steps: ['Right-click a file', 'Choose the PC and save', 'Open it on the other PC'],
      owners: ['Your PC · File Explorer', 'Your PC · FuckingShareIT', 'Home PC · File Explorer'],
      description: 'Example: right-click Letter.docx in File Explorer and choose FuckingShareIT. Choose Home PC, then save. The copy appears in Received files on Home PC.',
      starts: [0, 2700, 9700], duration: 13500
    },
    folder: {
      steps: ['Right-click a folder', 'Review and approve', 'Open it on the other PC'],
      owners: ['Laptop · File Explorer', 'Laptop · Sharing review', 'Other PC · File Explorer'],
      description: 'Example: right-click Photos in File Explorer and choose FuckingShareIT. Review read-only sharing and approve the Windows changes. Open Photos from the other PC. Files stay on Laptop.',
      starts: [0, 2700, 9000], duration: 14100
    }
  };
  document.querySelectorAll('[data-inert]').forEach(button => button.addEventListener('click', event => event.preventDefault()));

  function setPhase(value) {
    phase = value;
    demo.dataset.phase = value;
    steps.forEach((button, index) => {
      if (index + 1 === value) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    cursor.getAnimations().forEach(animation => animation.cancel());
    demo.querySelectorAll('.press').forEach(element => element.classList.remove('press'));
    demo.classList.remove('is-playing');
    position = [0, 0];
    cursor.style.transform = 'translate(0,0)';
  }
  function reset(value) {
    flags.forEach(flag => demo.classList.remove(flag));
    transfer.dataset.view = value === 3 ? 'done' : 'pc';
    review.dataset.view = value === 3 ? 'shared' : 'review';
    if (value > 1) demo.classList.add('menu-open', mode === 'file' ? 'picked-file' : 'folder-picked');
    if (mode === 'folder' && value > 1) demo.classList.add('read-only-on');
    if (mode === 'file' && value === 3) demo.classList.add('has-copy');
    setPhase(value);
  }
  function snapshot(value) {
    stop();
    reset(value);
    demo.classList.add('menu-open');
    if (mode === 'file') {
      demo.classList.add('picked-file');
      if (value === 2) { transfer.dataset.view = 'save'; demo.classList.add('pc-picked'); }
    } else {
      demo.classList.add('folder-picked', 'read-only-on');
      if (value === 3) demo.classList.add('folder-open');
    }
  }
  function target(name) {
    return demo.querySelector('.' + mode + '-demo [data-target="' + name + '"]');
  }
  function point(element) {
    const bounds = element.getBoundingClientRect(), origin = demo.getBoundingClientRect();
    return [bounds.left - origin.left + bounds.width * .55, bounds.top - origin.top + bounds.height * .55];
  }
  function place(element) {
    position = point(element);
    cursor.style.transform = 'translate(' + position[0] + 'px,' + position[1] + 'px)';
  }
  function move(name, duration = 500) {
    const element = target(name);
    if (!element || !element.getClientRects().length) return;
    const destination = point(element);
    cursor.getAnimations().forEach(animation => animation.cancel());
    const from = 'translate(' + position[0] + 'px,' + position[1] + 'px)';
    const to = 'translate(' + destination[0] + 'px,' + destination[1] + 'px)';
    cursor.style.transform = to;
    cursor.animate([{ transform: from }, { transform: to }], { duration, easing: 'cubic-bezier(.16,1,.3,1)' });
    position = destination;
  }
  function click(name) {
    const element = target(name);
    if (element) {
      element.classList.add('press');
      timers.push(setTimeout(() => element.classList.remove('press'), 180));
    }
    cursor.querySelector('svg').animate([{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }], { duration: 180 });
  }
  function fileTimeline() {
    return [
      [0, () => { setPhase(1); place(target('file')); }],
      [500, () => { click('file'); demo.classList.add('picked-file'); }],
      [900, () => demo.classList.add('menu-open')],
      [1350, () => move('share-file')],
      [2100, () => click('share-file')],
      [2700, () => { setPhase(2); transfer.dataset.view = 'pc'; place(target('pc')); }],
      [3650, () => { click('pc'); demo.classList.add('pc-picked'); }],
      [4300, () => move('continue')],
      [4950, () => click('continue')],
      [5200, () => { transfer.dataset.view = 'save'; }],
      [5950, () => move('save')],
      [6650, () => { click('save'); demo.classList.add('copying'); }],
      [8350, () => { demo.classList.remove('copying'); transfer.dataset.view = 'done'; demo.classList.add('has-copy'); }],
      [9700, () => { setPhase(3); demo.classList.remove('is-playing'); }]
    ];
  }
  function folderTimeline() {
    return [
      [0, () => { setPhase(1); place(target('folder')); }],
      [500, () => { click('folder'); demo.classList.add('folder-picked'); }],
      [900, () => demo.classList.add('menu-open')],
      [1350, () => move('share-folder')],
      [2100, () => click('share-folder')],
      [2700, () => { setPhase(2); review.dataset.view = 'review'; place(target('read-only')); }],
      [3200, () => { click('read-only'); demo.classList.add('read-only-on'); }],
      [4050, () => move('approve')],
      [4750, () => click('approve')],
      [5100, () => { review.dataset.view = 'approval'; }],
      [5850, () => move('yes')],
      [6650, () => click('yes')],
      [7500, () => { review.dataset.view = 'shared'; }],
      [9000, () => { setPhase(3); place(target('open-folder')); }],
      [9650, () => { click('open-folder'); demo.classList.add('network-picked'); }],
      [10300, () => { demo.classList.add('folder-open'); demo.classList.remove('is-playing'); }]
    ];
  }
  function running() { return motion && visible && !document.hidden; }
  function play(value) {
    stop();
    reset(value);
    demo.classList.add('is-playing');
    const start = copy[mode].starts[value - 1];
    const timeline = mode === 'file' ? fileTimeline() : folderTimeline();
    timeline.filter(([time]) => time >= start).forEach(([time, action]) => {
      timers.push(setTimeout(action, time - start));
    });
    timers.push(setTimeout(() => { if (running()) play(1); }, copy[mode].duration - start));
  }
  function go(value) { if (running()) play(value); else snapshot(value); }
  function chooseMode(value) {
    mode = value;
    demo.dataset.mode = mode;
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    steps.forEach((button, index) => { button.querySelector('b').textContent = copy[mode].steps[index]; });
    demo.querySelectorAll('[data-owner]').forEach((label, index) => { label.textContent = copy[mode].owners[index]; });
    description.textContent = copy[mode].description;
    go(1);
  }
  modes.forEach(button => button.addEventListener('click', () => chooseMode(button.dataset.mode)));
  steps.forEach((button, index) => {
    button.addEventListener('click', () => go(index + 1));
    button.addEventListener('keydown', event => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      const next = (index + delta + steps.length) % steps.length;
      steps[next].focus();
      go(next + 1);
    });
  });
  motionButton.addEventListener('click', () => {
    motion = !motion;
    root.classList.toggle('still', !motion);
    motionButton.setAttribute('aria-pressed', String(!motion));
    motionButton.querySelector('span').textContent = motion ? 'Pause demo' : 'Play demo';
    go(phase);
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (running()) play(phase); else stop();
  }, { threshold: .1 }).observe(demo);
  document.addEventListener('visibilitychange', () => { if (running()) play(phase); else stop(); });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    stop();
    resizeTimer = setTimeout(() => go(phase), 180);
  });
  chooseMode('file');
})();
