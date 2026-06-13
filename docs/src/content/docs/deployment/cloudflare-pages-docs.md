---
title: Cloudflare Pages (Docs)
description: How this docs site itself is deployed.
sidebar:
  order: 4
---

This documentation site (the one you're reading) is built with **Astro
Starlight** and deployed to **Cloudflare Pages** at `tinadiet.com`.

## Project config

- **Pages project name**: `tinadiet-docs`
- **Source**: GitHub `einsze/tinadiet`, builds from `projects/docs/`
- **Build framework**: Astro (auto-detected)
- **Custom domain**: `tinadiet.com` (apex)

## Build settings

In Cloudflare Pages dashboard → tinadiet-docs → Settings → Builds & deployments:

- **Production branch**: `main`
- **Build command**: `cd projects/docs && npm install && npm run build`
- **Build output directory**: `projects/docs/dist`
- **Root directory**: `/` (project root, build cd's into projects/docs)
- **Environment variables**: `NODE_VERSION=22`

## Local development

```bash
cd projects/docs
npm install         # first time
npm run dev         # Astro dev server on http://localhost:4321
```

Hot reload: any change in `src/content/docs/*.md`, `src/pages/*`, or
`astro.config.mjs` triggers automatic refresh.

```bash
npm run build       # static build into dist/
npm run preview     # preview prod build locally
```

## Site structure

Astro + Starlight conventions:

```
projects/docs/
├── astro.config.mjs       Site + Starlight config
├── src/
│   ├── content.config.ts  Starlight content collection registration
│   ├── content/docs/      Markdown pages (this is what you're editing)
│   │   ├── index.mdx      Homepage (uses Starlight `splash` template)
│   │   ├── introduction.md
│   │   ├── getting-started/
│   │   ├── architecture/
│   │   ├── backend/
│   │   ├── liff/
│   │   ├── payments/
│   │   ├── deployment/
│   │   ├── ops/
│   │   └── reference/
│   ├── pages/
│   │   └── index.astro    Apex landing page (NOT Starlight; separate)
│   ├── styles/
│   │   └── brand.css      Rose-pink palette overrides
│   └── assets/            mascot.png imported into pages
└── public/                static assets (favicon, og:image, mascot copy)
```

## Sidebar

Auto-generated from folder structure (configured in `astro.config.mjs`):

```js
sidebar: [
  { label: 'Introduction', slug: 'introduction' },
  { label: 'Getting Started', autogenerate: { directory: 'getting-started' } },
  { label: 'Architecture', autogenerate: { directory: 'architecture' } },
  // ...
]
```

To control order within a directory, use `sidebar.order` in frontmatter:

```markdown
---
title: Prerequisites
sidebar:
  order: 1
---
```

Lower numbers appear first.

## Routing

URL structure:
- `tinadiet.com/` → `src/pages/index.astro` (apex landing)
- `tinadiet.com/<slug>/` → corresponding markdown in `src/content/docs/`
  - e.g. `/architecture/overview/` → `src/content/docs/architecture/overview.md`

Note Starlight uses **directory-with-index** routing by default (so the
URL is `/architecture/overview/` not `/architecture/overview.html`).
Astro's `trailingSlash` setting controls whether the trailing `/` is
enforced; default behavior is fine.

## Search

Pagefind is bundled with Starlight — full-text search of all docs at
build time. Search bar in top nav (kbd `Ctrl+K` / `Cmd+K`). No
configuration needed; works automatically.

## Theme

`src/styles/brand.css` overrides Starlight's default Tailwind palette to
match Tina Diet's rose-pink brand:

```css
:root[data-theme='light'] {
  --sl-color-accent: #ec4571;
  --sl-color-accent-low: #ffe4ec;
  --sl-color-accent-high: #be3252;
}
```

Imported in `astro.config.mjs` `customCss: ['./src/styles/brand.css']`.

Light/dark toggle is built into Starlight (top right corner).

## Adding a new page

1. Create `.md` (or `.mdx` if using JSX components) in
   `src/content/docs/<section>/<page>.md`
2. Add frontmatter:
   ```yaml
   ---
   title: My New Page
   description: Short summary for SEO + meta.
   sidebar:
     order: 3
   ---
   ```
3. Write markdown body
4. If using Card / Tabs / Steps components: use `.mdx` extension and
   `import { Card } from '@astrojs/starlight/components';` at top

The sidebar will auto-update with the new page in the appropriate
section.

## MDX vs MD

| Need | Use |
|---|---|
| Pure markdown text + code | `.md` (simpler) |
| Star­light components (Card, Tabs, Steps, Aside, LinkCard) | `.mdx` |
| Custom React components | `.mdx` |
| Mixed (some pages need components, some don't) | Mix — each file independent |

## Deploying

Push to `main` branch:
```bash
git add projects/docs/
git commit -m "docs: add section X"
git push
```

Cloudflare Pages auto-builds (~30-90 seconds depending on cache). Watch
the build at Cloudflare dashboard → Pages → tinadiet-docs → Deployments.

If build fails, check the log. Common failures:
- Markdown frontmatter syntax error → check YAML
- Internal link to non-existent page → Starlight warns at build time
- MDX import path wrong → check `import { Card } from '@astrojs/starlight/components'`

## Preview deploys

Every commit on a non-main branch creates a **preview deploy** at a
unique `*.tinadiet-docs.pages.dev` URL. Useful for reviewing changes
before merging.

## Custom domain setup

`tinadiet.com` (apex) is claimed as custom domain on the Pages project:
1. Cloudflare dashboard → Pages → tinadiet-docs → Custom Domains
2. Add `tinadiet.com`
3. DNS auto-created (CNAME at apex via Cloudflare flattening)
4. SSL auto-provisioned

For www subdomain: optional 301 redirect via Cloudflare Page Rule
`www.tinadiet.com → tinadiet.com`. Currently not configured.

## Maintenance

- **Single source of truth**: code is canon. When code changes, update
  docs in the same PR.
- **Frontmatter discipline**: title + description required for every page.
- **Sync from `projects/ops/DB_QUERIES.md`**: docs page
  `/ops/db-queries/` should mirror the ops runbook. Currently manual
  copy; could automate with a build script later.

See `projects/docs/README.md` for the full plan and conventions.
