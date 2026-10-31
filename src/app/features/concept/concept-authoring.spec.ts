import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_READER, QASET_FR } from '../../core/catalog/testing/catalog-fixtures';
import {
  C,
  dialog,
  edited,
  escape,
  qasetIn,
  renderConcept as render,
  text,
} from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const EN = `/qasets/${IDS.qasetEn}`;
const BM = `/qasets/${IDS.qasetBm}`;

describe('ConceptPage authoring', () => {
  describe('permissions', () => {
    it('stays read-only without author_qasets', async () => {
      const { element } = await render({ me: ME_READER });

      // Listening and switching language tabs are not authoring.
      const authoring = [...element.querySelectorAll('button:not([role="tab"])')]
        .map((b) => text(b) ?? '')
        .filter((label) => !label.includes('Écouter'));
      expect(authoring).toEqual([]);
      expect(element.querySelector('textarea, select')).toBeNull();
    });

    it('offers the authoring actions with author_qasets', async () => {
      const { element, button, buttonNamed, pair, panel, card, header } = await render();

      expect(() => button('Supprimer la notion')).not.toThrow();
      expect(buttonNamed('Ajouter une langue')).toBeUndefined();
      expect(element.querySelector('.add-language')).toBeNull();
      expect(() => button('Traduire la notion')).not.toThrow();
      expect(() => button('Modifier la réponse (Français)', pair('fr'))).not.toThrow();
      expect(() => button('Modifier la question principale (Français)', pair('fr'))).not.toThrow();
      expect(() => button('Supprimer la question principale (Français)', pair('fr'))).not.toThrow();
      expect(() => button('Générer des variantes', panel('fr'))).not.toThrow();
      expect(() => button('Ajouter une variante', panel('fr'))).not.toThrow();
      expect(() => button('Modifier la variante 2', panel('fr'))).not.toThrow();
      expect(() => button('Supprimer la variante 2', panel('fr'))).not.toThrow();
      expect(() => button('Supprimer la traduction en Bambara', panel('bm'))).not.toThrow();
      expect(text(panel('bm'))).toContain('Supprimer la traduction');
      expect(text(panel('bm'))).not.toContain('Retirer la langue');
      // Notion-level, per-language and per-variant tools each live in their own toolbar.
      const bar = (scope: ParentNode, name: string) =>
        scope.querySelector(`[role="toolbar"][aria-label="${name}"]`);
      expect(bar(header(), 'Outils de la notion')).not.toBeNull();
      const answer = pair('fr').querySelector('.answer')!;
      expect(bar(answer, 'Outils de la réponse (Français)')).not.toBeNull();
      const main = pair('fr').querySelector('app-variant-item')!;
      expect(bar(main, 'Outils de la question principale (Français)')).not.toBeNull();
      expect(bar(panel('fr').querySelector('.variant')!, 'Outils de la variante 2')).not.toBeNull();
      expect(bar(card(), 'Outils de la notion')).toBeNull();
      // The base language goes only with the concept.
      expect(buttonNamed('Supprimer la traduction en Français', panel('fr'))).toBeUndefined();
    });
  });

  describe('each action calls its endpoint, then re-fetches the concept', () => {
    it('edits a QASet’s answer in a modal', async () => {
      const { api, pair, click, inDialog, type, submit, afterFirstWrite } = await render();
      api.answers[C] = edited((d) => (qasetIn(d, IDS.fr).answer.text = 'Réponse corrigée.'));

      await click('Modifier la réponse (Français)', pair('fr'));
      expect(text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!))).toBe(
        'Modifier la réponse (Français)',
      );
      const textarea = inDialog<HTMLTextAreaElement>('textarea')!;
      expect(textarea.value).toBe(QASET_FR.answer.text);
      expect(document.activeElement).toBe(textarea);
      type(textarea, 'Réponse corrigée.');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(api.writes).toEqual([
        { method: 'PATCH', path: `${FR}/answer`, body: { text: 'Réponse corrigée.' } },
      ]);
      expect(afterFirstWrite()).toEqual([`PATCH ${FR}/answer`, `GET ${C}`]);
      expect(dialog()).toBeNull();
      expect(text(pair('fr').querySelector('.answer .text'))).toBe('Réponse corrigée.');
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Modifier la réponse (Français)',
      );
    });

    it('changes nothing when the answer’s modal is cancelled or escaped', async () => {
      const { api, pair, click, press, inDialog, type, settle } = await render();

      await click('Modifier la réponse (Français)', pair('fr'));
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Brouillon');
      await press('Annuler');
      expect(dialog()).toBeNull();
      await click('Modifier la réponse (Français)', pair('fr'));
      escape();
      await settle();

      expect(dialog()).toBeNull();
      expect(api.writes).toEqual([]);
    });

    it('adds a variant to that language’s QASet', async () => {
      const { api, panel, click, type, submit, afterFirstWrite } = await render();

      await click('Ajouter une variante', panel('bm'));
      type(panel('bm').querySelector('textarea')!, ' Sumaya bɛ se ka kunbɛn cogo di ? ');
      await submit(panel('bm').querySelector('form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${BM}/variants`,
          body: { text: 'Sumaya bɛ se ka kunbɛn cogo di ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${BM}/variants`, `GET ${C}`]);
    });

    it('edits a variant in a modal', async () => {
      const { api, panel, click, inDialog, type, submit, afterFirstWrite } = await render();

      await click('Modifier la variante 2', panel('fr'));
      expect(text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!))).toBe(
        'Modifier la variante 2 (Français)',
      );
      expect(inDialog<HTMLTextAreaElement>('textarea')!.value).toBe(
        'Faut-il dormir sous une moustiquaire ?',
      );
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Dois-je dormir sous une moustiquaire ?');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(api.writes).toEqual([
        {
          method: 'PATCH',
          path: `${FR}/variants/${IDS.variantFr2}`,
          body: { text: 'Dois-je dormir sous une moustiquaire ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`PATCH ${FR}/variants/${IDS.variantFr2}`, `GET ${C}`]);
      expect(dialog()).toBeNull();
    });

    it('deletes a variant only once confirmed in a modal', async () => {
      const { api, panel, click, press, afterFirstWrite } = await render();

      await click('Supprimer la variante 2', panel('fr'));
      expect(api.writes).toEqual([]);
      expect(text(dialog())).toContain('La variante 2 sera supprimée.');
      await press('Supprimer');

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
        `DELETE ${FR}/variants/${IDS.variantFr2}`,
      ]);
      expect(afterFirstWrite()).toEqual([`DELETE ${FR}/variants/${IDS.variantFr2}`, `GET ${C}`]);
      expect(dialog()).toBeNull();
    });

    it('keeps the variant when its deletion is cancelled', async () => {
      const { api, panel, click, press } = await render();

      await click('Supprimer la variante 2', panel('fr'));
      await press('Annuler');

      expect(api.writes).toEqual([]);
      expect(dialog()).toBeNull();
    });

    it('writes a missing language’s answer by hand from its placeholder, in a modal', async () => {
      const { api, pair, click, inDialog, type, submit, afterFirstWrite } = await render();

      await click('Saisir la réponse en Peul', pair('ff'));
      expect(text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!))).toBe(
        'Saisir la réponse en Peul',
      );
      const select = inDialog<HTMLSelectElement>('select')!;
      // Only that language, already chosen.
      expect([...select.options].filter((o) => o.value !== '').map((o) => text(o))).toEqual([
        'Peul',
      ]);
      expect(select.value).toBe(IDS.ff);
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Hoyre e ndaaɗi.');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${C}/qasets`,
          body: { language_id: IDS.ff, answer_text: 'Hoyre e ndaaɗi.' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${C}/qasets`, `GET ${C}`]);
      expect(dialog()).toBeNull();
    });

    it('writes the answer by hand from the untranslated language’s tab too', async () => {
      const { api, panel, select, click, inDialog, type, submit } = await render();

      await select('ff');
      await click('Saisir la réponse en Peul', panel('ff'));
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Hoyre.');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${C}/qasets`]);
    });

    it('deletes a language’s translation only once confirmed, warning what goes with it', async () => {
      const { api, panel, click, afterFirstWrite } = await render();

      await click('Supprimer la traduction en Bambara', panel('bm'));
      expect(api.writes).toEqual([]);
      expect(text(panel('bm'))).toContain(
        'sa réponse, ses variantes, leurs audios et leurs validations',
      );
      expect(text(panel('bm'))).toContain('La langue reste dans le projet.');
      expect(text(panel('bm'))).toContain('irréversible');
      await click('Confirmer', panel('bm'));

      expect(afterFirstWrite()).toEqual([`DELETE ${BM}`, `GET ${C}`]);
    });

    it('deletes the concept only once confirmed in a modal, then returns to its theme', async () => {
      const { api, click, press } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await click('Supprimer la notion');
      expect(api.writes).toEqual([]);
      expect(text(dialog())).toContain('dans toutes les langues seront supprimées');
      await press('Supprimer');

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE ${C}`]);
      expect(navigate).toHaveBeenCalledWith(['/themes', IDS.theme]);
    });

    it('keeps the concept, and says why, when its deletion is refused', async () => {
      const { api, click, press } = await render();
      api.answers[`DELETE ${C}`] = engineError(403, 'permission_denied');

      await click('Supprimer la notion');
      await press('Supprimer');

      expect(text(dialog()!.querySelector('[role="alert"]'))).toBe(
        'Votre compte n’a pas la permission de modifier ce contenu.',
      );
    });
  });

  describe('failures', () => {
    it('shows a conflict in the modal and keeps the form and its text', async () => {
      const { api, pair, click, inDialog, type, submit, afterFirstWrite } = await render();
      api.answers[`POST ${C}/qasets`] = engineError(409, 'language_already_present');

      await click('Saisir la réponse en Peul', pair('ff'));
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Hoyre.');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(text(inDialog('[role="alert"]'))).toBe(
        'Cette langue est déjà présente dans cette notion.',
      );
      expect(inDialog<HTMLTextAreaElement>('textarea')?.value).toBe('Hoyre.');
      expect(afterFirstWrite()).toEqual([`POST ${C}/qasets`]);
    });

    it('shows a refused text in the modal and keeps it open', async () => {
      const { api, pair, click, inDialog, type, submit } = await render();
      api.answers[`PATCH ${EN}/answer`] = engineError(422, 'invalid_text');

      await click('Modifier la réponse (English)', pair('en'));
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'x');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(text(inDialog('[role="alert"]'))).toBe(
        'Le texte a été refusé : il ne peut pas être vide.',
      );
      expect(inDialog<HTMLTextAreaElement>('textarea')?.value).toBe('x');
    });

    it('re-fetches when the item is gone, closes its modal, and says so at the page level', async () => {
      const { api, element, panel, click, inDialog, type, submit, afterFirstWrite } =
        await render();
      api.answers[`PATCH ${FR}/variants/${IDS.variantFr2}`] = engineError(404, 'variant_not_found');
      api.answers[C] = edited((d) => qasetIn(d, IDS.fr).variants.splice(1, 1));

      await click('Modifier la variante 2', panel('fr'));
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Reformulée ?');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(afterFirstWrite()).toEqual([`PATCH ${FR}/variants/${IDS.variantFr2}`, `GET ${C}`]);
      expect(text(element.querySelector('.page-alert'))).toContain(
        'Cet élément n’existe plus : la page a été actualisée.',
      );
      expect(panel('fr').querySelectorAll('.variant')).toHaveLength(1);
      expect(dialog()).toBeNull();
    });
  });

  describe('validation resets', () => {
    it('shows the reset badges after the re-fetch, and says which ones the edit reset', async () => {
      const { api, element, pair, panel, click, type, submit } = await render();
      api.answers[C] = edited((d) => {
        qasetIn(d, IDS.fr).answer.text = 'Dormez sous une moustiquaire.';
        qasetIn(d, IDS.fr).clinical_validation = null;
        qasetIn(d, IDS.en).translation_validation = null;
      });

      await click('Modifier la réponse (Français)', pair('fr'));
      type(dialog()!.querySelector('textarea')!, 'Dormez sous une moustiquaire.');
      await submit(dialog()!.querySelector('form')!);

      expect(text(panel('fr').querySelector('.heading .badge'))).toBe(
        'Validation clinique : en attente',
      );
      expect(text(panel('en').querySelector('.heading .badge'))).toBe('Traduction : en attente');
      const notice = element.querySelector('.reset-notice')!;
      expect(notice.getAttribute('role')).toBe('status');
      expect(text(notice)).toContain(
        'Votre modification a remis en attente : la validation clinique, la validation de la traduction (English).',
      );
    });

    it('says nothing when the edit reset nothing', async () => {
      const { element, pair, click, type, submit } = await render();

      await click('Modifier la réponse (Français)', pair('fr'));
      type(dialog()!.querySelector('textarea')!, 'Autre réponse.');
      await submit(dialog()!.querySelector('form')!);

      expect(element.querySelector('.reset-notice')).toBeNull();
    });
  });
});
