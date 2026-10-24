import { HttpErrorResponse } from '@angular/common/http';
import { TRANSLATE_TEMPLATE } from '../../../core/admin/testing/admin-fixtures';
import { engineError } from '../../../core/api/testing/fake-api-port';
import { renderAdmin, text } from '../testing/render-admin';
import { PromptTemplatePage } from './prompt-template-page';

const PATH = '/prompt-templates/translate';
const CONTENT_LABEL = 'Contenu du modèle';

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(PromptTemplatePage, { [PATH]: TRANSLATE_TEMPLATE, ...answers }, { key: 'translate' });

const refusal = (missing: string[], unknown: string[]) =>
  new HttpErrorResponse({
    status: 422,
    error: { code: 'invalid_prompt_template', message: 'm', details: { missing, unknown } },
  });

describe('PromptTemplatePage', () => {
  it('shows the key, its required placeholders as guidance and the last change', async () => {
    const { element } = await render();

    expect(text(element.querySelector('h2'))).toBe('translate');
    const placeholders = [...element.querySelectorAll('.placeholders li')].map(text);
    expect(placeholders).toEqual(['{source_language}', '{target_language}', '{text}']);
    expect(text(element)).toContain('Modifié par admin@example.org');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-30T14:05:00Z');
    expect(element.querySelector('textarea')?.value).toBe(TRANSLATE_TEMPLATE.content);
  });

  it('saves the content with PUT, then re-reads the template', async () => {
    const saved = {
      ...TRANSLATE_TEMPLATE,
      content: 'Traduis {text} : {source_language} → {target_language}',
      updated_by: 'me@example.org',
    };
    const { api, element, type, submit } = await render({ [`PUT ${PATH}`]: saved });

    await type(CONTENT_LABEL, saved.content);
    api.answers[PATH] = saved;
    await submit();

    expect(api.writes).toEqual([{ method: 'PUT', path: PATH, body: { content: saved.content } }]);
    expect(api.reads.filter((path) => path === PATH)).toHaveLength(2);
    expect(text(element)).toContain('Modifié par me@example.org');
    expect(text(element.querySelector('[role="status"].saved'))).toBe('Modèle enregistré.');
  });

  it('shows the missing and unknown placeholders next to the editor, keeping the draft', async () => {
    const { api, element, type, submit } = await render({
      [`PUT ${PATH}`]: refusal(['text'], ['texte']),
    });

    await type(CONTENT_LABEL, 'Traduis {texte} de {source_language} vers {target_language}.');
    await submit();

    expect(text(element.querySelector('[role="alert"]'))).toContain(
      'Le modèle a été refusé : ses placeholders ne correspondent pas à ceux attendus.',
    );
    expect(text(element.querySelector('.problems .missing'))).toBe('Manquants : {text}');
    expect(text(element.querySelector('.problems .unknown'))).toBe('Inconnus : {texte}');
    expect(element.querySelector('textarea')?.value).toContain('{texte}');
    expect(api.reads.filter((path) => path === PATH)).toHaveLength(1);
  });

  it('maps any other refusal inline in French', async () => {
    const { element, submit } = await render({
      [`PUT ${PATH}`]: engineError(403, 'permission_denied'),
    });

    await submit();

    expect(text(element.querySelector('[role="alert"]'))).toContain(
      'Votre compte n’a pas la permission de modifier ce contenu.',
    );
    expect(element.querySelector('.problems')).toBeNull();
  });
});
