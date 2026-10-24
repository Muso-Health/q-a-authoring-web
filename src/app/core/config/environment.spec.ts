import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface BuildConfiguration {
  readonly fileReplacements?: readonly { readonly replace: string; readonly with: string }[];
}

const configurations = (
  JSON.parse(read('angular.json')) as {
    projects: Record<
      string,
      { architect: { build: { configurations: Record<string, BuildConfiguration> } } }
    >;
  }
).projects['qa-authoring-web'].architect.build.configurations;

const swapOf = (configuration: string): string | undefined =>
  configurations[configuration]?.fileReplacements?.find((replacement) =>
    replacement.replace.endsWith('core/config/environment.ts'),
  )?.with;

// Read as source, not imported: `ng test` builds with the development swap already applied.
describe('the environment', () => {
  it('ships the default file untouched in production', () => {
    expect(swapOf('production')).toBeUndefined();
  });

  it('points development at a local engine with the dev identity', () => {
    expect(swapOf('development')).toBe('src/app/core/config/environment.development.ts');
    const development = read('src/app/core/config/environment.development.ts');
    expect(development).toContain("apiBaseUrl: 'http://localhost:8000'");
    expect(development).toContain("provider: 'dev'");
  });
});
