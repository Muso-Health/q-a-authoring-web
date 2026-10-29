import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_READER, QASET_FR } from '../../core/catalog/testing/catalog-fixtures';
import { C, edited, qasetIn, renderConcept as render, text } from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const EN = `/qasets/${IDS.qasetEn}`;
const BM = `/qasets/${IDS.qasetBm}`;

describe('ConceptPage authoring', () => {
  describe('permissions', () => {
    it('stays read-only without author_qasets', async () => {
      const { element } = await render({ me: ME_READER });

      const authoring = [...element.querySelectorAll('button')]
        .map((b) => text(b) ?? '')
        .filter((label) => !label.includes('Écouter'));
      expect(authoring).toEqual([]);
      expect(element.querySelector('textarea, select')).toBeNull();
    });

    it('offers the authoring actions with author_qasets', async () => {
      const { button, buttonNamed, section } = await render();

      expect(() => button('Supprimer la notion')).not.toThrow();
      expect(() => button('Ajouter une langue')).not.toThrow();
      expect(() => button('Traduire la notion')).not.toThrow();
      expect(() => button('Modifier la réponse', section('fr'))).not.toThrow();
      expect(() => button('Générer des variantes', section('fr'))).not.toThrow();
      expect(() => button('Ajouter une variante', section('fr'))).not.toThrow();
      expect(() => button('Modifier la variante 1', section('fr'))).not.toThrow();
      expect(() => button('Supprimer la variante 1', section('fr'))).not.toThrow();
      expect(() => button('Retirer la langue Bambara', section('bm'))).not.toThrow();
      // The base language goes only with the concept.
      expect(buttonNamed('Retirer la langue Français', section('fr'))).toBeUndefined();
    });
  });

  describe('each action calls its endpoint, then re-fetches the concept', () => {
    it('edits a QASet’s answer in place', async () => {
      const { api, section, click, type, submit, afterFirstWrite } = await render();
      api.answers[C] = edited((d) => (qasetIn(d, IDS.fr).answer.text = 'Réponse corrigée.'));

      await click('Modifier la réponse', section('fr'));
      const textarea = section('fr').querySelector('textarea')!;
      expect(textarea.value).toBe(QASET_FR.answer.text);
      type(textarea, 'Réponse corrigée.');
      await submit(section('fr').querySelector('form')!);

      expect(api.writes).toEqual([
        { method: 'PATCH', path: `${FR}/answer`, body: { text: 'Réponse corrigée.' } },
      ]);
      expect(afterFirstWrite()).toEqual([`PATCH ${FR}/answer`, `GET ${C}`]);
      expect(section('fr').querySelector('textarea')).toBeNull();
      expect(text(section('fr').querySelector('.answer .text'))).toBe('Réponse corrigée.');
    });

    it('adds a variant to that language’s QASet', async () => {
      const { api, section, click, type, submit, afterFirstWrite } = await render();

      await click('Ajouter une variante', section('bm'));
      type(section('bm').querySelector('textarea')!, ' Sumaya bɛ se ka kunbɛn cogo di ? ');
      await submit(section('bm').querySelector('form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${BM}/variants`,
          body: { text: 'Sumaya bɛ se ka kunbɛn cogo di ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${BM}/variants`, `GET ${C}`]);
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
          path: `${FR}/variants/${IDS.variantFr2}`,
          body: { text: 'Dois-je dormir sous une moustiquaire ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`PATCH ${FR}/variants/${IDS.variantFr2}`, `GET ${C}`]);
    });

    it('deletes a variant only once confirmed', async () => {
      const { api, section, click, afterFirstWrite } = await render();

      await click('Supprimer la variante 2', section('fr'));
      expect(api.writes).toEqual([]);
      await click('Confirmer', section('fr'));

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
        `DELETE ${FR}/variants/${IDS.variantFr2}`,
      ]);
      expect(afterFirstWrite()).toEqual([`DELETE ${FR}/variants/${IDS.variantFr2}`, `GET ${C}`]);
    });

    it('adds a language presence, offering only the project’s languages not yet present', async () => {
      const { api, element, click, type, submit, afterFirstWrite } = await render();

      await click('Ajouter une langue');
      const select = element.querySelector<HTMLSelectElement>('.add-language select')!;
      const options = [...select.options].filter((o) => o.value !== '').map((o) => text(o));
      // Wolof is in the catalogue but not in the project.
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
          path: `${C}/qasets`,
          body: { language_id: IDS.ff, answer_text: 'Hoyre e ndaaɗi.' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${C}/qasets`, `GET ${C}`]);
    });

    it('removes a language’s QASet only once confirmed, warning what goes with it', async () => {
      const { api, section, click, afterFirstWrite } = await render();

      await click('Retirer la langue Bambara', section('bm'));
      expect(api.writes).toEqual([]);
      expect(text(section('bm'))).toContain('sa réponse et toutes ses variantes');
      await click('Confirmer', section('bm'));

      expect(afterFirstWrite()).toEqual([`DELETE ${BM}`, `GET ${C}`]);
    });

    it('deletes the concept only once confirmed, then returns to its theme', async () => {
      const { api, header, click } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await click('Supprimer la notion');
      expect(api.writes).toEqual([]);
      await click('Confirmer', header());

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE ${C}`]);
      expect(navigate).toHaveBeenCalledWith(['/themes', IDS.theme]);
    });
  });

  describe('failures', () => {
    it('shows a conflict inline and keeps the form and its text', async () => {
      const { api, element, click, type, submit, afterFirstWrite } = await render();
      api.answers[`POST ${C}/qasets`] = engineError(409, 'language_already_present');

      await click('Ajouter une langue');
      type(element.querySelector<HTMLSelectElement>('.add-language select')!, IDS.ff);
      type(element.querySelector<HTMLTextAreaElement>('.add-language textarea')!, 'Hoyre.');
      await submit(element.querySelector<HTMLFormElement>('.add-language form')!);

      expect(text(element.querySelector('.add-language [role="alert"]'))).toBe(
        'Cette langue est déjà présente dans cette notion.',
      );
      expect(element.querySelector<HTMLTextAreaElement>('.add-language textarea')?.value).toBe(
        'Hoyre.',
      );
      expect(afterFirstWrite()).toEqual([`POST ${C}/qasets`]);
    });

    it('shows a refused text inline', async () => {
      const { api, section, click, type, submit } = await render();
      api.answers[`PATCH ${EN}/answer`] = engineError(422, 'invalid_text');

      await click('Modifier la réponse', section('en'));
      type(section('en').querySelector('textarea')!, 'x');
      await submit(section('en').querySelector('form')!);

      expect(text(section('en').querySelector('.answer [role="alert"]'))).toBe(
        'Le texte a été refusé : il ne peut pas être vide.',
      );
      expect(section('en').querySelector('textarea')).not.toBeNull();
    });

    it('re-fetches when the item is gone, and says so at the page level', async () => {
      const { api, element, section, click, type, submit, afterFirstWrite } = await render();
      api.answers[`PATCH ${FR}/variants/${IDS.variantFr2}`] = engineError(404, 'variant_not_found');
      api.answers[C] = edited((d) => qasetIn(d, IDS.fr).variants.splice(1, 1));

      await click('Modifier la variante 2', section('fr'));
      type(section('fr').querySelector('.variant textarea')!, 'Reformulée ?');
      await submit(section('fr').querySelector('.variant form')!);

      expect(afterFirstWrite()).toEqual([`PATCH ${FR}/variants/${IDS.variantFr2}`, `GET ${C}`]);
      expect(text(element.querySelector('.page-alert'))).toContain(
        'Cet élément n’existe plus : la page a été actualisée.',
      );
      expect(section('fr').querySelectorAll('.variant')).toHaveLength(2);
    });
  });

  describe('validation resets', () => {
    it('shows the reset badges after the re-fetch, and says which ones the edit reset', async () => {
      const { api, element, section, click, type, submit } = await render();
      api.answers[C] = edited((d) => {
        qasetIn(d, IDS.fr).answer.text = 'Dormez sous une moustiquaire.';
        qasetIn(d, IDS.fr).clinical_validation = null;
        qasetIn(d, IDS.en).translation_validation = null;
      });

      await click('Modifier la réponse', section('fr'));
      type(section('fr').querySelector('textarea')!, 'Dormez sous une moustiquaire.');
      await submit(section('fr').querySelector('form')!);

      expect(text(section('fr').querySelector('.heading .badge'))).toBe(
        'Validation clinique : en attente',
      );
      expect(text(section('en').querySelector('.heading .badge'))).toBe('Traduction : en attente');
      const notice = element.querySelector('.reset-notice')!;
      expect(notice.getAttribute('role')).toBe('status');
      expect(text(notice)).toContain(
        'Votre modification a remis en attente : la validation clinique, la validation de la traduction (English).',
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
