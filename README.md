# Rakib Hossan — Portfolio

A data-driven personal site. `script.js` renders every section from JSON, and `scripts/prerender.py`
runs it once in headless Chrome to write a complete, static `index.html`. Visitors, search engines and
link previews get plain HTML; in the browser `script.js` runs again to wire up filters, toggles and the theme.

Edit `template.html` (layout) or `data/profile.json` (content), never `index.html`: it is regenerated.

| File | What it holds | Updated by |
|---|---|---|
| `data/profile.json` | Bio, news, experience, education, projects, mentors, tools, certifications, curated publications | **You** (edit by hand) |
| `data/scholar.json` | Publications, citations, h-index from Google Scholar | `scripts/update_data.py` (daily GitHub Action) |
| `data/github.json` | Public repositories, including pinned ones | Same script |
| `data/orcid.json` | Works listed on your ORCID record (adds DOI links) | Same script |

New papers that appear on Google Scholar are added to the site automatically. To give one tags, links,
or an abstract, add an entry with the same title to `publications` in `profile.json`.

LinkedIn has no public API, so update experience in `profile.json`.

## Run locally

```bash
cd portfolio
python3 scripts/update_data.py     # optional: refresh Scholar/GitHub data
python3 scripts/prerender.py       # rebuild index.html (needs Chrome/Chromium)
python3 -m http.server 8000        # then open http://localhost:8000
```

(Opening `index.html` directly with `file://` will not work, because browsers block `fetch()` of local JSON.)

## Deploy (Vercel + rakibhossan.com)

1. Import this repo in Vercel (**Add New → Project → Import Git Repository**).
   Framework preset: **Other**. Leave the build command and output directory empty; it's a static site.
2. Every push to `main` redeploys. `.github/workflows/update-data.yml` refreshes Scholar/GitHub/ORCID
   data daily, rebuilds `index.html`, and commits only when something actually changed. It also runs
   when you push changes to `profile.json`, `template.html` or `script.js`, so you can skip the local
   prerender step and let it rebuild the page for you (the old `index.html` stays live for about a minute).
   Run it any time from the repo's **Actions** tab (**Run workflow**).
3. Custom domain: in Vercel go to **Project → Settings → Domains** and add `rakibhossan.com` and `www.rakibhossan.com`.
   Then add the DNS records Vercel shows at your registrar, typically:
   - `A` record, host `@`, value `216.198.79.1`
   - `CNAME` record, host `www`, value the project-specific `*.vercel-dns-017.com` target Vercel shows

   HTTPS is issued automatically once DNS resolves.
