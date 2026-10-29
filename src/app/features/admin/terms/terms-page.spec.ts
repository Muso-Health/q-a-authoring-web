import { engineError } from '../../../core/api/testing/fake-api-port';
import { CATEGORIES, INTENTS, TAXONOMY_IDS } from '../../../core/admin/testing/admin-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { TermsPage } from './terms-page';

const labels = (element: HTMLElement) =>
  [...element.querySelectorAll('li.term')].map((card) => text(card.querySelector('h3')));

const cardOf = (element: HTMLElement, label: string) =>
  [...element.querySelectorAll<HTMLElement>('li.term')].find(
    (card) => text(card.querySelector('h3')) === label,
  )!;

describe('TermsPage — intents', () => {
  const render = (answers: Record<string, unknown> = {}) =>
    renderAdmin(TermsPage, { '/intents': INTENTS, ...answers }, { kind: 'intents' });

  it('lists the intent catalogue, offering no rename', async () => {
    const { element, buttonNamed } = await render();

    expect(text(element.querySelector('h2'))).toBe('Intentions');
    expect(labels(element)).toEqual(['Utiliser une moustiquaire', 'Reconnaître la fièvre']);
    expect(buttonNamed('Modifier')).toBeUndefined();
  });

  it('searches the catalogue by its beginning', async () => {
    const { api, element, type } = await render({
      '/intents?q=uti': { items: [INTENTS.items[0]] },
    });

    await type('Rechercher une intention', 'uti');
    expect(labels(element)).toEqual(['Utiliser une moustiquaire']);

    await type('Rechercher une intention', '');
    expect(labels(element)).toEqual(['Utiliser une moustiquaire', 'Reconnaître la fièvre']);
    expect(api.reads).toEqual(['/intents', '/intents?q=uti', '/intents']);
  });

  it('says when nothing matches', async () => {
    const { element, type } = await render({ '/intents?q=zz': { items: [] } });

    await type('Rechercher une intention', 'zz');

    expect(text(element.querySelector('.muso-empty'))).toBe('Aucune intention ne correspond.');
  });

  it('registers an intent, then re-reads the list as searched', async () => {
    const { api, element, type, submit } = await render({
      '/intents?q=uti': { items: [INTENTS.items[0]] },
    });
    const form = element.querySelector('form.create');

    await type('Rechercher une intention', 'uti');
    await type('Nouvelle intention', '  Utiliser un savon ', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/intents', body: { text: 'Utiliser un savon' } },
    ]);
    expect(api.reads).toEqual(['/intents', '/intents?q=uti', '/intents?q=uti']);
    expect(form!.querySelector<HTMLInputElement>('input')!.value).toBe('');
  });

  it('asks for the text before registering', async () => {
    const { api, element, submit } = await render();
    const form = element.querySelector('form.create');

    await submit(form);

    expect(api.writes).toEqual([]);
    expect(text(form?.querySelector('.field-error'))).toBe('Ce champ est obligatoire.');
  });

  it('asks before deleting, and explains an intent still attached', async () => {
    const { api, element, click } = await render({
      [`DELETE /intents/${TAXONOMY_IDS.fever}`]: engineError(409, 'intent_in_use'),
    });
    const fever = cardOf(element, 'Reconnaître la fièvre');

    await click('Supprimer l’intention Reconnaître la fièvre', fever);
    expect(api.writes).toEqual([]);
    expect(text(fever)).toContain(
      'Supprimer définitivement l’intention « Reconnaître la fièvre » ?',
    );
    await click('Confirmer', fever);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/intents/${TAXONOMY_IDS.fever}` }]);
    expect(text(cardOf(element, 'Reconnaître la fièvre').querySelector('[role="alert"]'))).toBe(
      'Cette intention est encore attachée à des notions : détachez-la avant de la supprimer.',
    );
  });

  it('deletes an unused intent, then re-reads', async () => {
    const { api, element, click } = await render();
    const bednet = cardOf(element, 'Utiliser une moustiquaire');

    await click('Supprimer l’intention Utiliser une moustiquaire', bednet);
    await click('Confirmer', bednet);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/intents/${TAXONOMY_IDS.bednet}` }]);
    expect(api.reads).toEqual(['/intents', '/intents']);
  });
});

describe('TermsPage — categories', () => {
  const render = (answers: Record<string, unknown> = {}) =>
    renderAdmin(TermsPage, { '/categories': CATEGORIES, ...answers }, { kind: 'categories' });

  it('lists, searches and registers categories', async () => {
    const { api, element, type, submit } = await render({
      '/categories?q=pa': { items: [CATEGORIES.items[1]] },
    });

    expect(text(element.querySelector('h2'))).toBe('Catégories');
    expect(labels(element)).toEqual(['Nutrition', 'Paludisme']);
    await type('Rechercher une catégorie', 'pa');
    expect(labels(element)).toEqual(['Paludisme']);

    const form = element.querySelector('form.create');
    await type('Nouvelle catégorie', 'Hygiène', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/categories', body: { name: 'Hygiène' } },
    ]);
    expect(api.reads).toEqual(['/categories', '/categories?q=pa', '/categories?q=pa']);
  });

  it('explains a category still attached', async () => {
    const { element, click } = await render({
      [`DELETE /categories/${TAXONOMY_IDS.malaria}`]: engineError(409, 'category_in_use'),
    });
    const malaria = cardOf(element, 'Paludisme');

    await click('Supprimer la catégorie Paludisme', malaria);
    await click('Confirmer', malaria);

    expect(text(cardOf(element, 'Paludisme').querySelector('[role="alert"]'))).toBe(
      'Cette catégorie est encore attachée à des notions : retirez-la avant de la supprimer.',
    );
  });
});
