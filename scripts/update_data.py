#!/usr/bin/env python3
"""Refresh data/scholar.json, data/github.json and data/orcid.json from public profiles.

Stdlib only, so it runs the same locally and in GitHub Actions:
    python3 scripts/update_data.py

On any fetch failure the existing JSON file is left untouched, so a
blocked request never wipes data that is already on the site.
"""
import html
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def text(fragment):
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def fetch_scholar(user_id):
    page = get(f"https://scholar.google.com/citations?user={user_id}&hl=en"
               "&cstart=0&pagesize=100&sortby=pubdate")
    if "gsc_a_tr" not in page and "gsc_rsb_std" not in page:
        raise RuntimeError("unexpected Scholar response (captcha?)")

    # Stats table: [citations all, since, h-index all, since, i10 all, since]
    nums = [int(n) for n in re.findall(r'class="gsc_rsb_std">(\d+)<', page)]
    stats = {}
    if len(nums) >= 6:
        stats = {"citations": nums[0], "h_index": nums[2], "i10_index": nums[4]}

    pubs = []
    for row in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
        title = re.search(r'class="gsc_a_at"[^>]*>(.*?)</a>', row, re.S)
        link = re.search(r'href="(/citations\?view_op=view_citation[^"]+)"', row)
        grays = re.findall(r'<div class="gs_gray">(.*?)</div>', row, re.S)
        cites = re.search(r'class="gsc_a_ac[^"]*"[^>]*>(\d*)<', row)
        year = re.search(r'class="gsc_a_h gsc_a_hc[^"]*">(\d{4})<', row)
        if not title:
            continue
        venue = text(re.sub(r'<span class="gs_oph">.*?</span>', "", grays[1])) if len(grays) > 1 else ""
        pubs.append({
            "title": text(title.group(1)),
            "authors": text(grays[0]) if grays else "",
            "venue": venue,
            "year": int(year.group(1)) if year else None,
            "citations": int(cites.group(1)) if cites and cites.group(1) else 0,
            "url": "https://scholar.google.com" + html.unescape(link.group(1)) if link else None,
        })
    return {"stats": stats, "publications": pubs}


def fetch_github(user):
    headers = {"Accept": "application/vnd.github+json"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    profile = json.loads(get(f"https://api.github.com/users/{user}", headers))
    repos = json.loads(get(f"https://api.github.com/users/{user}/repos?per_page=100&sort=pushed", headers))
    repos = [{
        "name": r["name"],
        "url": r["html_url"],
        "description": r["description"],
        "language": r["language"],
        "stars": r["stargazers_count"],
        "forks": r["forks_count"],
        "pushed_at": r["pushed_at"],
        "topics": r.get("topics", []),
    } for r in repos if not r["fork"] and not r["archived"]]
    return {
        "profile": {k: profile.get(k) for k in ("login", "public_repos", "followers", "html_url")},
        "pinned": fetch_pinned(user, headers),
        "repos": repos,
    }


def fetch_pinned(user, headers):
    """Repos pinned on the GitHub profile, in order. GraphQL only, so it needs a token."""
    if "Authorization" not in headers:
        return []
    query = ('{ user(login: "%s") { pinnedItems(first: 6, types: REPOSITORY) '
             '{ nodes { ... on Repository { name } } } } }' % user)
    req = urllib.request.Request(
        "https://api.github.com/graphql", data=json.dumps({"query": query}).encode(),
        headers={"User-Agent": UA, **headers, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            nodes = json.load(r)["data"]["user"]["pinnedItems"]["nodes"]
        return [n["name"] for n in nodes if n]
    except Exception as e:
        print(f"skip pinned repos: {e}", file=sys.stderr)
        return []


def fetch_orcid(orcid_id):
    data = json.loads(get(f"https://pub.orcid.org/v3.0/{orcid_id}/works",
                          {"Accept": "application/json"}))
    works = []
    for group in data.get("group", []):
        w = group["work-summary"][0]
        ids = {e["external-id-type"]: e for e in (w.get("external-ids") or {}).get("external-id", [])}
        doi = ids.get("doi", {}).get("external-id-value")
        url = (w.get("url") or {}).get("value") or (f"https://doi.org/{doi}" if doi else None)
        year = ((w.get("publication-date") or {}).get("year") or {}).get("value")
        works.append({
            "title": w["title"]["title"]["value"],
            "venue": (w.get("journal-title") or {}).get("value") or "",
            "year": int(year) if year else None,
            "doi": doi,
            "url": url,
        })
    return {"works": works}


def save(name, payload):
    payload["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    (DATA / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote data/{name}")


def main():
    links = json.loads((DATA / "profile.json").read_text())["links"]
    failed = False
    for name, fn, arg in (("scholar.json", fetch_scholar, links.get("scholar")),
                          ("github.json", fetch_github, links.get("github")),
                          ("orcid.json", fetch_orcid, links.get("orcid"))):
        if not arg:
            continue
        try:
            save(name, fn(arg))
        except Exception as e:  # keep the previous file on any failure
            failed = True
            print(f"skip {name}: {e}", file=sys.stderr)
    return 1 if failed and "--strict" in sys.argv else 0


if __name__ == "__main__":
    sys.exit(main())
