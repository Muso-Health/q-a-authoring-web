import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Firebase Hosting setup, held to the build it serves. Read as files: nothing here runs a
 * deploy. `scripts/deploy.sh` is the only thing that does, and only when someone runs it.
 */

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface Header {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}
interface HostingTarget {
  readonly target: string;
  readonly public: string;
  readonly ignore: readonly string[];
  readonly rewrites: readonly { readonly source: string; readonly destination: string }[];
  readonly headers: readonly Header[];
}

const hosting = (JSON.parse(read('firebase.json')) as { hosting: HostingTarget[] }).hosting;
const firebaserc = JSON.parse(read('.firebaserc')) as {
  projects: Record<string, string>;
  targets: Record<string, { hosting: Record<string, string[]> }>;
};
const angular = JSON.parse(read('angular.json')) as {
  projects: Record<string, { architect: { build: { options: { outputPath?: string } } } }>;
};

const cacheOf = (target: HostingTarget, source: string) =>
  target.headers
    .find((header) => header.source === source)
    ?.headers.find((header) => header.key === 'Cache-Control')?.value;

describe('the Firebase Hosting setup', () => {
  it('hosts in its own project, a test and a prod site, never the engine’s project', () => {
    expect(firebaserc.projects).toEqual({ default: 'q-a-authoring' });
    expect(firebaserc.targets).toEqual({
      'q-a-authoring': { hosting: { prod: ['qa-authoring'], test: ['qa-authoring-test'] } },
    });
    expect(read('.firebaserc')).not.toContain('musohealth');
  });

  it('names one hosting entry per target, the same in all but the name', () => {
    expect(hosting.map((target) => target.target)).toEqual(['prod', 'test']);
    const [prod, test] = hosting.map(({ target: _, ...rest }) => rest);
    expect(test).toEqual(prod);
  });

  for (const target of hosting) {
    describe(`the ${target.target} site`, () => {
      it('serves the browser build Angular actually writes', () => {
        // No `outputPath` in angular.json: the builder's default, `dist/<project>`, with the
        // application builder's `browser/` folder inside it.
        expect(angular.projects['qa-authoring-web'].architect.build.options.outputPath).toBe(
          undefined,
        );
        expect(target.public).toBe('dist/qa-authoring-web/browser');
      });

      it('answers every route with the single-page app', () => {
        expect(target.rewrites).toEqual([{ source: '**', destination: '/index.html' }]);
      });

      it('never caches the page or the translations, and keeps hashed bundles for a year', () => {
        expect(cacheOf(target, '/index.html')).toBe('no-cache, no-store, must-revalidate');
        expect(cacheOf(target, '/i18n/**')).toBe('no-cache');
        expect(cacheOf(target, '**/*-????????.@(js|css)')).toBe(
          'public, max-age=31536000, immutable',
        );
        // Fonts are not hashed, so a week rather than forever.
        expect(cacheOf(target, '/fonts/*.woff2')).toBe('public, max-age=604800');
      });

      it('names only header sources that match something the build ships', () => {
        for (const { source } of target.headers) {
          if (source.startsWith('/') && !source.includes('*')) {
            expect(() => statSync(join(ROOT, 'src', source))).not.toThrow();
          }
        }
      });
    });
  }
});

describe('the deploy script', () => {
  const script = read('scripts/deploy.sh');
  const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

  it('is run as `npm run deploy:test` or `npm run deploy:prod`', () => {
    expect(scripts['deploy:test']).toBe('bash scripts/deploy.sh test');
    expect(scripts['deploy:prod']).toBe('bash scripts/deploy.sh prod');
  });

  it('builds the configuration that matches the site it deploys to', () => {
    expect(script).toContain('test) configuration=test environment=environment.test.ts');
    expect(script).toContain('prod) configuration=production environment=environment.ts');
    expect(script).toContain('--only "hosting:$target"');
  });

  it('refuses to ship an engine placeholder', () => {
    expect(script).toContain('replace-me.invalid');
  });
});
