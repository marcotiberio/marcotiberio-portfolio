// Builds the site from content/ (edited in Pages CMS) into dist/.
// Run: node build.mjs   — then open dist/index.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync, existsSync, statSync } from 'node:fs';

// Plain recursive copy (works on any file system).
const copyDir = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) {
    if (f === '.DS_Store') continue;
    const a = `${from}/${f}`, b = `${to}/${f}`;
    statSync(a).isDirectory() ? copyDir(a, b) : copyFileSync(a, b);
  }
};

const OUT = process.env.OUT || 'dist';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const info = read('content/info.json');
const home = read('content/home.json');
const projects = readdirSync('content/projects')
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ slug: f.replace(/\.json$/, ''), ...read(`content/projects/${f}`) }))
  .filter((p) => !p.draft)
  .sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Plain text with [label](url) links and line breaks.
const md = (s) => esc(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');
const paras = (s) => String(s || '').split(/\n\s*\n/).filter(Boolean).map((p) => `<p>${md(p.trim())}</p>`).join('');
// Pages CMS may store media paths with or without a leading slash.
const src = (p, root) => root + String(p || '').replace(/^\//, '');

const media = (item, root) => {
  const s = src(item.image, root);
  if (s.endsWith('.mp4')) {
    const poster = s.replace(/\.mp4$/, '-poster.jpg');
    return `<video src="${esc(s)}" poster="${esc(poster)}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(item.alt)}"></video>`;
  }
  return `<img src="${esc(s)}" alt="${esc(item.alt)}" loading="lazy">`;
};
const fig = (item, root) => `<figure>${media(item, root)}${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}</figure>`;

const block = (b, root) => {
  if (b.type === 'vimeo') {
    const v = (b.videos || []).filter((x) => x.id);
    if (!v.length) return '';
    return `<div class="b ${v.length > 1 ? 'b-pair' : 'b-full'}" style="--n:${v.length}">${v.map((x) => `<figure><iframe src="https://player.vimeo.com/video/${esc(x.id)}?dnt=1&amp;title=0&amp;byline=0&amp;portrait=0" title="${esc(x.caption)}" allow="fullscreen; picture-in-picture" loading="lazy" style="aspect-ratio:16/9"></iframe>${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`;
  }
  const imgs = (b.images || []).filter((i) => i.image);
  if (!imgs.length) return '';
  switch (b.layout) {
    case 'row': return `<div class="b b-pair" style="--n:${imgs.length}">${imgs.map((i) => fig(i, root)).join('')}</div>`;
    case 'offset': return `<div class="b b-offset grid${b.narrow ? ' b-offset--narrow' : ''}">${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}${fig(imgs[0], root)}</div>`;
    case 'inset': return imgs.map((i) => `<div class="b b-inset grid">${fig(i, root)}</div>`).join('');
    default: return imgs.map((i) => `<div class="b b-full">${fig(i, root)}</div>`).join('');
  }
};

const layout = ({ title, body, root, page, description }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || info.description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body class="page-${page}">
<header class="site-header">
  <a class="site-name" href="${root}index.html">${esc(info.name)}</a>
  <nav><a href="${root}info.html"${page === 'info' ? ' aria-current="page"' : ''}>Info</a></nav>
</header>
<main>
${body}
</main>
<script src="${root}assets/main.js" defer></script>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/projects`, { recursive: true });
copyDir('assets', `${OUT}/assets`);
if (existsSync('media')) copyDir('media', `${OUT}/media`);

// ── Home carousel ──
const slides = home.filter((s) => s.image).map((s) => {
  const slug = String(s.project || '').split('/').pop().replace(/\.json$/, '');
  const p = bySlug[slug];
  return { img: src(s.image, ''), focus: s.focus || 'center', fullbleed: s.fullbleed !== false, title: p ? p.title : '', client: p ? p.client : '', href: p ? `projects/${p.slug}.html` : '' };
});
const first = slides[0] || { title: '', client: '', href: '' };
writeFileSync(`${OUT}/index.html`, layout({
  title: info.name, root: '', page: 'home',
  body: `<section class="carousel" aria-roledescription="carousel" aria-label="Selected work">
${slides.map((s, i) => `  <div class="slide${s.fullbleed ? '' : ' slide--fit'}${i ? '' : ' is-active'}" data-title="${esc(s.title)}" data-client="${esc(s.client)}" data-href="${esc(s.href)}"${i ? ' aria-hidden="true"' : ''}><figure><img src="${esc(s.img)}" alt="" style="object-position:${esc(s.focus)}"${i < 2 ? ' fetchpriority="high"' : ' loading="lazy"'}></figure></div>`).join('\n')}
  <button class="carousel-zone carousel-zone--prev" type="button" aria-label="Previous image"></button>
  <button class="carousel-zone carousel-zone--next" type="button" aria-label="Next image"></button>
  <a class="carousel-caption"${first.href ? ` href="${first.href}"` : ''}><span class="cap-title">${esc(first.title)}</span> <span class="cap-client">${esc(first.client)}</span></a>
  <p class="carousel-count" aria-live="polite"><span class="cur">01</span> / ${String(slides.length).padStart(2, '0')}</p>
</section>`,
}));

// ── Work list (not in the menu, reachable at /work.html) ──
const groups = [['Commissions', projects.filter((p) => p.section !== 'personal')], ['Personal', projects.filter((p) => p.section === 'personal')]].filter(([, l]) => l.length);
writeFileSync(`${OUT}/work.html`, layout({
  title: `Work — ${info.name}`, root: '', page: 'work',
  body: `<div class="index grid"><div class="list">
${groups.map(([label, list]) => `<section class="group"><h2 class="label">${label} <span>${list.length}</span></h2><ul>
${list.map((p) => `<li><a class="row" href="projects/${p.slug}.html" data-preview="${p.slug}"><span class="t">${p.client ? esc(p.client) + ' – ' : ''}${esc(p.title)}</span><span class="m">${esc(p.type)}</span></a></li>`).join('\n')}
</ul></section>`).join('\n')}
</div><aside class="preview" aria-hidden="true">
${projects.filter((p) => p.cover).map((p, i) => `<figure class="pv" data-slug="${p.slug}"${i ? ' hidden' : ''}>${media({ image: p.cover }, '')}<figcaption><span>${esc(p.location)}</span></figcaption></figure>`).join('\n')}
</aside></div>`,
}));

// ── Project pages ──
projects.forEach((p, i) => {
  const next = projects[(i + 1) % projects.length];
  const meta = [['Client', p.client], ['Location', p.location], ['Type', p.type], ['Role', p.role]].filter(([, v]) => v);
  const credits = (p.credits || []).filter((c) => c.role || c.name);
  writeFileSync(`${OUT}/projects/${p.slug}.html`, layout({
    title: `${p.title} — ${info.name}`, root: '../', page: 'project', description: p.description,
    body: `<article class="project">
  <header class="p-head grid">
    <h1>${esc(p.title)}</h1>
    <dl class="meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${p.description ? `<div class="context">${paras(p.description)}</div>` : ''}
  </header>
  ${(p.blocks || []).map((b) => block(b, '../')).join('\n  ')}
  ${credits.length ? `<section class="credits grid"><h2 class="label">Credits</h2><dl class="meta">${credits.map((c) => `<dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd>`).join('')}</dl></section>` : ''}
  ${next !== p ? `<a class="next" href="${next.slug}.html"><span class="label">Next project</span><span class="next-title">${esc(next.title)} →</span></a>` : ''}
</article>`,
  }));
});

// ── Info ──
const section = (s) => {
  let c = '';
  if (s.style === 'list') c = `<ul class="entries">${(s.entries || []).map((e) => `<li><span>${esc(e.date)}</span><span>${md(e.text)}</span></li>`).join('')}</ul>`;
  else if (s.style === 'large') c = `<p class="big">${md(s.text)}</p>`;
  else c = paras(s.text);
  return `<section><h2>${esc(s.title)}</h2>${c}</section>`;
};
const col = (name) => (info.sections || []).filter((s) => (s.column || 'left') === name).map(section).join('\n');
writeFileSync(`${OUT}/info.html`, layout({
  title: `Info — ${info.name}`, root: '', page: 'info',
  body: `<div class="info grid">
  <div class="info-col info-main"><div class="bio">${paras(info.bio)}</div>${col('left')}</div>
  <div class="info-col">${col('middle')}</div>
  <div class="info-col info-contact">${col('right')}</div>
</div>`,
}));

console.log(`Built dist/: home (${slides.length} slides), ${projects.length} projects, info.`);
