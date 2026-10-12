// Builds the site from content/ (edited in Pages CMS) into dist/, then compiles
// Tailwind (src/style.css → dist/assets/style.css) from the classes used below.
// Run: npm install (once), then node build.mjs — then open dist/index.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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

// Placeholder text like "[Year]" or "[Client], [Client]" is never published.
// Real links "[label](https://…)" are fine; anything else with a "[" is a placeholder.
const real = (s) => {
  const t = String(s ?? '').trim();
  return t.replace(/\[([^\]]+)\]\(([^)\s[\]]+)\)/g, '').includes('[') ? '' : t;
};

// Two sections, each on its own page and never mixed. The home page is the image fire.
// "personal" is the stored value for Research. Each page's intro, button and footer
// line are edited in the CMS (content/research.json, content/commissions.json).
const SECTIONS = [
  { key: 'personal', id: 'research', page: 'research.html', label: 'Research', prefix: 'R' },
  { key: 'commission', id: 'commissions', page: 'commissions.html', label: 'Commissions', prefix: 'C' },
].map((s) => ({ ...s, text: read(`content/${s.id}.json`) }));
// Which menu items are shown (Menu in the CMS). Missing = shown.
const menu = existsSync('content/menu.json') ? read('content/menu.json') : {};
const inMenu = (id) => menu[id] !== false;
const COMMISSIONS = SECTIONS[1];
const sectionOf = (p) => SECTIONS.find((s) => s.key === p.section) || COMMISSIONS;
const projects = readdirSync('content/projects')
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ slug: f.replace(/\.json$/, ''), ...read(`content/projects/${f}`) }))
  .filter((p) => !p.draft)
  .sort((a, b) => SECTIONS.indexOf(sectionOf(a)) - SECTIONS.indexOf(sectionOf(b)) || (Number(a.order) || 99) - (Number(b.order) || 99));
const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));
// Catalogue numbers: C01, C02 … R01, R02 …
for (const s of SECTIONS) projects.filter((p) => sectionOf(p) === s).forEach((p, i) => { p.no = s.prefix + String(i + 1).padStart(2, '0'); });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Plain text with [label](url) links and line breaks.
const md = (s) => esc(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');
const paras = (s) => String(s || '').split(/\n\s*\n/).filter(Boolean).map((p) => `<p>${md(p.trim())}</p>`).join('');
// Pages CMS may store media paths with or without a leading slash.
const src = (p, root) => root + String(p || '').replace(/^\//, '');
// A still for any media item: videos use their "-poster.jpg".
const still = (p) => String(p || '').replace(/\.mp4$/, '-poster.jpg');

// ── Shared classes ──
// 12-column grid, 24px gutter (16px on phones). Children span the full width on phones
// and take their columns from md: up.
const GRID = 'grid grid-cols-12 gap-x-4 md:gap-x-6';
const FULL = 'col-span-full';
// Catalogue label: small mono capitals.
const LABEL = 'font-mono text-[11px] leading-[1.4] font-medium uppercase tracking-[.06em]';
const META = 'grid grid-cols-[minmax(80px,max-content)_1fr] gap-x-5 gap-y-1.5 text-[14px] [&_dt]:text-soft';
const LARGE = 'text-[clamp(20px,1.9vw,27px)] leading-[1.2] tracking-[-.005em]';
// The shared 4:3 frame for photographs in the index and contact sheets.
const FRAME = 'aspect-4/3 bg-line';

const media = (item, root) => {
  const s = src(item.image, root);
  if (s.endsWith('.mp4')) {
    return `<video src="${esc(s)}" poster="${esc(still(s))}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(item.alt)}"></video>`;
  }
  return `<img src="${esc(s)}" alt="${esc(item.alt)}" loading="lazy">`;
};

// Every image and video of a project, in page order.
const allMedia = (p) => (p.blocks || []).filter((b) => b.type !== 'vimeo').flatMap((b) => (b.images || []).filter((i) => i.image));
// The photographs shown in the project's index row: chosen in the CMS, else the first four.
const indexMedia = (p) => {
  const chosen = (p.index || []).filter((i) => i.image);
  const list = chosen.length ? chosen : allMedia(p);
  return (list.length ? list : p.cover ? [{ image: p.cover }] : []).slice(0, 4);
};

// Side by side: one column on small phones, at most two on tablets, all of them from md: up.
// Spelled out in full so Tailwind can find the class names.
const PAIR_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3', 4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4', 5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-5', 6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-6' };
const pair = (n) => `grid ${PAIR_COLS[Math.min(n, 6)]} gap-4 md:gap-6 items-start`;
const caption = (text) => (text ? `<figcaption class="mt-2 text-[13px] text-soft">${esc(text)}</figcaption>` : '');

const block = (b, root, fig) => {
  if (b.type === 'vimeo') {
    const v = (b.videos || []).filter((x) => x.id);
    if (!v.length) return '';
    return `<div class="${pair(v.length)}">${v.map((x) => `<figure><iframe class="block w-full aspect-video border-0 bg-line" src="https://player.vimeo.com/video/${esc(x.id)}?dnt=1&amp;title=0&amp;byline=0&amp;portrait=0" title="${esc(x.caption)}" allow="fullscreen; picture-in-picture" loading="lazy"></iframe>${caption(x.caption)}</figure>`).join('')}</div>`;
  }
  const imgs = (b.images || []).filter((i) => i.image);
  if (!imgs.length) return '';
  switch (b.layout) {
    case 'row': return `<div class="${pair(imgs.length)}">${imgs.map((i) => fig(i, root)).join('')}</div>`;
    case 'offset': return `<div class="${GRID} items-end gap-y-3 md:gap-y-0">${b.note ? `<p class="${FULL} ${b.narrow ? 'md:col-[1/5]' : 'md:col-[1/4]'} text-[14px] text-soft max-w-[36ch]">${esc(b.note)}</p>` : ''}${fig(imgs[0], root, `${FULL} ${b.narrow ? 'md:col-[8/13]' : 'md:col-[5/13]'}`)}</div>`;
    case 'inset': return imgs.map((i) => `<div class="${GRID}">${fig(i, root, `${FULL} md:col-[3/11]`)}</div>`).join('');
    default: return imgs.map((i) => `<div>${fig(i, root)}</div>`).join('');
  }
};

const email = real(info.email);
const instagram = real(info.instagram).replace(/^@/, '');
const contactHref = (root) => (email ? `mailto:${email}` : `${root}info.html`);

// ── Search engines and link previews ──
// The site's public address: "Website address" on Info, else the one Netlify sets
// during the build. Without it, the canonical links, share images and sitemap are left out.
const SITE = (real(info.url) || process.env.URL || '').replace(/\/+$/, '');
const abs = (path) => (SITE ? `${SITE}/${String(path || '').replace(/^\//, '')}` : '');
// Search results show about 155 characters of the description.
const clip = (t, n = 155) => {
  const s = String(t || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s;
};
// Optional overrides from the "Search engines & link previews" group in the CMS.
// Empty fields fall back to the automatic values.
const seoOf = (o) => ({ title: real(o?.seo?.title), description: real(o?.seo?.description), image: o?.seo?.image || '' });
const SEO = seoOf(info);
const JOB = real(info.seo?.job_title) || 'Photographer';
const PERSON = {
  '@type': 'Person', name: info.name, jobTitle: JOB,
  ...(SITE && { url: `${SITE}/` }),
  ...(email && { email: `mailto:${email}` }),
  ...(real(info.location) && { address: { '@type': 'PostalAddress', addressLocality: real(info.location) } }),
  ...(instagram && { sameAs: [`https://www.instagram.com/${instagram}/`] }),
};
const ld = (data) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c')}</script>`;
const sitemap = [];

// path: the page's address within the site ('' for home). image: the share preview.
const layout = ({ title, body, root, page, path, description, image, schema, section = COMMISSIONS, script }) => {
  // On the home page the header floats over the image fire as small black tags.
  const home = page === 'home';
  const tag = 'bg-black px-1.5 py-0.5';
  const navLink = home ? `${tag} text-[#b5b5b3] hover:text-white` : 'text-soft hover:text-ink aria-[current]:text-ink';
  const current = (s) => (page === s.key ? ' aria-current="page"' : page === 'project' && section === s ? ' aria-current="true"' : '');
  const desc = clip(description || info.description);
  const url = abs(path);
  const img = image && abs(still(image));
  if (url) sitemap.push(url);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${url ? `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n` : ''}<meta property="og:type" content="${page === 'project' ? 'article' : page === 'info' ? 'profile' : 'website'}">
<meta property="og:site_name" content="${esc(info.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="en_GB">
${img ? `<meta property="og:image" content="${esc(img)}">\n<meta name="twitter:card" content="summary_large_image">\n` : '<meta name="twitter:card" content="summary">\n'}${schema ? `${ld(schema)}\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body class="${home ? 'h-dvh overflow-hidden bg-black' : 'px-5 md:px-10'}">
<header class="${home ? 'fixed inset-x-0 top-0 px-[14px] py-4 md:px-[34px] md:py-6' : 'sticky top-0 bg-bg py-5 md:py-7'} z-2 flex flex-wrap md:flex-nowrap justify-between items-baseline gap-x-6 gap-y-2">
  <a class="${home ? `${tag} text-white` : 'w-full sm:w-auto'} font-medium" href="${root}index.html">${esc(info.name)}</a>
  <nav class="flex ${home ? 'gap-1' : 'gap-4 md:gap-7'}">${SECTIONS.filter((s) => inMenu(s.id)).map((s) => `<a class="${navLink}" href="${root}${s.page}"${current(s)}>${s.label}</a>`).join('')}${inMenu('info') ? `<a class="${navLink}" href="${root}info.html"${page === 'info' ? ' aria-current="page"' : ''}>Info</a>` : ''}${inMenu('contact') ? `<a class="${home ? navLink : 'text-ink'}" href="${contactHref(root)}">Contact</a>` : ''}</nav>
</header>
<main>
${body}
</main>
${home || page === 'info' ? '' : `<footer class="${GRID} pt-7 pb-10 gap-y-6 items-start border-t border-ink">
  ${real(section.text.footer) ? `<p class="${FULL} md:col-[1/7] ${LARGE} max-w-[24ch]">${esc(real(section.text.footer))}</p>` : ''}
  <p class="${FULL} md:col-[7/13] ${LARGE} [&_a]:border-b [&_a]:border-current [&_a:hover]:text-soft">${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : `<a href="${root}info.html">Contact details</a>`}${instagram ? `<br><a href="https://www.instagram.com/${esc(instagram)}/">Instagram</a>` : ''}</p>
  <p class="${FULL} pt-10 ${LABEL} text-soft">${esc(info.name)} · ${esc(real(info.location) || 'Amsterdam')}</p>
</footer>`}
${script ? `<script src="${root}assets/${script}" defer></script>` : ''}
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/projects`, { recursive: true });
copyDir('assets', `${OUT}/assets`);
if (existsSync('media')) copyDir('media', `${OUT}/media`);

// One line of facts per project: client, place, year, type — whatever is filled in.
const facts = (p) => [p.client, p.location, p.year, p.type].map(real).filter(Boolean);

// ── Research and Commissions ──
// Each project is one catalogue entry: number and facts on the left, up to four
// photographs at one size on the right, so the work can be compared at a glance.
// Hovering an entry fades the others.
const entry = (p) => {
  const tiles = indexMedia(p);
  const fade = 'transition-opacity duration-200 motion-reduce:transition-none group-hover/list:opacity-35 group-hover/entry:opacity-100!';
  return `<li><a class="group/entry ${GRID} items-start py-5 border-b border-line" href="projects/${p.slug}.html">
  <div class="${FULL} md:col-[1/4] grid grid-cols-[auto_1fr] md:grid-cols-1 gap-x-3 gap-y-1.5 mb-3 md:mb-0 text-[14px] text-soft">
    <span class="${LABEL} row-start-1 md:row-auto pt-1 md:pt-0">${p.no}</span>
    <h3 class="text-[20px] leading-[1.15] font-medium tracking-[-.01em] text-ink ${fade}">${esc(p.title)}</h3>
    <p class="col-start-2 md:col-start-auto">${facts(p).map(esc).join('<br>')}</p>
  </div>
  <div class="${FULL} md:col-[4/13] grid grid-cols-2 md:grid-cols-4 gap-2">${tiles.map((t) => `<figure><img class="${FRAME} ${fade}" src="${esc(src(still(t.image), ''))}" alt="${esc(t.alt)}" loading="lazy"></figure>`).join('')}</div>
</a></li>`;
};
SECTIONS.forEach((s) => {
  const list = projects.filter((p) => sectionOf(p) === s);
  // The intro (statement, text and button) can be switched off in the CMS;
  // the catalogue then starts right under the header.
  const t = s.text;
  const show = t.show_intro !== false;
  const statement = real(t.statement);
  const intro = real(t.intro);
  const button = real(t.button);
  writeFileSync(`${OUT}/${s.page}`, layout({
    title: seoOf(t).title || `${s.label} — ${info.name}`, root: '', page: s.key, path: s.page, section: s,
    description: seoOf(t).description || (statement && intro ? `${statement} ${intro}` : statement || intro),
    image: seoOf(t).image || (list.length && indexMedia(list[0])[0]?.image) || SEO.image,
    schema: { '@type': 'CollectionPage', name: `${s.label} — ${info.name}`, ...(SITE && { url: abs(s.page) }), author: PERSON, ...(SITE && { hasPart: list.map((p) => ({ '@type': 'CreativeWork', name: p.title, url: abs(`projects/${p.slug}.html`) })) }) },
    body: `${show ? `<section class="${GRID} gap-y-8 items-end pt-10 pb-18 md:pt-18 md:pb-30">
  <h1 class="${FULL} md:col-[1/9] text-[clamp(36px,5.2vw,76px)] leading-none font-medium tracking-[-.025em] text-balance">${statement ? md(statement) : s.label}</h1>
  ${intro || button ? `<div class="${FULL} md:col-[9/13] grid gap-3 text-[14px] max-w-[40ch]">${paras(intro)}${button ? `<p><a class="border-b border-current hover:text-soft" href="${contactHref('')}">${esc(button)} →</a></p>` : ''}</div>` : ''}
</section>` : `<h1 class="sr-only">${s.label}</h1>`}
${list.length ? `<section class="${show ? '' : 'pt-6 md:pt-10 '}pb-18 md:pb-30">
  <h2 class="${LABEL} flex justify-between pb-3 border-b border-ink"><span>${s.label}</span><span>${String(list.length).padStart(2, '0')}</span></h2>
  <ol class="group/list">
${list.map(entry).join('\n')}
  </ol>
</section>` : ''}`,
  }));
});

// ── Home: image fire ──
// The photographs chosen under Home in the CMS, fired onto a canvas by assets/fire.js.
// Each carries its project's title and link, shown when the visitor pauses.
// Caption and pause button are black tags, like the header.
const homeFile = read('content/home.json');
const fire = (Array.isArray(homeFile) ? homeFile : homeFile.slides || []).filter((s) => s.image).map((s) => {
  const p = bySlug[String(s.project || '').split('/').pop().replace(/\.json$/, '')];
  return { src: src(still(s.image), ''), title: p ? p.title : '', href: p ? `projects/${p.slug}.html` : '' };
});
const fireTag = 'fixed bottom-5 md:bottom-7 z-2 bg-black px-1.5 py-0.5 text-white';
writeFileSync(`${OUT}/index.html`, layout({
  title: SEO.title || `${info.name} — ${JOB}${real(info.location) ? `, ${real(info.location)}` : ''}`, root: '', page: 'home', path: '', script: 'fire.js',
  description: SEO.description, image: SEO.image || fire[0]?.src,
  schema: { '@type': 'WebSite', name: info.name, ...(SITE && { url: `${SITE}/` }), description: real(info.description), author: PERSON },
  body: `<h1 class="sr-only">${esc(info.name)}${real(info.description) ? ` — ${esc(real(info.description))}` : ''}</h1>
<section class="fire fixed inset-0 bg-black" aria-label="Photographs, shown in rapid succession">
  <canvas class="block size-full cursor-pointer"></canvas>
  <a class="fire-caption ${fireTag} left-[14px] md:left-[34px] underline-offset-4 decoration-1 hover:underline" hidden></a>
  <button class="fire-toggle ${fireTag} right-[14px] md:right-[34px] cursor-pointer" type="button">Pause</button>
  <script type="application/json" id="fire-data">${JSON.stringify(fire).replace(/</g, '\\u003c')}</script>
</section>`,
}));

// Old links to the work list land on the commissions.
writeFileSync(`${OUT}/work.html`, `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=commissions.html"><link rel="canonical" href="commissions.html"><title>${esc(info.name)}</title><a href="commissions.html">${esc(info.name)}</a>`);

// ── Project pages ──
projects.forEach((p) => {
  const s = sectionOf(p);
  const meta = [['Client', p.client], ['Location', p.location], ['Year', p.year], ['Type', p.type], ['Role', p.role]].map(([k, v]) => [k, real(v)]).filter(([, v]) => v);
  const credits = (p.credits || []).filter((c) => real(c.role) || real(c.name));
  const description = real(p.description);
  // With no description yet, search results get a line made from the project's facts.
  const summary = seoOf(p).description || description || `${p.title}${facts(p).length ? `, ${facts(p).join(', ')}` : ''}. Photography by ${info.name}.`;
  // Number every image so the contact sheet can jump to it.
  let n = 0;
  const fig = (item, root, cls = '') => `<figure id="i${++n}"${cls ? ` class="${cls}"` : ''}>${media(item, root)}${caption(item.caption)}</figure>`;
  const sheet = allMedia(p);
  writeFileSync(`${OUT}/projects/${p.slug}.html`, layout({
    title: seoOf(p).title || `${p.title} — ${info.name}`, root: '../', page: 'project', path: `projects/${p.slug}.html`, section: s, description: summary,
    image: seoOf(p).image || indexMedia(p)[0]?.image || SEO.image,
    schema: {
      '@type': 'CreativeWork', name: p.title, description: clip(summary, 500), author: PERSON, creator: PERSON,
      ...(SITE && { url: abs(`projects/${p.slug}.html`) }),
      ...(real(p.year) && { dateCreated: real(p.year) }),
      ...(real(p.location) && { locationCreated: { '@type': 'Place', name: real(p.location) } }),
      ...(real(p.type) && { genre: real(p.type) }),
      ...(SITE && { image: allMedia(p).slice(0, 12).map((m) => ({ '@type': 'ImageObject', contentUrl: abs(still(m.image)), ...(real(m.alt) && { description: real(m.alt) }) })) }),
    },
    body: `<article class="grid gap-14 md:gap-24 pt-8 md:pt-16 pb-30">
  <header class="${GRID} gap-y-5 items-start">
    <p class="${FULL} ${LABEL} text-soft"><a class="hover:text-ink" href="../${s.page}">${s.label}</a> / ${p.no}</p>
    <h1 class="${FULL} md:col-[1/7] text-[clamp(40px,5vw,64px)] leading-none font-medium tracking-[-.02em] text-balance">${esc(p.title)}</h1>
    <dl class="${FULL} md:col-[7/10] ${META}">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${description ? `<div class="${FULL} md:col-[10/13] grid gap-2.5 text-[14px] max-w-[42ch]">${paras(description)}</div>` : ''}
  </header>
  ${sheet.length > 2 ? `<nav class="grid grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 -mt-6 md:-mt-12" aria-label="All images">${sheet.map((m, k) => `<a class="group/thumb grid gap-1.5" href="#i${k + 1}"><img class="${FRAME} group-hover/thumb:opacity-70" src="${esc(src(still(m.image), '../'))}" alt="" loading="lazy"><span class="${LABEL} text-soft">${String(k + 1).padStart(2, '0')}</span></a>`).join('')}</nav>` : ''}
  ${(p.blocks || []).map((b) => block(b, '../', fig)).join('\n  ')}
  ${credits.length ? `<section class="${GRID} pt-5 border-t border-line"><h2 class="${FULL} md:col-[1/7] ${LABEL} text-soft">Credits</h2><dl class="${FULL} md:col-[7/10] ${META}">${credits.map((c) => `<dt>${esc(real(c.role))}</dt><dd>${esc(real(c.name))}</dd>`).join('')}</dl></section>` : ''}
</article>`,
  }));
});

// ── Info ──
// Three columns, plain and dense: bio + lists (left), dated lists (middle), contacts (right).
// Small plain headings, no rules, no footer. Empty or placeholder sections are left out.
const BIG = 'text-[clamp(20px,1.6vw,24px)] leading-[1.2] [overflow-wrap:anywhere]';
const infoSection = (s) => {
  let c = '';
  if (s.style === 'list') {
    const entries = (s.entries || []).filter((e) => real(e.text));
    if (!entries.length) return '';
    c = `<ul>${entries.map((e) => `<li class="grid grid-cols-[88px_minmax(0,1fr)] md:grid-cols-[104px_minmax(0,1fr)] tabular-nums"><span>${esc(real(e.date))}</span><span>${md(e.text)}</span></li>`).join('')}</ul>`;
  } else {
    if (!real(s.text)) return '';
    c = s.style === 'large' ? `<p class="${BIG}">${md(s.text)}</p>` : paras(s.text);
  }
  return `<section><h2>${esc(s.title)}</h2>${c}</section>`;
};
const col = (name) => (info.sections || []).filter((s) => (s.column || 'left') === name).map(infoSection).join('\n');
const COL = 'grid content-start';
writeFileSync(`${OUT}/info.html`, layout({
  title: `Info — ${info.name}`, root: '', page: 'info', path: 'info.html', description: real(info.seo?.info_description) || info.bio,
  image: SEO.image || fire[0]?.src,
  schema: { '@type': 'ProfilePage', mainEntity: { ...PERSON, ...(real(info.bio) && { description: clip(info.bio, 500) }) } },
  body: `<div class="${GRID} items-start gap-y-10 md:gap-y-0 pt-6 md:pt-10 pb-30 text-[14px] leading-[1.3] [&_a:hover]:text-soft">
  <div class="${FULL} md:col-[1/7] ${COL} gap-7"><div class="grid gap-[.5em] ${LARGE} text-pretty [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-1">${paras(info.bio)}</div>${col('left')}</div>
  <div class="${FULL} md:col-[7/10] ${COL} gap-7">${col('middle')}</div>
  <div class="${FULL} md:col-[10/13] ${COL} gap-5">${email ? `<section><h2>General enquiries</h2><p class="${BIG}"><a href="mailto:${esc(email)}">${esc(email)}</a></p></section>` : ''}${col('right')}${instagram ? `<section><h2>Follow</h2><p class="${BIG}"><a href="https://www.instagram.com/${esc(instagram)}/">Instagram</a></p></section>` : ''}</div>
</div>`,
}));

// ── Sitemap and robots.txt ──
// Every published page; hidden projects are never built, so they never appear.
if (SITE) writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\n${SITE ? `\nSitemap: ${SITE}/sitemap.xml\n` : ''}`);

// Compile Tailwind from the classes above.
execFileSync('node_modules/.bin/tailwindcss', ['-i', 'src/style.css', '-o', `${OUT}/assets/style.css`, '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });

console.log(`Built ${OUT}/: index (${projects.length} projects), info.`);
