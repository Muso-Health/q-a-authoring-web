import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import {
  AUDIO_ITEM,
  CLINICAL_A,
  CLINICAL_B,
  CLINICAL_C,
  TRANSLATION_EN,
  TRANSLATION_NO_BASE,
  page,
  queuePath,
} from '../../core/validation/testing/queue-fixtures';
import type { QueueKind } from './queue-item';
import { ValidationPage } from './validation-page';

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();
const attached: HTMLElement[] = [];
afterEach(() => attached.splice(0).forEach((host) => host.remove()));

async function render(kind: QueueKind, answers: Record<string, unknown>) {
  const api = new FakeApiPort({ ...world(), ...answers });
  TestBed.configureTestingModule({
    imports: [ValidationPage],
    providers: [provideTestI18n(), provideRouter([]), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(ValidationPage);
  document.body.appendChild(fixture.nativeElement);
  attached.push(fixture.nativeElement);
  fixture.componentRef.setInput('kind', kind);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => fixture.whenStable();
  const buttonNamed = (name: string) =>
    [...element.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
    );
  const click = async (name: string) => {
    const button = buttonNamed(name);
    if (!button) throw new Error(`no button named "${name}"`);
    button.click();
    await settle();
  };
  const press = async (key: string, target: EventTarget = document.body) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await settle();
  };
  const select = async (label: string, value: string) => {
    const field = [...element.querySelectorAll<HTMLSelectElement>('select')].find(
      (s) => text(element.querySelector(`label[for="${s.id}"]`)) === label,
    )!;
    field.value = value;
    field.dispatchEvent(new Event('change'));
    await settle();
  };
  const card = () => element.querySelector<HTMLElement>('.item-card');
  return { api, fixture, element, settle, buttonNamed, click, press, select, card };
}

const clinical = () => ({
  [queuePath('clinical')]: page([CLINICAL_A, CLINICAL_B], 3, CLINICAL_B.qaset_id),
  [queuePath('clinical', `&cursor=${CLINICAL_B.qaset_id}`)]: page([CLINICAL_C], 3),
});
const CLINICAL_DECISION = `/qasets/${CLINICAL_A.qaset_id}/clinical-validation`;

describe('ValidationPage', () => {
  describe('the item card', () => {
    it('shows a clinical item’s base answer and variants, in context, with progress', async () => {
      const { element, card } = await render('clinical', clinical());

      expect(text(element.querySelector('h1'))).toBe('Validation clinique');
      expect(text(card()?.querySelector('.context'))).toBe(
        'Santé communautaire Mali › Paludisme › Prévention',
      );
      expect(card()?.querySelector('a.open')?.getAttribute('href')).toBe(
        `/concepts/${IDS.concept}`,
      );
      expect(text(card()?.querySelector('.answer'))).toContain(CLINICAL_A.answer_text);
      expect([...card()!.querySelectorAll('.variants li')].map((li) => text(li))).toEqual(
        CLINICAL_A.variant_texts,
      );
      expect(card()?.querySelector('.answer [lang="fr"]')).not.toBeNull();
      expect(text(element.querySelector('.progress'))).toBe('3 / 3 restants');
    });

    it('sets a translated QASet — answer and variants — beside the base-language one', async () => {
      const { card } = await render('translation', {
        [queuePath('translation')]: page([TRANSLATION_EN], 1),
      });

      const translated = card()!.querySelector('.translated')!;
      expect(text(translated)).toContain('Réponse traduite (English)');
      expect(text(translated)).toContain('Sleep under an insecticide-treated net every night.');
      expect([...translated.querySelectorAll('.variants li')].map((li) => text(li))).toEqual([
        'How can I avoid malaria?',
      ]);
      expect(translated.querySelector('[lang="en"]')).not.toBeNull();
      const source = card()!.querySelector('.source')!;
      expect(text(source)).toContain(TRANSLATION_EN.base_answer_text!);
      expect([...source.querySelectorAll('.variants li')].map((li) => text(li))).toEqual(
        TRANSLATION_EN.base_variant_texts,
      );
      expect(card()?.querySelector('a.open')?.getAttribute('href')).toBe(
        `/concepts/${IDS.concept}`,
      );
    });

    it('says so when there is no base-language text to compare with', async () => {
      const { card } = await render('translation', {
        [queuePath('translation')]: page([TRANSLATION_NO_BASE], 1),
      });

      expect(text(card()?.querySelector('.source'))).toBe('Aucun texte source disponible.');
    });

    it('decides a translation on its QASet as a whole', async () => {
      const { api, click } = await render('translation', {
        [queuePath('translation')]: page([TRANSLATION_EN], 1),
      });

      await click('Valider');

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `/qasets/${IDS.qasetEn}/translation-validation`,
          body: { decision: 'validated' },
        },
      ]);
    });

    it('plays an audio item through its playback URL', async () => {
      const { api, card, settle } = await render('audio', {
        [queuePath('audio')]: page([AUDIO_ITEM], 1),
        [`/audios/${AUDIO_ITEM.audio_id}/playback-url`]: {
          url: 'https://s/a.webm',
          expires_at: 'x',
        },
      });

      expect(text(card()?.querySelector('.voiced'))).toContain(AUDIO_ITEM.text);
      card()!.querySelector<HTMLButtonElement>('app-audio-player button')!.click();
      await settle();

      expect(api.reads).toContain(`/audios/${AUDIO_ITEM.audio_id}/playback-url`);
      expect(card()?.querySelector('app-audio-player audio')?.getAttribute('src')).toBe(
        'https://s/a.webm',
      );
    });
  });

  describe('deciding', () => {
    it('posts the decision with its note, then shows the next item and the new progress', async () => {
      const { api, element, card, click, settle } = await render('clinical', clinical());
      const note = element.querySelector<HTMLTextAreaElement>('textarea')!;
      note.value = 'Conforme au protocole';
      note.dispatchEvent(new Event('input'));
      await settle();

      await click('Valider');

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: CLINICAL_DECISION,
          body: { decision: 'validated', note: 'Conforme au protocole' },
        },
      ]);
      expect(text(card()?.querySelector('.answer'))).toContain(CLINICAL_B.answer_text);
      expect(text(element.querySelector('.progress'))).toBe('2 / 3 restants');
      expect(element.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('');
      expect(text(element.querySelector('.announce'))).toBe('Décision enregistrée : validé.');
      // The current item is the last loaded: the next page is already on its way.
      expect(api.reads).toContain(queuePath('clinical', `&cursor=${CLINICAL_B.qaset_id}`));
    });

    it('skips to the next item without deciding', async () => {
      const { api, card, click } = await render('clinical', clinical());

      await click('Passer');

      expect(text(card()?.querySelector('.answer'))).toContain(CLINICAL_B.answer_text);
      expect(api.writes).toEqual([]);
    });

    it('shows a refusal inline and keeps the item', async () => {
      const { api, element, card, click } = await render('clinical', {
        ...clinical(),
        [`POST ${CLINICAL_DECISION}`]: engineError(409, 'no_base_language_presence'),
      });

      await click('Rejeter');

      expect(text(element.querySelector('.decision [role="alert"]'))).toContain(
        'pas de réponse dans la langue de base',
      );
      expect(text(card()?.querySelector('.answer'))).toContain(CLINICAL_A.answer_text);
      expect(api.writes).toHaveLength(1);
    });

    it('says so when everything has been seen', async () => {
      const { element, click } = await render('clinical', {
        [queuePath('clinical')]: page([CLINICAL_A], 1),
      });

      await click('Valider');

      expect(text(element)).toContain('Vous avez parcouru toute la liste.');
    });

    it('says so when there is nothing to validate', async () => {
      const { element } = await render('clinical', { [queuePath('clinical')]: page([], 0) });

      expect(text(element)).toContain('Aucun élément à valider dans cette sélection.');
    });
  });

  describe('keyboard', () => {
    it('validates with V and rejects with R', async () => {
      const { api, press } = await render('clinical', clinical());

      await press('v');
      await press('r');

      expect(api.writes.map((w) => [w.path, (w.body as { decision: string }).decision])).toEqual([
        [CLINICAL_DECISION, 'validated'],
        [`/qasets/${CLINICAL_B.qaset_id}/clinical-validation`, 'rejected'],
      ]);
    });

    it('moves with J and K, and N focuses the note', async () => {
      const { api, card, press } = await render('clinical', clinical());

      await press('j');
      expect(text(card()?.querySelector('.answer'))).toContain(CLINICAL_B.answer_text);
      await press('k');
      expect(text(card()?.querySelector('.answer'))).toContain(CLINICAL_A.answer_text);
      await press('n');
      expect(document.activeElement?.tagName).toBe('TEXTAREA');
      expect(api.writes).toEqual([]);
    });

    it('never decides while the note is being typed', async () => {
      const { api, element, press } = await render('clinical', clinical());

      await press('v', element.querySelector('textarea')!);

      expect(api.writes).toEqual([]);
    });

    it('documents its shortcuts on screen', async () => {
      const { element } = await render('clinical', clinical());

      const pairs = [...element.querySelectorAll('.shortcuts > div')].map((pair) => [
        text(pair.querySelector('dt')),
        text(pair.querySelector('dd')),
      ]);
      expect(pairs).toEqual([
        ['V', 'Valider'],
        ['R', 'Rejeter'],
        ['N', 'Écrire une note'],
        ['J / →', 'Passer'],
        ['K / ←', 'Précédent'],
      ]);
    });
  });

  describe('filters', () => {
    it('re-queries for another state, read-only review included', async () => {
      const { api, select } = await render('clinical', {
        ...clinical(),
        [queuePath('clinical').replace('pending', 'rejected')]: page([CLINICAL_B], 1),
      });

      await select('État', 'rejected');

      expect(api.reads.at(-1)).toBe(queuePath('clinical').replace('pending', 'rejected'));
    });

    it('scopes to a project, then to one of its themes', async () => {
      const { api, element, select } = await render('clinical', {
        ...clinical(),
        [queuePath('clinical', `&project_id=${IDS.project}`)]: page([CLINICAL_A], 1),
        [queuePath('clinical', `&project_id=${IDS.project}&theme_id=${IDS.theme}`)]: page(
          [CLINICAL_A],
          1,
        ),
      });

      await select('Projet', IDS.project);
      expect(api.reads).toContain(queuePath('clinical', `&project_id=${IDS.project}`));
      const themes = [...element.querySelectorAll<HTMLSelectElement>('select')][1];
      expect([...themes.options].filter((o) => o.value).map((o) => text(o))).toEqual([
        'Paludisme › Prévention',
      ]);

      await select('Thème', IDS.theme);
      expect(api.reads.at(-1)).toBe(
        queuePath('clinical', `&project_id=${IDS.project}&theme_id=${IDS.theme}`),
      );
    });
  });

  it('says access is refused when the engine answers 403', async () => {
    const { element } = await render('audio', {
      [queuePath('audio')]: engineError(403, 'permission_denied'),
    });

    expect(text(element.querySelector('[role="alert"]'))).toContain('Accès refusé');
  });
});
