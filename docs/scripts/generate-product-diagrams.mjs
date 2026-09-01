// Copyright 2026 The ThunderID Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Generates the ThunderID product diagram set used in blog posts.
 *
 * Emits a light and a dark SVG per diagram. Two files rather than one
 * prefers-color-scheme SVG because an <img>-embedded SVG can only see the OS
 * setting, while Docusaurus themes off data-theme on <html>; a light OS with a
 * dark site would otherwise render dark cards on a white page. This mirrors the
 * light/dark screenshot pairs already under docs/content/guides/assets/images.
 *
 * Usage: node ./scripts/generate-product-diagrams.mjs
 */
import {mkdirSync, writeFileSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import {createLogger} from '@thunderid/logger';
import {LOGOS} from './product-diagram-logos.mjs';

const logger = createLogger('generate-product-diagrams');

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../static/assets/images/blog/product-diagrams');

// ---------------------------------------------------------------------------
// Shared visual system for the ThunderID blog diagram set.
// Palette is lifted from frontend/packages/design/src/themes/DefaultTheme.ts so
// the diagrams match the product UI.
// ---------------------------------------------------------------------------

const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Two fixed palettes rather than a prefers-color-scheme query. An SVG embedded
// with <img> can only see the OS setting, but Docusaurus themes off data-theme
// on <html>, so a light OS with a dark site would render dark cards on a white
// page. Shipping a file per theme is what the repo already does for screenshots
// (flow-builder-consent-light.png / -dark.png) and removes the mismatch.
const THEMES = {
  light: {
    ink: '#0f172a',
    mut: '#64748b',
    surf: '#ffffff',
    line: '#cbd5e1',
    'acc-cfg': '#2563eb',
    'acc-run': '#0d9488',
    'acc-vc': '#059669',
    'acc-agt': '#b45309',
    'acc-cry': '#dc2626',
    'acc-dat': '#0e7490',
  },
  dark: {
    ink: '#e6edf3',
    mut: '#9aa7b5',
    surf: '#0d1117',
    line: '#30363d',
    'acc-cfg': '#6ea8fe',
    'acc-run': '#2dd4bf',
    'acc-vc': '#34d399',
    'acc-agt': '#fbbf24',
    'acc-cry': '#f87171',
    'acc-dat': '#22d3ee',
  },
};

const vars = (t) =>
  Object.entries(THEMES[t])
    .map(([k, v]) => `--${k}:${v};`)
    .join('');

const CSS = (theme) => `
:root{${vars(theme)}}
text { font-family: ${FONT}; fill: var(--ink); }
.mut { fill: var(--mut); }
.b { font-weight: 700; }
.sb { font-weight: 600; }
.it { font-style: italic; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.surf { fill: var(--surf); }
.pill-bg { fill: var(--ink); }
.pill-tx { fill: var(--surf); font-weight: 600; }
.hair { stroke: var(--line); fill: none; }
.arrow { stroke: var(--ink); fill: none; stroke-width: 2.2; }
.arrow-mut { stroke: var(--mut); fill: none; stroke-width: 2; }
.dash { stroke-dasharray: 8 7; }
.dot { stroke-dasharray: 2 6; stroke-linecap: round; }
`;

const ACC = {
  cfg: 'var(--acc-cfg)',
  run: 'var(--acc-run)',
  vc: 'var(--acc-vc)',
  agt: 'var(--acc-agt)',
  cry: 'var(--acc-cry)',
  dat: 'var(--acc-dat)',
  ink: 'var(--ink)',
  mut: 'var(--mut)',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rough advance width for the sans stack. Good enough for layout maths.
const CW = 0.545;
const widthOf = (s, size, weight = 400) => s.length * size * (weight >= 600 ? CW * 1.05 : CW);

/** Greedy word wrap to a pixel width. Returns an array of lines. */
function wrap(str, maxW, size, weight = 400) {
  const words = String(str).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (widthOf(next, size, weight) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function text(x, y, str, o = {}) {
  const {size = 24, cls = '', anchor = 'start', fill, weight, opacity} = o;
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${size}"`,
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    cls ? `class="${cls}"` : '',
    // Inline style, not a fill attribute: the base `text { fill: var(--ink) }`
    // rule is CSS and would otherwise win over a presentation attribute.
    fill ? `style="fill:${fill}"` : '',
    weight ? `font-weight="${weight}"` : '',
    opacity != null ? `opacity="${opacity}"` : '',
  ].filter(Boolean);
  return `<text ${attrs.join(' ')}>${esc(str)}</text>`;
}

/** Multi-line text block. Returns SVG and the y baseline after the last line. */
function block(x, y, str, o = {}) {
  const {size = 22, lh = size * 1.28, maxW = 400, weight, ...rest} = o;
  const lines = wrap(str, maxW, size, weight === undefined ? 400 : 700);
  const out = lines.map((l, i) => text(x, y + i * lh, l, {size, weight, ...rest})).join('');
  return {svg: out, endY: y + (lines.length - 1) * lh, lines: lines.length};
}

function rect(x, y, w, h, o = {}) {
  const {rx = 14, fill = 'none', fillOpacity, stroke, sw = 2, cls = '', dash} = o;
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${w}"`,
    `height="${h}"`,
    `rx="${rx}"`,
    `fill="${fill}"`,
    fillOpacity != null ? `fill-opacity="${fillOpacity}"` : '',
    stroke ? `stroke="${stroke}" stroke-width="${sw}"` : '',
    dash ? `stroke-dasharray="${dash}"` : '',
    cls ? `class="${cls}"` : '',
  ].filter(Boolean);
  return `<rect ${attrs.join(' ')}/>`;
}

/** Tinted container with a full-strength border: the plan's core device. */
function container(x, y, w, h, accent, o = {}) {
  const {rx = 20, tint = 0.07, sw = 2.5, dash} = o;
  return rect(x, y, w, h, {rx, fill: accent, fillOpacity: tint}) + rect(x, y, w, h, {rx, stroke: accent, sw, dash});
}

/** A white card that sits on top of a tinted container. */
function card(x, y, w, h, o = {}) {
  const {rx = 12, stroke, sw = 1.5, dash} = o;
  return rect(x, y, w, h, {rx, cls: 'surf'}) + (stroke ? rect(x, y, w, h, {rx, stroke, sw, dash}) : '');
}

/** Inverted chip: near-black in light, near-white in dark. High contrast at any size. */
function pill(x, y, label, o = {}) {
  const {size = 22, padX = 16, h = 36, anchor = 'start'} = o;
  const w = widthOf(label, size, 600) + padX * 2;
  const px = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return {
    svg:
      rect(px, y, w, h, {rx: h / 2, cls: 'pill-bg'}) +
      text(px + padX, y + h / 2 + size * 0.35, label, {
        size,
        cls: 'pill-tx',
      }),
    w,
    x: px,
    right: px + w,
  };
}

/** Small outlined chip. `dashed` marks a pluggable / external thing. */
function chip(x, y, w, h, label, o = {}) {
  const {size = 21, accent = ACC.mut, dashed = false, weight = 600, sub} = o;
  const cy = sub ? y + h / 2 - 4 : y + h / 2 + size * 0.35;
  return (
    card(x, y, w, h, {
      rx: 10,
      stroke: accent,
      sw: 1.6,
      dash: dashed ? '6 5' : undefined,
    }) +
    text(x + w / 2, cy, label, {size, anchor: 'middle', weight}) +
    (sub
      ? text(x + w / 2, y + h / 2 + 20, sub, {
          size: size - 3,
          anchor: 'middle',
          cls: 'mut',
        })
      : '')
  );
}

const ARROW_DEFS = `
<defs>
  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)"/>
  </marker>
  <marker id="ahm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="var(--mut)"/>
  </marker>
  <marker id="ahs" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)"/>
  </marker>
</defs>`;

/** Straight arrow, optionally labelled above the line. */
function arrow(x1, y1, x2, y2, o = {}) {
  const {label, size = 20, dashed, muted, both, gap = 8} = o;
  const cls = `${muted ? 'arrow-mut' : 'arrow'}${dashed ? ' dash' : ''}`;
  const mk = muted ? 'ahm' : 'ah';
  const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" marker-end="url(#${mk})"${
    both ? ` marker-start="url(#${mk})"` : ''
  }/>`;
  const lbl = label
    ? text((x1 + x2) / 2, Math.min(y1, y2) - gap, label, {
        size,
        anchor: 'middle',
        cls: 'mut',
      })
    : '';
  return line + lbl;
}

/** Curved annotation leader, for the one callout each diagram is allowed. */
function leader(x1, y1, cx, cy, x2, y2, o = {}) {
  const {muted = true} = o;
  return `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" class="${
    muted ? 'arrow-mut' : 'arrow'
  }" marker-end="url(#${muted ? 'ahm' : 'ah'})"/>`;
}

// Set by the builder before each diagram function runs, so the diagram code
// itself never has to know which theme it is drawing.
let THEME = 'light';
const setTheme = (t) => {
  THEME = t;
};

function svgDoc(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(
    title,
  )}"><title>${esc(title)}</title><style>${CSS(THEME)}</style>${ARROW_DEFS}${body}</svg>`;
}

// ---------------------------------------------------------------------------
// 1 — Positioning banner
// ---------------------------------------------------------------------------
function d1() {
  const W = 1620,
    H = 440;
  let s = '';

  const boxW = 350,
    boxY = 108,
    boxH = 230;
  const leftX = 40,
    rightX = W - 40 - boxW;

  // Persona boxes: dotted border marks "not part of the product".
  const persona = (x, title, sub, detail) => {
    let o = rect(x, boxY, boxW, boxH, {
      rx: 18,
      stroke: ACC.mut,
      sw: 2,
      dash: '3 7',
    });
    const t = title.split('|');
    o += text(x + boxW / 2, boxY + 62, t[0], {
      size: 32,
      weight: 700,
      anchor: 'middle',
    });
    o += text(x + boxW / 2, boxY + 100, t[1], {
      size: 32,
      weight: 700,
      anchor: 'middle',
    });
    o += text(x + boxW / 2, boxY + 136, sub, {
      size: 21,
      anchor: 'middle',
      cls: 'mut',
    });
    o += rect(x + 24, boxY + 158, boxW - 48, 48, {
      rx: 10,
      stroke: ACC.mut,
      sw: 1.5,
      dash: '3 6',
    });
    o += text(x + boxW / 2, boxY + 188, detail, {
      size: 20,
      anchor: 'middle',
      cls: 'mut',
    });
    return o;
  };

  s += persona(leftX, 'Developers and|Platform Teams', 'configure', 'Console · API · MCP · YAML');
  s += persona(rightX, 'Humans, AI Agents|and Machines', 'authenticate', 'Apps · Wallets · API · MCP');

  // Centre: the product.
  const cW = 380,
    cX = (W - cW) / 2,
    cY = 148,
    cH = 150;
  s += rect(cX, cY, cW, cH, {rx: 20, cls: 'surf'});
  s += rect(cX, cY, cW, cH, {rx: 20, stroke: ACC.cfg, sw: 3});
  s += lockup(cX + cW / 2, cY + cH / 2, 300);

  // Relationship arrows: the caption carries the meaning, not the arrow. The
  // arrow sits on the shared centre line of the persona boxes and the lockup.
  const rel = (x1, x2, above) => {
    let o = '';
    const mid = (x1 + x2) / 2;
    above.split('|').forEach((l, i) => {
      o += text(mid, 168 + i * 30, l, {size: 22, anchor: 'middle'});
    });
    o += arrow(x1 + 12, 223, x2 - 12, 223, {both: true, muted: true});
    return o;
  };

  s += rel(leftX + boxW, cX, 'Define applications,|journeys, and policy');
  s += rel(cX + cW, rightX, 'Sign in, consent,|present credentials');

  s += text(W / 2, 386, 'One open-source IAM stack for every identity that touches your systems.', {
    size: 23,
    anchor: 'middle',
    cls: 'mut',
  });

  return svgDoc(
    W,
    H,
    s,
    'ThunderID sits between the teams who configure identity and the humans, AI agents, and machines who authenticate.',
  );
}

// ---------------------------------------------------------------------------
// 2 — Configure-time vs Runtime (the anchor map)
// ---------------------------------------------------------------------------
function d2() {
  const W = 1620,
    H = 1200;
  let s = '';

  const bX = 40,
    bY = 122,
    bW = 1320,
    bH = 1034;

  // The binary boundary. Dashed, because it is a process boundary, not a network one.
  s += rect(bX, bY, bW, bH, {
    rx: 26,
    stroke: ACC.mut,
    sw: 2.5,
    dash: '10 8',
  });
  const bl = pill(bX + 26, bY - 19, 'One ThunderID binary', {size: 22});
  s += bl.svg;

  // The single callout this diagram is allowed.
  s += text(W / 2 + 120, 52, 'one binary, two audiences', {
    size: 26,
    anchor: 'middle',
    cls: 'mut it',
  });
  s += leader(W / 2 + 20, 60, W / 2 - 90, 74, W / 2 - 168, 116);

  const cY = 200,
    cH = 740;
  const ctX = 70,
    ctW = 605;
  const rtX = 715,
    rtW = 605;

  s += container(ctX, cY, ctW, cH, ACC.cfg);
  s += container(rtX, cY, rtW, cH, ACC.run);

  const head = (x, title, sub, accent) => {
    let o = text(x + 24, cY + 54, title, {size: 36, weight: 700, fill: accent});
    o += text(x + 24, cY + 88, sub, {size: 22, cls: 'mut'});
    return o;
  };
  s += head(ctX, 'Configure-time', 'developers and platform teams', ACC.cfg);
  s += head(rtX, 'Runtime', 'humans, AI agents, and machines', ACC.run);

  // Entry surfaces / callers: four chips, same rhythm on both sides.
  const chipRow = (x, inner, items, accent, dashed) => {
    let o = '';
    const n = items.length,
      g = 13;
    const w = (inner - g * (n - 1)) / n;
    items.forEach((it, i) => {
      o += chip(x + i * (w + g), cY + 108, w, 54, it, {
        size: 20,
        accent,
        dashed,
      });
    });
    return o;
  };
  s += chipRow(ctX + 15, ctW - 30, ['Console', 'REST API', 'MCP', 'YAML / Git'], ACC.cfg);
  s += chipRow(rtX + 15, rtW - 30, ['Browser', 'Mobile app', 'Service', 'AI agent'], ACC.run, true);

  s += pill(ctX + 15, cY + 186, 'Managed resources').svg;
  s += pill(rtX + 15, cY + 186, 'Runtime surfaces').svg;

  // Configure-time: label-left / items-right rows. Every label is a real resource_type.
  const rows = [
    ['Identity', 'Users · Groups · Organization Units · Agents · User Types'],
    ['Access', 'Applications · Resource Servers · Roles · Permissions'],
    ['Journeys', 'Flows · 29 Executors · Consent'],
    ['Connections', 'Identity Providers · Notification Senders'],
    ['Credentials', 'Credential Configurations · Presentation Definitions'],
    ['Look and feel', 'Themes · Layouts · Translations'],
  ];
  let ry = cY + 232;
  rows.forEach(([k, v]) => {
    s += card(ctX + 15, ry, ctW - 30, 66, {stroke: ACC.cfg, sw: 1.4});
    s += text(ctX + 31, ry + 40, k, {size: 22, weight: 700});
    const b = block(ctX + 190, ry + 27, v, {
      size: 20,
      maxW: ctW - 30 - 175 - 30,
      lh: 25,
      cls: 'mut',
    });
    s += b.svg;
    ry += 74;
  });
  s += block(ctX + 15, cY + 700, 'Every row above is a YAML resource_type, versionable in Git.', {
    size: 20,
    maxW: ctW - 30,
    lh: 26,
    cls: 'mut it',
  }).svg;

  // Runtime: four surface cards.
  const surfaces = [
    [
      'OAuth 2.1 and OpenID Connect',
      'authorize · token · PAR · PKCE · DPoP · CIBA · DCR · introspect · revocation · userinfo · JWKS',
    ],
    ['Identity journeys', 'POST /flow/execute · Gate login UI · sessions and SSO'],
    ['Authorization', 'AuthZEN PDP · access evaluation · batch evaluation · action search · RBAC'],
    ['Verifiable credentials', 'OpenID4VCI issuance · OpenID4VP verification · DCQL · trust anchors'],
  ];
  let sy = cY + 232;
  surfaces.forEach(([k, v]) => {
    s += card(rtX + 15, sy, rtW - 30, 92, {stroke: ACC.run, sw: 1.4});
    s += text(rtX + 31, sy + 34, k, {size: 22, weight: 700});
    const b = block(rtX + 31, sy + 62, v, {
      size: 20,
      maxW: rtW - 62,
      lh: 25,
      cls: 'mut',
    });
    s += b.svg;
    sy += 104;
  });
  s += block(
    rtX + 15,
    cY + 700,
    'All of it served by the same process on one port, with no separate gateway to deploy.',
    {size: 20, maxW: rtW - 30, lh: 26, cls: 'mut it'},
  ).svg;

  // Storage: four independently-configurable logical databases.
  // The arrows into it are the real relationship between the two halves —
  // one writes configuration, the other reads it on every request.
  const dbY = 1018;
  s += pill(bX + 30, 970, 'Storage').svg;
  const feed = (cx, label) => {
    let o = arrow(cx, cY + cH + 6, cx, dbY - 8, {});
    o += text(cx + 14, dbY - 30, label, {size: 21, cls: 'mut'});
    return o;
  };
  s += feed(ctX + ctW / 2, 'writes');
  s += feed(rtX + rtW / 2, 'reads on every request');
  const dbs = [
    ['config', 'SQLite / Postgres'],
    ['entity', 'SQLite / Postgres'],
    ['runtime_transient', 'SQLite / Postgres'],
    ['runtime_persistent', 'SQLite / Postgres / Redis'],
  ];
  const dbW = (bW - 60 - 3 * 16) / 4;
  dbs.forEach(([n, k], i) => {
    const x = bX + 30 + i * (dbW + 16);
    s += container(x, dbY, dbW, 92, ACC.dat, {rx: 14, tint: 0.08, sw: 1.6});
    s += text(x + dbW / 2, dbY + 40, n, {
      size: 23,
      anchor: 'middle',
      weight: 700,
      cls: 'mono',
    });
    s += text(x + dbW / 2, dbY + 70, k, {
      size: 20,
      anchor: 'middle',
      cls: 'mut',
    });
  });

  // Pluggable externals, outside the binary boundary.
  const pX = 1400,
    pW = 200;
  s += text(pX, 224, 'Bring your own', {size: 21, cls: 'mut', weight: 600});
  const plug = [
    'Any OIDC or OAuth identity provider',
    'Any SMTP server',
    'Twilio, Vonage, or a custom webhook',
    'Any OpenID4VP wallet',
  ];
  plug.forEach((p, i) => {
    const y = 246 + i * 126;
    s += rect(pX, y, pW, 110, {
      rx: 14,
      stroke: ACC.mut,
      sw: 1.6,
      dash: '5 5',
    });
    const b = block(pX + 16, y + 34, p, {
      size: 20,
      maxW: pW - 32,
      lh: 25,
      cls: 'mut',
    });
    s += b.svg;
  });
  s += arrow(1394, 300, 1366, 300, {muted: true});
  s += arrow(1394, 552, 1366, 552, {muted: true});

  return svgDoc(
    W,
    H,
    s,
    'ThunderID is one binary with two faces: a configure-time surface for developers and a runtime surface for end users, agents, and services.',
  );
}

// ---------------------------------------------------------------------------
// 3 — Identity journeys as a canvas
// Claim: a login is a graph, and every auth method is an interchangeable node.
// ---------------------------------------------------------------------------
function d3() {
  const W = 1620,
    H = 790;
  let s = '';

  // Left: the flow canvas, drawn in the shape the Console builder actually uses.
  const fX = 40,
    fY = 110,
    fW = 970,
    fH = 620;
  s += rect(fX, fY, fW, fH, {rx: 20, stroke: ACC.mut, sw: 2, dash: '3 7'});
  s += pill(fX + 24, fY - 19, 'Console flow builder').svg;

  const nodeY = 468,
    nodeH = 94;

  // Screen previews hang above the PROMPT nodes, mirroring the real canvas.
  const preview = (cx, title, fields, cta) => {
    const pw = 168,
      ph = 232,
      px = cx - pw / 2,
      py = 196;
    let o = card(px, py, pw, ph, {stroke: ACC.mut, sw: 1.4});
    o += rect(px, py, pw, 26, {rx: 8, fill: ACC.mut, fillOpacity: 0.16});
    o += text(px + 12, py + 44, title, {size: 18, weight: 700});
    fields.forEach((f, i) => {
      o += rect(px + 12, py + 58 + i * 34, pw - 24, 24, {
        rx: 6,
        stroke: ACC.mut,
        sw: 1.2,
      });
      o += text(px + 20, py + 75 + i * 34, f, {size: 14, cls: 'mut'});
    });
    o += rect(px + 12, py + 58 + fields.length * 34 + 8, pw - 24, 26, {
      rx: 6,
      fill: ACC.cfg,
    });
    o += text(cx, py + 76 + fields.length * 34 + 8, cta, {
      size: 15,
      anchor: 'middle',
      fill: 'var(--surf)',
      weight: 700,
    });
    o += `<line x1="${cx}" y1="${py + ph}" x2="${cx}" y2="${nodeY}" class="hair dot" stroke-width="2"/>`;
    return o;
  };

  // START -> PROMPT -> TASK -> PROMPT -> TASK -> END
  const nodes = [
    {x: 62, w: 84, label: 'START', kind: 'end'},
    {x: 170, w: 158, label: 'Sign-in screen', kind: 'prompt'},
    {x: 352, w: 176, label: 'Identifier +\nPassword', kind: 'task'},
    {x: 552, w: 158, label: 'Consent screen', kind: 'prompt'},
    {x: 734, w: 166, label: 'Auth\nAssertion', kind: 'task'},
    {x: 924, w: 74, label: 'END', kind: 'end'},
  ];
  const kindAcc = {end: ACC.mut, prompt: ACC.cfg, task: ACC.agt};

  nodes.forEach((n, i) => {
    const acc = kindAcc[n.kind];
    if (n.kind === 'end') {
      s += rect(fX + n.x, nodeY + 22, n.w, 44, {
        rx: 22,
        fill: acc,
        fillOpacity: 0.18,
      });
      s += rect(fX + n.x, nodeY + 22, n.w, 44, {rx: 22, stroke: acc, sw: 1.8});
      s += text(fX + n.x + n.w / 2, nodeY + 51, n.label, {
        size: 20,
        anchor: 'middle',
        weight: 700,
      });
    } else {
      s += card(fX + n.x, nodeY, n.w, nodeH, {stroke: acc, sw: 2});
      s += rect(fX + n.x, nodeY, n.w, 5, {rx: 2, fill: acc});
      const parts = n.label.split('\n');
      parts.forEach((p, j) => {
        s += text(fX + n.x + n.w / 2, nodeY + (parts.length === 1 ? 44 : 36 + j * 25), p, {
          size: 20,
          anchor: 'middle',
          weight: 700,
        });
      });
      s += text(fX + n.x + n.w / 2, nodeY + nodeH - 13, n.kind === 'task' ? 'TASK_EXECUTION' : 'PROMPT', {
        size: 15,
        anchor: 'middle',
        cls: 'mut mono',
      });
    }
    if (i < nodes.length - 1) {
      const nx = nodes[i + 1];
      s += arrow(fX + n.x + n.w + 3, nodeY + 44, fX + nx.x - 3, nodeY + 44, {
        muted: true,
      });
    }
  });

  s += preview(fX + 170 + 79, 'Sign in', ['Username', 'Password'], 'Sign In');
  s += preview(fX + 552 + 79, 'Allow access?', ['profile', 'email'], 'Allow');

  // Node-type key. The graph vocabulary is small, so state it once.
  const key = [
    ['PROMPT', 'shows a screen', ACC.cfg],
    ['TASK_EXECUTION', 'runs an executor', ACC.agt],
    ['CALL', 'invokes a sub-flow', ACC.mut],
  ];
  // Monospace advances wider than the sans stack, so measure it separately or
  // the label and its gloss collide.
  const monoW = (str, size) => str.length * size * 0.61;
  let kx = fX + 40;
  key.forEach(([k, v, a]) => {
    s += rect(kx, 620, 14, 14, {rx: 4, fill: a});
    s += text(kx + 24, 632, k, {size: 19, weight: 700, cls: 'mono'});
    s += text(kx + 24 + monoW(k, 19) + 14, 632, v, {size: 19, cls: 'mut'});
    kx += 24 + monoW(k, 19) + 14 + widthOf(v, 19) + 46;
  });
  s += text(
    fX + 40,
    678,
    'Branching happens on executor outcomes, so the same graph handles success, failure, and step-up.',
    {size: 20, cls: 'mut'},
  );

  // Right: the tray of things that drop into a TASK_EXECUTION node.
  const tX = 1060,
    tW = 520;
  s += container(tX, fY, tW, fH, ACC.agt, {tint: 0.06});
  s += text(tX + 22, fY + 46, 'Executors', {
    size: 32,
    weight: 700,
    fill: ACC.agt,
  });
  s += text(tX + 22, fY + 78, 'any of these drops into a TASK node', {
    size: 20,
    cls: 'mut',
  });

  const ex = [
    'Password',
    'Passkey',
    'Email OTP',
    'SMS OTP',
    'Magic Link',
    'Google',
    'GitHub',
    'Any OIDC',
    'Any OAuth',
    'OpenID4VP',
    'Consent',
    'Attributes',
    'HTTP Request',
    'Provisioning',
    'Authorization',
    'Session',
    'SSO Check',
    'Invite',
  ];
  const cols = 3,
    gap = 12;
  const cw = (tW - 44 - gap * (cols - 1)) / cols;
  ex.forEach((e, i) => {
    const r = Math.floor(i / cols),
      c = i % cols;
    s += chip(tX + 22 + c * (cw + gap), fY + 108 + r * 58, cw, 46, e, {
      size: 18,
      accent: ACC.agt,
      weight: 600,
    });
  });

  s += text(tX + 22, fY + 470, '29 built-in executors', {
    size: 22,
    weight: 700,
  });
  s += block(
    tX + 22,
    fY + 500,
    'Add your own by implementing ExecutorInterface and registering it. The graph does not change.',
    {size: 20, maxW: tW - 44, lh: 26, cls: 'mut'},
  ).svg;

  // The relationship the whole figure exists to show.
  s += leader(tX - 8, fY + 300, 990, 400, 902, 474, {muted: true});
  s += text(972, 372, 'swap freely', {
    size: 21,
    cls: 'mut it',
    anchor: 'middle',
  });

  return svgDoc(
    W,
    H,
    s,
    'An identity journey is a node graph; every authentication method is an interchangeable executor inside a task node.',
  );
}

// ---------------------------------------------------------------------------
// 4 — Agent-native identity
// Claim: the act claim is what separates an agent acting for itself from an
// agent acting for a user, and the permissions differ accordingly.
// ---------------------------------------------------------------------------
function d4() {
  const W = 1620,
    H = 950;
  let s = '';

  // Left: the agent record. Identity and OAuth client are the same object.
  const aX = 44,
    aY = 150,
    aW = 380,
    aH = 480;
  s += container(aX, aY, aW, aH, ACC.agt);
  s += text(aX + 22, aY + 48, 'Agent', {size: 34, weight: 700, fill: ACC.agt});
  s += text(aX + 22, aY + 78, 'one record, two natures', {size: 20, cls: 'mut'});

  const half = (y, title, items) => {
    let o = card(aX + 16, y, aW - 32, 148, {stroke: ACC.agt, sw: 1.4});
    o += text(aX + 32, y + 32, title, {size: 21, weight: 700});
    items.forEach((it, i) => {
      o += text(aX + 32, y + 62 + i * 27, it, {size: 19, cls: 'mut mono'});
    });
    return o;
  };
  s += half(aY + 96, 'as an identity', [
    'id · name · description',
    'type (category: agent)',
    'owner · ou · attributes',
  ]);
  s += half(aY + 258, 'as an OAuth client', ['client_id · client_secret', 'grant_types', 'redirect_uris']);

  s += block(aX + 22, aY + 440, 'No shadow service account to keep in sync.', {
    size: 19,
    maxW: aW - 44,
    lh: 24,
    cls: 'mut it',
  }).svg;

  // The management surface an agent itself can call.
  const mY = 664;
  s += rect(aX, mY, aW, 132, {rx: 14, cls: 'pill-bg'});
  s += text(aX + 22, mY + 42, 'MCP server', {
    size: 24,
    weight: 700,
    fill: 'var(--surf)',
  });
  s += block(aX + 22, mY + 72, 'Agents manage and query IAM here too, at /mcp.', {
    size: 19,
    maxW: aW - 44,
    lh: 24,
    fill: 'var(--surf)',
    opacity: 0.78,
  }).svg;

  // Right: two lanes on a shared four-column rhythm, so the delta is visible.
  const C = [
    [478, 168],
    [696, 232],
    [980, 258],
    [1312, 244],
  ];
  const colX = (i) => C[i][0],
    colW = (i) => C[i][1];

  const laneLabel = (x, y, t, sub, acc) => {
    let o = text(x, y, t, {size: 28, weight: 700, fill: acc});
    o += text(x + widthOf(t, 28, 700) + 18, y, sub, {size: 20, cls: 'mut'});
    return o;
  };

  const box = (i, y, h, title, lines, acc, dashed) => {
    let o = card(colX(i), y, colW(i), h, {
      stroke: acc,
      sw: 2,
      dash: dashed ? '6 5' : undefined,
    });
    o += text(colX(i) + colW(i) / 2, y + 34, title, {
      size: 21,
      anchor: 'middle',
      weight: 700,
    });
    lines.forEach((l, j) => {
      o += text(colX(i) + colW(i) / 2, y + 62 + j * 26, l, {
        size: 19,
        anchor: 'middle',
        cls: 'mut mono',
      });
    });
    return o;
  };

  // Lane A — agent as subject.
  s += laneLabel(478, 138, 'Agent as subject', 'it acts for itself', ACC.cfg);
  s += box(0, 200, 92, 'Agent', [], ACC.cfg);
  s += box(1, 200, 92, 'client_credentials', [], ACC.cfg);
  s += box(2, 178, 136, 'Access token', ['sub = agent', 'no user involved'], ACC.cfg);
  s += box(3, 200, 92, 'Resource server', [], ACC.cfg);
  [0, 1, 2].forEach((i) => {
    s += arrow(colX(i) + colW(i) + 4, 246, colX(i + 1) - 4, 246, {muted: true});
  });
  s += block(
    colX(2) - 40,
    348,
    "Scopes are the resource server's permissions intersected with the agent's own role grants, then narrowed by the requested resource.",
    {size: 19, maxW: 620, lh: 25, cls: 'mut'},
  ).svg;

  s += `<line x1="460" y1="446" x2="1580" y2="446" class="hair dash" stroke-width="2"/>`;

  // Lane B — agent as actor. Same column rhythm as lane A, so the two extra
  // hops and the changed token are the only things that differ.
  s += laneLabel(478, 512, 'Agent as actor', 'it acts for a user', ACC.agt);
  s += box(0, 566, 84, 'User', [], ACC.agt);
  s += box(0, 664, 84, 'Agent', [], ACC.agt);
  s += box(1, 566, 84, 'Auth code + PKCE', [], ACC.agt);
  s += box(1, 664, 84, 'User consent', [], ACC.agt);
  s += box(2, 566, 182, 'Access token', ['sub = user', 'act = agent'], ACC.agt);
  s += box(3, 615, 84, 'Resource server', [], ACC.agt);

  s += arrow(colX(0) + colW(0) + 4, 608, colX(1) - 4, 608, {muted: true});
  s += arrow(colX(0) + colW(0) + 4, 706, colX(1) - 4, 706, {muted: true});
  s += arrow(colX(1) + colW(1) + 4, 608, colX(2) - 4, 608, {muted: true});
  s += arrow(colX(1) + colW(1) + 4, 706, colX(2) - 4, 706, {muted: true});
  s += arrow(colX(2) + colW(2) + 4, 657, colX(3) - 4, 657, {muted: true});
  s += text(colX(1) + colW(1) / 2, 552, 'or token exchange', {
    size: 19,
    anchor: 'middle',
    cls: 'mut',
  });

  s += block(
    colX(0),
    800,
    "Effective permissions are the user's own permissions intersected with exactly what the user just consented to.",
    {size: 19, maxW: 520, lh: 25, cls: 'mut'},
  ).svg;

  // The one callout.
  s += text(1560, 806, 'the act claim is', {
    size: 22,
    cls: 'mut it',
    anchor: 'end',
  });
  s += text(1560, 834, 'the whole difference', {
    size: 22,
    cls: 'mut it',
    anchor: 'end',
  });
  s += leader(1330, 796, 1290, 780, 1250, 752);

  return svgDoc(
    W,
    H,
    s,
    'An agent is both an identity and an OAuth client; it can act as the subject of a token or as the actor on behalf of a user.',
  );
}

// ---------------------------------------------------------------------------
// 5 — Verifiable credentials
// Claim: ThunderID holds both non-wallet corners, and verification is not a
// separate product surface — it drops into an ordinary login journey.
// ---------------------------------------------------------------------------
function d5() {
  const W = 1620,
    H = 880;
  let s = '';

  const top = 130,
    colH = 470;

  const step = (x, w, y, n, title, detail, acc) => {
    let o = card(x, y, w, 74, {stroke: acc, sw: 1.5});
    o += `<circle cx="${x + 30}" cy="${y + 37}" r="16" fill="${acc}"/>`;
    o += text(x + 30, y + 44, String(n), {
      size: 19,
      anchor: 'middle',
      fill: 'var(--surf)',
      weight: 700,
    });
    o += text(x + 58, y + 32, title, {size: 21, weight: 700});
    o += text(x + 58, y + 57, detail, {size: 18, cls: 'mut mono'});
    return o;
  };

  // Issuer
  const iX = 40,
    iW = 520;
  s += container(iX, top, iW, colH, ACC.vc);
  s += text(iX + 22, top + 46, 'ThunderID', {size: 30, weight: 700, fill: ACC.vc});
  s += text(iX + 22, top + 76, 'as issuer · OpenID4VCI', {size: 20, cls: 'mut'});
  [
    ['Credential offer', 'GET /openid4vci/offer'],
    ['Authorization code grant', 'the credential config is the scope'],
    ['Nonce', 'POST /openid4vci/nonce'],
    ['Issue credential', 'POST /openid4vci/credential'],
  ].forEach(([t, d], i) => {
    s += step(iX + 16, iW - 32, top + 96 + i * 84, i + 1, t, d, ACC.vc);
  });

  // Wallet — dotted, because ThunderID does not ship one.
  const wX = 620,
    wW = 380;
  s += rect(wX, top + 60, wW, 350, {rx: 20, stroke: ACC.mut, sw: 2.5, dash: '6 6'});
  s += text(wX + wW / 2, top + 112, 'Wallet', {
    size: 32,
    weight: 700,
    anchor: 'middle',
  });
  s += text(wX + wW / 2, top + 144, 'external: ThunderID ships no wallet', {
    size: 19,
    anchor: 'middle',
    cls: 'mut',
  });
  s += card(wX + 28, top + 172, wW - 56, 126, {stroke: ACC.mut, sw: 1.4});
  s += text(wX + wW / 2, top + 204, 'holder key', {
    size: 21,
    anchor: 'middle',
    weight: 700,
  });
  s += block(wX + 44, top + 232, 'a cnf JWK binds each credential to the key the holder proved', {
    size: 18,
    maxW: wW - 88,
    lh: 23,
    cls: 'mut',
  }).svg;
  s += chip(wX + 28, top + 314, wW - 56, 44, 'dc+sd-jwt', {
    size: 19,
    accent: ACC.vc,
  });
  s += text(wX + wW / 2, top + 386, 'selective disclosure: show age, not birthdate', {
    size: 18,
    anchor: 'middle',
    cls: 'mut',
  });

  // Verifier
  const vX = 1060,
    vW = 520;
  s += container(vX, top, vW, colH, ACC.vc);
  s += text(vX + 22, top + 46, 'ThunderID', {size: 30, weight: 700, fill: ACC.vc});
  s += text(vX + 22, top + 76, 'as verifier · OpenID4VP', {size: 20, cls: 'mut'});
  [
    ['Request', 'signed request URI'],
    ['Query', 'DCQL selects the claims'],
    ['Response', 'wallet posts to the response URI'],
    ['Validate', 'x5c chain against trust anchors'],
  ].forEach(([t, d], i) => {
    s += step(vX + 16, vW - 32, top + 96 + i * 84, i + 1, t, d, ACC.vc);
  });

  // Labels sit on a surface chip: the gap between columns is narrower than the
  // words, so the chip makes the overlap deliberate instead of accidental.
  const hop = (x1, x2, label) => {
    const mid = (x1 + x2) / 2;
    const lw = widthOf(label, 19) + 16;
    return (
      arrow(x1, top + 236, x2, top + 236, {}) +
      rect(mid - lw / 2, top + 186, lw, 32, {rx: 8, cls: 'surf'}) +
      text(mid, top + 208, label, {size: 19, anchor: 'middle', cls: 'mut'})
    );
  };
  s += hop(iX + iW + 8, wX - 8, 'issues');
  s += hop(wX + wW + 8, vX - 8, 'presents');

  // Issuance detail that is genuinely unusual and worth the space.
  s += text(iX + 16, top + colH + 44, 'Batch issuance', {size: 22, weight: 700});
  s += block(
    iX + 16,
    top + colH + 74,
    'One request carries many holder proofs, so the wallet gets one credential per key and presentations cannot be correlated.',
    {size: 19, maxW: iW - 32, lh: 25, cls: 'mut'},
  ).svg;

  s += text(vX + 16, top + colH + 44, 'Trust, not just signature', {
    size: 22,
    weight: 700,
  });
  s += block(
    vX + 16,
    top + colH + 74,
    'Presentations are checked against configured root CAs, so an unknown issuer is rejected rather than merely noted.',
    {size: 19, maxW: vW - 32, lh: 25, cls: 'mut'},
  ).svg;

  // The hook back into diagram 3. No connector line: it would have to cross the
  // caption text to reach the strip. The shared green node carries the link.
  const sy = 774;
  const strip = [
    ['START', ACC.mut, 74],
    ['Identify', ACC.cfg, 140],
    ['OpenID4VP', ACC.vc, 176],
    ['Consent', ACC.cfg, 130],
    ['END', ACC.mut, 74],
  ];
  let sx = 700;
  strip.forEach(([t, a, w], i) => {
    const hot = a === ACC.vc;
    s += rect(sx, sy, w, 52, {rx: 12, fill: a, fillOpacity: hot ? 0.2 : 0.1});
    s += rect(sx, sy, w, 52, {rx: 12, stroke: a, sw: hot ? 2.4 : 1.5});
    s += text(sx + w / 2, sy + 33, t, {
      size: 19,
      anchor: 'middle',
      weight: 700,
    });
    if (i < strip.length - 1) s += arrow(sx + w + 3, sy + 26, sx + w + 27, sy + 26, {muted: true});
    sx += w + 30;
  });
  s += block(40, sy + 20, 'Verification is also just a node: drop it into any login journey.', {
    size: 20,
    maxW: 620,
    lh: 26,
    cls: 'mut it',
  }).svg;

  return svgDoc(
    W,
    H,
    s,
    'ThunderID issues credentials over OpenID4VCI and verifies them over OpenID4VP, with verification usable standalone or as a step inside a login journey.',
  );
}

// ---------------------------------------------------------------------------
// 6 — Crypto-agility
// Claim: one pluggable signer serves everything, and ML-DSA is already one of
// the options. Coverage is stated honestly rather than implied.
// ---------------------------------------------------------------------------
function d6() {
  const W = 1620,
    H = 780;
  let s = '';

  // The signing rail.
  const railY = 168,
    railH = 116;
  const stages = [
    ['Key manager', 'loads the configured key'],
    ['PKI service', 'RSA · EC · ML-DSA PKCS#8'],
    ['JOSE / JWS signer', 'one signer, many algorithms'],
    ['JWKS endpoint', 'publishes the public key'],
  ];
  const sw = 280,
    sg = 32;
  stages.forEach(([t, d], i) => {
    const x = 40 + i * (sw + sg);
    s += card(x, railY, sw, railH, {stroke: ACC.cry, sw: 2});
    s += text(x + sw / 2, railY + 46, t, {
      size: 23,
      anchor: 'middle',
      weight: 700,
    });
    s += block(x + sw / 2, railY + 74, d, {
      size: 18,
      maxW: sw - 28,
      lh: 22,
      cls: 'mut',
      anchor: 'middle',
    }).svg;
    if (i < stages.length - 1)
      s += arrow(x + sw + 4, railY + railH / 2, x + sw + sg - 4, railY + railH / 2, {
        muted: true,
      });
  });

  // Algorithms hang off the signer. Classical and post-quantum, same slot.
  const algY = 380;
  s += container(40, algY - 52, 1208, 162, ACC.cry, {tint: 0.06});
  s += pill(62, algY - 72, 'Pluggable signing algorithms').svg;
  s += arrow(40 + 2 * (sw + sg) + sw / 2, railY + railH + 4, 40 + 2 * (sw + sg) + sw / 2, algY - 56, {
    muted: true,
  });

  const algs = [
    ['RS256', 0],
    ['PS256', 0],
    ['ES256', 0],
    ['ES384', 0],
    ['ES512', 0],
    ['EdDSA', 0],
    ['ML-DSA-44', 1],
    ['ML-DSA-65', 1],
    ['ML-DSA-87', 1],
  ];
  const aw = 116,
    ag = 11;
  algs.forEach(([a, pq], i) => {
    const x = 62 + i * (aw + ag);
    s += rect(x, algY - 16, aw, 52, {
      rx: 10,
      fill: pq ? ACC.cry : ACC.mut,
      fillOpacity: pq ? 0.18 : 0.08,
    });
    s += rect(x, algY - 16, aw, 52, {
      rx: 10,
      stroke: pq ? ACC.cry : ACC.mut,
      sw: pq ? 2.2 : 1.4,
    });
    s += text(x + aw / 2, algY + 16, a, {
      size: pq ? 18 : 19,
      anchor: 'middle',
      weight: 700,
      cls: 'mono',
    });
  });
  s += `<line x1="62" y1="${algY + 54}" x2="${62 + 6 * (aw + ag) - ag}" y2="${algY + 54}" class="hair" stroke-width="2"/>`;
  s += `<line x1="${62 + 6 * (aw + ag)}" y1="${algY + 54}" x2="${62 + 9 * (aw + ag) - ag}" y2="${algY + 54}" stroke="${ACC.cry}" stroke-width="2.5" fill="none"/>`;
  s += text(62, algY + 82, 'classical', {size: 19, cls: 'mut'});
  s += text(62 + 6 * (aw + ag), algY + 82, 'post-quantum · FIPS 204', {
    size: 19,
    fill: ACC.cry,
    weight: 600,
  });

  // Consumers: everything ThunderID signs rides the same signer.
  const cX = 1288,
    cW = 292;
  s += text(cX, 152, 'Everything signed', {size: 22, weight: 700});
  ['ID tokens', 'Access tokens', 'SD-JWT credentials', 'Client assertions', 'Identity assertions'].forEach((c, i) => {
    s += chip(cX, 172 + i * 62, cW, 50, c, {size: 19, accent: ACC.cry});
  });
  s += arrow(1262, railY + railH / 2, cX - 8, railY + railH / 2, {muted: true});
  s += block(cX, 508, 'Change the key, and every one of these changes with it.', {
    size: 19,
    maxW: cW,
    lh: 24,
    cls: 'mut it',
  }).svg;

  // Honest coverage. Saying what is missing is what makes the rest credible.
  const bY = 604;
  const status = (x, w, mark, title, body, acc) => {
    let o = card(x, bY, w, 132, {stroke: acc, sw: 2});
    o += `<circle cx="${x + 34}" cy="${bY + 38}" r="15" fill="${acc}"/>`;
    o += text(x + 34, bY + 45, mark, {
      size: 18,
      anchor: 'middle',
      fill: 'var(--surf)',
      weight: 700,
    });
    o += text(x + 62, bY + 45, title, {size: 22, weight: 700});
    o += block(x + 22, bY + 76, body, {
      size: 19,
      maxW: w - 44,
      lh: 24,
      cls: 'mut',
    }).svg;
    return o;
  };
  s += status(
    40,
    760,
    '✓',
    'Shipped',
    'ML-DSA signing per RFC 9881 key encoding and RFC 9964 JWS, published as AKP JWKs at the JWKS endpoint.',
    ACC.vc,
  );
  s += status(
    828,
    752,
    '→',
    'Not yet',
    'Key encapsulation and hybrid modes. Encryption today is RSA-OAEP, ECDH-ES, and AES-KW.',
    ACC.mut,
  );

  // The callout points at the signer, because that is what the claim is about.
  s += text(1246, 74, 'crypto-agility, not post-quantum everywhere', {
    size: 23,
    cls: 'mut it',
    anchor: 'end',
  });
  s += leader(1010, 86, 950, 108, 900, 160);

  return svgDoc(
    W,
    H,
    s,
    'One pluggable signer serves every token ThunderID issues, with ML-DSA available alongside the classical algorithms.',
  );
}

// ---------------------------------------------------------------------------
// 7 — Developer experience
// A survey, not a mechanism: the four kinds of surface a developer touches, and
// what ships under each. Deliberately kept above the command and syntax level.
// ---------------------------------------------------------------------------

/**
 * Places the ThunderID lockup, fitted to a width and picking the light or
 * inverted artwork to match the variant being drawn.
 */
function lockup(cx, cy, width) {
  const l = LOGOS[THEME === 'dark' ? 'ThunderIDLockupInverted' : 'ThunderIDLockup'];
  const [minX, minY, vw, vh] = l.viewBox.split(/\s+/).map(Number);
  const k = width / vw;
  return (
    `<g transform="translate(${(cx - width / 2).toFixed(1)},${(cy - (vh * k) / 2).toFixed(1)}) scale(${k.toFixed(
      4,
    )}) translate(${-minX},${-minY})">` +
    l.body +
    '</g>'
  );
}

/** Places an extracted brand mark, scaled and centred on (cx, cy). */
function logo(name, cx, cy, size) {
  const l = LOGOS[name];
  if (!l) return '';
  const [minX, minY, vw, vh] = l.viewBox.split(/\s+/).map(Number);
  const k = size / Math.max(vw, vh);
  const ox = (size - vw * k) / 2;
  const oy = (size - vh * k) / 2;
  // Monochrome marks carry no literal fill, so they would default to black and
  // vanish on the dark variant; stroke-only marks resolve against `color`.
  const paint = l.mono ? ' fill="var(--ink)"' : '';
  const colour = /currentColor/.test(l.attrs + l.body) ? ' style="color:var(--ink)"' : '';
  return (
    `<g${paint}${colour}${l.attrs ? ' ' + l.attrs : ''} transform="translate(${(cx - size / 2 + ox).toFixed(
      1,
    )},${(cy - size / 2 + oy).toFixed(1)}) scale(${k.toFixed(4)}) translate(${-minX},${-minY})">` +
    l.body +
    '</g>'
  );
}

// Marks the docs have no component for yet, plus ThunderID's own surfaces.
// Kept geometric and simple so they sit beside the real logos without pretending
// to be official artwork.
function glyph(kind, cx, cy, size) {
  const u = size / 24;
  const g = (b) => `<g transform="translate(${cx - size / 2},${cy - size / 2}) scale(${u})">${b}</g>`;
  switch (kind) {
    case 'console':
      return g(
        `<rect x="2" y="4" width="20" height="16" rx="2.5" fill="none" stroke="var(--acc-cfg)" stroke-width="1.8"/>` +
          `<path d="M2 8.5h20" stroke="var(--acc-cfg)" stroke-width="1.8"/>` +
          `<circle cx="5" cy="6.2" r="0.9" fill="var(--acc-cfg)"/>` +
          `<path d="M6 13h6M6 16.5h9" stroke="var(--acc-cfg)" stroke-width="1.6" stroke-linecap="round"/>`,
      );
    case 'login':
      return g(
        `<rect x="4" y="3" width="16" height="18" rx="2.5" fill="none" stroke="var(--acc-cfg)" stroke-width="1.8"/>` +
          `<circle cx="12" cy="8.5" r="2.4" fill="none" stroke="var(--acc-cfg)" stroke-width="1.8"/>` +
          `<path d="M7.5 13.5h9" stroke="var(--acc-cfg)" stroke-width="1.6" stroke-linecap="round"/>` +
          `<rect x="7.5" y="16" width="9" height="2.8" rx="1.4" fill="var(--acc-cfg)"/>`,
      );
    case 'sdk':
      return g(
        `<path d="M12 2.6l8 4.3v9.8l-8 4.3-8-4.3V6.9z" fill="none" stroke="var(--acc-run)" stroke-width="1.8" stroke-linejoin="round"/>` +
          `<path d="M4 6.9l8 4.3 8-4.3M12 11.2V21" fill="none" stroke="var(--acc-run)" stroke-width="1.6" stroke-linejoin="round"/>`,
      );
    case 'person':
      return g(
        `<circle cx="12" cy="8" r="3.6" fill="none" stroke="var(--acc-cfg)" stroke-width="1.8"/>` +
          `<path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="var(--acc-cfg)" stroke-width="1.8" stroke-linecap="round"/>`,
      );
    case 'agent':
      return g(
        `<rect x="4" y="8" width="16" height="11" rx="3.2" fill="none" stroke="var(--acc-agt)" stroke-width="1.8"/>` +
          `<path d="M12 4.2v3.6M8.5 21h7" stroke="var(--acc-agt)" stroke-width="1.8" stroke-linecap="round"/>` +
          `<circle cx="12" cy="3.4" r="1.4" fill="var(--acc-agt)"/>` +
          `<circle cx="9.2" cy="13.4" r="1.3" fill="var(--acc-agt)"/>` +
          `<circle cx="14.8" cy="13.4" r="1.3" fill="var(--acc-agt)"/>`,
      );
    case 'machine':
      return g(
        `<rect x="3.5" y="4" width="17" height="5.6" rx="1.8" fill="none" stroke="var(--acc-dat)" stroke-width="1.8"/>` +
          `<rect x="3.5" y="14.4" width="17" height="5.6" rx="1.8" fill="none" stroke="var(--acc-dat)" stroke-width="1.8"/>` +
          `<circle cx="7" cy="6.8" r="1.1" fill="var(--acc-dat)"/>` +
          `<circle cx="7" cy="17.2" r="1.1" fill="var(--acc-dat)"/>`,
      );
    case 'mcp':
      return g(
        `<path d="M3 12h4M17 12h4" stroke="var(--acc-agt)" stroke-width="1.8" stroke-linecap="round"/>` +
          `<rect x="7" y="7" width="10" height="10" rx="2.4" fill="none" stroke="var(--acc-agt)" stroke-width="1.8"/>` +
          `<circle cx="12" cy="12" r="2" fill="var(--acc-agt)"/>`,
      );
    case 'android':
      return g(
        `<path d="M5 11a7 7 0 0 1 14 0z" fill="#3DDC84"/>` +
          `<path d="M7.2 7.2 5.9 5.2M16.8 7.2l1.3-2" stroke="#3DDC84" stroke-width="1.5" stroke-linecap="round"/>` +
          `<circle cx="9.6" cy="8.9" r="0.85" fill="var(--surf)"/>` +
          `<circle cx="14.4" cy="8.9" r="0.85" fill="var(--surf)"/>` +
          `<rect x="5" y="12.4" width="14" height="6.4" rx="2.2" fill="#3DDC84"/>`,
      );
    case 'flutter':
      return g(
        `<path d="M14.6 2.4 5.2 11.8l2.9 2.9 12.3-12.3z" fill="#47C5FB"/>` +
          `<path d="M14.5 11.1 9.3 16.3l5.2 5.3h5.9l-5.2-5.3 5.2-5.2z" fill="#00569E"/>` +
          `<path d="M8.1 14.7 11 17.6l-2.9 2.9-2.9-2.9z" fill="#00B5F8"/>`,
      );
    case 'helm':
      return g(
        `<circle cx="12" cy="12" r="8.5" fill="none" stroke="#0F1689" stroke-width="1.8"/>` +
          `<circle cx="12" cy="12" r="3" fill="none" stroke="#0F1689" stroke-width="1.8"/>` +
          `<path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" stroke="#0F1689" stroke-width="1.8" stroke-linecap="round"/>`,
      );
    default:
      return '';
  }
}

function d7() {
  const W = 1620;
  let s = '';

  // One tile per thing that ships. Logo above, name below, nothing else.
  const CELL_W = 124,
    TILE = 56;
  const item = (x, y, it) => {
    const tx = x + (CELL_W - TILE) / 2;
    let o = card(tx, y, TILE, TILE, {rx: 14, stroke: ACC.mut, sw: 1.3});
    o += it.logo ? logo(it.logo, tx + TILE / 2, y + TILE / 2, 32) : glyph(it.glyph, tx + TILE / 2, y + TILE / 2, 30);
    const lines = wrap(it.label, CELL_W + 10, 17);
    lines.forEach((l, i) => {
      o += text(x + CELL_W / 2, y + TILE + 24 + i * 20, l, {
        size: 17,
        anchor: 'middle',
      });
    });
    return o;
  };

  const rows = (items, cols) => Math.ceil(items.length / cols);
  const gridH = (items, cols) => rows(items, cols) * 100;

  const grid = (x, y, items, cols) => {
    let o = '';
    items.forEach((it, i) => {
      o += item(x + (i % cols) * CELL_W, y + Math.floor(i / cols) * 100, it);
    });
    return o;
  };

  // --- The four surfaces ----------------------------------------------------
  const groups = [
    {
      x: 40,
      w: 272,
      cols: 2,
      title: 'Consoles',
      glyph: 'console',
      accent: ACC.cfg,
      items: [
        {glyph: 'console', label: 'Developer Console'},
        {glyph: 'login', label: 'Login UI'},
      ],
    },
    {
      x: 338,
      w: 272,
      cols: 2,
      title: 'AI',
      glyph: 'mcp',
      accent: ACC.agt,
      items: [
        {logo: 'SkillsLogo', label: 'Agent Skills'},
        {glyph: 'mcp', label: 'MCP Server'},
        {logo: 'ClaudeLogo', label: 'Claude Plugin'},
        {logo: 'CodexLogo', label: 'Codex Plugin'},
      ],
    },
    {
      x: 636,
      w: 644,
      cols: 5,
      title: 'SDKs',
      glyph: 'sdk',
      accent: ACC.run,
      web: [
        {logo: 'NodeLogo', label: 'Node.js'},
        {logo: 'ExpressLogo', label: 'Express'},
        {logo: 'ReactLogo', label: 'React'},
        {logo: 'NextLogo', label: 'Next.js'},
        {logo: 'VueLogo', label: 'Vue'},
        {logo: 'NuxtLogo', label: 'Nuxt'},
        {logo: 'ReactRouterLogo', label: 'React Router'},
        {logo: 'TanStackLogo', label: 'TanStack Router'},
        {logo: 'BrowserLogo', label: 'Browser'},
        {logo: 'JavaScriptLogo', label: 'JavaScript'},
      ],
      mobile: [
        {logo: 'IOSLogo', label: 'iOS'},
        {glyph: 'android', label: 'Android'},
        {glyph: 'flutter', label: 'Flutter'},
      ],
    },
    {
      x: 1306,
      w: 272,
      cols: 2,
      title: 'Run it',
      glyph: null,
      logo: 'CliLogo',
      accent: ACC.dat,
      items: [
        {logo: 'CliLogo', label: 'npx'},
        {logo: 'DockerLogo', label: 'Docker'},
        {logo: 'KubernetesLogo', label: 'Kubernetes'},
      ],
    },
  ];

  const HEAD_Y = 54,
    HEAD = 64,
    PANEL_Y = 196;

  let bottom = PANEL_Y;
  groups.forEach((g) => {
    const midX = g.x + g.w / 2;

    // Category header: a tile, a name, and a dotted line down to what it holds.
    s += card(midX - HEAD / 2, HEAD_Y, HEAD, HEAD, {rx: 16, stroke: g.accent, sw: 1.8});
    s += g.logo ? logo(g.logo, midX, HEAD_Y + HEAD / 2, 34) : glyph(g.glyph, midX, HEAD_Y + HEAD / 2, 32);
    s += text(midX, HEAD_Y + HEAD + 30, g.title, {
      size: 23,
      anchor: 'middle',
      weight: 700,
      fill: g.accent,
    });
    s += `<line x1="${midX}" y1="${HEAD_Y + HEAD + 48}" x2="${midX}" y2="${PANEL_Y - 8}" class="hair dot" stroke-width="2.4"/>`;

    // Panel height follows its contents, so the columns stay top-aligned and
    // each one is only as tall as it needs to be.
    const inner = g.cols * CELL_W;
    const padX = (g.w - inner) / 2;
    let h;
    if (g.web) {
      h = 26 + 30 + gridH(g.web, g.cols) + 18 + 30 + gridH(g.mobile, g.cols) + 6;
    } else {
      h = 26 + gridH(g.items, g.cols) + 6;
    }
    s += container(g.x, PANEL_Y, g.w, h, g.accent, {tint: 0.05, sw: 1.8});
    bottom = Math.max(bottom, PANEL_Y + h);

    if (g.web) {
      let y = PANEL_Y + 44;
      s += text(midX, y, 'For web applications', {size: 20, anchor: 'middle', cls: 'mut'});
      s += grid(g.x + padX, y + 18, g.web, g.cols);
      y += 18 + gridH(g.web, g.cols) + 40;
      s += text(midX, y, 'For mobile applications', {size: 20, anchor: 'middle', cls: 'mut'});
      s += grid(g.x + padX + ((g.cols - g.mobile.length) * CELL_W) / 2, y + 18, g.mobile, g.cols);
    } else {
      s += grid(g.x + padX, PANEL_Y + 26, g.items, g.cols);
    }
  });

  return svgDoc(
    W,
    bottom + 44,
    s,
    'The developer-facing surfaces: two consoles, four AI integrations, thirteen SDKs across web and mobile, and three ways to run the server.',
  );
}

// ---------------------------------------------------------------------------
// 8 — First-class identity types
// Claim: users, AI agents, and machines are not three subsystems. They differ
// only in how they prove who they are; underneath they are the same entity,
// carry roles from the same model, and can be the subject of a token.
// ---------------------------------------------------------------------------
function d8() {
  const W = 1620,
    H = 880;
  let s = '';

  const CARD_W = 480,
    CARD_Y = 90,
    CARD_H = 450;
  const XS = [40, 570, 1100];

  const principals = [
    {
      glyph: 'person',
      accent: ACC.cfg,
      title: 'People',
      sub: 'customers, employees, admins',
      assignee: 'user',
      proves: ['Password', 'Passkey', 'Email OTP', 'SMS OTP', 'Social login', 'Verifiable credential'],
      note: 'Any of these, in any order, composed as a journey.',
      token: 'the person is the subject',
    },
    {
      glyph: 'agent',
      accent: ACC.agt,
      title: 'AI agents',
      sub: 'copilots, autonomous workers',
      assignee: 'agent',
      proves: ['Client secret', 'Delegation from a person'],
      note: 'Owned by a person or a team, and able to act on their behalf.',
      token: 'the agent is the subject, or the actor for a person',
    },
    {
      glyph: 'machine',
      accent: ACC.dat,
      title: 'Machines',
      sub: 'services, jobs, integrations',
      assignee: 'app',
      proves: ['Client secret'],
      note: 'No interactive login. It authenticates as itself.',
      token: 'the service is the subject',
    },
  ];

  principals.forEach((p, i) => {
    const x = XS[i];
    s += container(x, CARD_Y, CARD_W, CARD_H, p.accent, {tint: 0.05});

    s += card(x + 24, CARD_Y + 20, 56, 56, {rx: 14, stroke: p.accent, sw: 1.5});
    s += glyph(p.glyph, x + 52, CARD_Y + 48, 30);
    s += text(x + 96, CARD_Y + 50, p.title, {size: 27, weight: 700, fill: p.accent});
    s += text(x + 96, CARD_Y + 78, p.sub, {size: 19, cls: 'mut'});

    // The assignee type is the concrete evidence for "first-class": all three
    // are peers in the same enum, not special cases bolted onto one another.
    const bw = widthOf(p.assignee, 18) + 28;
    s += card(x + CARD_W - 24 - bw, CARD_Y + 26, bw, 32, {rx: 8, stroke: p.accent, sw: 1.4});
    s += text(x + CARD_W - 24 - bw / 2, CARD_Y + 48, p.assignee, {
      size: 18,
      anchor: 'middle',
      cls: 'mono',
    });

    s += pill(x + 24, CARD_Y + 104, 'proves identity with', {size: 19, h: 32}).svg;

    const cols = p.proves.length > 2 ? 2 : 1;
    const chipW = (CARD_W - 48 - (cols - 1) * 12) / cols;
    p.proves.forEach((c, j) => {
      s += chip(x + 24 + (j % cols) * (chipW + 12), CARD_Y + 148 + Math.floor(j / cols) * 48, chipW, 38, c, {
        size: 17,
        accent: p.accent,
        weight: 600,
      });
    });

    const afterChips = CARD_Y + 148 + Math.ceil(p.proves.length / cols) * 48;
    s += block(x + 24, afterChips + 14, p.note, {
      size: 18,
      maxW: CARD_W - 48,
      lh: 23,
      cls: 'mut',
    }).svg;

    // Token row sits at a fixed offset from the bottom so the three align.
    s += `<line x1="${x + 24}" y1="${CARD_Y + 352}" x2="${x + CARD_W - 24}" y2="${CARD_Y + 352}" class="hair" stroke-width="1.5"/>`;
    s += text(x + 24, CARD_Y + 382, 'In an access token', {size: 18, weight: 700});
    s += block(x + 24, CARD_Y + 408, p.token, {
      size: 18,
      maxW: CARD_W - 48,
      lh: 23,
      cls: 'mut',
    }).svg;

    s += arrow(x + CARD_W / 2, CARD_Y + CARD_H + 6, x + CARD_W / 2, 594, {muted: true});
  });

  // --- What they share ------------------------------------------------------
  const SY = 600,
    SH = 240;
  s += container(40, SY, 1540, SH, ACC.run, {tint: 0.06});
  s += text(810, SY + 52, 'The same model underneath', {
    size: 30,
    anchor: 'middle',
    weight: 700,
    fill: ACC.run,
  });

  const shared = [
    ['One directory', 'All three are stored as entities, with the same lifecycle and the same APIs.'],
    ['One authorization model', 'Roles assign to a person, an agent, a machine, or a group alike.'],
    ['One token model', 'Any of the three can be the subject that a resource server checks.'],
  ];
  const sw2 = (1540 - 48 - 2 * 20) / 3;
  shared.forEach(([t, d], i) => {
    const x = 64 + i * (sw2 + 20);
    s += card(x, SY + 76, sw2, 110, {stroke: ACC.run, sw: 1.5});
    s += text(x + 20, SY + 108, t, {size: 22, weight: 700});
    s += block(x + 20, SY + 136, d, {size: 18, maxW: sw2 - 40, lh: 23, cls: 'mut'}).svg;
  });

  s += text(
    810,
    SY + 218,
    'People and agents also carry schema-driven types, so their attributes are yours to define.',
    {size: 19, anchor: 'middle', cls: 'mut it'},
  );

  return svgDoc(
    W,
    H,
    s,
    'People, AI agents, and machines differ only in how they authenticate; underneath they share one directory, one authorization model, and one token model.',
  );
}

// ---------------------------------------------------------------------------
// 8b — First-class identity types, release-blog treatment
// Same claim as diagram 8, stripped of the mechanism. The three tiles are drawn
// identically on purpose: equal visual weight is the argument for "first-class".
// Keep this one free of credential types, claim names, and schema detail.
// ---------------------------------------------------------------------------
function d8b() {
  const W = 1620,
    H = 640;
  let s = '';

  const TILE_W = 460,
    TILE_Y = 70,
    TILE_H = 260;
  const XS = [60, 580, 1100];

  const kinds = [
    {
      glyph: 'person',
      accent: ACC.cfg,
      title: 'People',
      desc: 'Customers, employees, and partners who sign in.',
    },
    {
      glyph: 'agent',
      accent: ACC.agt,
      title: 'AI agents',
      desc: 'Copilots and autonomous workers, acting alone or for someone.',
    },
    {
      glyph: 'machine',
      accent: ACC.dat,
      title: 'Machines',
      desc: 'Services, jobs, and integrations that call your APIs.',
    },
  ];

  const BAND_Y = 410;

  kinds.forEach((k, i) => {
    const x = XS[i];
    const midX = x + TILE_W / 2;
    s += container(x, TILE_Y, TILE_W, TILE_H, k.accent, {tint: 0.05});

    s += card(midX - 44, TILE_Y + 30, 88, 88, {rx: 24, stroke: k.accent, sw: 1.8});
    s += glyph(k.glyph, midX, TILE_Y + 74, 46);

    s += text(midX, TILE_Y + 162, k.title, {
      size: 31,
      anchor: 'middle',
      weight: 700,
      fill: k.accent,
    });
    s += block(midX, TILE_Y + 200, k.desc, {
      size: 20,
      maxW: TILE_W - 72,
      lh: 27,
      anchor: 'middle',
      cls: 'mut',
    }).svg;

    // Dotted, not arrowed: these belong to the model rather than flow into it.
    s += `<line x1="${midX}" y1="${TILE_Y + TILE_H + 12}" x2="${midX}" y2="${BAND_Y - 12}" class="hair dot" stroke-width="2.6"/>`;
  });

  const BAND_H = 170;
  s += container(60, BAND_Y, 1500, BAND_H, ACC.run, {tint: 0.06});
  s += text(810, BAND_Y + 56, 'All three are first-class identity types in ThunderID', {
    size: 32,
    anchor: 'middle',
    weight: 700,
    fill: ACC.run,
  });

  const points = ['Managed in one directory', 'Granted roles the same way', 'Accepted by your APIs the same way'];
  const cw2 = 440,
    gap2 = 30;
  const startX = (W - (points.length * cw2 + (points.length - 1) * gap2)) / 2;
  points.forEach((p, i) => {
    s += chip(startX + i * (cw2 + gap2), BAND_Y + 88, cw2, 52, p, {
      size: 20,
      accent: ACC.run,
      weight: 600,
    });
  });

  return svgDoc(
    W,
    H,
    s,
    'People, AI agents, and machines are all first-class identities in ThunderID: managed in one directory, granted roles the same way, and accepted by your APIs the same way.',
  );
}

const DIAGRAMS = {
  '1-positioning': d1,
  '2-configure-time-and-runtime': d2,
  '3-identity-journeys': d3,
  '4-agent-native-identity': d4,
  '5-verifiable-credentials': d5,
  '6-crypto-agility': d6,
  '7-developer-experience': d7,
  '8-identity-types': d8,
  '8-identity-types-simple': d8b,
};

mkdirSync(OUT, {recursive: true});
for (const theme of ['light', 'dark']) {
  setTheme(theme);
  for (const [name, draw] of Object.entries(DIAGRAMS)) {
    writeFileSync(join(OUT, `${name}-${theme}.svg`), draw());
  }
}
logger.info(`Wrote ${Object.keys(DIAGRAMS).length * 2} SVGs to ${OUT}`);
