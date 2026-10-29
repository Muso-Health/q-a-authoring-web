import type { Schemas } from '../../core/api/api-types';
import { engineError } from '../../core/api/testing/fake-api-port';
import { ME_AUTHOR, ME_READER } from '../../core/catalog/testing/catalog-fixtures';
import { C, renderConcept, text } from './testing/render-concept';

const ME_CURATOR: Schemas['MeResponse'] = {
  ...ME_AUTHOR,
  permissions: ['author_qasets', 'manage_intents', 'manage_categories'],
};

async function render(me: Schemas['MeResponse'] = ME_CURATOR) {
  const page = await renderConcept({
    me,
    answers: {
      '/intents?q=mous': {
        items: [
          { id: 'i2', text: 'moustiquaire' },
          { id: 'i5', text: 'moustique' },
        ],
      },
      '/intents?q=fi%C3%A8vre': { items: [] },
      '/categories?q=enf': { items: [{ id: 'c2', name: 'Enfants de moins de 5 ans' }] },
      '/categories?q=urg': { items: [{ id: 'c7', name: 'Urgences' }] },
      '/categories?q=nutrition': { items: [] },
      'POST /intents': { id: 'i9', text: 'fièvre' },
      'POST /categories': { id: 'c9', name: 'nutrition' },
    },
  });
  const { element, settle } = page;
  const tags = (kind: 'intents' | 'categories') =>
    element.querySelector<HTMLElement>(`app-concept-tags[kind="${kind}"]`)!;
  const search = async (scope: ParentNode, value: string) => {
    const input = scope.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const choose = async (scope: ParentNode, label: string) => {
    const option = [...scope.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (o) => text(o) === label,
    );
    if (!option) throw new Error(`no option "${label}"`);
    option.click();
    await settle();
  };
  const options = (scope: ParentNode) =>
    [...scope.querySelectorAll('[role="option"]')].map((o) => text(o));
  const chips = (scope: ParentNode) =>
    [...scope.querySelectorAll('.muso-chips .chip-label')].map((c) => text(c));
  return { ...page, tags, search, choose, options, chips };
}

describe('ConceptPage classification', () => {
  it('offers no classification without author_qasets', async () => {
    const { element, buttonNamed } = await render(ME_READER);

    for (const name of [
      'Ajouter une intention',
      'Ajouter une catégorie',
      'Retirer l’intention « moustiquaire »',
      'Retirer la catégorie « Prévention »',
    ]) {
      expect(buttonNamed(name, element)).toBeUndefined();
    }
  });

  it('classifies the concept, not its variants or QASets', async () => {
    const { element, tags, chips } = await render();

    expect(chips(tags('intents'))).toEqual(['prévention_paludisme', 'moustiquaire']);
    expect(chips(tags('categories'))).toEqual(['Prévention', 'Enfants de moins de 5 ans']);
    for (const section of element.querySelectorAll('section.language')) {
      expect(section.querySelector('app-typeahead, .muso-chips')).toBeNull();
      expect(text(section)).not.toContain('Ajouter une intention');
    }
  });

  describe('intents', () => {
    it('searches by prefix and attaches an existing intent, leaving out those already attached', async () => {
      const { api, tags, click, search, options, choose, afterFirstWrite } = await render();

      await click('Ajouter une intention', tags('intents'));
      await search(tags('intents'), 'mous');

      expect(api.reads).toContain('/intents?q=mous');
      // The concept already carries « moustiquaire ».
      expect(options(tags('intents'))).toEqual(['moustique', 'Créer « mous »']);
      await choose(tags('intents'), 'moustique');

      expect(api.writes).toEqual([
        { method: 'POST', path: `${C}/intents`, body: { intent_id: 'i5' } },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${C}/intents`, `GET ${C}`]);
      expect(tags('intents').querySelector('input[role="combobox"]')).toBeNull();
    });

    it('creates a missing intent, then attaches it to the concept, then re-fetches', async () => {
      const { api, tags, click, search, choose, afterFirstWrite } = await render();

      await click('Ajouter une intention', tags('intents'));
      await search(tags('intents'), 'fièvre');
      await choose(tags('intents'), 'Créer « fièvre »');

      expect(api.writes).toEqual([
        { method: 'POST', path: '/intents', body: { text: 'fièvre' } },
        { method: 'POST', path: `${C}/intents`, body: { intent_id: 'i9' } },
      ]);
      expect(afterFirstWrite()).toEqual(['POST /intents', `POST ${C}/intents`, `GET ${C}`]);
    });

    it('offers to create only with manage_intents', async () => {
      const { tags, click, search, options } = await render(ME_AUTHOR);

      await click('Ajouter une intention', tags('intents'));
      await search(tags('intents'), 'fièvre');

      expect(options(tags('intents'))).toEqual([]);
    });

    it('detaches an intent from its chip, then re-fetches', async () => {
      const { tags, click, afterFirstWrite } = await render();

      await click('Retirer l’intention « moustiquaire »', tags('intents'));

      expect(afterFirstWrite()).toEqual([`DELETE ${C}/intents/i2`, `GET ${C}`]);
    });

    it('shows a refusal under the intents', async () => {
      const { api, tags, click, afterFirstWrite } = await render();
      api.answers[`DELETE ${C}/intents/i2`] = engineError(403, 'permission_denied');

      await click('Retirer l’intention « moustiquaire »', tags('intents'));

      expect(text(tags('intents').querySelector('[role="alert"]'))).toBe(
        'Votre compte n’a pas la permission de modifier ce contenu.',
      );
      expect(afterFirstWrite()).toEqual([`DELETE ${C}/intents/i2`]);
    });
  });

  describe('categories', () => {
    it('attaches an existing category to the concept, leaving out those already attached', async () => {
      const { api, tags, click, search, options, choose, afterFirstWrite } = await render();
      const categories = tags('categories');

      await click('Ajouter une catégorie', categories);
      await search(categories, 'enf');
      // « Enfants de moins de 5 ans » is already on the concept; only a new « enf » could be made.
      expect(options(categories)).toEqual(['Créer « enf »']);
      await search(categories, 'urg');
      expect(options(categories)).toEqual(['Urgences', 'Créer « urg »']);
      await choose(categories, 'Urgences');

      expect(api.writes).toEqual([
        { method: 'POST', path: `${C}/categories`, body: { category_id: 'c7' } },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${C}/categories`, `GET ${C}`]);
    });

    it('creates a missing category, then attaches it', async () => {
      const { api, tags, click, search, choose } = await render();

      await click('Ajouter une catégorie', tags('categories'));
      await search(tags('categories'), 'nutrition');
      await choose(tags('categories'), 'Créer « nutrition »');

      expect(api.writes).toEqual([
        { method: 'POST', path: '/categories', body: { name: 'nutrition' } },
        { method: 'POST', path: `${C}/categories`, body: { category_id: 'c9' } },
      ]);
    });

    it('removes a category from its chip, then re-fetches', async () => {
      const { tags, click, afterFirstWrite } = await render();

      await click('Retirer la catégorie « Prévention »', tags('categories'));

      expect(afterFirstWrite()).toEqual([`DELETE ${C}/categories/c1`, `GET ${C}`]);
    });
  });
});
