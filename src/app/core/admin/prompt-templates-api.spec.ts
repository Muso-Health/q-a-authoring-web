import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { PromptTemplatesApi } from './prompt-templates-api';
import { GENERATE_TEMPLATE, TEMPLATES, TRANSLATE_TEMPLATE } from './testing/admin-fixtures';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, templates: TestBed.inject(PromptTemplatesApi) };
}

describe('PromptTemplatesApi', () => {
  it('lists the active template of every use', async () => {
    const { templates } = setUp({ '/prompt-templates': TEMPLATES });

    const list = await templates.list();

    expect(list.map((t) => t.key)).toEqual(['translate', 'generate_variants']);
    expect(list[1]).toEqual({
      key: 'generate_variants',
      content: GENERATE_TEMPLATE.content,
      requiredPlaceholders: ['count', 'question'],
      updatedBy: null,
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('reads one template by its key', async () => {
    const { templates } = setUp({ '/prompt-templates/translate': TRANSLATE_TEMPLATE });

    expect((await templates.get('translate')).updatedBy).toBe('admin@example.org');
  });

  it('replaces the content for everyone', async () => {
    const { api, templates } = setUp();

    await templates.update('translate', 'Traduis {text}.');

    expect(api.writes).toEqual([
      { method: 'PUT', path: '/prompt-templates/translate', body: { content: 'Traduis {text}.' } },
    ]);
  });
});
