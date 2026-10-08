// Home: image fire. Every 100 ms a random photograph lands somewhere on the canvas
// and stays, building up a collage. Now and then a strip tears sideways or the
// screen jolts. Click, tap or Space pauses; paused, the caption names the last
// photograph and links to its project. With reduced motion: one photograph every
// 1.5 s, no tearing or jolts. Stops while the tab is hidden.
const stage = document.querySelector('.fire');
if (stage) {
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const cap = stage.querySelector('.fire-caption');
  const toggle = stage.querySelector('.fire-toggle');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Photographs join the pool as they finish loading.
  const pool = [];
  JSON.parse(document.getElementById('fire-data').textContent).forEach((item) => {
    const img = new Image();
    img.onload = () => pool.push({ ...item, img });
    img.src = item.src;
  });

  // Canvas in device pixels, drawing in CSS pixels. Resizing keeps what is already drawn.
  let w = 0, h = 0, dpr = 1;
  const size = () => {
    const keep = document.createElement('canvas');
    keep.width = canvas.width; keep.height = canvas.height;
    if (keep.width && keep.height) keep.getContext('2d').drawImage(canvas, 0, 0);
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = stage.clientWidth; h = stage.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    if (keep.width && keep.height) ctx.drawImage(keep, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // One photograph, 20–45% of the width on wide screens (50–90% on narrow), anywhere it fits.
  let last = null;
  const add = () => {
    if (!pool.length) return;
    let item;
    do item = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && item === last);
    last = item;
    const { naturalWidth: nw, naturalHeight: nh } = item.img;
    let iw = w * (w < 700 ? 0.5 + Math.random() * 0.4 : 0.2 + Math.random() * 0.25);
    let ih = (iw * nh) / nw;
    if (ih > h * 0.8) { iw *= (h * 0.8) / ih; ih = h * 0.8; }
    ctx.drawImage(item.img, Math.random() * (w - iw), Math.random() * (h - ih), iw, ih);
  };

  // Grab a 100 px strip and shift it 50 px left or right.
  const tear = () => {
    const band = 100 * dpr;
    const y = Math.random() * (canvas.height - band);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, y, canvas.width, band, (Math.random() < 0.5 ? -50 : 50) * dpr, y, canvas.width, band);
    ctx.restore();
  };
  // Bump the whole canvas sideways for a moment.
  const jolt = () => {
    canvas.style.translate = `${Math.random() < 0.5 ? -50 : 50}px 0`;
    setTimeout(() => { canvas.style.translate = ''; }, 50);
  };

  const tick = () => {
    if (document.hidden) return;
    if (!calm && Math.random() < 0.1) tear();
    if (!calm && Math.random() < 0.05) jolt();
    add();
  };

  let timer = null;
  const play = () => {
    timer = setInterval(tick, calm ? 1500 : 100);
    stage.classList.remove('is-paused');
    toggle.textContent = 'Pause';
    cap.hidden = true;
  };
  const pause = () => {
    clearInterval(timer);
    timer = null;
    stage.classList.add('is-paused');
    toggle.textContent = 'Play';
    if (last && last.title) {
      cap.textContent = `${last.title} →`;
      cap.href = last.href;
      cap.hidden = false;
    }
  };
  const flip = () => (timer ? pause() : play());

  canvas.addEventListener('click', flip);
  toggle.addEventListener('click', flip);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.closest('a, button')) { e.preventDefault(); flip(); }
  });
  addEventListener('resize', size);
  size();
  play();
}
