import type { Schemas } from '../../core/api/api-types';
import { engineError } from '../../core/api/testing/fake-api-port';
import { CONCEPT, ME_AUTHOR, ME_READER } from '../../core/catalog/testing/catalog-fixtures';
import { C, dialog, escape, renderConcept, text } from './testing/render-concept';

const ME_CURATOR: Schemas['MeResponse'] = {
  ...ME_AUTHOR,
  permissions: ['author_qasets', 'manage_intents', 'manage_categories'],
};

const INTENTS = {
  items: [
    { id: 'i1', text: 'prévention_paludisme' },
    { id: 'i2', text: 'moustiquaire' },
    { id: 'i5', text: 'moustique' },
    { id: 'i6', text: 'vaccination' },
  ],
};
const CATEGORIES = {
  items: [
    { id: 'c1', name: 'Prévention' },
    { id: 'c2', name: 'Enfants de moins de 5 ans' },
    { id: 'c7', name: 'Urgences' },
  ],
};

async function render(
  me: Schemas['MeResponse'] = ME_CURATOR,
  answers: Record<string, unknown> = {},
) {
  const page = await renderConcept({
    me,
    answers: {
      '/intents': INTENTS,
      '/categories': CATEGORIES,
      '/intents?q=mous': { items: [INTENTS.items[1], INTENTS.items[2]] },
      '/intents?q=fi%C3%A8vre': { items: [] },
      '/categories?q=nutrition': { items: [] },
      'POST /intents': { id: 'i9', text: 'fièvre' },
      'POST /categories': { id: 'c9', name: 'nutrition' },
      ...answers,
    },
  });
  const { element, settle } = page;
  const tags = (kind: 'intents' | 'categories') =>
    element.querySelector<HTMLElement>(`[data-kind="${kind}"]`)!;
  const search = async (value: string) => {
    const input = dialog()!.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const options = () => [...dialog()!.querySelectorAll('[role="option"]')].map((o) => text(o));
  const choose = async (label: string) => {
    const option = [...dialog()!.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (o) => text(o) === label,
    );
    if (!option) throw new Error(`no option "${label}"`);
    option.click();
    await settle();
  };
  const chips = (scope: ParentNode) =>
    [...scope.querySelectorAll('.muso-chips .chip-label')].map((c) => text(c));
  const title = () => text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!));
  return { ...page, tags, search, options, choose, chips, title };
}

describe('ConceptPage classification', () => {
  it('offers no notion toolbar without author_qasets', async () => {
    const { element, buttonNamed } = await render(ME_READER);

    expect(element.querySelector('[role="toolbar"][aria-label="Outils de la notion"]')).toBeNull();
    for (const name of ['Ajouter une intention', 'Ajouter une catégorie', 'Supprimer la notion']) {
      expect(buttonNamed(name, element)).toBeUndefined();
    }
  });

  it('puts classification and deletion in the notion toolbar, in the header, and nowhere per language', async () => {
    const { element, header } = await render();

    const bar = header().querySelector('[role="toolbar"][aria-label="Outils de la notion"]')!;
    expect([...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ajouter une catégorie',
      'Retirer une catégorie',
      'Ajouter une intention',
      'Retirer une intention',
      'Supprimer la notion',
    ]);
    const card = element.querySelector('section.concept-card')!;
    expect(text(card)).not.toContain('intention');
    expect(card.querySelector('[aria-label*="catégorie"]')).toBeNull();
  });

  it('shows the concept’s intents and categories as chips', async () => {
    const { tags, chips } = await render();

    expect(chips(tags('intents'))).toEqual(['prévention_paludisme', 'moustiquaire']);
    expect(chips(tags('categories'))).toEqual(['Prévention', 'Enfants de moins de 5 ans']);
  });

  it('cannot remove what the concept does not have', async () => {
    const bare = { ...structuredClone(CONCEPT), intents: [], categories: [] };
    const { button } = await render(ME_CURATOR, { [C]: bare });

    expect(button('Retirer une intention').getAttribute('aria-disabled')).toBe('true');
    expect(button('Retirer une catégorie').getAttribute('aria-disabled')).toBe('true');
  });

  describe('intents', () => {
    it('lists the intent catalogue in a modal, leaving out those already attached', async () => {
      const { api, click, title, options } = await render();

      await click('Ajouter une intention');

      expect(title()).toBe('Ajouter une intention');
      expect(api.reads).toContain('/intents');
      expect(options()).toEqual(['moustique', 'vaccination']);
      expect(document.activeElement).toBe(dialog()!.querySelector('input[role="combobox"]'));
    });

    it('narrows by prefix and attaches the chosen intent, then closes and re-fetches', async () => {
      const { api, click, search, options, choose, afterFirstWrite } = await render();

      await click('Ajouter une intention');
      await search('mous');
      // The concept already carries « moustiquaire ».
      expect(options()).toEqual(['moustique', 'Créer « mous »']);
      await choose('moustique');

      expect(api.writes).toEqual([
        { method: 'POST', path: `${C}/intents`, body: { intent_id: 'i5' } },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${C}/intents`, `GET ${C}`]);
      expect(dialog()).toBeNull();
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Ajouter une intention');
    });

    it('creates a missing intent, then attaches it', async () => {
      const { api, click, search, choose, afterFirstWrite } = await render();

      await click('Ajouter une intention');
      await search('fièvre');
      await choose('Créer « fièvre »');

      expect(api.writes).toEqual([
        { method: 'POST', path: '/intents', body: { text: 'fièvre' } },
        { method: 'POST', path: `${C}/intents`, body: { intent_id: 'i9' } },
      ]);
      expect(afterFirstWrite()).toEqual(['POST /intents', `POST ${C}/intents`, `GET ${C}`]);
    });

    it('offers to create only with manage_intents', async () => {
      const { click, search, options } = await render(ME_AUTHOR);

      await click('Ajouter une intention');
      await search('fièvre');

      expect(options()).toEqual([]);
    });

    it('attaches nothing when the modal is escaped', async () => {
      const { api, click, settle } = await render();

      await click('Ajouter une intention');
      escape();
      await settle();

      expect(dialog()).toBeNull();
      expect(api.writes).toEqual([]);
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Ajouter une intention');
    });

    it('detaches an intent from the removal modal, then re-fetches', async () => {
      const { click, press, title, afterFirstWrite } = await render();

      await click('Retirer une intention');
      expect(title()).toBe('Retirer une intention');
      await press('Retirer l’intention « moustiquaire »');

      expect(afterFirstWrite()).toEqual([`DELETE ${C}/intents/i2`, `GET ${C}`]);
    });

    it('shows a refusal in the removal modal', async () => {
      const { api, click, press, afterFirstWrite } = await render();
      api.answers[`DELETE ${C}/intents/i2`] = engineError(403, 'permission_denied');

      await click('Retirer une intention');
      await press('Retirer l’intention « moustiquaire »');

      expect(text(dialog()!.querySelector('[role="alert"]'))).toBe(
        'Votre compte n’a pas la permission de modifier ce contenu.',
      );
      expect(afterFirstWrite()).toEqual([`DELETE ${C}/intents/i2`]);
    });
  });

  describe('categories', () => {
    it('lists the category catalogue and attaches the chosen one', async () => {
      const { api, click, title, options, choose, afterFirstWrite } = await render();

      await click('Ajouter une catégorie');
      expect(title()).toBe('Ajouter une catégorie');
      // « Prévention » and « Enfants de moins de 5 ans » are already on the concept.
      expect(options()).toEqual(['Urgences']);
      await choose('Urgences');

      expect(api.writes).toEqual([
        { method: 'POST', path: `${C}/categories`, body: { category_id: 'c7' } },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${C}/categories`, `GET ${C}`]);
    });

    it('creates a missing category, then attaches it', async () => {
      const { api, click, search, choose } = await render();

      await click('Ajouter une catégorie');
      await search('nutrition');
      await choose('Créer « nutrition »');

      expect(api.writes).toEqual([
        { method: 'POST', path: '/categories', body: { name: 'nutrition' } },
        { method: 'POST', path: `${C}/categories`, body: { category_id: 'c9' } },
      ]);
    });

    it('removes a category from the removal modal, then re-fetches', async () => {
      const { click, press, afterFirstWrite } = await render();

      await click('Retirer une catégorie');
      await press('Retirer la catégorie « Prévention »');

      expect(afterFirstWrite()).toEqual([`DELETE ${C}/categories/c1`, `GET ${C}`]);
    });
  });
});
