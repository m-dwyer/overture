// Minimal markdown block builders. Each function returns ONE block (no leading
// or trailing blank lines); callers collect blocks into an array and join with
// `\n\n`, so blank-line separation is automatic and never hand-placed.

export const h1 = (text: string): string => `# ${text}`;
export const h2 = (text: string): string => `## ${text}`;
export const h3 = (text: string): string => `### ${text}`;
export const p = (text: string): string => text;
export const comment = (text: string): string => `<!-- ${text} -->`;
export const img = (alt: string, src: string): string => `![${alt}](${src})`;
export const link = (text: string, href: string): string =>
  `[${text}](${href})`;

export const ul = (items: string[]): string =>
  items.map((item) => `- ${item}`).join("\n");

export const table = (headers: string[], rows: string[][]): string => {
  const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [row(headers), row(headers.map(() => "---")), ...rows.map(row)].join(
    "\n",
  );
};

// Join blocks into a final document with a single trailing newline.
export const doc = (blocks: string[]): string => blocks.join("\n\n") + "\n";
