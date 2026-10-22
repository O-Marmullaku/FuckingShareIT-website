(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const root = document.documentElement;

  // Download buttons have no destination on this page: they are deliberately inert.
  $$('[data-inert]').forEach(b => b.addEventListener('click', e => e.preventDefault()));

  /* ---------- Motion switch: the page decides, and the visitor can pause it ---------- */
  let motion = true;
  const motionListeners = [];
  const motionBtn = $('#motion');
  const motionText = motionBtn && $('.motion-text', motionBtn);
  function setMotion(on) {
    motion = on;
    root.classList.toggle('still', !on);
    if (motionText) motionText.textContent = on ? 'Pause motion' : 'Play motion';
    motionListeners.forEach(f => f(on));
  }
  if (motionBtn) motionBtn.addEventListener('click', () => setMotion(!motion));

  /* ---------- The demo: one hand on the laptop sends Letter.docx to the Home PC ----------
     1) drags Letter.docx from the desktop onto the window, then Choose a PC;
     2) the PC list finds Home PC, the hand picks it and continues;
     3) Save file: the copy crosses the network, lands in the Home PC's folder, is checked;
     4) File saved. Every second pass the name is taken, so the new copy becomes Letter (2).docx. */
  const stage = $('#stage');
  if (stage) demo();

  function demo() {
    const layer = $('.cursor-layer', stage);
    const ptr = $('.pointer', layer);
    const arrow = $('svg', ptr);
    const laptop = $('.laptop .screen', stage);
    const icon = $('.desk-icon', stage);
    const drop = $('.drop', stage);
    const toPc = $('[data-hit="to-pc"]', stage);
    const pcRow = $('.pc', stage);
    const toSave = $('[data-hit="to-save"]', stage);
    const saveBtn = $('[data-hit="save"]', stage);
    const steps = $$('.steps .step');
    const caption = $('#caption');
    const texts = steps.map(b => $('.d', b).textContent);
    const FLAGS = ['has-file', 'found', 'picked', 'saving', 'checking', 'arrived'];

    let token = 0, timers = [], pos = [0, 0], pass = 0, current = 1, inView = false;

    const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const at = p => `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`;
    function pt(el, fx = .5, fy = .5) {
      const r = el.getBoundingClientRect(), b = layer.getBoundingClientRect();
      return [r.left - b.left + r.width * fx, r.top - b.top + r.height * fy];
    }
    const rest = () => pt(laptop, .5, .9);

    function showStep(k) {
      current = k;
      stage.dataset.step = k;
      steps.forEach((b, i) => (i + 1 === k ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
      if (caption) caption.textContent = texts[k - 1];
    }
    // The scene at the start of step k, or with step k finished when `end` is set.
    function prep(k, end) {
      const on = [];
      if (k > 1 || end) on.push('has-file');
      if (k > 2 || (k === 2 && end)) on.push('found', 'picked');
      if (k === 4) on.push('arrived');
      FLAGS.forEach(f => stage.classList.toggle(f, on.includes(f)));
      stage.classList.toggle('collide', pass % 2 === 1);
      const name = pass % 2 ? 'Letter (2).docx' : 'Letter.docx';
      $$('[data-name]', stage).forEach(e => { e.textContent = name; });
      showStep(k);
    }

    function place(p) {
      ptr.getAnimations().forEach(a => a.cancel());
      pos = p;
      ptr.style.transform = at(p);
    }
    // Hands don't travel in straight lines: a gentle bow, eased at both ends.
    function glide(to, ms, bend = .14) {
      const from = pos;
      const c = [(from[0] + to[0]) / 2 - (to[1] - from[1]) * bend, (from[1] + to[1]) / 2 + (to[0] - from[0]) * bend];
      const n = Math.max(16, Math.round(ms / 22)), frames = [];
      for (let i = 0; i <= n; i++) {
        const u = ease(i / n), v = 1 - u;
        frames.push({ transform: at([v * v * from[0] + 2 * v * u * c[0] + u * u * to[0], v * v * from[1] + 2 * v * u * c[1] + u * u * to[1]]) });
      }
      ptr.getAnimations().forEach(a => a.cancel());
      ptr.style.transform = at(to);
      ptr.animate(frames, { duration: ms });
      pos = to;
      return wait(ms);
    }
    function click(el) {
      arrow.animate([{ transform: 'scale(1)' }, { transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
      if (el) { el.classList.add('press'); later(170, () => el.classList.remove('press')); }
      return wait(230);
    }

    const scenes = {
      async 1(alive) {
        await wait(650); if (!alive()) return;
        await glide(pt(icon, .5, .4), 850); if (!alive()) return;
        icon.classList.add('sel');
        await click(); if (!alive()) return;
        ptr.classList.add('drag');
        later(780, () => drop.classList.add('over'));
        await glide(pt(drop, .55, .5), 1050, -.08); if (!alive()) return;
        await wait(260); if (!alive()) return;
        ptr.classList.remove('drag');
        drop.classList.remove('over');
        icon.classList.remove('sel');
        stage.classList.add('has-file');
        await wait(850); if (!alive()) return;
        await glide(pt(toPc), 760); if (!alive()) return;
        await click(toPc);
      },
      async 2(alive) {
        await wait(1250); if (!alive()) return;
        stage.classList.add('found');
        await wait(380); if (!alive()) return;
        await glide(pt(pcRow, .32, .5), 820); if (!alive()) return;
        await click(pcRow); if (!alive()) return;
        stage.classList.add('picked');
        await wait(520); if (!alive()) return;
        await glide(pt(toSave), 720); if (!alive()) return;
        await click(toSave);
      },
      async 3(alive) {
        await wait(800); if (!alive()) return;
        await glide(pt(saveBtn), 820); if (!alive()) return;
        await click(saveBtn); if (!alive()) return;
        stage.classList.add('saving');
        glide(rest(), 1200, .1); // out of the way while it copies
        await wait(1650); if (!alive()) return;
        stage.classList.add('checking', 'arrived');
        await wait(1150); if (!alive()) return;
        stage.classList.remove('saving', 'checking');
      },
      async 4() {
        await wait(3800);
      },
    };

    async function play(t, k) {
      const alive = () => t === token;
      for (;;) {
        prep(k);
        await scenes[k](alive);
        if (!alive()) return;
        if (k === 4) { pass++; k = 1; } else k++;
      }
    }
    function stop() {
      token++;
      timers.forEach(clearTimeout);
      timers = [];
      ptr.getAnimations().forEach(a => a.cancel());
      ptr.classList.remove('drag');
      icon.classList.remove('sel');
      drop.classList.remove('over');
    }
    function start(k) {
      stop();
      const t = token;
      prep(k);
      stage.classList.add('live');
      requestAnimationFrame(() => {
        if (t !== token) return;
        place(k === 1 ? pt(laptop, .62, .92) : rest());
        play(t, k);
      });
    }
    function still(k) {
      stop();
      stage.classList.remove('live');
      prep(k, true);
    }
    const running = () => motion && inView && !document.hidden;
    const go = k => (running() ? start(k) : still(k));

    steps.forEach((b, i) => {
      b.addEventListener('click', () => go(i + 1));
      b.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        steps[(i + d + steps.length) % steps.length].focus();
      });
    });

    motionListeners.push(on => (on && inView ? start(current) : still(current)));

    new IntersectionObserver(([e]) => {
      const was = inView;
      inView = e.isIntersecting;
      if (inView === was) return;
      if (inView && motion && !document.hidden) start(current);
      else if (!inView) stop();
    }, { threshold: .12 }).observe(stage);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (running()) start(current);
    });

    // A width change moves every target the hand aims at; height-only changes (phone toolbars) move nothing.
    let width = innerWidth, settle = 0;
    addEventListener('resize', () => {
      if (innerWidth === width) return;
      width = innerWidth;
      clearTimeout(settle);
      settle = setTimeout(() => { if (running()) start(current); }, 250);
    });

    prep(1);
  }

  /* ---------- The usual way: a pile of Windows dialogs to click through ---------- */
  const pile = $('#pile');
  if (pile) {
    const cards = $$('.dlg', pile);
    const end = $('.pile-end', pile);
    const count = $('#pile-count');
    const again = $('#pile-again');
    let top = 0;
    const arrange = focus => {
      cards.forEach((c, i) => {
        c.classList.toggle('gone', i < top);
        c.inert = i !== top;
        c.style.zIndex = String(cards.length - i + 1);
      });
      const left = cards.length - top;
      end.inert = left > 0;
      pile.classList.toggle('cleared', left === 0);
      count.textContent = left
        ? `${left} ${left === 1 ? 'window' : 'windows'} between you and Letter.docx.`
        : 'Six windows later, the file hasn’t moved.';
      if (focus) {
        const next = left ? ($('.wbtn-main', cards[top]) || $('button', cards[top])) : again;
        if (next) next.focus({ preventScroll: true });
      }
    };
    cards.forEach(c => $$('button', c).forEach(b => b.addEventListener('click', () => {
      if (cards.indexOf(c) !== top) return;
      top++;
      arrange(true);
    })));
    again.addEventListener('click', () => { top = 0; arrange(true); });
    arrange(false);
  }

  /* ---------- The final download button's arrow ----------
     A highlighter arrow on a spring: it flies in and crashes into the button the first time it's seen,
     jabs at it every few seconds (the button gives a little), and its tail lags when the page scrolls. */
  const mount = $('.spring-mount');
  const action = $('#cta-action');
  if (mount && action) spring();

  function spring() {
    const shaft = $('.shaft', mount), under = $('.under', mount);
    const STEP = 1000 / 60;
    let x = 0, vx = 0, bend = 0, vb = 0, rot = 0, vr = 0, alpha = 1;
    let frame = 0, last = 0, acc = 0, lastY = scrollY, pressed = false, pokeTimer = 0, seen = false, inView = false;

    function tick() {
      vx = (vx - x * .11) * .86; x = clamp(x + vx, -6, 120);
      vb = (vb - bend * .07) * .93; bend = clamp(bend + vb, -13, 13);
      vr = (vr - rot * .09) * .88; rot = clamp(rot + vr, -10, 10);
      if (alpha < 1) alpha = Math.min(1, alpha + .05);
      // The tip touching the button presses it, once per jab.
      if (x < -2.4 && !pressed) {
        pressed = true;
        action.classList.add('poked');
        clearTimeout(pokeTimer);
        pokeTimer = setTimeout(() => action.classList.remove('poked'), 140);
      }
      if (x > -.8) pressed = false;
    }
    function render() {
      const d = `M6 16Q33 ${(16 + bend * .45).toFixed(2)} 60 ${(16 + bend).toFixed(2)}`;
      shaft.setAttribute('d', d);
      under.setAttribute('d', d);
      mount.style.transform = `translateX(${x.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
      mount.style.opacity = alpha.toFixed(2);
    }
    function settleAll() {
      x = vx = bend = vb = rot = vr = 0;
      alpha = 1;
      render();
    }
    function loop(t) {
      acc += last ? Math.min(100, t - last) : STEP;
      last = t;
      for (; acc >= STEP; acc -= STEP) tick();
      render();
      const energy = Math.abs(x) + Math.abs(vx) + Math.abs(bend) + Math.abs(vb) + Math.abs(rot) + Math.abs(vr) + (1 - alpha);
      if (energy > .03 && motion) frame = requestAnimationFrame(loop);
      else { frame = last = acc = 0; settleAll(); }
    }
    const wake = () => { if (!frame && motion) frame = requestAnimationFrame(loop); };
    const jab = () => { vx -= 3.4; vb += (Math.random() < .5 ? -1 : 1) * 1.6; wake(); };

    setInterval(() => { if (motion && inView && !document.hidden) jab(); }, 4200);

    addEventListener('scroll', () => {
      const d = clamp(scrollY - lastY, -80, 80);
      lastY = scrollY;
      if (!motion || !inView) return;
      vb -= d * .06;
      vr += d * .012;
      vx -= Math.abs(d) * .008;
      wake();
    }, { passive: true });

    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (!inView || seen) return;
      seen = true;
      if (!motion) return;
      // Entrance: from up and to the right, fast, straight into the button.
      x = Math.min(90, Math.max(0, innerWidth - action.getBoundingClientRect().right - 70));
      vx = -1.5; rot = -8; alpha = 0;
      render();
      wake();
    }, { threshold: .6 }).observe(action);

    motionListeners.push(on => {
      if (on) return;
      cancelAnimationFrame(frame);
      frame = last = acc = 0;
      action.classList.remove('poked');
      settleAll();
    });
  }
})();
