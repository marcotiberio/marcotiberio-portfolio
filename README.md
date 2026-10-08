# Marco Tiberio — portfolio (Pages CMS)

Edit the site at **app.pagescms.org**. Every save publishes the site automatically.

## What's where

- `content/home.json` — photographs for the home page image fire (edited as **Home (image fire)**)
- `content/projects/*.json` — one file per project (edited as **Projects**)
- `content/info.json` — bio, Info sections, email and the Research / Commissions page texts (edited as **Info**)
- `media/` — all images and videos
- `build.mjs` — turns content into the site in `dist/`. The page markup and its Tailwind classes live here.
- `src/style.css` — Tailwind setup: colours (with dark mode), fonts, breakpoints and a few base styles. Compiled by the build.
- `assets/` — the home page script (`fire.js`).
- `.pages.yml` — tells Pages CMS which fields to show.

## One-time setup (≈15 minutes)

1. **Put this folder on GitHub.** Easiest: install GitHub Desktop → File → Add local repository → choose this folder → "Publish repository" (private is fine).
2. **Hosting (free):** netlify.com → Add new site → Import from GitHub → pick the repository. Settings are read from `netlify.toml` (build `node build.mjs`, publish `dist`). Netlify gives you a URL; add your own domain later if you want.
3. **Editor:** app.pagescms.org → Sign in with GitHub → install the Pages CMS GitHub App on that repository → open it.

## Editing

- **Home:** the photographs fired onto the home page, in random order. "Linked project" names the photograph (and links to its project) when a visitor pauses. Add as many as you like.
- **Projects:** "Order" sets the position (1 = first). Tick "Hidden (draft)" to take a project offline. "Images & video" is a list of blocks: Images (layout: full width, centred, offset + note, side by side) or Vimeo.
- **Info:** each section has a column (left / middle / right) and a style (small text, dated list, large text).
- Links in any text: `[text](https://…)`. Empty line = new paragraph.

## Preview locally (optional)

`npm install` (once), then `node build.mjs`, then open `dist/index.html`.
