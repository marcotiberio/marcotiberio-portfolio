// Home page: the photographs chosen under Home, dropped along the mouse path.
// Moving the mouse drops photographs along its path; when the mouse rests, and on touch
// screens, one lands somewhere every 900 ms. The newest 36 stay. Click, tap or Space pauses;
// paused, the caption names the last photograph and links to its project.
// Reduced motion: a still pile of six, nothing lands on its own. Stops while the tab is hidden.
const stage = document.querySelector('.trail');
if (stage) {
  const cap = stage.querySelector('.trail-caption');
  const toggle = stage.querySelector('.trail-toggle');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX = 36;     // photographs kept on the stage
  const GAP = 90;     // px of mouse travel between two drops
  const REST = 1800;  // ms without mouse movement before photographs land on their own
  const EVERY = 900;  // ms between automatic landings
  const START = 6;    // photographs placed as soon as they load

  // Shuffled once, then used in turn, so the same photograph doesn't come back twice in a row.
  const items = JSON.parse(document.getElementById('fire-data').textContent).sort(() => Math.random() - 0.5);
  const pool = [];
  let turn = 0;
  let last = null;

  // One photograph centred on (x, y): 16–24% of the width on wide screens, 32–48% on narrow ones.
  const drop = (x, y) => {
    if (!pool.length) return;
    const item = pool[turn++ % pool.length];
    last = item;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    let iw = w * (w < 700 ? 0.4 : 0.2) * (0.8 + Math.random() * 0.4);
    let ih = (iw * item.img.naturalHeight) / item.img.naturalWidth;
    if (ih > h * 0.6) { iw *= (h * 0.6) / ih; ih = h * 0.6; }
    const el = item.img.cloneNode();
    el.alt = '';
    el.className = 'trail-img';
    el.style.cssText = `left:${x - iw / 2}px;top:${y - ih / 2}px;width:${iw}px;height:${ih}px`;
    stage.insertBefore(el, cap);
    const imgs = stage.querySelectorAll('.trail-img');
    for (let i = 0; i < imgs.length - MAX; i++) imgs[i].remove();
  };
  const dropAnywhere = () => drop(Math.random() * stage.clientWidth, Math.random() * stage.clientHeight);

  // The first six load with the page, the rest after load or on the first mouse move.
  const load = (item) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      pool.push({ ...item, img });
      if (pool.length <= START) dropAnywhere();
    };
    img.src = item.src;
  };
  items.slice(0, START).forEach(load);
  let rest = false;
  const loadRest = () => {
    if (rest || calm) return;
    rest = true;
    items.slice(START).forEach(load);
  };
  if (document.readyState === 'complete') setTimeout(loadRest, 1500);
  else addEventListener('load', () => setTimeout(loadRest, 1500), { once: true });

  // Mouse trail
  let running = !calm;
  let lastMove = 0;
  let lx = null;
  let ly = null;
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !running) return;
    loadRest();
    lastMove = performance.now();
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (lx === null || Math.hypot(x - lx, y - ly) >= GAP) {
      drop(x, y);
      lx = x;
      ly = y;
    }
  });
  stage.addEventListener('pointerleave', () => { lx = null; });

  // Pause / play, with the caption while paused
  const show = () => {
    stage.classList.toggle('is-paused', !running);
    toggle.textContent = running ? 'Pause' : 'Play';
    if (!running && last && last.title) {
      cap.textContent = `${last.title} →`;
      cap.href = last.href;
      cap.hidden = false;
    } else cap.hidden = true;
  };
  const flip = () => { running = !running; show(); };
  if (calm) toggle.hidden = true;
  else {
    stage.addEventListener('click', (e) => { if (!e.target.closest('a, button')) flip(); });
    toggle.addEventListener('click', flip);
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.closest('a, button')) { e.preventDefault(); flip(); }
    });

    // Automatic landing
    setInterval(() => {
      if (running && !document.hidden && performance.now() - lastMove > REST) dropAnywhere();
    }, EVERY);
    show();
  }
}
