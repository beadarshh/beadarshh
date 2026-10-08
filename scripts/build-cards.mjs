#!/usr/bin/env node
/**
 * Builds the static README cards in assets/ so the whole profile reads as one black + green page:
 * about, services, project cards, tech stack, connect tiles and section titles.
 *
 * Edit the CONTENT section below, then run:  node scripts/build-cards.mjs
 * (Animated header/divider/website/footer cards are hand-made SVGs in assets/ and aren't touched.)
 */
import { mkdir, writeFile } from 'node:fs/promises';

/* ---------------------------------------------------------------- CONTENT */

const ABOUT = {
  paragraphs: [
    "I'm a **Software Engineer** and **AI & full-stack developer**, currently a **Software Fellow at Drone Federation India** — building the digital infrastructure behind India's drone ecosystem.",
    'I work across the whole stack: designing APIs, architecting systems, crafting interfaces and wiring AI into products people actually use. I care about **clean architecture**, **fast, delightful UX**, and turning messy real-world problems into simple, elegant software.',
  ],
  chips: ['Software Fellow · DFI', 'B.Tech CSE · 9.05 CGPA', 'Delhi, India'],
  yaml: [
    ['name', '"Adarsh Pandey"'],
    ['role', '"Software Fellow"'],
    ['at', '"Drone Federation India"'],
    ['focus', '[AI, Web Platforms, APIs, UI/UX]'],
    ['education', '"B.Tech CSE · CGPA 9.05"'],
    ['college', '"GTB 4th Centenary Engg. College"'],
    ['based_in', '"Delhi, India"'],
    ['website', 'https://beadarsh.in'],
    ['email', 'connect@beadarsh.in'],
  ],
};

const SERVICES = [
  { icon: 'web', title: 'Scalable Web Apps', desc: 'Modern full-stack products, from database schema to pixel-perfect UI.' },
  { icon: 'api', title: 'Robust APIs', desc: 'Clean, documented APIs that let systems talk to each other seamlessly.' },
  { icon: 'ai', title: 'AI Integration', desc: 'LLMs, RAG, computer vision and ML — shipped inside real products.' },
  { icon: 'design', title: 'UI/UX Design', desc: 'Intuitive, motion-rich interfaces designed in Figma, built for people.' },
  { icon: 'bolt', title: 'Workflow Automation', desc: 'Scripts, bots and pipelines that remove repetitive work.' },
  { icon: 'team', title: 'Technical Leadership', desc: 'Leading teams, reviewing architecture and mentoring developers.' },
];

const PROJECTS = [
  { id: 'diagramgen', icon: 'diagram', name: 'DiagramGen', tags: 'AI · JavaScript', link: '↗ mermaid.beadarsh.in',
    desc: 'AI Mermaid diagram generator — write a prompt between // markers and get a flowchart, sequence diagram or DFD rendered live.' },
  { id: 'easymail', icon: 'mail', name: 'EasyMail', tags: 'TypeScript · Resend', link: '</> self-hosted · open source',
    desc: 'Self-hosted email platform — send, receive and track mail for all your projects, with a keyed contact API that never exposes a mail key.' },
  { id: 'content-protection', icon: 'shield', name: 'React Content Protection', tags: 'React · npm package', link: '$ npm i @beadarshh/react-content-protection',
    desc: 'Configurable React package that protects web content by blocking copying, right-clicks, printing, shortcuts and developer tools.' },
  { id: 'alex', icon: 'chat', name: 'Alex — AI Interview Assistant', tags: 'Python · YOLOv8 · Gemini', link: '</> open source',
    desc: 'Real-time interview practice: posture detection from your webcam, voice analysis for tone, pace and filler words, plus AI feedback.' },
  { id: 'drone-anomaly', icon: 'chart', name: 'Drone Flight Anomaly Detection', tags: 'ML · Drones', link: '↗ live demo',
    desc: 'Detecting anomalies in drone flight data, with a live web demo — rooted in the drone ecosystem I build for every day.' },
  { id: 'mascot-buddy', icon: 'mascot', name: 'Mascot Buddy', tags: 'JavaScript · Browser', link: '</> open source',
    desc: 'A draggable mascot that lives on every webpage — it follows your cursor with its eyes and reacts when you poke it.' },
];

const STACK = [
  ['Frontend & Design', [['React', '#61DAFB'], ['Next.js', '#ffffff'], ['Vue', '#41b883'], ['TypeScript', '#3178c6'], ['JavaScript', '#f7df1e'],
    ['Tailwind CSS', '#38bdf8'], ['HTML5', '#e34c26'], ['CSS3', '#2965f1'], ['Figma', '#f24e1e']]],
  ['Backend & Databases', [['Node.js', '#5fa04e'], ['Python', '#4b8bbe'], ['Java', '#f89820'], ['Spring Boot', '#6db33f'], ['Django', '#44b78b'],
    ['Supabase', '#3ecf8e'], ['PostgreSQL', '#4f8cc9'], ['MongoDB', '#47a248']]],
  ['AI, DevOps & Tooling', [['TensorFlow', '#ff6f00'], ['Gemini API', '#8e75ff'], ['LLMs & RAG', '#3aaf4b'], ['Computer Vision', '#2dd4bf'],
    ['Docker', '#2496ed'], ['Git', '#f05032'], ['GitHub Actions', '#2088ff'], ['Selenium', '#43b02a'], ['Vercel', '#ffffff']]],
];

const CONNECT = [
  { id: 'website', icon: 'globe', label: 'Website', value: 'beadarsh.in' },
  { id: 'email', icon: 'mail', label: 'Email', value: 'connect@beadarsh.in' },
  { id: 'linkedin', icon: 'briefcase', label: 'LinkedIn', value: 'in/beadarshh' },
  { id: 'phone', icon: 'phone', label: 'Phone', value: '+91 95559 95196' },
];

const TITLES = {
  featured: ['Featured Work', "// a few things I've built recently", 'more on beadarsh.in ↗'],
  portfolio: ['beadarsh.in', '// my corner of the internet — projects, tools, services & more', 'visit ↗'],
  connect: ["Let's Connect", '// the fastest ways to reach me', 'connect@beadarsh.in'],
};

/* ----------------------------------------------------------------- DESIGN */

// Same palette as beadarsh.in and the generated contribution/stats cards.
const C = {
  ink: '#0B0B0A', tile: '#111512', border: '#1f2a22', text: '#e8efe9', body: '#a9b8ad', muted: '#8a9a8e',
  faint: '#56645a', green: '#3aaf4b', mint: '#a7f3b5', teal: '#2dd4bf',
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Code', 'SF Mono', Consolas, Menlo, monospace";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const BASE_STYLE = `
text{font-family:${FONT};fill:${C.text}}
.mono{font-family:${MONO}}
.rise{animation:rise .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{transform:translateY(14px);opacity:0}to{transform:translateY(0px);opacity:1}}
.runner{fill:none;stroke:url(#runGrad);stroke-width:2;stroke-linecap:round;stroke-dasharray:90 910;animation:run 8s linear infinite}
@keyframes run{from{stroke-dashoffset:0}to{stroke-dashoffset:-1000}}
.mark{transform-box:fill-box;transform-origin:center;animation:mark 4s ease-in-out infinite}
@keyframes mark{0%,100%{transform:rotate(45deg)}50%{transform:rotate(225deg)}}
.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.4s ease-out infinite}
@keyframes pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

let runners = 0;

/** Card frame shared by every block: ink background, soft green glow, hairline border, running light. */
function card({ w, h, x = 0, cw = w, label, body, style = '', glow = [0.85, 0.1] }) {
  const r = 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<defs>
  <radialGradient id="glow" cx="${glow[0]}" cy="${glow[1]}" r=".75"><stop offset="0" stop-color="${C.green}" stop-opacity=".16"/><stop offset="1" stop-color="${C.green}" stop-opacity="0"/></radialGradient>
  <linearGradient id="runGrad" x1="0" x2="1"><stop offset="0" stop-color="${C.green}" stop-opacity="0"/><stop offset=".6" stop-color="${C.green}"/><stop offset="1" stop-color="${C.mint}"/></linearGradient>
  <clipPath id="frame"><rect x="${x}" width="${cw}" height="${h}" rx="${r}"/></clipPath>
</defs>
<style>${BASE_STYLE}${style}</style>
<g clip-path="url(#frame)">
  <rect x="${x}" width="${cw}" height="${h}" fill="${C.ink}"/>
  <rect x="${x}" width="${cw}" height="${h}" fill="url(#glow)"/>
  ${body}
</g>
<rect x="${x + 0.75}" y=".75" width="${cw - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" fill="none" stroke="${C.border}" stroke-width="1.5"/>
<rect class="runner" x="${x + 0.75}" y=".75" width="${cw - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" pathLength="1000" style="animation-delay:-${((runners++ * 1.7) % 8).toFixed(1)}s"/>
</svg>
`;
}

/** Section heading — mirrors the title + mono subline used on the generated contribution card. */
const heading = (x, title, sub) => `
<text x="${x + 43}" y="61" style="font-size:25px;font-weight:700">${esc(title)}</text>
<rect class="mark" x="${x + 45}" y="80" width="9" height="9" rx="2" fill="${C.green}"/>
<text x="${x + 65}" y="91" class="mono" style="font-size:15px;fill:${C.muted}">${esc(sub)}</text>`;

/** Word-wraps text (with **bold** runs) into SVG <text> lines using an average glyph-width estimate. */
function paragraph(text, { x, y, size, width, lh, color = C.body, strong = C.text, cls = '', delay = 0 }) {
  const words = [];
  const segs = text.split('**');
  segs.forEach((seg, i) => {
    // Text touching a ** marker ("**word**,") sticks to its neighbour instead of starting a new word.
    const prev = segs[i - 1] ?? '';
    const glued = i > 0 && (i % 2 === 0 ? !/^\s/.test(seg) : prev !== '' && !/\s$/.test(prev));
    seg.split(/\s+/).filter(Boolean).forEach((w, j) => words.push({ w, b: i % 2 === 1, glue: glued && j === 0 }));
  });
  const charW = size * 0.5;
  const lines = [[]];
  let len = 0;
  for (const word of words) {
    const wl = (word.w.length + 1) * charW * (word.b ? 1.1 : 1);
    if (len + wl > width && lines.at(-1).length && !word.glue) {
      lines.push([]);
      len = 0;
    }
    lines.at(-1).push(word);
    len += wl;
  }
  const svg = lines.map((line, i) => {
    const runs = [];
    for (const wd of line) {
      const last = runs.at(-1);
      const sep = wd.glue || !last ? '' : ' ';
      if (last && last.b === wd.b) last.t += sep + wd.w;
      else runs.push({ t: sep + wd.w, b: wd.b });
    }
    const spans = runs.map((r) => (r.b ? `<tspan style="fill:${strong};font-weight:700">${esc(r.t)}</tspan>` : `<tspan>${esc(r.t)}</tspan>`)).join('');
    return `<text x="${x}" y="${y + i * lh}" class="${cls}" style="font-size:${size}px;fill:${color}${delay ? `;animation-delay:${delay}s` : ''}" xml:space="preserve">${spans}</text>`;
  }).join('\n');
  return { svg, height: lines.length * lh };
}

/** 48×48 line icons, drawn around (0,0). */
const ICONS = {
  web: `<rect x="-14" y="-11" width="28" height="22" rx="3.5"/><path d="M-14 -4 H14"/><circle cx="-9.5" cy="-7.5" r="1" fill="${C.mint}"/><circle cx="-6" cy="-7.5" r="1" fill="${C.mint}"/>`,
  api: `<path d="M-6 -12 C-11 -12 -10 -3 -14 0 C-10 3 -11 12 -6 12 M6 -12 C11 -12 10 -3 14 0 C10 3 11 12 6 12"/><circle cx="0" cy="0" r="2" fill="${C.mint}"/>`,
  ai: `<path d="M0 -13 C1.5 -4 4 -1.5 13 0 C4 1.5 1.5 4 0 13 C-1.5 4 -4 1.5 -13 0 C-4 -1.5 -1.5 -4 0 -13Z" fill="${C.mint}" fill-opacity=".2"/><circle cx="10" cy="-10" r="2" fill="${C.mint}"/>`,
  design: `<path d="M0 -12 L13 -5 L0 2 L-13 -5Z" fill="${C.mint}" fill-opacity=".2"/><path d="M-13 1 L0 8 L13 1 M-13 6 L0 13 L13 6"/>`,
  bolt: `<path d="M3 -13 L-8 2 H0 L-3 13 L8 -2 H0 Z" fill="${C.mint}" fill-opacity=".2"/>`,
  team: `<circle cx="-5" cy="-5" r="5"/><path d="M-14 11 C-14 4 4 4 4 11"/><circle cx="8" cy="-3" r="3.6"/><path d="M6 5 C11 4 15 6 15 11"/>`,
  diagram: `<rect x="-15" y="-13" width="14" height="10" rx="2.5"/><rect x="2" y="3" width="14" height="10" rx="2.5"/><path d="M-8 -3 V8 H2"/>`,
  mail: `<rect x="-14" y="-10" width="28" height="20" rx="3"/><path d="M-13 -8 L0 2 L13 -8"/>`,
  shield: `<path d="M0 -14 L12 -9 V0 C12 8 6 12 0 14 C-6 12 -12 8 -12 0 V-9 Z" fill="${C.mint}" fill-opacity=".15"/><path d="M-5 0 L-1 4 L6 -4"/>`,
  chat: `<path d="M-12 -11 H12 A3 3 0 0 1 15 -8 V5 A3 3 0 0 1 12 8 H-3 L-9 13 V8 H-12 A3 3 0 0 1 -15 5 V-8 A3 3 0 0 1 -12 -11 Z"/><circle class="dot" cx="-6" cy="-2" r="1.8" fill="${C.mint}"/><circle class="dot" cx="0" cy="-2" r="1.8" fill="${C.mint}" style="animation-delay:.2s"/><circle class="dot" cx="6" cy="-2" r="1.8" fill="${C.mint}" style="animation-delay:.4s"/>`,
  chart: `<path d="M-15 6 L-9 3 L-4 6 L1 -11 L5 10 L10 1 L15 3"/><circle class="pulse" cx="1" cy="-11" r="2.4" fill="#ff5f57" stroke="none"/><circle cx="1" cy="-11" r="2.4" fill="#ff5f57" stroke="none"/>`,
  mascot: `<circle cx="0" cy="1" r="13"/><circle cx="-5" cy="-1" r="3.6" fill="${C.mint}" fill-opacity=".2"/><circle cx="5" cy="-1" r="3.6" fill="${C.mint}" fill-opacity=".2"/><g class="eyes"><circle cx="-5" cy="-1" r="1.6" fill="${C.mint}" stroke="none"/><circle cx="5" cy="-1" r="1.6" fill="${C.mint}" stroke="none"/></g><path d="M-5 6 C-2 9 2 9 5 6"/>`,
  globe: `<circle r="12"/><ellipse rx="5" ry="12"/><path d="M-12 0 H12 M-10 -6 H10 M-10 6 H10"/>`,
  briefcase: `<rect x="-14" y="-8" width="28" height="20" rx="3"/><path d="M-5 -8 V-11 A2 2 0 0 1 -3 -13 H3 A2 2 0 0 1 5 -11 V-8 M-14 1 H14"/>`,
  phone: `<rect x="-8" y="-14" width="16" height="28" rx="3.5"/><path d="M-3 9 H3"/>`,
};
const ICON_STYLE = `
.dot{animation:dot 1.2s ease-in-out infinite}
@keyframes dot{0%,60%,100%{opacity:.25}30%{opacity:1}}
.eyes{animation:eyes 4s ease-in-out infinite}
@keyframes eyes{0%,100%{transform:translateX(0px)}25%{transform:translateX(-1.6px)}50%{transform:translateX(1.6px)}75%{transform:translate(0px,1.2px)}}`;

const iconBox = (cx, cy, name, size = 48) => `
<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="13" fill="${C.green}" fill-opacity=".1" stroke="${C.green}" stroke-opacity=".35"/>
<g transform="translate(${cx} ${cy})" fill="none" stroke="${C.mint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;

/* ------------------------------------------------------------------ CARDS */

function aboutCard() {
  const W = 1200, X = 43;
  let y = 150;
  const parts = ABOUT.paragraphs.map((p, i) => {
    const out = paragraph(p, { x: X, y, size: 19.5, width: 560, lh: 31, cls: 'rise', delay: 0.1 + i * 0.15 });
    y += out.height + 16;
    return out.svg;
  });
  let cx = X;
  const chipY = y + 4;
  const chips = ABOUT.chips.map((c, i) => {
    const w = c.length * 7.9 + 40;
    const out = `<g class="rise" style="animation-delay:${0.4 + i * 0.1}s">
  <rect x="${cx}" y="${chipY}" width="${w}" height="36" rx="18" fill="${C.tile}" stroke="${C.border}"/>
  <circle cx="${cx + 18}" cy="${chipY + 18}" r="4" fill="${C.green}"/>
  <text x="${cx + 30}" y="${chipY + 23.5}" style="font-size:14.5px;fill:${C.text}">${esc(c)}</text></g>`;
    cx += w + 10;
    return out;
  }).join('\n');
  const leftBottom = chipY + 36;

  // Right: an editor window holding about.yml
  const PX = 650, PY = 118, PW = W - 43 - PX, LH = 28;
  const PH = 44 + (ABOUT.yaml.length + 1) * LH + 18;
  const lines = ABOUT.yaml.map(([k, v], i) => {
    const ly = PY + 74 + i * LH;
    const val = v.startsWith('"')
      ? `<tspan style="fill:${C.mint}">${esc(v)}</tspan>`
      : v.startsWith('[') ? `<tspan style="fill:${C.teal}">${esc(v)}</tspan>` : `<tspan style="fill:${C.text}">${esc(v)}</tspan>`;
    return `<g class="rise" style="animation-delay:${(0.3 + i * 0.09).toFixed(2)}s">
  <text x="${PX + 22}" y="${ly}" class="mono" style="font-size:13px;fill:${C.faint}">${String(i + 1).padStart(2, ' ')}</text>
  <text x="${PX + 56}" y="${ly}" class="mono" style="font-size:15px" xml:space="preserve"><tspan style="fill:${C.green}">${esc(k)}</tspan><tspan style="fill:${C.muted}">:</tspan></text>
  <text x="${PX + 166}" y="${ly}" class="mono" style="font-size:15px">${val}</text></g>`;
  }).join('\n');
  const lastY = PY + 74 + ABOUT.yaml.length * LH;
  const panel = `
<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="16" fill="${C.tile}" stroke="${C.border}"/>
<path d="M${PX} ${PY + 44} H${PX + PW}" stroke="${C.border}"/>
<circle cx="${PX + 22}" cy="${PY + 22}" r="5.5" fill="#ff5f57"/><circle cx="${PX + 40}" cy="${PY + 22}" r="5.5" fill="#febc2e"/><circle cx="${PX + 58}" cy="${PY + 22}" r="5.5" fill="#28c840"/>
<text x="${PX + PW / 2}" y="${PY + 27}" text-anchor="middle" class="mono" style="font-size:13px;fill:${C.muted}">about.yml</text>
${lines}
<text x="${PX + 22}" y="${lastY}" class="mono" style="font-size:13px;fill:${C.faint}">${ABOUT.yaml.length + 1}</text>
<rect class="caret" x="${PX + 56}" y="${lastY - 14}" width="9" height="18" fill="${C.green}"/>`;

  const H = Math.max(leftBottom, PY + PH) + 40;
  return card({
    w: W, h: H, label: 'About me — Software Engineer and AI & full-stack developer, Software Fellow at Drone Federation India',
    style: '.caret{animation:blink 1.05s steps(1) infinite}@keyframes blink{50%{opacity:0}}',
    body: `${heading(0, 'About Me', '// who I am & what drives me')}\n${parts.join('\n')}\n${chips}\n${panel}`,
  });
}

function servicesCard() {
  const W = 1200, X = 43, GAP = 23, TW = (W - 2 * X - 2 * GAP) / 3, TH = 162, Y0 = 118;
  const tiles = SERVICES.map((s, i) => {
    const x = X + (i % 3) * (TW + GAP), y = Y0 + Math.floor(i / 3) * (TH + GAP);
    const desc = paragraph(s.desc, { x: x + 24, y: y + 104, size: 16.5, width: TW - 40, lh: 23 });
    return `<g class="rise" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s">
  <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="16" fill="${C.tile}" stroke="${C.border}"/>
  <g class="glowbox" style="animation-delay:${(i * 0.7).toFixed(1)}s">${iconBox(x + 48, y + 48, s.icon)}</g>
  <text x="${x + 88}" y="${y + 55}" style="font-size:20px;font-weight:700">${esc(s.title)}</text>
  ${desc.svg}
</g>`;
  }).join('\n');
  const H = Y0 + 2 * TH + GAP + 40;
  const clip = SERVICES.map((_, i) => `<rect x="${X + (i % 3) * (TW + GAP)}" y="${Y0 + Math.floor(i / 3) * (TH + GAP)}" width="${TW}" height="${TH}" rx="16"/>`).join('');
  return card({
    w: W, h: H, glow: [0.1, 0.9], label: 'What I do — scalable web apps, robust APIs, AI integration, UI/UX design, workflow automation, technical leadership',
    style: `${ICON_STYLE}
.glowbox{animation:glowbox 4.2s ease-in-out infinite}
@keyframes glowbox{0%,100%{opacity:1}50%{opacity:.55}}
.sheen{animation:sheen 6s ease-in-out infinite}
@keyframes sheen{0%{transform:translateX(0px) skewX(-20deg)}55%,100%{transform:translateX(1400px) skewX(-20deg)}}`,
    body: `<defs><clipPath id="tiles">${clip}</clipPath><linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
${heading(0, 'What I Do', '// the work I love shipping')}
${tiles}
<g clip-path="url(#tiles)"><rect class="sheen" x="-200" y="${Y0}" width="120" height="${2 * TH + GAP}" fill="url(#shine)"/></g>`,
  });
}

/** Cards that sit side by side are drawn inside equal-width SVGs with the gutter baked in,
 *  so rows line up exactly with the full-width cards above and below. */
function slot(i, cols, total = 1200, gap = 24) {
  const colW = total / cols, cw = (total - (cols - 1) * gap) / cols;
  return { w: colW, x: i * (cw + gap) - i * colW, cw };
}

function projectCard(p, i) {
  const { w, x, cw } = slot(i % 2, 2);
  const H = 250;
  const desc = paragraph(p.desc, { x: x + 28, y: 124, size: 16.5, width: cw - 60, lh: 25 });
  return card({
    w, h: H, x, cw, glow: [i % 2 ? 0.95 : 0.05, 0.05], label: `${p.name} — ${p.desc}`,
    style: ICON_STYLE,
    body: `${iconBox(x + 54, 54, p.icon, 52)}
<text x="${x + 96}" y="50" style="font-size:22px;font-weight:700">${esc(p.name)}</text>
<text x="${x + 96}" y="75" class="mono" style="font-size:13.5px;fill:${C.green}">${esc(p.tags)}</text>
${desc.svg}
<path d="M${x + 28} 198.5 H${x + cw - 28}" stroke="${C.border}"/>
<text x="${x + 28}" y="228" class="mono" style="font-size:13.5px;fill:${C.mint}">${esc(p.link)}</text>
<text x="${x + cw - 28}" y="228" text-anchor="end" class="mono" style="font-size:13.5px;fill:${C.muted}">view repo →</text>`,
  });
}

function stackCard() {
  const W = 1200, X = 43, MAX = W - X;
  let y = 128;
  let n = 0;
  const groups = STACK.map(([label, items]) => {
    let out = `<text x="${X}" y="${y + 12}" class="mono" style="font-size:13px;letter-spacing:2px;fill:${C.green}">${esc(label.toUpperCase())}</text>`;
    let x = X;
    y += 28;
    for (const [name, color] of items) {
      const w = name.length * 7.6 + 46;
      if (x + w > MAX) { x = X; y += 52; }
      out += `
<g class="rise" style="animation-delay:${(0.05 + n * 0.03).toFixed(2)}s">
  <rect x="${x}" y="${y}" width="${w}" height="40" rx="20" fill="${C.tile}" stroke="${C.border}"/>
  <circle class="twinkle" cx="${x + 21}" cy="${y + 20}" r="9" fill="${color}" fill-opacity=".18" style="animation-delay:${((n * 0.37) % 5).toFixed(2)}s"/>
  <circle cx="${x + 21}" cy="${y + 20}" r="5" fill="${color}"/>
  <text x="${x + 35}" y="${y + 25.5}" style="font-size:15px">${esc(name)}</text>
</g>`;
      x += w + 10;
      n++;
    }
    y += 40 + 34;
    return out;
  }).join('\n');
  return card({
    w: W, h: y + 6, glow: [0.9, 0.95], label: `Tech stack — ${STACK.flatMap(([, items]) => items.map(([nm]) => nm)).join(', ')}`,
    style: '.twinkle{transform-box:fill-box;transform-origin:center;animation:twinkle 5s ease-in-out infinite}@keyframes twinkle{0%,70%,100%{transform:scale(1);opacity:.9}80%{transform:scale(1.6);opacity:.2}}',
    body: `${heading(0, 'Tech Stack', '// tools I reach for every day')}\n${groups}`,
  });
}

function connectTile(t, i) {
  const { w, x, cw } = slot(i, 4);
  const H = 150;
  return card({
    w, h: H, x, cw, glow: [0.1, 0.1], label: `${t.label}: ${t.value}`,
    style: '.nudge{animation:nudge 2.4s ease-in-out infinite}@keyframes nudge{0%,100%{transform:translate(0px,0px)}50%{transform:translate(3px,-3px)}}',
    body: `${iconBox(x + 48, 50, t.icon, 46)}
<g class="nudge" style="animation-delay:${i * 0.3}s"><path d="M${x + cw - 38} 46 l10 -10 m-8 0 h8 v8" fill="none" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
<text x="${x + 26}" y="104" class="mono" style="font-size:12.5px;letter-spacing:2px;fill:${C.green}">${esc(t.label.toUpperCase())}</text>
<text x="${x + 26}" y="130" style="font-size:${t.value.length > 16 ? 17.5 : 19}px;font-weight:700">${esc(t.value)}</text>`,
  });
}

function titleCard([title, sub, hint]) {
  const W = 1200;
  return card({
    w: W, h: 116, glow: [0.95, 0.5], label: title,
    body: `${heading(0, title, sub)}
<text x="${W - 43}" y="76" text-anchor="end" class="mono" style="font-size:15px;fill:${C.mint}">${esc(hint)}</text>`,
  });
}

/* ------------------------------------------------------------------- MAIN */

const out = new URL('../assets/', import.meta.url);
await mkdir(out, { recursive: true });
const files = {
  'about.svg': aboutCard(),
  'services.svg': servicesCard(),
  'stack.svg': stackCard(),
  ...Object.fromEntries(PROJECTS.map((p, i) => [`project-${p.id}.svg`, projectCard(p, i)])),
  ...Object.fromEntries(CONNECT.map((t, i) => [`connect-${t.id}.svg`, connectTile(t, i)])),
  ...Object.fromEntries(Object.entries(TITLES).map(([k, v]) => [`title-${k}.svg`, titleCard(v)])),
};
for (const [name, svg] of Object.entries(files)) await writeFile(new URL(name, out), svg);
console.log(`✓ wrote ${Object.keys(files).length} cards to assets/`);
