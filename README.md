# Rakib Hossan — Portfolio

A data-driven personal site. The HTML is a shell; `script.js` renders every section from JSON.

| File | What it holds | Updated by |
|---|---|---|
| `data/profile.json` | Bio, news, experience, education, projects, skills, certifications, curated publications | **You** (edit by hand) |
| `data/scholar.json` | Publications, citations, h-index from Google Scholar | `scripts/update_data.py` (daily GitHub Action) |
| `data/github.json` | Public repositories | Same script; the browser also loads repos live from the GitHub API |
| `data/orcid.json` | Works listed on your ORCID record (adds DOI links) | Same script |

New papers that appear on Google Scholar are added to the site automatically. To give one tags, links,
or an abstract, add an entry with the same title to `publications` in `profile.json`.

LinkedIn has no public API, so update experience in `profile.json`.

## Run locally

```bash
cd portfolio
python3 scripts/update_data.py     # optional: refresh Scholar/GitHub data
python3 -m http.server 8000        # then open http://localhost:8000
```

(Opening `index.html` directly with `file://` will not work, because browsers block `fetch()` of local JSON.)

## Deploy (Vercel + rakibhossan.com)

1. Import this repo in Vercel (**Add New → Project → Import Git Repository**).
   Framework preset: **Other**. Leave the build command and output directory empty; it's a static site.
2. Every push to `main` redeploys. `.github/workflows/update-data.yml` refreshes Scholar/GitHub/ORCID
   data daily and commits it, which triggers a redeploy only when something actually changed.
   Run it any time from the repo's **Actions** tab (**Run workflow**).
3. Custom domain: in Vercel go to **Project → Settings → Domains** and add `rakibhossan.com` and `www.rakibhossan.com`.
   Then add the DNS records Vercel shows at your registrar, typically:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`

   HTTPS is issued automatically once DNS resolves.
