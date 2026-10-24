import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Schemas } from '../../core/api/api-types';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import {
  IDS,
  ME_AUTHOR,
  ME_READER,
  QASET,
  world,
} from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { QASetPage } from './qaset-page';

const Q = `/qasets/${IDS.qaset}`;
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

async function render(me: Schemas['MeResponse'] = ME_AUTHOR) {
  const api = new FakeApiPort({ ...world(), '/me': me });
  TestBed.configureTestingModule({
    imports: [QASetPage],
    providers: [provideTestI18n(), provideRouter([]), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(QASetPage);
  fixture.componentRef.setInput('qasetId', IDS.qaset);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const settle = () => fixture.whenStable();
  const section = (code: string) =>
    element.querySelector<HTMLElement>(`section.language[data-lang="${code}"]`)!;
  /** A button by its accessible name: its aria-label, or else its text. */
  const button = (name: string, scope: ParentNode = element) => {
    const found = [...scope.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
    );
    if (!found) throw new Error(`no button named "${name}"`);
    return found;
  };
  const click = async (name: string, scope?: ParentNode) => {
    button(name, scope).click();
    await settle();
  };
  const type = (field: HTMLTextAreaElement | HTMLSelectElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const submit = async (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit'));
    await settle();
  };
  /** The calls made since the first write, so "and then re-fetched" can be asserted. */
  const afterFirstWrite = () =>
    api.calls.slice(api.calls.findIndex((call) => !call.startsWith('GET')));
  return { api, fixture, element, section, button, click, type, submit, afterFirstWrite, settle };
}

/** The QASet as the engine returns it after an edit; `change` edits a deep copy. */
function edited(change: (detail: Schemas['QASetResponse']) => void): Schemas['QASetResponse'] {
  const detail = structuredClone(QASET);
  change(detail);
  return detail;
}
const presence = (detail: Schemas['QASetResponse'], languageId: string) =>
  detail.languages.find((l) => l.language_id === languageId)!;

describe('QASetPage authoring', () => {
  describe('permissions', () => {
    it('stays read-only without author_qasets', async () => {
      const { element } = await render(ME_READER);

      const authoring = [...element.querySelectorAll('button')]
        .map((b) => text(b) ?? '')
        .filter((label) => !label.includes('Écouter'));
      expect(authoring).toEqual([]);
      expect(element.querySelector('textarea, select')).toBeNull();
    });

    it('offers the authoring actions with author_qasets', async () => {
      const { button, section } = await render();

      expect(() => button('Supprimer l’ensemble')).not.toThrow();
      expect(() => button('Ajouter une langue')).not.toThrow();
      expect(() => button('Modifier la réponse', section('fr'))).not.toThrow();
      expect(() => button('Ajouter une variante', section('fr'))).not.toThrow();
      expect(() => button('Modifier la variante 1', section('fr'))).not.toThrow();
      expect(() => button('Supprimer la variante 1', section('fr'))).not.toThrow();
      expect(() => button('Retirer la langue Bambara', section('bm'))).not.toThrow();
    });
  });

  describe('each action calls its endpoint, then re-fetches the QASet', () => {
    it('edits an answer in place', async () => {
      const { api, section, click, type, submit, afterFirstWrite } = await render();
      api.answers[Q] = edited((d) => (presence(d, IDS.fr).answer.text = 'Réponse corrigée.'));

      await click('Modifier la réponse', section('fr'));
      const textarea = section('fr').querySelector('textarea')!;
      expect(textarea.value).toBe(presence(QASET, IDS.fr).answer.text);
      type(textarea, 'Réponse corrigée.');
      await submit(section('fr').querySelector('form')!);

      expect(api.writes).toEqual([
        { method: 'PATCH', path: `${Q}/languages/${IDS.fr}`, body: { text: 'Réponse corrigée.' } },
      ]);
      expect(afterFirstWrite()).toEqual([`PATCH ${Q}/languages/${IDS.fr}`, `GET ${Q}`]);
      expect(section('fr').querySelector('textarea')).toBeNull();
      expect(text(section('fr').querySelector('.answer .text'))).toBe('Réponse corrigée.');
    });

    it('adds a variant', async () => {
      const { api, section, click, type, submit, afterFirstWrite } = await render();

      await click('Ajouter une variante', section('bm'));
      type(section('bm').querySelector('textarea')!, ' Sumaya bɛ se ka kunbɛn cogo di ? ');
      await submit(section('bm').querySelector('form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${Q}/languages/${IDS.bm}/variants`,
          body: { text: 'Sumaya bɛ se ka kunbɛn cogo di ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${Q}/languages/${IDS.bm}/variants`, `GET ${Q}`]);
    });

    it('edits a variant', async () => {
      const { api, section, click, type, submit, afterFirstWrite } = await render();

      await click('Modifier la variante 2', section('fr'));
      type(
        section('fr').querySelector('.variant textarea')!,
        'Dois-je dormir sous une moustiquaire ?',
      );
      await submit(section('fr').querySelector('.variant form')!);

      expect(api.writes).toEqual([
        {
          method: 'PATCH',
          path: `${Q}/variants/${IDS.variantFr2}`,
          body: { text: 'Dois-je dormir sous une moustiquaire ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`PATCH ${Q}/variants/${IDS.variantFr2}`, `GET ${Q}`]);
    });

    it('deletes a variant only once confirmed', async () => {
      const { api, section, click, afterFirstWrite } = await render();

      await click('Supprimer la variante 2', section('fr'));
      expect(api.writes).toEqual([]);
      await click('Confirmer', section('fr'));

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
        `DELETE ${Q}/variants/${IDS.variantFr2}`,
      ]);
      expect(afterFirstWrite()).toEqual([`DELETE ${Q}/variants/${IDS.variantFr2}`, `GET ${Q}`]);
    });

    it('adds a language, offering only the languages not yet present', async () => {
      const { api, element, click, type, submit, afterFirstWrite } = await render();

      await click('Ajouter une langue');
      const select = element.querySelector<HTMLSelectElement>('.add-language select')!;
      const options = [...select.options].filter((o) => o.value !== '').map((o) => text(o));
      expect(options).toEqual(['Peul']);
      type(select, IDS.ff);
      type(
        element.querySelector<HTMLTextAreaElement>('.add-language textarea')!,
        'Hoyre e ndaaɗi.',
      );
      await submit(element.querySelector<HTMLFormElement>('.add-language form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${Q}/languages`,
          body: { language_id: IDS.ff, answer_text: 'Hoyre e ndaaɗi.' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${Q}/languages`, `GET ${Q}`]);
    });

    it('removes a language only once confirmed, warning what goes with it', async () => {
      const { api, section, click, afterFirstWrite } = await render();

      await click('Retirer la langue Bambara', section('bm'));
      expect(api.writes).toEqual([]);
      expect(text(section('bm'))).toContain('sa réponse et toutes ses variantes');
      await click('Confirmer', section('bm'));

      expect(afterFirstWrite()).toEqual([`DELETE ${Q}/languages/${IDS.bm}`, `GET ${Q}`]);
    });

    it('deletes the QASet only once confirmed, then returns to its theme', async () => {
      const { api, element, click } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await click('Supprimer l’ensemble');
      expect(api.writes).toEqual([]);
      await click('Confirmer', element.querySelector('header')!);

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE ${Q}`]);
      expect(navigate).toHaveBeenCalledWith(['/themes', IDS.theme]);
    });
  });

  describe('failures', () => {
    it('shows a conflict inline and keeps the form and its text', async () => {
      const { api, element, click, type, submit, afterFirstWrite } = await render();
      api.answers[`POST ${Q}/languages`] = engineError(409, 'language_already_present');

      await click('Ajouter une langue');
      type(element.querySelector<HTMLSelectElement>('.add-language select')!, IDS.ff);
      type(element.querySelector<HTMLTextAreaElement>('.add-language textarea')!, 'Hoyre.');
      await submit(element.querySelector<HTMLFormElement>('.add-language form')!);

      expect(text(element.querySelector('.add-language [role="alert"]'))).toBe(
        'Cette langue a déjà une réponse dans cet ensemble.',
      );
      expect(element.querySelector<HTMLTextAreaElement>('.add-language textarea')?.value).toBe(
        'Hoyre.',
      );
      expect(afterFirstWrite()).toEqual([`POST ${Q}/languages`]);
    });

    it('shows a refused text inline', async () => {
      const { api, section, click, type, submit } = await render();
      api.answers[`PATCH ${Q}/languages/${IDS.fr}`] = engineError(422, 'invalid_text');

      await click('Modifier la réponse', section('fr'));
      type(section('fr').querySelector('textarea')!, 'x');
      await submit(section('fr').querySelector('form')!);

      expect(text(section('fr').querySelector('.answer [role="alert"]'))).toBe(
        'Le texte a été refusé : il ne peut pas être vide.',
      );
      expect(section('fr').querySelector('textarea')).not.toBeNull();
    });

    it('re-fetches when the item is gone, and says so at the page level', async () => {
      const { api, element, section, click, type, submit, afterFirstWrite } = await render();
      api.answers[`PATCH ${Q}/variants/${IDS.variantFr2}`] = engineError(404, 'variant_not_found');
      api.answers[Q] = edited((d) => presence(d, IDS.fr).variants.splice(1, 1));

      await click('Modifier la variante 2', section('fr'));
      type(section('fr').querySelector('.variant textarea')!, 'Reformulée ?');
      await submit(section('fr').querySelector('.variant form')!);

      expect(afterFirstWrite()).toEqual([`PATCH ${Q}/variants/${IDS.variantFr2}`, `GET ${Q}`]);
      expect(text(element.querySelector('.page-alert'))).toContain(
        'Cet élément n’existe plus : la page a été actualisée.',
      );
      expect(section('fr').querySelectorAll('.variant')).toHaveLength(2);
    });
  });

  describe('validation resets', () => {
    it('shows the reset badges after the re-fetch, and says which ones the edit reset', async () => {
      const { api, element, section, click, type, submit } = await render();
      api.answers[Q] = edited((d) => {
        d.clinical_validation = null;
        presence(d, IDS.en).answer.text = 'Sleep under a treated net.';
        presence(d, IDS.en).answer.translation_validation = null;
      });

      await click('Modifier la réponse', section('en'));
      type(section('en').querySelector('textarea')!, 'Sleep under a treated net.');
      await submit(section('en').querySelector('form')!);

      expect(text(element.querySelector('header .badge'))).toBe('Validation clinique : en attente');
      expect(text(section('en').querySelector('.answer .badge[data-kind="translation"]'))).toBe(
        'Traduction : en attente',
      );
      const notice = element.querySelector('.reset-notice')!;
      expect(notice.getAttribute('role')).toBe('status');
      expect(text(notice)).toContain(
        'Votre modification a remis en attente : la validation clinique, la traduction de la réponse (English).',
      );
    });

    it('says nothing when the edit reset nothing', async () => {
      const { element, section, click, type, submit } = await render();

      await click('Modifier la réponse', section('fr'));
      type(section('fr').querySelector('textarea')!, 'Autre réponse.');
      await submit(section('fr').querySelector('form')!);

      expect(element.querySelector('.reset-notice')).toBeNull();
    });
  });
});
