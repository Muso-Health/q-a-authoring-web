// Copies the exact webfont files the brand needs out of the @fontsource packages and into
// `public/fonts/`, where they are served from our own origin under STABLE names.
//
// Why copy rather than import the packages' CSS directly: self-hosting is not optional here. The
// app is a PWA that must start with no connection, so a font request to a CDN — or to a build
// artefact whose name changes every release — is a font that is missing exactly when someone is
// working offline. Stable paths are also what makes `<link rel=preload>` in index.html possible
// and what lets the service worker cache them by name.
//
// The packages stay in devDependencies as the PROVENANCE of these binaries: the version in
// package-lock.json says precisely which cut of Inter and Noto Serif JP is in `public/`, and
// `npm run fonts:sync` reproduces them. Run it after bumping either package.
//
// Only the latin and latin-ext subsets are taken. Noto Serif JP's full family is ~94 MB of
// Japanese; the brand spec is explicit that only the latin subsets are wanted.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'fonts');

/** [package, file] — the file name is the same on both sides, so the mapping stays obvious. */
const FILES = [
  ['@fontsource/inter', 'inter-latin-400-normal.woff2'],
  ['@fontsource/inter', 'inter-latin-ext-400-normal.woff2'],
  ['@fontsource/inter', 'inter-latin-600-normal.woff2'],
  ['@fontsource/inter', 'inter-latin-ext-600-normal.woff2'],
  ['@fontsource/inter-tight', 'inter-tight-latin-700-normal.woff2'],
  ['@fontsource/noto-serif-jp', 'noto-serif-jp-latin-600-normal.woff2'],
  ['@fontsource/noto-serif-jp', 'noto-serif-jp-latin-ext-600-normal.woff2'],
];

mkdirSync(out, { recursive: true });
for (const [pkg, file] of FILES) {
  copyFileSync(join(root, 'node_modules', pkg, 'files', file), join(out, file));
  console.log(`fonts: ${pkg}/${file}`);
}
console.log(`fonts: ${FILES.length} files synced to public/fonts`);
