// Renders the whole page from data/*.json. scripts/prerender.py runs this once in headless
// Chrome to write index.html; in the browser it runs again to wire up the interactive bits.
//   profile.json — hand-edited content (bio, experience, news, ...)
//   scholar.json, github.json, orcid.json — refreshed daily by scripts/update_data.py (GitHub Action)

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => norm(s) || 'x';

const ICONS = {
  email: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  cv: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  scholar: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 3 1 9.5l4 2.3V16c0 2.8 3.1 5 7 5s7-2.2 7-5v-4.2l4-2.3zm0 15.5c-2.7 0-4.7-1.4-4.7-2.9 0-1.6 2-2.9 4.7-2.9s4.7 1.3 4.7 2.9c0 1.5-2 2.9-4.7 2.9z"/></svg>',
  github: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" class="fill"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/></svg>',
  orcid: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.3 17.3H6.7V9.7h1.6zM7.5 8.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm2.4.9h3.3c3.1 0 4.5 2.2 4.5 3.9 0 1.9-1.5 3.9-4.5 3.9H9.9zm1.6 1.4v5h1.6c2.3 0 2.9-1.7 2.9-2.5 0-1.3-.8-2.5-2.9-2.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" class="fill"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
};

async function load(path) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1).toLocaleString('en', { month: 'short', year: 'numeric' });
}

// Open external links in a new tab without repeating target/rel in the JSON
function externalize(root) {
  root.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
}

/* ---------------- sections ---------------- */

function renderHero(p) {
  document.querySelectorAll('[data-bind]').forEach((el) => { el.innerHTML = p[el.dataset.bind] ?? ''; });
  $('#photo').src = p.photo;
  $('#emailLink').href = `mailto:${p.email}`;
  $('#emailLink').textContent = p.email;
  const L = p.links;
  // CV buttons only show once a (public) PDF is set in profile.json
  $('#navCv').hidden = !p.cv;
  if (p.cv) $('#navCv').href = p.cv;
  $('#quickLinks').innerHTML = [
    p.cv && `<a class="tag-btn" href="${esc(p.cv)}" target="_blank" rel="noopener">${ICONS.cv}CV</a>`,
    L.scholar && `<a class="tag-btn" href="https://scholar.google.com/citations?user=${esc(L.scholar)}&hl=en">${ICONS.scholar}Google Scholar</a>`,
  ].filter(Boolean).join('');
  const socials = [
    ['Email', `mailto:${p.email}`, ICONS.email],
    L.github && ['GitHub', `https://github.com/${L.github}`, ICONS.github],
    L.linkedin && ['LinkedIn', `https://www.linkedin.com/in/${L.linkedin}`, ICONS.linkedin],
    L.orcid && ['ORCID', `https://orcid.org/${L.orcid}`, ICONS.orcid],
  ].filter(Boolean);
  $('#socials').innerHTML = socials.map(([t, u, i]) =>
    `<li><a href="${esc(u)}" aria-label="${t}" title="${t}">${i}</a></li>`).join('');
  $('#contactBtn').href = `mailto:${p.email}`;
  $('#contactBtn').textContent = p.email;
  externalize($('#about'));
}

function renderStats(p, scholar) {
  const s = scholar?.stats || {};
  const papers = Math.max(p.publications.length, scholar?.publications?.length || 0);
  const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;
  // Scholar metrics, refreshed daily by the updater
  const items = [
    [papers, plural(papers, 'paper')],
    s.citations != null && [s.citations, plural(s.citations, 'citation')],
    s.h_index != null && [s.h_index, 'h-index'],
  ].filter(Boolean);
  $('#stats').style.gridTemplateColumns = `repeat(${items.length}, 1fr)`;
  $('#stats').innerHTML = items.map(([n, l]) =>
    `<div><b>${esc(n)}</b><span>${l}</span></div>`).join('');
}

// Each research area lists the work behind it, like "Area: Paper (Venue) · Project"
function renderFocus(p) {
  $('#focus').innerHTML = p.focus.map((f) => `
    <li><b>${esc(f.title)}:</b>
      ${(f.work || []).map((w) => `<a href="${esc(w.url)}">${esc(w.label)}</a>${w.venue ? ` <span class="venue-tag">(${esc(w.venue)})</span>` : ''}`).join(' · ')}
    </li>`).join('');
  externalize($('#focus'));
}

function renderNews(p) {
  const news = [...p.news].sort((a, b) => b.date.localeCompare(a.date));
  const LIMIT = 4;
  const draw = (all) => {
    $('#newsList').innerHTML = (all ? news : news.slice(0, LIMIT)).map((n) =>
      `<li><time>${fmtMonth(n.date)}</time><span>${n.icon || '•'} ${n.html}</span></li>`).join('');
    externalize($('#newsList'));
  };
  draw(false);
  const btn = $('#newsMore');
  btn.hidden = news.length <= LIMIT;
  btn.onclick = () => { draw(true); btn.hidden = true; };
}

// Compact experience list in the side card; click an entry to see its details
function renderExperience(p) {
  const LIMIT = 3;
  $('#experience').innerHTML = p.experience.map((e, i) => `
    <li${e.marine ? ' class="marine"' : ''}${i >= LIMIT ? ' hidden' : ''}>
      <details>
        <summary>
          <span class="exp-row"><span class="exp-org">${e.url ? `<a href="${esc(e.url)}">${esc(e.org)}</a>` : esc(e.org)}</span><span class="exp-where">${esc(e.where)}</span></span>
          <span class="exp-row"><span>${esc(e.role)}</span><span class="exp-date">${esc(e.dates)}</span></span>
        </summary>
        <ul>${e.points.map((pt) => `<li>${pt}</li>`).join('')}</ul>
      </details>
    </li>`).join('');
  externalize($('#experience'));
  const btn = $('#expMore');
  btn.hidden = p.experience.length <= LIMIT;
  btn.onclick = () => { $('#experience').querySelectorAll('li[hidden]').forEach((li) => { li.hidden = false; }); btn.hidden = true; };

  $('#education').innerHTML = p.education.map((e) => `
    <div class="edu"><h4>${esc(e.degree)}</h4><p>${esc(e.school)}</p><p class="tl-meta">${esc(e.meta)}</p></div>`).join('');
  $('#beyond').innerHTML = (p.background || []).map((b) => `
    <article class="beyond"><h3>${esc(b.title)}</h3><p class="tl-meta">${esc(b.meta)}</p><p>${b.html}</p></article>`).join('');
}

// Hand-curated entries win; anything new on Scholar or ORCID is appended automatically.
function mergePublications(manual, scholar, orcid) {
  const pubs = manual.map((m) => ({ ...m }));
  const byTitle = new Map(pubs.map((m) => [norm(m.title), m]));
  for (const s of scholar?.publications || []) {
    const hit = byTitle.get(norm(s.title));
    if (hit) {
      hit.citations = s.citations;
      hit.scholarUrl = s.url;
    } else {
      pubs.push({
        title: s.title, authors: esc(s.authors), venue: s.venue, year: s.year,
        badge: (s.venue || 'Paper').split(/[\s,]+/).slice(-2).join(' '),
        tags: [], links: s.url ? { Scholar: s.url } : {},
        citations: s.citations, fromScholar: true,
      });
      byTitle.set(norm(s.title), pubs[pubs.length - 1]);
    }
  }
  for (const w of orcid?.works || []) {
    const hit = byTitle.get(norm(w.title));
    if (hit) {
      if (w.doi && !Object.values(hit.links).some((u) => u.includes(w.doi))) hit.links.DOI = `https://doi.org/${w.doi}`;
    } else {
      pubs.push({
        title: w.title, authors: '', venue: w.venue, year: w.year,
        badge: w.venue || 'Paper', tags: [], links: w.url ? { [w.doi ? 'DOI' : 'Link']: w.url } : {},
      });
    }
  }
  return pubs.sort((a, b) => (b.year || 0) - (a.year || 0));
}

function renderPublications(p, scholar, orcid) {
  const pubs = mergePublications(p.publications, scholar, orcid);
  const tags = [...new Set(pubs.flatMap((x) => x.tags || []))];
  $('#pubFilters').innerHTML = ['All', ...tags].map((t, i) =>
    `<button class="chip ${i ? '' : 'active'}" data-filter="${i ? slug(t) : 'all'}">${esc(t)}</button>`).join('');

  $('#pubs').innerHTML = pubs.map((x) => {
    const links = Object.entries(x.links || {}).map(([k, u]) => `<a href="${esc(u)}">${esc(k)}</a>`);
    if (x.scholarUrl) links.push(`<a href="${esc(x.scholarUrl)}">Scholar</a>`);
    return `
    <li class="pub" data-tags="${(x.tags || []).map(slug).join(' ')}">
      <div class="pub-badge">${esc(x.badge || 'Paper')}<br><b>${esc(x.year || '')}</b></div>
      <div class="pub-body">
        <h3>${esc(x.title)}</h3>
        <p class="authors">${x.authors}</p>
        <p class="venue">${esc(x.venue)}${x.citations ? ` · <span class="cites">${x.citations} citation${x.citations > 1 ? 's' : ''}</span>` : ''}</p>
        <div class="pub-links">
          ${links.join('')}
          ${x.abstract ? '<button class="abs-toggle" type="button">Abstract</button>' : ''}
        </div>
        ${x.abstract ? `<p class="abstract" hidden>${esc(x.abstract)}</p>` : ''}
      </div>
    </li>`;
  }).join('');
  externalize($('#pubs'));

  $('#pubFilters').onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#pubFilters .chip').forEach((c) => c.classList.toggle('active', c === chip));
    const f = chip.dataset.filter;
    document.querySelectorAll('.pub').forEach((el) => {
      el.hidden = f !== 'all' && !el.dataset.tags.split(' ').includes(f);
    });
  };
  $('#pubs').onclick = (e) => {
    const btn = e.target.closest('.abs-toggle');
    if (!btn) return;
    const abs = btn.closest('.pub-body').querySelector('.abstract');
    abs.hidden = !abs.hidden;
    btn.classList.toggle('on', !abs.hidden);
  };

  const sid = p.links.scholar;
  $('#scholarNote').innerHTML = sid
    ? `Synced from <a href="https://scholar.google.com/citations?user=${esc(sid)}&hl=en" target="_blank" rel="noopener">Google Scholar</a>${scholar?.updated ? ` · ${new Date(scholar.updated).toLocaleDateString('en', { dateStyle: 'medium' })}` : ''}.`
    : '';
}

function renderProjects(p) {
  $('#projectCards').innerHTML = p.projects.map((x) => `
    <article class="card">
      <span class="tag">${esc(x.tag)}</span>
      <h3>${esc(x.title)}</h3>
      <p>${esc(x.text)}</p>
      ${x.collab ? `<p class="collab">With ${x.collab}</p>` : ''}
    </article>`).join('');
  externalize($('#projectCards'));
}

// Repos come from data/github.json, refreshed daily (pinned repos need GraphQL + a token)
const loadGithub = () => load('data/github.json');

function renderRepos(p, gh) {
  const user = p.links.github;
  const all = gh?.repos || [];
  // Repos pinned on the GitHub profile come first, in GitHub's order; remaining slots
  // fill with the most-starred, then most recently updated repos.
  const notes = p.repoDescriptions || {};
  const byName = new Map(all.map((r) => [r.name.toLowerCase(), r]));
  const withNote = (r) => ({ ...r, description: r.description || notes[r.name] });
  const pinned = (gh?.pinned || [])
    .map((name) => byName.get(name.toLowerCase()))
    .filter(Boolean)
    .map(withNote);
  const pinnedNames = new Set(pinned.map((r) => r.name));
  const rest = all
    .filter((r) => !pinnedNames.has(r.name) && r.name.toLowerCase() !== user.toLowerCase())
    .sort((a, b) => b.stars - a.stars || b.pushed_at.localeCompare(a.pushed_at))
    .map(withNote);
  const repos = [...pinned, ...rest].slice(0, 6);
  $('#repos').innerHTML = repos.length ? repos.map((r) => `
    <a class="card repo" href="${esc(r.url)}" target="_blank" rel="noopener">
      <h3>${ICONS.github}<span>${esc(r.name).replace(/_/g, '_<wbr>')}</span></h3>
      <p>${esc(r.description || 'No description')}</p>
      <div class="repo-meta">
        ${r.language ? `<span><i class="lang-dot"></i>${esc(r.language)}</span>` : ''}
        <span>${ICONS.star}${r.stars}</span>
        <span>Updated ${new Date(r.pushed_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>
      </div>
    </a>`).join('')
    : '<p class="note">Repositories will appear here once GitHub data is available.</p>';
  const count = gh?.profile?.public_repos || all.length;
  $('#ghNote').innerHTML = `See all ${count ? count + ' ' : ''}repositories on <a href="https://github.com/${esc(user)}" target="_blank" rel="noopener">github.com/${esc(user)}</a>.`;
}

// Tools and certificates as quiet one-liners under Education (researchers don't need a skills section)
function renderTools(p) {
  const lines = [];
  if (p.tools?.length) lines.push(`<li class="cert-line"><span>Tools</span>${p.tools.map(esc).join(' · ')}</li>`);
  const certs = [...p.certifications].reverse();
  if (certs.length) {
    const short = (n) => n.replace(/ Specialization$/, '').replace('Natural Language Processing', 'NLP');
    const years = [...new Set(certs.map((c) => c.date.slice(-4)))].join('–');
    lines.push(`<li class="cert-line"><span>Coursera · ${esc(certs[0].issuer)} (${esc(years)})</span>
      ${certs.map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(short(c.name))}</a>`).join(' · ')} Specializations</li>`);
  }
  $('#certs').innerHTML = lines.join('');
}

// CV-style one-liners: "Award (twice) — Issuer · Spring 2025, Fall 2025", terms link to certificates
function renderAwards(p) {
  const list = p.awards || [];
  $('#awards').hidden = !list.length;
  $('#awardList').innerHTML = list.map((a) => `
    <li><b>${esc(a.name)}</b>${a.note ? ` (${esc(a.note)})` : ''} — ${esc(a.issuer)} ·
      ${(a.terms || []).map((t) => t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.label)}</a>` : esc(t.label)).join(', ')}</li>`).join('');
}

function renderMentors(p) {
  const list = p.mentors || [];
  $('#mentors').previousElementSibling.hidden = !list.length;
  $('#mentors').innerHTML = list.map((m) =>
    `<li><a href="${esc(m.url)}">${esc(m.name)}</a><span>${esc(m.role)}</span></li>`).join('');
  externalize($('#mentors'));
}

/* ---------------- UI chrome ---------------- */

function initChrome() {
  const root = document.documentElement;
  $('#themeToggle').onclick = () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  };
  const nav = $('#nav');
  $('#menuBtn').onclick = () => nav.classList.toggle('open');
  nav.onclick = (e) => { if (e.target.tagName === 'A') nav.classList.remove('open'); };

  // Highlight the nav link of the section in view
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.hash === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));

  // Fade sections in on scroll
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); reveal.unobserve(en.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section').forEach((s) => reveal.observe(s));

}

/* ---------------- boot ---------------- */

const PRERENDER = new URLSearchParams(location.search).has('prerender');

(async function main() {
  const [profile, scholar, orcid] = await Promise.all([
    load('data/profile.json'), load('data/scholar.json'), load('data/orcid.json'),
  ]);
  if (!profile) {
    $('#app').innerHTML = '<p class="note" style="padding:4rem 0">Could not load data/profile.json. Serve this folder over HTTP (e.g. <code>python3 -m http.server</code>) rather than opening the file directly.</p>';
    initChrome();
    return;
  }
  renderHero(profile);
  renderFocus(profile);
  renderNews(profile);
  renderExperience(profile);
  renderPublications(profile, scholar, orcid);
  renderProjects(profile);
  renderAwards(profile);
  renderTools(profile);
  renderMentors(profile);
  renderStats(profile, scholar);
  renderRepos(profile, await loadGithub());
  $('#year').textContent = new Date().getFullYear();
  // scripts/prerender.py snapshots the page at this point; it wants plain, fully visible HTML
  if (PRERENDER) { document.documentElement.classList.remove('js'); return; }
  // Start scroll-spy/reveal only once sections have their real height
  initChrome();
})();
