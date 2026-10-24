import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const fr = JSON.parse(readFileSync(join(ROOT, 'public/i18n/fr.json'), 'utf8')) as Record<
  string,
  unknown
>;

function sources(directory: string): string[] {
  return readdirSync(join(ROOT, directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(ROOT, relative)).isDirectory()) return sources(relative);
    return (entry.endsWith('.ts') || entry.endsWith('.html')) && !entry.endsWith('.spec.ts')
      ? [relative]
      : [];
  });
}

const lookup = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      fr,
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

  it('all resolve in French, to words or to a plural group', () => {
    const unresolved = used.filter((key) => {
      const node = lookup(key);
      if (typeof node === 'string') return node.trim() === '';
      return typeof (node as Record<string, unknown> | undefined)?.['other'] !== 'string';
    });

    expect(unresolved).toEqual([]);
  });
});
