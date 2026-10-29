import { engineError } from '../../../core/api/testing/fake-api-port';
import { IDS, VOICES } from '../../../core/catalog/testing/catalog-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { VoicesPage } from './voices-page';

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(VoicesPage, { '/voices': VOICES, ...answers });

const cardOf = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLElement>('li.voice')].find(
    (card) => text(card.querySelector('h3')) === name,
  )!;

describe('VoicesPage', () => {
  it('lists the voices with their notes', async () => {
    const { element } = await render();

    expect(text(element.querySelector('h2'))).toBe('Voix');
    expect(
      [...element.querySelectorAll('li.voice')].map((card) => [
        text(card.querySelector('h3')),
        text(card.querySelector('.note')) ?? null,
      ]),
    ).toEqual([
      ['Awa', 'Voix féminine, Bamako'],
      ['Moussa', null],
    ]);
  });

  it('says so when there is no voice yet', async () => {
    const { element } = await render({ '/voices': { items: [] } });

    expect(text(element.querySelector('.muso-empty'))).toBe('Aucune voix pour l’instant.');
  });

  it('adds a voice, a blank note left out, then re-reads', async () => {
    const { api, element, type, submit } = await render();
    const form = element.querySelector('form.create');

    await type('Nom', ' Fatou ', form);
    await type('Note (facultative)', '  ', form);
    await submit(form);
    await type('Nom', 'Ibrahim', form);
    await type('Note (facultative)', 'Voix grave', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/voices', body: { name: 'Fatou' } },
      { method: 'POST', path: '/voices', body: { name: 'Ibrahim', note: 'Voix grave' } },
    ]);
    expect(api.reads.filter((path) => path === '/voices')).toHaveLength(3);
  });

  it('asks for a name before adding', async () => {
    const { api, element, submit } = await render();
    const form = element.querySelector('form.create');

    await submit(form);

    expect(api.writes).toEqual([]);
    expect(text(form?.querySelector('.field-error'))).toBe('Ce champ est obligatoire.');
  });

  it('edits a voice’s name and note in place, a cleared note sent as null', async () => {
    const { api, element, click, type, submit } = await render();

    await click('Modifier la voix Awa');
    const form = cardOf(element, 'Awa').querySelector('form');
    await type('Nom', 'Awa D.', form);
    await type('Note (facultative)', '', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'PATCH', path: `/voices/${IDS.voiceAwa}`, body: { name: 'Awa D.', note: null } },
    ]);
    expect(cardOf(element, 'Awa').querySelector('form')).toBeNull();
  });

  it('asks before deleting, and explains a voice still in use', async () => {
    const { api, element, click } = await render({
      [`DELETE /voices/${IDS.voiceAwa}`]: engineError(409, 'voice_in_use'),
    });
    const awa = cardOf(element, 'Awa');

    await click('Supprimer la voix Awa', awa);
    expect(api.writes).toEqual([]);
    expect(text(awa)).toContain('Supprimer définitivement la voix « Awa » ?');
    await click('Confirmer', awa);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/voices/${IDS.voiceAwa}` }]);
    expect(text(cardOf(element, 'Awa').querySelector('[role="alert"]'))).toBe(
      'Cette voix est encore utilisée par des enregistrements : elle ne peut pas être supprimée.',
    );
  });

  it('deletes an unused voice, then re-reads', async () => {
    const { api, element, click } = await render();
    const moussa = cardOf(element, 'Moussa');

    await click('Supprimer la voix Moussa', moussa);
    await click('Confirmer', moussa);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/voices/${IDS.voiceMoussa}` }]);
    expect(api.reads.filter((path) => path === '/voices')).toHaveLength(2);
  });
});
