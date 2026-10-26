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

  it('signs production in with Entra, from placeholders until its values are supplied', () => {
    const source = read('src/app/core/config/environment.ts');
    expect(source).toContain("provider: 'entra'");
    expect(source).toContain("tenantId: '<ENTRA_TENANT_ID>'");
    expect(source).toContain("clientId: '<ENTRA_SPA_CLIENT_ID>'");
    expect(source).toContain("engineScope: '<ENGINE_API_SCOPE>'");
    expect(source).toContain('QA_AUTHORING_AUTH_ENTRA_AUDIENCE');
    expect(source).not.toContain("provider: 'dev'");
  });

  it('signs the test site in with Entra, with the test registration’s real values', () => {
    const source = read('src/app/core/config/environment.test.ts');
    expect(source).toContain("provider: 'entra'");
    expect(source).toContain("tenantId: '54f70170-aa34-45ae-8315-0fa0d17d916e'");
    expect(source).toContain("clientId: '03dff017-5bbf-49b1-9f74-d22d217e36b8'");
    expect(source).toContain(
      "engineScope: 'api://9cc072fd-584f-4753-be07-539953fa21a0/access_as_user'",
    );
    expect(source).toContain('QA_AUTHORING_AUTH_ENTRA_AUDIENCE');
    // Nothing left for the deploy guards to refuse.
    expect(source).not.toContain('replace-me.invalid');
    expect(source).not.toMatch(/'<[A-Z_]+>'/);
    expect(source).not.toContain("provider: 'dev'");
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

  // TEMPORARY, until Entra is live: a dev-auth build for the operator alone.
  it('signs the demo site in as the single dev user, against its own engine', () => {
    expect(swapOf('demo')).toBe('src/app/core/config/environment.demo.ts');
    const { fileReplacements, ...demoSettings } = configurations['demo'];
    expect(fileReplacements).toHaveLength(1);
    expect(demoSettings).toEqual(configurations['production']);

    const demo = read('src/app/core/config/environment.demo.ts');
    expect(demo).toContain("provider: 'dev'");
    expect(demo).toContain("email: '<DEMO_DEV_EMAIL>'");
    expect(demo).toContain("apiBaseUrl: 'https://demo-engine-url.replace-me.invalid'");
    expect(demo).toContain('QA_AUTHORING_AUTH_PROVIDER=dev');
    expect(demo).toContain('https://qa-authoring-demo.web.app');
    expect(demo).toContain('https://qa-authoring-demo.firebaseapp.com');
    expect(demo).not.toContain("provider: 'entra'");
  });

  it('leaves production on its placeholder engine; the test site calls the test engine', () => {
    expect(swapOf('production')).toBeUndefined();
    expect(swapOf('test')).toBe('src/app/core/config/environment.test.ts');
    expect(read('src/app/core/config/environment.ts')).toContain(
      "apiBaseUrl: 'https://prod-engine-url.replace-me.invalid'",
    );
    expect(read('src/app/core/config/environment.test.ts')).toContain(
      "apiBaseUrl: 'https://qa-authoring-engine-test-uh7dztocmq-uc.a.run.app'",
    );
  });
});
