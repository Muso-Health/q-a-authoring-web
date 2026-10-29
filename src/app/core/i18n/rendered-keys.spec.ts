import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SPANISH } from './testing/spanish';

const ROOT = process.cwd();
const bundle = (language: string) =>
  JSON.parse(readFileSync(join(ROOT, `public/i18n/${language}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
const LOCALES = { fr: bundle('fr'), en: bundle('en') };
const fr = LOCALES.fr;

function sources(directory: string): string[] {
  return readdirSync(join(ROOT, directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(ROOT, relative)).isDirectory()) return sources(relative);
    return (entry.endsWith('.ts') || entry.endsWith('.html')) && !entry.endsWith('.spec.ts')
      ? [relative]
      : [];
  });
}

const lookup = (translations: Record<string, unknown>, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      translations,
    );

/** Every quoted dotted literal whose first segment is a top-level group of the translations. */
const keysIn = (source: string): string[] =>
  [...source.matchAll(/'([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)'/g)]
    .map((match) => match[1])
    .filter((key) => key.split('.')[0] in fr);

describe('the keys the application uses', () => {
  const used = [
    ...new Set(
      sources('src/app').flatMap((file) => keysIn(readFileSync(join(ROOT, file), 'utf8'))),
    ),
  ];

  it('are found at all', () => {
    expect(used.length).toBeGreaterThan(40);
  });

  for (const [language, translations] of Object.entries(LOCALES)) {
    it(`all resolve in ${language}, to words or to a plural group`, () => {
      const unresolved = used.filter((key) => {
        const node = lookup(translations, key);
        if (typeof node === 'string') return node.trim() === '';
        return typeof (node as Record<string, unknown> | undefined)?.['other'] !== 'string';
      });

      expect(unresolved).toEqual([]);
    });
  }
});

describe('the templates and component strings', () => {
  it('carry no Spanish: their words come from the French and English files', () => {
    const spanish = sources('src/app').filter((file) =>
      SPANISH.test(readFileSync(join(ROOT, file), 'utf8')),
    );

    expect(spanish).toEqual([]);
  });
});
