import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The charte graphique, held to its own rule: ONE source.
 *
 * A design system decays in a predictable way — a hex gets pasted into a component "just for
 * now", a second one follows, and a year later changing the brand is a sweep across forty files
 * nobody can enumerate. These tests make that decay a failing build rather than a discovery.
 *
 * Three things are asserted, and the third is the interesting one:
 *  - `_muso-tokens.scss` states each brand value exactly once, and nothing else states one.
 *  - The one consumer that CANNOT read a custom property — index.html's `theme-color` — carries
 *    the same teal the token file gives the header. It is the only duplication in the system, so it is
 *    the only duplication that is checked.
 *  - The contrast the brand spec claims is recomputed from the tokens themselves. Re-seed navy
 *    and this says whether muted labels are still legible, instead of leaving it to be noticed.
 */

const ROOT = process.cwd();
const TOKENS = join(ROOT, 'src/styles/_muso-tokens.scss');

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/**
 * The colours this application states that the charte does not, each a decision, not a paste.
 *
 * A deep red for the actions nothing can undo (`--danger-strong`, the cancel-round card): the
 * brand's danger tone is orange, which cannot carry text on a filled control.
 *
 * And the line tables' three row tints by acceptance state (`--row-*-bg`): light green accepted,
 * light red refused, light yellow waiting — approved as an exception to "no green, no red", for a
 * row background only. Each is held to AA under navy text below.
 *
 * And the validation badges' two rules: a green for « validée » and an ochre for « en attente »
 * (the rejected badge takes the deep red above). Each is a badge's BORDER on its own tint, held to
 * 5:1 there below — the charte's teal now belongs to the header, and its yellow is 1.6:1 on white.
 */
const SANCTIONED_COLOURS = {
  'danger-red': '#b3261e',
  'row-accepted': '#e6f4ea',
  'row-rejected': '#fce8e6',
  'row-waiting': '#fef7e0',
  'badge-validated': '#137333',
  'badge-pending': '#8a6100',
};

/** The seven colours of the brand spec's canonical table. */
const BRAND_COLOURS = {
  navy: '#01475b',
  yellow: '#ffc126',
  teal: '#00919e',
  blue: '#60dbdf',
  orange: '#ff8725',
  cream: '#f1f3e8',
  white: '#ffffff',
} as const;

const tokensFile = readFileSync(TOKENS, 'utf8');

/** Every literal colour in a file, however it is spelt. */
const hexesIn = (source: string): readonly string[] =>
  [...source.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((match) =>
    match[0].toLowerCase(),
  );

function sourceFiles(directory: string, extensions: readonly string[]): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(ROOT, directory))) {
    const relative = `${directory}/${entry}`;
    if (statSync(join(ROOT, relative)).isDirectory()) {
      found.push(...sourceFiles(relative, extensions));
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      found.push(relative);
    }
  }
  return found;
}

// ── Contrast, computed rather than quoted ────────────────────────────────────────────────────
const channel = (value: number): number => {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (left: string, right: string): number => {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/** The same arithmetic `color-mix(in srgb, …)` does, so a token's real value is what is tested. */
const mix = (base: string, over: string, share: number): string => {
  const parts = [1, 3, 5].map((at) => {
    const from = parseInt(base.slice(at, at + 2), 16);
    const to = parseInt(over.slice(at, at + 2), 16);
    return Math.round(from * share + to * (1 - share))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${parts.join('')}`;
};

describe('the brand tokens', () => {
  it('declares each brand colour, exactly once, in the one file that may', () => {
    for (const [name, hex] of Object.entries(BRAND_COLOURS)) {
      expect(tokensFile).toContain(`$${name}: ${hex};`);
    }

    // Nothing else — no near-miss variant, no second navy. The palette file that Material's
    // generator produced is the documented exception: its tonal ramps are DERIVED from these
    // same two seeds, which is why it is generated and never hand-edited.
    // And ONE sanctioned colour outside the charte: the deep red reserved for irreversible actions.
    const declared = hexesIn(tokensFile);
    expect([...declared].sort()).toEqual(
      [...Object.values(BRAND_COLOURS), ...Object.values(SANCTIONED_COLOURS)].sort(),
    );
  });

  it('is the only place in the application that names a colour at all', () => {
    const scanned = [
      ...sourceFiles('src/app', ['.ts', '.html', '.scss']),
      'src/styles.scss',
      'src/styles/_muso-typography.scss',
    ];

    const offenders = scanned
      .filter((file) => !file.endsWith('brand.spec.ts'))
      .map((file) => ({ file, hexes: hexesIn(read(file)) }))
      .filter((entry) => entry.hexes.length > 0);

    // A component that hard-codes a colour is a component the next brand change will miss.
    expect(offenders).toEqual([]);
  });

  it('is the only place that names a typeface', () => {
    const offenders = sourceFiles('src/app', ['.ts', '.html', '.scss'])
      .filter((file) => !file.endsWith('brand.spec.ts'))
      .flatMap((file) =>
        [...read(file).matchAll(/font-family:([^;]+);/g)]
          .map(([, value]) => `${file}: ${value.trim()}`)
          .filter((declaration) => !declaration.includes('var(--muso-font-')),
      );

    expect(offenders).toEqual([]);
  });

  it('binds Angular Material to the tokens rather than to a second set of values', () => {
    const theme = read('src/styles/_muso-material.scss');
    const bindings = [...theme.matchAll(/(--mat-sys-[a-z-]+):\s*([^;]+);/g)];

    expect(bindings.length).toBeGreaterThan(10);
    for (const [, name, value] of bindings) {
      // Every system value Material renders reads a `--muso-*` custom property, so re-seeding a
      // token moves Material in the same paint — no rebuild, no second source. The one literal
      // allowed is a bare `0`, which is a geometry, not a brand value.
      expect(`${name} → ${value}`).toMatch(/var\(--muso-|→ 0$/);
    }
    expect(hexesIn(theme)).toEqual([]);
  });
});

describe('the brand values that CANNOT read a token', () => {
  const teal = BRAND_COLOURS.teal;

  it("gives the browser chrome the header's teal in index.html's theme-color", () => {
    expect(read('src/index.html')).toContain(`<meta name="theme-color" content="${teal}" />`);
  });

  it('serves every face the stylesheet asks for', () => {
    const declared = [...read('src/styles/_muso-typography.scss').matchAll(/url\('([^']+)'\)/g)];

    expect(declared.length).toBeGreaterThan(0);
    for (const [, url] of declared) {
      expect(() => statSync(join(ROOT, 'public', url))).not.toThrow();
    }
  });
});

describe('the contrast the brand promises', () => {
  const { navy, white, cream, teal, yellow, orange, blue } = BRAND_COLOURS;

  it('carries body text at AA on both page surfaces', () => {
    expect(contrast(navy, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(navy, cream)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(white, navy)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps muted labels legible, which is where a tint ramp usually fails', () => {
    // `--muso-text-muted` is `--muso-navy-80`, and 80% of navy is still text.
    const muted = mix(navy, white, 0.8);

    expect(contrast(muted, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('carries the destructive label on the reserved red at AA, which the orange could not', () => {
    const red = SANCTIONED_COLOURS['danger-red'];
    // `--on-danger-strong` is white: 6.5:1 on the red.
    expect(contrast(white, red)).toBeGreaterThanOrEqual(4.5);
    // The reason the red exists at all: neither text colour reaches AA on the brand orange.
    expect(contrast(white, orange)).toBeLessThan(4.5);
    expect(contrast(navy, orange)).toBeLessThan(4.5);
    // Its hover is darker still (mixed toward navy), so it only gains.
    expect(contrast(white, mix(red, navy, 0.85))).toBeGreaterThan(contrast(white, red));
  });

  it('keeps navy readable on every status surface the app paints', () => {
    for (const accent of [orange, yellow, blue, teal]) {
      expect(contrast(navy, mix(accent, white, 0.12))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps navy text well above AA on the three row tints, each told apart from the zebra', () => {
    const tints = [
      SANCTIONED_COLOURS['row-accepted'],
      SANCTIONED_COLOURS['row-rejected'],
      SANCTIONED_COLOURS['row-waiting'],
    ];
    for (const tint of tints) {
      expect(contrast(navy, tint)).toBeGreaterThanOrEqual(7);
      // A tint, not white: the row it paints visibly differs from an untinted one.
      expect(contrast(white, tint)).toBeGreaterThan(1.05);
    }
  });

  it('states why teal is never allowed to be text', () => {
    // 3.8:1 — the reason `--muso-text-accent` is documented for ≥24px and non-text UI only, and
    // the reason links are navy with a teal underline rather than teal.
    expect(contrast(teal, white)).toBeLessThan(4.5);
  });
});

/**
 * What tells this application from budgetisation at a glance: the same charte, but a teal header
 * — the logo's white variant is sanctioned on teal as on navy — 56px and flat, ruled off in navy,
 * with its own wordmark; rounder corners; badges in their own hues; eyebrows in sentence case.
 */
describe('the header that sets this app apart from its siblings', () => {
  const { navy, white, teal } = BRAND_COLOURS;
  const shell = read('src/app/layout/shell.ts');
  const tokenOf = (name: string) => tokensFile.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

  it('is stated as tokens: teal, 56px, a navy-20 rule, a white focus ring', () => {
    expect(tokenOf('--muso-chrome-bg')).toBe('var(--muso-teal)');
    expect(tokenOf('--muso-chrome-fg')).toBe('var(--muso-text-inverse)');
    expect(tokenOf('--muso-chrome-block-size')).toBe('56px');
    expect(tokenOf('--muso-chrome-rule')).toBe('1px solid var(--muso-navy-20)');
    expect(tokenOf('--muso-chrome-focus')).toBe('var(--muso-white)');
    // Everywhere else the ring stays teal.
    expect(tokenOf('--muso-focus')).toBe('var(--muso-teal)');
  });

  it('is drawn from those tokens by the shell, flat', () => {
    const header = shell.match(/\n {4}header \{([^}]+)\}/)?.[1] ?? '';

    expect(header).toContain('background: var(--muso-chrome-bg)');
    expect(header).toContain('color: var(--muso-chrome-fg)');
    expect(header).toContain('block-size: var(--muso-chrome-block-size)');
    expect(header).toContain('border-block-end: var(--muso-chrome-rule)');
    expect(header).toContain('--muso-focus: var(--muso-chrome-focus)');
    expect(header).not.toContain('box-shadow');
  });

  it('carries its white wordmark and white focus ring on teal', () => {
    // Both need 3:1: the wordmark is 24px bold (large text), a focus ring is non-text UI.
    // White on teal is 3.79:1; the default teal ring would be 1:1 there, hence the override.
    expect(contrast(white, teal)).toBeGreaterThanOrEqual(3);
    expect(contrast(teal, teal)).toBeLessThan(3);
  });

  it('sets the wordmark in the subheading face, bold, at 24px', () => {
    const product = shell.match(/\.product \{([^}]+)\}/)?.[1] ?? '';

    expect(product).toContain('font-family: var(--muso-font-subheading)');
    expect(product).toContain('font-weight: 700');
    expect(product).toContain('font-size: var(--muso-wordmark-size)');
    // With the type scale, where every size is stated.
    expect(read('src/styles/_muso-typography.scss')).toContain('--muso-wordmark-size: 1.5rem;');
  });

  it('rounds every corner to 4px', () => {
    expect(tokenOf('--muso-radius')).toBe('4px');
  });

  it('draws each validation badge in its own hue, at 5:1 on its tint and navy text at AA', () => {
    const red = SANCTIONED_COLOURS['danger-red'];
    const badges = [
      [SANCTIONED_COLOURS['badge-validated'], SANCTIONED_COLOURS['row-accepted']],
      [red, mix(red, white, 0.12)],
      [SANCTIONED_COLOURS['badge-pending'], mix(BRAND_COLOURS.yellow, white, 0.12)],
    ];
    for (const [rule, tint] of badges) {
      expect(contrast(rule, tint)).toBeGreaterThanOrEqual(5);
      expect(contrast(navy, tint)).toBeGreaterThanOrEqual(4.5);
    }

    expect(tokenOf('--badge-validated-border')).toBe('#{$badge-validated}');
    expect(tokenOf('--badge-validated-bg')).toBe('var(--row-accepted-bg)');
    expect(tokenOf('--badge-rejected-border')).toBe('var(--danger-strong)');
    expect(tokenOf('--badge-rejected-bg')).toBe(
      'color-mix(in srgb, var(--danger-strong) 12%, var(--muso-white))',
    );
    expect(tokenOf('--badge-pending-border')).toBe('#{$badge-pending}');
    expect(tokenOf('--badge-pending-bg')).toBe('var(--muso-yellow-12)');

    const badge = read('src/app/shared/ui/validation-badge.ts');
    for (const status of ['validated', 'rejected', 'pending']) {
      expect(badge).toContain(`background: var(--badge-${status}-bg)`);
      expect(badge).toContain(`border-color: var(--badge-${status}-border)`);
    }
  });

  it('sets eyebrows in sentence case, untracked', () => {
    const eyebrow = read('src/styles.scss').match(/\.muso-eyebrow \{([^}]+)\}/)?.[1] ?? '';

    expect(eyebrow).not.toContain('uppercase');
    expect(eyebrow).toContain('letter-spacing: 0;');
  });
});
