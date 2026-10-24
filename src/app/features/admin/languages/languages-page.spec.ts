import { engineError } from '../../../core/api/testing/fake-api-port';
import { IDS, LANGUAGES } from '../../../core/catalog/testing/catalog-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { LanguagesPage } from './languages-page';

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(LanguagesPage, { '/languages': LANGUAGES, ...answers });

const cardOf = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLElement>('li.language')].find(
    (card) => text(card.querySelector('h3')) === name,
  )!;

describe('LanguagesPage', () => {
  it('lists the languages with their codes', async () => {
    const { element } = await render();

    expect(text(element.querySelector('h2'))).toBe('Langues');
    expect(
      [...element.querySelectorAll('li.language')].map((card) => [
        text(card.querySelector('h3')),
        text(card.querySelector('.code')),
      ]),
    ).toEqual([
      ['Bambara', 'bm'],
      ['English', 'en'],
      ['Français', 'fr'],
      ['Peul', 'ff'],
    ]);
  });

  it('registers a language by code and name, then re-reads', async () => {
    const { api, element, type, submit } = await render();
    const form = element.querySelector('form.create');

    await type('Code', ' wo ', form);
    await type('Nom', 'Wolof', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/languages', body: { code: 'wo', name: 'Wolof' } },
    ]);
    expect(api.reads.filter((path) => path === '/languages')).toHaveLength(2);
  });

  it('asks for both fields before registering', async () => {
    const { api, element, submit } = await render();
    const form = element.querySelector('form.create');

    await submit(form);

    expect(api.writes).toEqual([]);
    expect([...form!.querySelectorAll('.field-error')].map(text)).toEqual([
      'Ce champ est obligatoire.',
      'Ce champ est obligatoire.',
    ]);
  });

  it('maps a refused or taken code inline', async () => {
    const { api, element, type, submit } = await render({
      'POST /languages': engineError(422, 'invalid_language_code'),
    });
    const form = element.querySelector('form.create');

    await type('Code', 'bambara', form);
    await type('Nom', 'Bambara', form);
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe(
      'Ce code a été refusé : utilisez un code de langue ISO 639, par exemple « bm » ou « fr ».',
    );

    api.answers['POST /languages'] = engineError(409, 'language_code_already_exists');
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe('Une langue porte déjà ce code.');
  });

  it('renames a language, its code shown but never editable', async () => {
    const { api, element, click, type, submit } = await render();

    await click('Renommer la langue Bambara');
    const form = cardOf(element, 'Bambara').querySelector('form');
    expect(form?.querySelectorAll('input')).toHaveLength(1);
    expect(text(form)).toContain('Le code (bm) ne peut pas être modifié.');
    await type('Nom', 'Bamanankan', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'PATCH', path: `/languages/${IDS.bm}`, body: { name: 'Bamanankan' } },
    ]);
    expect(api.reads.filter((path) => path === '/languages')).toHaveLength(2);
  });

  it('asks before deleting, and explains a language still in use', async () => {
    const { api, element, click } = await render({
      [`DELETE /languages/${IDS.fr}`]: engineError(409, 'language_in_use'),
    });
    const french = cardOf(element, 'Français');

    await click('Supprimer la langue Français', french);
    expect(api.writes).toEqual([]);
    expect(text(french)).toContain('Supprimer définitivement la langue « Français » ?');
    await click('Confirmer', french);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/languages/${IDS.fr}` }]);
    expect(text(cardOf(element, 'Français').querySelector('[role="alert"]'))).toBe(
      'Cette langue est encore utilisée par un projet ou des contenus : elle ne peut pas être supprimée.',
    );
    expect(api.reads.filter((path) => path === '/languages')).toHaveLength(1);
  });

  it('deletes an unused language, then re-reads', async () => {
    const { api, element, click } = await render();
    const peul = cardOf(element, 'Peul');

    await click('Supprimer la langue Peul', peul);
    await click('Confirmer', peul);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/languages/${IDS.ff}` }]);
    expect(api.reads.filter((path) => path === '/languages')).toHaveLength(2);
  });
});
