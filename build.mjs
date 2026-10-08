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

// Placeholder text like "[Year]" or "[Client], [Client]" is never published.
// Real links "[label](https://…)" are fine; anything else with a "[" is a placeholder.
const real = (s) => {
  const t = String(s ?? '').trim();
  return t.replace(/\[([^\]]+)\]\(([^)\s[\]]+)\)/g, '').includes('[') ? '' : t;
};

// Two sections, each on its own page and never mixed: research is the home page,
// commissions have their own. "personal" is the stored value for Research.
const SECTIONS = [
  { key: 'personal', page: 'index.html', label: 'Research', prefix: 'R', statement: 'research_statement', intro: 'research_intro', cta: 'Get in touch',
    footer: 'For exhibitions, publications and collaborations.' },
  { key: 'commission', page: 'commissions.html', label: 'Commissions', prefix: 'C', statement: 'statement', intro: 'intro', cta: 'Enquire about a commission',
    footer: 'Available for commissions in hospitality, architecture and interiors.' },
];
const COMMISSIONS = SECTIONS[1];
const sectionOf = (p) => SECTIONS.find((s) => s.key === p.section) || COMMISSIONS;
const projects = readdirSync('content/projects')
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ slug: f.replace(/\.json$/, ''), ...read(`content/projects/${f}`) }))
  .filter((p) => !p.draft)
  .sort((a, b) => SECTIONS.indexOf(sectionOf(a)) - SECTIONS.indexOf(sectionOf(b)) || (Number(a.order) || 99) - (Number(b.order) || 99));
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

const block = (b, root, fig) => {
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

const email = real(info.email);
const instagram = real(info.instagram).replace(/^@/, '');
const contactHref = (root) => (email ? `mailto:${email}` : `${root}info.html`);

const layout = ({ title, body, root, page, description, section = COMMISSIONS }) => `<!doctype html>
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
  <nav>${SECTIONS.map((s) => `<a href="${root}${s.page}"${page === s.key ? ' aria-current="page"' : page === 'project' && section === s ? ' aria-current="true"' : ''}>${s.label}</a>`).join('')}<a href="${root}info.html"${page === 'info' ? ' aria-current="page"' : ''}>Info</a><a class="nav-contact" href="${contactHref(root)}">Contact</a></nav>
</header>
<main>
${body}
</main>
<footer class="site-footer grid">
  <p class="f-lead">${section.footer}</p>
  <p class="f-contact">${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : `<a href="${root}info.html">Contact details</a>`}${instagram ? `<br><a href="https://www.instagram.com/${esc(instagram)}/">Instagram</a>` : ''}</p>
  <p class="f-base label">${esc(info.name)} · ${esc(real(info.location) || 'Amsterdam')}</p>
</footer>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/projects`, { recursive: true });
copyDir('assets', `${OUT}/assets`);
if (existsSync('media')) copyDir('media', `${OUT}/media`);

// One line of facts per project: client, place, year, type — whatever is filled in.
const facts = (p) => [p.client, p.location, p.year, p.type].map(real).filter(Boolean);

// ── Index (home) ──
// Each project is one catalogue entry: number and facts on the left, up to four
// photographs at one size on the right, so the work can be compared at a glance.
const entry = (p) => {
  const tiles = indexMedia(p);
  return `<li><a class="entry grid" href="projects/${p.slug}.html">
  <div class="e-label"><span class="no label">${p.no}</span><h3>${esc(p.title)}</h3><p>${facts(p).map(esc).join('<br>')}</p></div>
  <div class="e-tiles" style="--n:${tiles.length}">${tiles.map((t) => `<figure><img src="${esc(src(still(t.image), ''))}" alt="${esc(t.alt)}" loading="lazy"></figure>`).join('')}</div>
</a></li>`;
};
SECTIONS.forEach((s) => {
  const list = projects.filter((p) => sectionOf(p) === s);
  const statement = real(info[s.statement]);
  const intro = real(info[s.intro]);
  writeFileSync(`${OUT}/${s.page}`, layout({
    title: s.page === 'index.html' ? info.name : `${s.label} — ${info.name}`, root: '', page: s.key, section: s,
    description: statement && intro ? `${statement} ${intro.replace(/\s+/g, ' ')}` : '',
    body: `<section class="intro grid">
  ${statement ? `<h1>${md(statement)}</h1>` : ''}
  ${intro ? `<div class="intro-sub">${paras(intro)}<p><a class="cta" href="${contactHref('')}">${email ? s.cta : 'Contact'} →</a></p></div>` : ''}
</section>
${list.length ? `<section class="catalogue">
  <h2 class="section-head label"><span>${s.label}</span><span>${String(list.length).padStart(2, '0')}</span></h2>
  <ol>
${list.map(entry).join('\n')}
  </ol>
</section>` : ''}`,
  }));
});

// Old links to the work list land on the commissions.
writeFileSync(`${OUT}/work.html`, `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=commissions.html"><link rel="canonical" href="commissions.html"><title>${esc(info.name)}</title><a href="commissions.html">${esc(info.name)}</a>`);

// ── Project pages ──
projects.forEach((p) => {
  // "Next" stays inside the project's own section.
  const s = sectionOf(p);
  const own = projects.filter((x) => sectionOf(x) === s);
  const next = own[(own.indexOf(p) + 1) % own.length];
  const meta = [['Client', p.client], ['Location', p.location], ['Year', p.year], ['Type', p.type], ['Role', p.role]].map(([k, v]) => [k, real(v)]).filter(([, v]) => v);
  const credits = (p.credits || []).filter((c) => real(c.role) || real(c.name));
  const description = real(p.description);
  // Number every image so the contact sheet can jump to it.
  let n = 0;
  const fig = (item, root) => `<figure id="i${++n}">${media(item, root)}${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}</figure>`;
  const sheet = allMedia(p);
  writeFileSync(`${OUT}/projects/${p.slug}.html`, layout({
    title: `${p.title} — ${info.name}`, root: '../', page: 'project', section: s, description,
    body: `<article class="project">
  <header class="p-head grid">
    <p class="p-no label"><a href="../${s.page}">${s.label}</a> / ${p.no}</p>
    <h1>${esc(p.title)}</h1>
    <dl class="meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${description ? `<div class="context">${paras(description)}</div>` : ''}
  </header>
  ${sheet.length > 2 ? `<nav class="sheet" aria-label="All images">${sheet.map((m, k) => `<a href="#i${k + 1}"><img src="${esc(src(still(m.image), '../'))}" alt="" loading="lazy"><span class="label">${String(k + 1).padStart(2, '0')}</span></a>`).join('')}</nav>` : ''}
  ${(p.blocks || []).map((b) => block(b, '../', fig)).join('\n  ')}
  ${credits.length ? `<section class="credits grid"><h2 class="label">Credits</h2><dl class="meta">${credits.map((c) => `<dt>${esc(real(c.role))}</dt><dd>${esc(real(c.name))}</dd>`).join('')}</dl></section>` : ''}
  ${next !== p ? `<a class="next" href="${next.slug}.html"><span class="label">Next · ${next.no}</span><span class="next-title">${esc(next.title)} →</span></a>` : ''}
</article>`,
  }));
});

// ── Info ──
// Same language as the catalogue: the bio large with contact details beside it,
// then each section as a ruled list — date on the left, text on the right.
// "Large text" sections join the contact details; empty or placeholder sections are left out.
const heading = (t) => esc(String(t || '').replace(/:\s*$/, ''));
const infoSections = (info.sections || []).map((s) => ({ ...s, entries: (s.entries || []).filter((e) => real(e.text)) }));
const contact = [
  email && ['Email', `<a href="mailto:${esc(email)}">${esc(email)}</a>`],
  instagram && ['Instagram', `<a href="https://www.instagram.com/${esc(instagram)}/">@${esc(instagram)}</a>`],
  real(info.location) && ['Based in', esc(real(info.location))],
  ...infoSections.filter((s) => s.style === 'large' && real(s.text)).map((s) => [heading(s.title), md(s.text)]),
].filter(Boolean);
const infoSection = (s) => {
  if (s.style === 'large') return '';
  if (s.style === 'list') {
    if (!s.entries.length) return '';
    return `<section class="catalogue">
  <h2 class="section-head label"><span>${heading(s.title)}</span><span>${String(s.entries.length).padStart(2, '0')}</span></h2>
  <ol>${s.entries.map((e) => `<li class="fact grid"><span class="f-date">${esc(real(e.date))}</span><span class="f-text">${md(e.text)}</span></li>`).join('')}</ol>
</section>`;
  }
  if (!real(s.text)) return '';
  return `<section class="catalogue">
  <h2 class="section-head label"><span>${heading(s.title)}</span></h2>
  <div class="fact grid"><div class="f-text">${paras(s.text)}</div></div>
</section>`;
};
writeFileSync(`${OUT}/info.html`, layout({
  title: `Info — ${info.name}`, root: '', page: 'info',
  body: `<section class="intro info-intro grid">
  <div class="bio">${paras(info.bio)}</div>
  ${contact.length ? `<dl class="info-contact">${contact.map(([k, v]) => `<dt class="label">${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
</section>
${infoSections.map(infoSection).join('\n')}`,
}));

console.log(`Built ${OUT}/: index (${projects.length} projects), info.`);
