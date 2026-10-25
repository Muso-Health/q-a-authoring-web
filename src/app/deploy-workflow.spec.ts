import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The CI deploy workflow, held to the branch → site mapping. Read as text: the mapping is the
 * shell step that chooses the target, so that step's lines are what is asserted.
 */

const workflow = readFileSync(join(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');

describe('the deploy workflow', () => {
  it('runs on pushes to master and develop only', () => {
    expect(workflow).toMatch(/^on:\n {2}push:\n {4}branches: \[master, develop\]\n/m);
    expect(workflow).not.toMatch(/^ {2}pull_request:/m);
  });

  it('ships master to prod with the production build, develop to test with the test build', () => {
    expect(workflow).toContain(
      [
        '          if [ "${{ github.ref_name }}" = "master" ]; then',
        '            echo "name=prod" >> "$GITHUB_OUTPUT"',
        '            echo "configuration=production" >> "$GITHUB_OUTPUT"',
        '            echo "environment=environment.ts" >> "$GITHUB_OUTPUT"',
        '          elif [ "${{ github.ref_name }}" = "develop" ]; then',
        '            echo "name=test" >> "$GITHUB_OUTPUT"',
        '            echo "configuration=test" >> "$GITHUB_OUTPUT"',
        '            echo "environment=environment.test.ts" >> "$GITHUB_OUTPUT"',
        '          else',
      ].join('\n'),
    );
    expect(workflow).toContain('--only "hosting:${{ steps.target.outputs.name }}"');
    expect(workflow).toContain('FIREBASE_PROJECT_ID: q-a-authoring');
  });

  it('never deploys the demo site: that stays manual', () => {
    expect(workflow).not.toMatch(/name=demo|configuration=demo|hosting:demo|deploy-demo/);
    const targets = [...workflow.matchAll(/echo "name=(\w+)"/g)].map((match) => match[1]);
    expect(targets).toEqual(['prod', 'test']);
  });

  it('tests, then builds, then refuses placeholders, then deploys', () => {
    const at = (text: string) => {
      const index = workflow.indexOf(text);
      expect(index, text).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at('run: npm test'),
      at('run: npm run build -- --configuration'),
      at("grep -rqF 'replace-me.invalid'"),
      at("grep -rqF '<ENTRA_TENANT_ID>'"),
      at('firebase-tools@15 deploy'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('authenticates with a secret named, never a credential committed', () => {
    expect(workflow).toContain('${{ secrets.FIREBASE_SERVICE_ACCOUNT_QA_AUTHORING }}');
    expect(workflow).not.toMatch(/"private_key"|BEGIN PRIVATE KEY|"type": "service_account"/);
  });
});
