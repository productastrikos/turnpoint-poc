// Turns an on-screen string into a translation key by replacing equipment tags, job / MTO ids, dates and numbers
// with {#} placeholders, so one Arabic entry covers "Replace K-301 seals", "Replace P-205 seals" and so on.
// The Arabic value uses {#} (next value, in order) or {1}, {2}... (a specific value) to put them back.

// One pass, so the values come back in the order they appear in the text.
const VARIABLE = new RegExp(
  [
    String.raw`\b20\d\d-\d\d-\d\d\b`, // ISO date
    String.raw`(?:\d{1,2}["”]?-)?\b[A-Z]{1,5}-?\d{1,5}[A-Z]?(?:-\d{1,5}[A-Z]?)?\b`, // equipment tag, job / MTO id, line tag
    String.raw`(?<![\w{])\d[\d,]*(?:\.\d+)?[kKM%]?(?![\w}])`, // number
  ].join('|'),
  'g'
);

export interface Normalized {
  key: string;
  values: string[];
}

export function normalize(text: string): Normalized {
  const values: string[] = [];
  const hold = (m: string) => {
    values.push(m);
    return '{#}';
  };
  return { key: text.replace(VARIABLE, hold), values };
}

/** Puts the original values back into an Arabic template. */
export function fill(template: string, values: string[]): string {
  let i = 0;
  return template.replace(/\{(#|\d+)\}/g, (_, n: string) => (n === '#' ? values[i++] : values[Number(n) - 1]) ?? '');
}
