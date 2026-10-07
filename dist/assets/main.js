// Work index: show the hovered (or focused) project's cover in the side panel.
const panes = document.querySelectorAll('.pv');
const show = (slug) => panes.forEach((p) => { p.hidden = p.dataset.slug !== slug; });

document.querySelectorAll('[data-preview]').forEach((row) => {
  const slug = row.dataset.preview;
  row.addEventListener('mouseenter', () => show(slug));
  row.addEventListener('focus', () => show(slug));
});

// Home carousel: click left/right half, arrow keys or swipe. Gentle autoplay
// until the visitor takes over (off for reduced motion).
const carousel = document.querySelector('.carousel');
if (carousel) {
  const slides = [...carousel.querySelectorAll('.slide')];
  const cap = carousel.querySelector('.carousel-caption');
  const capTitle = cap.querySelector('.cap-title');
  const capClient = cap.querySelector('.cap-client');
  const cur = carousel.querySelector('.carousel-count .cur');
  let i = 0;
  let timer = null;

  const go = (n) => {
    slides[i].classList.remove('is-active');
    slides[i].setAttribute('aria-hidden', 'true');
    i = (n + slides.length) % slides.length;
    const s = slides[i];
    s.classList.add('is-active');
    s.removeAttribute('aria-hidden');
    capTitle.textContent = s.dataset.title;
    capClient.textContent = s.dataset.client;
    if (s.dataset.href) cap.setAttribute('href', s.dataset.href); else cap.removeAttribute('href');
    cur.textContent = String(i + 1).padStart(2, '0');
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const user = (n) => { stop(); go(n); };

  carousel.querySelector('.carousel-zone--prev').addEventListener('click', () => user(i - 1));
  carousel.querySelector('.carousel-zone--next').addEventListener('click', () => user(i + 1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') user(i + 1);
    if (e.key === 'ArrowLeft') user(i - 1);
  });
  let x0 = null;
  carousel.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) user(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(i + 1), 5000);
}
