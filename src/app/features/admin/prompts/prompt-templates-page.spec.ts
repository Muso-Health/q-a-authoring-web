import { TEMPLATES } from '../../../core/admin/testing/admin-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { PromptTemplatesPage } from './prompt-templates-page';

describe('PromptTemplatesPage', () => {
  it('lists every template with who last changed it', async () => {
    const { element } = await renderAdmin(PromptTemplatesPage, {
      '/prompt-templates': TEMPLATES,
    });

    expect(text(element.querySelector('h2'))).toBe('Modèles de prompt');
    const rows = [...element.querySelectorAll('li.template')];
    expect(rows.map((row) => text(row.querySelector('a')))).toEqual([
      'translate',
      'generate_variants',
    ]);
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/admin/prompts/translate');
    expect(text(rows[0])).toContain('Modifié par admin@example.org');
    expect(text(rows[1])).toContain('Modèle par défaut');
    expect(text(rows[1])).toContain('{count}');
  });

  it('says so when the list cannot be read', async () => {
    const { element } = await renderAdmin(PromptTemplatesPage, {});

    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
