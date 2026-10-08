#!/usr/bin/env node
/**
 * Generates the animated graphics used in the profile README:
 *   contrib-{dark,light}.svg — contribution calendar that assembles itself particle by particle
 *   stats-{dark,light}.svg   — headline numbers + most-used languages
 *
 * Usage: node scripts/generate-profile-graphics.mjs <github-login> [out-dir]
 *
 * With GITHUB_TOKEN set (always the case inside GitHub Actions) the GraphQL API is used.
 * Without a token it falls back to the public contribution calendar + REST API, so you can
 * preview the output locally. Zero dependencies — needs Node 18+.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LOGIN = process.argv[2] || 'beadarshh';
const OUT_DIR = process.argv[3] || 'dist';
const TOKEN = process.env.GITHUB_TOKEN;
// Notebooks are huge on disk and drown out every other language, so they're hidden by default.
const EXCLUDED_LANGUAGES = new Set(
  (process.env.EXCLUDED_LANGUAGES ?? 'Jupyter Notebook').split(',').map((s) => s.trim()).filter(Boolean),
);

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Code', 'SF Mono', Consolas, Menlo, monospace";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Palette follows beadarsh.in: ink #0B0B0A + brand green #3aaf4b.
const THEMES = {
  dark: {
    bg: '#0B0B0A', tile: '#111512', border: '#1f2a22', text: '#e8efe9', muted: '#8a9a8e', faint: '#56645a',
    accent: '#3aaf4b', levels: ['#161c18', '#0f3d1c', '#1b6e2d', '#3aaf4b', '#86e894'],
    hot: '#c9ffd3', flash: '#ffffff', hotEmpty: '#4d6a55', dust: '#7ee08a', scan: '#a7f3b5', glow: true,
  },
  light: {
    bg: '#ffffff', tile: '#f6f8f7', border: '#d0d7de', text: '#1f2328', muted: '#59636e', faint: '#8c959f',
    accent: '#2f9a40', levels: ['#ebedf0', '#b4e3bd', '#6cc77c', '#3aaf4b', '#1f7a2e'],
    hot: '#3aaf4b', flash: '#0f5c1f', hotEmpty: '#c3cbc5', dust: '#3aaf4b', scan: '#3aaf4b', glow: false,
  },
};

const FALLBACK_LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219', HTML: '#e34c26',
  CSS: '#663399', PHP: '#4F5D95', Vue: '#41b883', Shell: '#89e051', 'Jupyter Notebook': '#DA5B0B',
  Go: '#00ADD8', 'C++': '#f34b7d', C: '#555555', Kotlin: '#A97BFF', Dart: '#00B4AB', SCSS: '#c6538c',
};

/* ------------------------------------------------------------------ data */

async function request(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': `${LOGIN}-profile-graphics`, ...init.headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
}

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function fromGraphQL() {
  const query = `query($login: String!) {
    user(login: $login) {
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
        }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
    }
  }`;
  const res = await request('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));

  const { user } = data;
  const calendar = user.contributionsCollection.contributionCalendar;
  const sizes = new Map();
  for (const repo of user.repositories.nodes) {
    for (const { size, node } of repo.languages.edges) {
      const entry = sizes.get(node.name) ?? { name: node.name, color: node.color, size: 0 };
      entry.size += size;
      sizes.set(node.name, entry);
    }
  }
  return {
    days: calendar.weeks.flatMap((w) => w.contributionDays).map((d) => ({
      date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0,
    })),
    total: calendar.totalContributions,
    repos: user.repositories.totalCount,
    stars: user.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0),
    followers: user.followers.totalCount,
    languages: [...sizes.values()],
  };
}

async function fromPublicPages() {
  const html = await (await request(`https://github.com/users/${LOGIN}/contributions`)).text();
  const counts = new Map();
  for (const [, id, label] of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^([\d,]+) contribution/.exec(label.trim());
    counts.set(id, n ? Number(n[1].replace(/,/g, '')) : 0);
  }
  const days = [];
  for (const [tag, date] of html.matchAll(/<td\b[^>]*\bdata-date="([^"]+)"[^>]*>/g)) {
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    const level = Number(/\bdata-level="(\d)"/.exec(tag)?.[1] ?? 0);
    days.push({ date, level, count: counts.get(id) ?? (level ? 1 : 0) });
  }
  if (!days.length) throw new Error('Could not parse the public contribution calendar');

  const [user, repos] = await Promise.all([
    request(`https://api.github.com/users/${LOGIN}`).then((r) => r.json()),
    request(`https://api.github.com/users/${LOGIN}/repos?per_page=100&type=owner`).then((r) => r.json()),
  ]);
  const own = repos.filter((r) => !r.fork);
  // REST only exposes each repo's primary language, so weight it by repo size as an approximation.
  const sizes = new Map();
  for (const r of own) {
    if (!r.language) continue;
    const entry = sizes.get(r.language) ?? { name: r.language, color: FALLBACK_LANGUAGE_COLORS[r.language], size: 0 };
    entry.size += Math.max(r.size, 1);
    sizes.set(r.language, entry);
  }
  return {
    days,
    total: days.reduce((n, d) => n + d.count, 0),
    repos: own.length,
    stars: own.reduce((n, r) => n + r.stargazers_count, 0),
    followers: user.followers,
    languages: [...sizes.values()],
  };
}

function analyse(data) {
  const days = [...data.days].sort((a, b) => a.date.localeCompare(b.date));
  const firstWeekday = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  days.forEach((d, i) => {
    d.col = Math.floor((i + firstWeekday) / 7);
    d.row = (i + firstWeekday) % 7;
  });

  let longest = { len: 0 };
  let run = null;
  for (const d of days) {
    run = d.count > 0 ? { len: (run?.len ?? 0) + 1, start: run?.start ?? d.date, end: d.date } : null;
    if (run && run.len > longest.len) longest = run;
  }
  // Today may simply not have contributions *yet* — that shouldn't break the current streak.
  let last = days.length - 1;
  if (days[last].count === 0) last--;
  let current = { len: 0 };
  for (let i = last; i >= 0 && days[i].count > 0; i--) current = { len: current.len + 1, start: days[i].date, end: days[last].date };

  const languages = data.languages
    .filter((l) => !EXCLUDED_LANGUAGES.has(l.name))
    .sort((a, b) => b.size - a.size);

  return {
    ...data,
    days,
    languages,
    current,
    longest,
    best: days.reduce((a, b) => (b.count > a.count ? b : a)),
    active: days.filter((d) => d.count > 0).length,
  };
}

/* --------------------------------------------------------------- helpers */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
const r1 = (n) => Math.round(n * 10) / 10;
const fmtDate = (iso, withYear = false) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

const frame = (W, H, t, title, body, style) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
text{font-family:${FONT};fill:${t.text}}
.mono{font-family:${MONO}}
.muted{fill:${t.muted}}
.faint{fill:${t.faint}}
.accent{fill:${t.accent}}
.h{font-size:18px;font-weight:700}
.live{transform-box:fill-box;transform-origin:center;animation:live 2s ease-out infinite}
@keyframes live{0%{transform:scale(1);opacity:.9}100%{transform:scale(3.2);opacity:0}}
${style}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>
`;

const liveDot = (x, y, t) =>
  `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${t.accent}"/><circle cx="${x}" cy="${y}" r="3.5" fill="${t.accent}"/>`;

/* ------------------------------------------------- contribution particles */

function contributionSvg(d, t) {
  const rand = mulberry32(hash(d.days.at(-1).date));
  const W = 900, H = 360, CELL = 12, STEP = 15, CYCLE = 14;
  const cols = d.days.at(-1).col + 1;
  const gridW = cols * STEP - (STEP - CELL);
  const gridH = 7 * STEP - (STEP - CELL);
  const X0 = Math.round((W - gridW) / 2 + 14);
  const Y0 = 104;
  const pos = (day) => [X0 + day.col * STEP, Y0 + day.row * STEP];

  // Month labels on the first column of each month (skipping cramped ones).
  const months = [];
  for (const day of d.days) {
    if (day.row !== 0 && day.col !== 0) continue;
    const m = Number(day.date.slice(5, 7)) - 1;
    if (months.at(-1)?.m === m) continue;
    if (months.length && day.col - months.at(-1).col < 3) months.pop();
    months.push({ m, col: day.col });
  }
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();

  const slots = d.days.map((day) => {
    const [x, y] = pos(day);
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5"/>`;
  }).join('');

  // Every day is a particle: it appears somewhere on the card, flies to its cell,
  // flashes on landing, holds, then drifts away as dust before the loop starts again.
  const particles = d.days.map((day) => {
    const [x, y] = pos(day);
    const sx = -0.1 * W + rand() * 1.2 * W;
    const sy = -0.15 * H + rand() * 1.3 * H;
    const delay = day.col * 0.055 + rand() * 0.45;
    const style = `--x:${r1(sx - x)}px;--y:${r1(sy - y)}px;--x2:${r1(40 + rand() * 220)}px;--y2:${r1(-30 - rand() * 170)}px;animation-delay:${delay.toFixed(2)}s`;
    return `<rect class="p l${day.level}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" style="${style}"/>`;
  }).join('\n');

  const dust = Array.from({ length: 42 }, () => {
    const style = `--dx:${r1(-30 + rand() * 90)}px;--o:${(0.25 + rand() * 0.5).toFixed(2)};animation-duration:${(7 + rand() * 9).toFixed(1)}s;animation-delay:-${(rand() * 14).toFixed(1)}s`;
    return `<circle class="dust" cx="${r1(rand() * W)}" cy="${r1(40 + rand() * (H - 40))}" r="${r1(0.6 + rand() * 1.3)}" style="${style}"/>`;
  }).join('');

  // The scan line sweeps across in step with the landing wave (≈ flight time + column stagger).
  const scanStart = 2.1 / CYCLE * 100, scanEnd = (2.1 + cols * 0.055 + 0.4) / CYCLE * 100;
  const scanDist = gridW + 48;

  const legendX = W - 36 - 5 * STEP - 34;
  const legend = t.levels.map((c, i) => `<rect x="${legendX + i * STEP}" y="${Y0 + gridH + 20}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`).join('');

  const stats = [
    { value: num(d.total), label: 'Total contributions', sub: `${fmtDate(d.days[0].date)} – ${fmtDate(d.days.at(-1).date)}` },
    { value: d.current.len, unit: d.current.len === 1 ? 'day' : 'days', label: 'Current streak', sub: d.current.len ? `${fmtDate(d.current.start)} – ${fmtDate(d.current.end)}` : 'starts with the next commit' },
    { value: d.longest.len, unit: d.longest.len === 1 ? 'day' : 'days', label: 'Longest streak', sub: d.longest.len ? `${fmtDate(d.longest.start)} – ${fmtDate(d.longest.end)}` : '—' },
    { value: d.best.count, unit: d.best.count === 1 ? 'contribution' : 'contributions', label: 'Best day', sub: d.best.count ? fmtDate(d.best.date, true) : '—' },
  ];
  const colW = (W - 64) / stats.length;
  const statBlocks = stats.map((s, i) => `<g class="stat" style="animation-delay:${(3.4 + i * 0.15).toFixed(2)}s">
  <text x="${32 + i * colW}" y="300" style="font-size:26px;font-weight:700">${esc(s.value)}${s.unit ? `<tspan class="muted" style="font-size:13px;font-weight:500"> ${esc(s.unit)}</tspan>` : ''}</text>
  <text x="${32 + i * colW}" y="321" class="muted" style="font-size:11px;letter-spacing:1.2px;font-weight:600">${esc(s.label.toUpperCase())}</text>
  <text x="${32 + i * colW}" y="339" class="faint" style="font-size:11px">${esc(s.sub)}</text>
</g>`).join('\n');

  const style = `
.slot rect{fill:${t.levels[0]};opacity:.35}
.l0{--c:${t.levels[0]};--h:${t.hotEmpty};--f:${t.hotEmpty}}
${t.levels.slice(1).map((c, i) => `.l${i + 1}{--c:${c};--h:${t.hot};--f:${t.flash}}`).join('')}
.p{fill:var(--c);transform-box:fill-box;transform-origin:center;animation:form ${CYCLE}s infinite both}
@keyframes form{
0%{transform:translate(var(--x),var(--y)) scale(.25);opacity:0;fill:var(--h);animation-timing-function:cubic-bezier(.15,.75,.25,1)}
17%{transform:translate(0px,0px) scale(1);opacity:1;fill:var(--f)}
25%{fill:var(--c)}
82%{transform:translate(0px,0px) scale(1);opacity:1;fill:var(--c);animation-timing-function:cubic-bezier(.55,0,.85,.35)}
100%{transform:translate(var(--x2),var(--y2)) scale(.2);opacity:0;fill:var(--h)}}
.dust{fill:${t.dust};animation:dust linear infinite}
@keyframes dust{0%{transform:translate(0px,0px);opacity:0}20%,80%{opacity:var(--o)}100%{transform:translate(var(--dx),-80px);opacity:0}}
.scan{animation:scan ${CYCLE}s linear infinite}
@keyframes scan{0%,${r1(scanStart)}%{transform:translateX(0px);opacity:0}${r1(scanStart + 1.5)}%{opacity:1}${r1(scanEnd)}%{transform:translateX(${scanDist}px);opacity:1}${r1(scanEnd + 2)}%,100%{transform:translateX(${scanDist}px);opacity:0}}
.stat{animation:rise .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{transform:translateY(12px);opacity:0}to{transform:translateY(0px);opacity:1}}
@media (prefers-reduced-motion:reduce){.p,.scan,.dust,.stat{animation:none}.scan,.dust{display:none}}`;

  const body = `<defs>
  <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.scan}" stop-opacity="0"/><stop offset=".5" stop-color="${t.scan}"/><stop offset="1" stop-color="${t.scan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.scan}" stop-opacity="0"/><stop offset="1" stop-color="${t.scan}" stop-opacity=".22"/></linearGradient>
  ${t.glow ? '<filter id="glow" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' : ''}
</defs>
<g>${dust}</g>
${liveDot(37, 64, t)}
<text x="32" y="46" class="h">Contribution Activity</text>
<text x="49" y="68" class="mono muted" style="font-size:11.5px">assembling particle by particle · github.com/${esc(LOGIN)}</text>
<text x="${W - 32}" y="46" text-anchor="end" style="font-size:18px;font-weight:700"><tspan class="accent">${num(d.total)}</tspan> contributions</text>
<text x="${W - 32}" y="68" text-anchor="end" class="muted" style="font-size:12px">in the last year · updated ${fmtDate(d.days.at(-1).date, true)}</text>
<g class="muted" style="font-size:11px">
${months.map((m) => `<text x="${X0 + m.col * STEP}" y="${Y0 - 10}" class="muted">${MONTHS[m.m]}</text>`).join('')}
${[[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].map(([r, l]) => `<text x="${X0 - 9}" y="${Y0 + r * STEP + 10}" text-anchor="end" class="muted">${l}</text>`).join('')}
</g>
<g class="slot">${slots}</g>
<g class="scan"><rect x="${X0 - 58}" y="${Y0 - 6}" width="34" height="${gridH + 12}" fill="url(#trail)"/><rect x="${X0 - 25}" y="${Y0 - 8}" width="2" height="${gridH + 16}" fill="url(#scanGrad)"/></g>
<g${t.glow ? ' filter="url(#glow)"' : ''}>
${particles}
</g>
<text x="32" y="${Y0 + gridH + 30}" class="mono faint" style="font-size:11px">${esc(plural(d.active, 'active day'))} · ${Math.round((d.active / d.days.length) * 100)}% of the year</text>
<text x="${legendX - 8}" y="${Y0 + gridH + 30}" text-anchor="end" class="muted" style="font-size:11px">Less</text>
${legend}
<text x="${legendX + 5 * STEP + 5}" y="${Y0 + gridH + 30}" class="muted" style="font-size:11px">More</text>
<line x1="32" x2="${W - 32}" y1="262.5" y2="262.5" stroke="${t.border}"/>
${statBlocks}`;

  return frame(W, H, t, `${LOGIN}'s contribution graph — ${num(d.total)} contributions in the last year`, body, style);
}

/* ------------------------------------------------------------ stats card */

function statsSvg(d, t) {
  const W = 900, H = 274;
  const metrics = [
    ['Public repos', d.repos],
    ['Stars earned', d.stars],
    ['Followers', d.followers],
    // Calendar-based numbers include private work (when "private contributions" is enabled on the profile).
    ['Contributions', d.total],
    ['Best streak', d.longest.len],
    ['Active days', d.active],
  ];
  const TW = 136, TH = 74, GAP = 12;
  const tiles = metrics.map(([label, value], i) => {
    const x = 32 + (i % 3) * (TW + GAP), y = 90 + Math.floor(i / 3) * (TH + GAP);
    return `<g class="tile" style="animation-delay:${(0.15 + i * 0.08).toFixed(2)}s">
  <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="12" fill="${t.tile}" stroke="${t.border}"/>
  <rect x="${x}" y="${y + 18}" width="3" height="${TH - 36}" rx="1.5" fill="${t.accent}"/>
  <text x="${x + 16}" y="${y + 37}" style="font-size:24px;font-weight:700">${num(value)}</text>
  <text x="${x + 16}" y="${y + 57}" class="muted" style="font-size:10px;letter-spacing:.6px;font-weight:600">${esc(label.toUpperCase())}</text>
</g>`;
  }).join('\n');

  const PX = 500, PW = W - 32 - PX;
  const total = d.languages.reduce((n, l) => n + l.size, 0) || 1;
  const top = d.languages.slice(0, 6);
  const rest = d.languages.slice(6).reduce((n, l) => n + l.size, 0);
  const segs = [...top, ...(rest ? [{ name: 'Other', color: t.faint, size: rest }] : [])];
  let cursor = PX;
  const bar = segs.map((l, i) => {
    const w = (l.size / total) * PW;
    const out = `<rect class="seg" x="${r1(cursor)}" y="118" width="${r1(w + 0.5)}" height="12" fill="${l.color ?? t.accent}" style="animation-delay:${(0.5 + i * 0.12).toFixed(2)}s"/>`;
    cursor += w;
    return out;
  }).join('');
  const legend = top.map((l, i) => {
    const x = PX + (i % 2) * (PW / 2 + 8), y = 166 + Math.floor(i / 2) * 30;
    const pct = (l.size / total) * 100;
    return `<g class="tile" style="animation-delay:${(0.7 + i * 0.08).toFixed(2)}s">
  <circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${l.color ?? t.accent}"/>
  <text x="${x + 18}" y="${y}" style="font-size:13px;font-weight:600">${esc(l.name)}</text>
  <text x="${x + PW / 2 - 16}" y="${y}" text-anchor="end" class="mono muted" style="font-size:12px">${pct < 0.1 ? '&lt;0.1' : pct.toFixed(1)}%</text>
</g>`;
  }).join('\n');

  const style = `
.tile{animation:rise .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{transform:translateY(10px);opacity:0}to{transform:translateY(0px);opacity:1}}
.seg{transform-box:fill-box;transform-origin:left center;animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.sheen{animation:sheen 4.5s ease-in-out 1.8s infinite both}
@keyframes sheen{0%{transform:translateX(0px)}60%,100%{transform:translateX(${PW + 120}px)}}
@media (prefers-reduced-motion:reduce){.tile,.seg,.sheen{animation:none}.sheen{display:none}}`;

  const body = `<defs>
  <clipPath id="barClip"><rect x="${PX}" y="118" width="${PW}" height="12" rx="6"/></clipPath>
  <linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
${liveDot(37, 64, t)}
<text x="32" y="46" class="h">GitHub at a Glance</text>
<text x="49" y="68" class="mono muted" style="font-size:11.5px">last 12 months · auto-updated by GitHub Actions</text>
<text x="${W - 32}" y="46" text-anchor="end" class="muted" style="font-size:12px">updated ${fmtDate(d.days.at(-1).date, true)}</text>
${tiles}
<text x="${PX}" y="104" class="muted" style="font-size:11px;letter-spacing:1.2px;font-weight:600">MOST USED LANGUAGES</text>
<rect x="${PX}" y="118" width="${PW}" height="12" rx="6" fill="${t.levels[0]}"/>
<g clip-path="url(#barClip)">${bar}<rect class="sheen" x="${PX - 120}" y="118" width="80" height="12" fill="url(#shine)"/></g>
${legend}`;

  return frame(W, H, t, `${LOGIN}'s GitHub stats and most used languages`, body, style);
}

/* ------------------------------------------------------------------ main */

const raw = TOKEN ? await fromGraphQL() : await fromPublicPages();
const data = analyse(raw);
await mkdir(OUT_DIR, { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  await writeFile(join(OUT_DIR, `contrib-${name}.svg`), contributionSvg(data, t));
  await writeFile(join(OUT_DIR, `stats-${name}.svg`), statsSvg(data, t));
}
console.log(`✓ ${LOGIN}: ${data.total} contributions, ${data.active} active days, ` +
  `streak ${data.current.len}/${data.longest.len}, ${data.languages.length} languages → ${OUT_DIR}/ (${TOKEN ? 'GraphQL' : 'public pages'})`);
