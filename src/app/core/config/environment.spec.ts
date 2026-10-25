import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface BuildConfiguration {
  readonly fileReplacements?: readonly { readonly replace: string; readonly with: string }[];
  readonly [setting: string]: unknown;
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

  it('signs the deployed builds in with Entra, from placeholders until the registration exists', () => {
    for (const path of [
      'src/app/core/config/environment.ts',
      'src/app/core/config/environment.test.ts',
    ]) {
      const source = read(path);
      expect(source).toContain("provider: 'entra'");
      expect(source).toContain("tenantId: '<ENTRA_TENANT_ID>'");
      expect(source).toContain("clientId: '<ENTRA_SPA_CLIENT_ID>'");
      expect(source).toContain("engineScope: '<ENGINE_API_SCOPE>'");
      expect(source).toContain('QA_AUTHORING_AUTH_ENTRA_AUDIENCE');
      expect(source).not.toContain("provider: 'dev'");
    }
  });

  it('points the test site at its own engine, built otherwise exactly as production', () => {
    expect(swapOf('test')).toBe('src/app/core/config/environment.test.ts');
    const { fileReplacements, ...testSettings } = configurations['test'];
    expect(fileReplacements).toHaveLength(1);
    expect(testSettings).toEqual(configurations['production']);

    const engineOf = (path: string) => read(path).match(/apiBaseUrl: '([^']+)'/)?.[1];
    const production = engineOf('src/app/core/config/environment.ts');
    const test = engineOf('src/app/core/config/environment.test.ts');
    expect(production).toMatch(/^https:\/\//);
    expect(test).toMatch(/^https:\/\//);
    expect(test).not.toBe(production);
  });
});
