import { writeFileSync } from "node:fs";
import type { GuideConfig, Scene, Section } from "./types";

// Styled standalone HTML build of the guide. Same data as the markdown emitter,
// wrapped in a self-contained page with inline CSS (no external deps): a sticky
// table of contents, the Overture palette, a styled cheat-sheet, and figures.
// Output lives in docs/generated/ alongside the markdown so assets/ resolves.
// Everything that differs between the beginner guide and the reference is in cfg.

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Escape, then turn `code` spans into <code>.
const inline = (s: string): string => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

const tableHtml = (headers: string[], rows: string[][]): string =>
  [
    "<table>",
    `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`,
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    "</table>",
  ].join("\n");

const STYLE = `
  :root {
    --bg: #101214; --panel: #202327; --panel-2: #2a2e34; --line: #434952;
    --text: #f1f4f8; --muted: #b4bdc8; --accent: #19f0a8; --badge: #23d7ff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.9em;
    background: var(--panel-2); border: 1px solid var(--line); border-radius: 4px; padding: 0.05em 0.35em; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem;
    display: grid; grid-template-columns: 240px 1fr; gap: 2.5rem; align-items: start; }
  header.brand { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 0.6rem;
    border-bottom: 1px solid var(--line); padding-bottom: 1rem; }
  header.brand .name { font: 700 0.95rem/1 ui-monospace, monospace; letter-spacing: 0.28em; color: var(--accent); }
  header.brand .sub { font: 0.95rem/1 ui-monospace, monospace; letter-spacing: 0.2em; color: var(--muted); }
  nav { position: sticky; top: 1.5rem; font-size: 0.9rem; }
  nav .label { text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.7rem; color: var(--muted); margin-bottom: 0.6rem; }
  nav ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  nav a { color: var(--muted); display: block; padding: 0.2rem 0; border-left: 2px solid transparent; padding-left: 0.7rem; }
  nav a:hover { color: var(--text); border-left-color: var(--accent); text-decoration: none; }
  main { min-width: 0; }
  .intro { color: var(--text); }
  .deeper { background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 0.8rem 1rem; font-size: 0.92rem; color: var(--muted); }
  .deeper strong { color: var(--text); }
  h2 { font-size: 1.5rem; margin: 2.4rem 0 0.8rem; padding-top: 0.6rem; border-top: 1px solid var(--line); }
  h2:first-of-type { border-top: none; }
  h3 { font-size: 1.05rem; color: var(--muted); margin: 1.6rem 0 0.6rem; }
  p { margin: 0.6rem 0; }
  figure { margin: 1rem 0 1.6rem; }
  figure img { max-width: 100%; height: auto; display: block; border: 1px solid var(--line); border-radius: 8px; background: #000; }
  figcaption { font-size: 0.88rem; color: var(--muted); margin-top: 0.5rem; }
  figcaption strong { color: var(--text); }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.5rem 0.8rem; border: 1px solid var(--line); vertical-align: top; }
  th { background: var(--panel-2); color: var(--text); font-weight: 600; }
  td:first-child { color: var(--text); font-weight: 500; white-space: nowrap; }
  footer { grid-column: 1 / -1; border-top: 1px solid var(--line); margin-top: 2.5rem; padding-top: 1.2rem;
    font-size: 0.85rem; color: var(--muted); }
  @media (max-width: 820px) {
    .wrap { grid-template-columns: 1fr; gap: 1.5rem; }
    nav { position: static; }
  }
`;

export function writeGuideHtml(sections: Section[], scenes: Scene[], cfg: GuideConfig): void {
  const slugFor = (title: string) => scenes.find((s) => s.title === title)?.slug ?? "";

  const toc = [
    { href: "#controls-cheat-sheet", label: "Controls cheat-sheet" },
    ...scenes.map((s) => ({ href: `#${s.slug}`, label: s.title })),
    { href: "#glossary", label: "Glossary" },
  ];
  const navHtml = `<nav><div class="label">Contents</div><ol>${toc
    .map((t) => `<li><a href="${esc(t.href)}">${esc(t.label)}</a></li>`)
    .join("")}</ol></nav>`;

  const linkLine = cfg.links
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a> — ${esc(l.note)}`)
    .join(" &middot; ");
  const deeperHtml = linkLine
    ? `<p class="deeper"><strong>Where to go deeper:</strong> ${linkLine}</p>`
    : "";

  const sectionsHtml = sections
    .map((sec) => {
      const body = sec.body.map((p) => `<p>${inline(p)}</p>`).join("\n");
      const shots = sec.shots
        .map(
          (shot) =>
            `<figure>\n<img src="assets/${esc(shot.file)}" alt="${esc(shot.title)}" loading="lazy" />\n` +
            `<figcaption><strong>${esc(shot.title)}.</strong> ${inline(shot.caption)}</figcaption>\n</figure>`
        )
        .join("\n");
      return `<section id="${esc(slugFor(sec.title))}">\n<h2>${esc(sec.title)}</h2>\n${body}\n${shots}\n</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(cfg.title)}</title>
<!-- Generated by \`${esc(cfg.generateCmd)}\`. ${esc(cfg.editHint)} -->
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="brand"><span class="name">${esc(cfg.brandName)}</span><span class="sub">${esc(cfg.brandSub)}</span></header>
${navHtml}
<main>
${cfg.intro.map((p) => `<p class="intro">${inline(p)}</p>`).join("\n")}
${deeperHtml}
<section id="controls-cheat-sheet">
<h2>Controls cheat-sheet</h2>
${tableHtml(
  ["Control", "Gesture", "What it does"],
  cfg.cheatSheet.map((r) => [r.control, r.gesture, r.does])
)}
</section>
${sectionsHtml}
<section id="glossary">
<h2>Glossary</h2>
${tableHtml(
  ["Term", "Meaning"],
  cfg.glossary.map((g) => [g.term, g.def])
)}
</section>
${linkLine ? `<footer>${linkLine}</footer>` : ""}
</main>
</div>
</body>
</html>
`;

  writeFileSync(cfg.htmlPath, html, "utf8");
}
