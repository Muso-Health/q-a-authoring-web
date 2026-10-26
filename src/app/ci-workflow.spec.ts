import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The CI workflow: verify only. Read as text, like the deploy workflow's spec — what matters is
 * which commands run and what never appears.
 */

const workflow = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
/** What the workflow DOES: its comments may name the deploy workflow, its steps may not. */
const steps = workflow
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('the CI workflow', () => {
  it('runs on every push and every pull request, on any branch', () => {
    expect(workflow).toMatch(/^on:\n {2}push:\n {2}pull_request:\n/m);
    expect(workflow).not.toMatch(/branches/);
  });

  it('installs from the lockfile on the Node version .nvmrc pins', () => {
    expect(workflow).toContain("node-version-file: '.nvmrc'");
    expect(workflow).toContain('cache: npm');
    expect(workflow).toContain('run: npm ci');
  });

  it('lints, tests headless, builds for production, then checks the contract types', () => {
    const at = (text: string) => {
      const index = workflow.indexOf(text);
      expect(index, text).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at('run: npm ci'),
      at('run: npm run lint'),
      at('run: npm test -- --watch=false'),
      at('run: npm run build'),
      at('git diff --exit-code -- src/app/core/api/generated/schema.ts'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('reads the repository and nothing else', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
  });

  it('never deploys, and needs no Firebase and no secret', () => {
    expect(steps).not.toMatch(/firebase|deploy|secrets\.|GOOGLE_APPLICATION_CREDENTIALS/i);
  });
});
