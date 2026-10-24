import { engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_AUTHOR, world } from '../../core/catalog/testing/catalog-fixtures';
import {
  DOC_IDS,
  DOCUMENTS,
  GUIDE,
  SIGNED_URL,
} from '../../core/catalog/testing/documentation-fixtures';
import { renderAdmin, text } from '../admin/testing/render-admin';
import { ThemeDetailPage } from './theme-detail-page';

const DOCS_PATH = `/themes/${IDS.theme}/documentation`;
const COMPLETENESS = `POST /themes/${IDS.theme}/completeness`;

const render = (permissions: string[], answers: Record<string, unknown> = {}) =>
  renderAdmin(
    ThemeDetailPage,
    { ...world(), '/me': { ...ME_AUTHOR, permissions }, [DOCS_PATH]: DOCUMENTS, ...answers },
    { themeId: IDS.theme },
  );

const documentation = (element: HTMLElement) =>
  element.querySelector<HTMLElement>('section.documentation')!;
const completeness = (element: HTMLElement) =>
  element.querySelector<HTMLElement>('section.completeness');
const rowOf = (element: HTMLElement, filename: string) =>
  [...element.querySelectorAll<HTMLElement>('li.document')].find(
    (row) => text(row.querySelector('.filename')) === filename,
  )!;

async function pick(element: HTMLElement, file: File, settle: () => Promise<void>) {
  const input = documentation(element).querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  await settle();
}

const pdf = () => new File(['%PDF-1.7'], 'protocole.pdf', { type: 'application/pdf' });

describe('ThemeDetailPage', () => {
  it('places itself under its theme', async () => {
    const { element } = await render([]);

    expect(text(element.querySelector('h1'))).toBe('Prévention');
    expect(
      [...element.querySelectorAll('nav ol li')].map((li) => [
        text(li),
        li.querySelector('a')?.getAttribute('href') ?? null,
      ]),
    ).toEqual([
      ['Projets', '/projects'],
      ['Santé communautaire Mali', `/projects/${IDS.project}`],
      ['Paludisme', `/protocols/${IDS.protocol}`],
      ['Prévention', `/themes/${IDS.theme}`],
      ['Documentation et complétude', null],
    ]);
  });

  describe('documentation', () => {
    it('lists each document with its type, size and date', async () => {
      const { element } = await render([]);

      expect(text(documentation(element).querySelector('h2'))).toBe('Documentation');
      const guide = rowOf(element, 'guide-paludisme.pdf');
      expect(text(guide)).toContain('application/pdf');
      expect(text(guide)).toContain('1,5 Mo');
      expect(text(guide)).toContain('3 oct. 2026');
      expect(text(rowOf(element, 'affiche-moustiquaire.png'))).toContain('840 octets');
    });

    it('says when the theme has no document', async () => {
      const { element } = await render([], { [DOCS_PATH]: { items: [] } });

      expect(text(documentation(element).querySelector('.muso-empty'))).toBe(
        'Aucun document pour ce thème.',
      );
    });

    it('lets anyone download a document through a fresh signed URL', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const { api, element, click } = await render([], {
        [`/documentation/${DOC_IDS.guide}/download-url`]: {
          url: SIGNED_URL,
          expires_at: '2026-10-24T12:00:00Z',
        },
      });

      await click('Télécharger guide-paludisme.pdf', rowOf(element, 'guide-paludisme.pdf'));

      expect(api.reads).toContain(`/documentation/${DOC_IDS.guide}/download-url`);
      expect(open).toHaveBeenCalledWith(SIGNED_URL, '_blank', 'noopener');
      open.mockRestore();
    });

    it('says so when no download link could be had', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const { element, click } = await render([]);
      const guide = rowOf(element, 'guide-paludisme.pdf');

      await click('Télécharger guide-paludisme.pdf', guide);

      expect(open).not.toHaveBeenCalled();
      expect(text(guide.querySelector('[role="alert"]'))).toBe(
        'Le lien de téléchargement n’a pas pu être obtenu. Réessayez.',
      );
      open.mockRestore();
    });

    it('offers no upload or deletion without manage_catalog', async () => {
      const { element, buttonNamed } = await render(['author_qasets']);

      expect(documentation(element).querySelector('input[type="file"]')).toBeNull();
      expect(buttonNamed('Supprimer le document guide-paludisme.pdf')).toBeUndefined();
      expect(buttonNamed('Télécharger guide-paludisme.pdf')).toBeDefined();
    });

    it('uploads the chosen file as multipart, then re-reads the list', async () => {
      const { api, element, click, settle } = await render(['manage_catalog']);
      const panel = documentation(element);

      const input = panel.querySelector('input[type="file"]');
      expect(input?.getAttribute('accept')).toContain('application/pdf');
      expect(input?.getAttribute('accept')).toContain('video/*');
      expect(input?.getAttribute('accept')).toContain('image/*');
      await pick(element, pdf(), settle);
      expect(text(panel)).toContain('Fichier choisi : protocole.pdf');
      await click('Téléverser', panel);

      expect(api.writes).toHaveLength(1);
      expect(api.writes[0].method).toBe('POST');
      expect(api.writes[0].path).toBe(DOCS_PATH);
      const sent = (api.writes[0].body as FormData).get('file') as File;
      expect(sent.name).toBe('protocole.pdf');
      expect(api.reads.filter((path) => path === DOCS_PATH)).toHaveLength(2);
      expect(text(panel)).not.toContain('Fichier choisi');
    });

    it('maps a refused type or size inline, keeping the selection', async () => {
      const { api, element, click, settle } = await render(['manage_catalog'], {
        [`POST ${DOCS_PATH}`]: engineError(422, 'unsupported_document_type'),
      });
      const panel = documentation(element);

      await pick(element, pdf(), settle);
      await click('Téléverser', panel);
      expect(text(panel.querySelector('[role="alert"]'))).toBe(
        'Type de document non pris en charge : choisissez un PDF, un document Word, un texte, une vidéo ou une image.',
      );
      expect(text(panel)).toContain('Fichier choisi : protocole.pdf');

      api.answers[`POST ${DOCS_PATH}`] = engineError(422, 'document_too_large');
      await click('Téléverser', panel);
      expect(text(panel.querySelector('[role="alert"]'))).toBe(
        'Document trop volumineux : choisissez un fichier plus léger.',
      );
    });

    it('asks before deleting a document, then re-reads the list', async () => {
      const { api, element, click } = await render(['manage_catalog']);
      const guide = rowOf(element, 'guide-paludisme.pdf');

      await click('Supprimer le document guide-paludisme.pdf', guide);
      expect(api.writes).toEqual([]);
      expect(text(guide)).toContain(
        'Supprimer définitivement le document « guide-paludisme.pdf » ?',
      );
      await click('Confirmer', guide);

      expect(api.writes).toEqual([
        { method: 'DELETE', path: `${DOCS_PATH}/${DOC_IDS.guide}`, body: undefined },
      ]);
      expect(api.reads.filter((path) => path === DOCS_PATH)).toHaveLength(2);
    });

    it('re-reads the list when the document had already gone', async () => {
      const { api, element, click } = await render(['manage_catalog'], {
        [`DELETE ${DOCS_PATH}/${DOC_IDS.guide}`]: engineError(404, 'documentation_not_found'),
      });
      api.answers[DOCS_PATH] = { items: [DOCUMENTS.items[1]] };

      await click('Supprimer le document guide-paludisme.pdf');
      await click('Confirmer', rowOf(element, 'guide-paludisme.pdf'));

      expect(text(element.querySelector('.page-notice'))).toBe(
        'Cet élément n’existe plus : la page a été actualisée.',
      );
      expect(rowOf(element, GUIDE.filename)).toBeUndefined();
    });
  });

  describe('completeness', () => {
    it('is not offered without author_qasets', async () => {
      const { element } = await render(['manage_catalog']);

      expect(completeness(element)).toBeNull();
    });

    it('runs only when asked, then lists the uncovered notions', async () => {
      const { api, element, click } = await render(['author_qasets'], {
        [COMPLETENESS]: { uncovered_notions: ['Dosage de la CTA', 'Signes de gravité'] },
      });
      const panel = completeness(element)!;

      expect(text(panel.querySelector('h2'))).toBe('Complétude');
      expect(api.writes).toEqual([]);
      await click('Analyser la complétude', panel);

      expect(api.calls.filter((call) => call === COMPLETENESS)).toHaveLength(1);
      expect(text(panel.querySelector('h3'))).toBe('Notions non couvertes');
      expect([...panel.querySelectorAll('li')].map(text)).toEqual([
        'Dosage de la CTA',
        'Signes de gravité',
      ]);
    });

    it('says everything is covered when no notion is left', async () => {
      const { element, click } = await render(['author_qasets'], {
        [COMPLETENESS]: { uncovered_notions: [] },
      });
      const panel = completeness(element)!;

      await click('Analyser la complétude', panel);

      expect(panel.querySelector('li')).toBeNull();
      expect(text(panel.querySelector('.covered'))).toBe(
        'Tout est couvert : chaque notion de la documentation est traitée par au moins une réponse.',
      );
    });

    it('asks for usable documentation first', async () => {
      const { element, click } = await render(['author_qasets'], {
        [COMPLETENESS]: engineError(409, 'no_documentation'),
      });
      const panel = completeness(element)!;

      await click('Analyser la complétude', panel);

      expect(text(panel.querySelector('[role="alert"]'))).toBe(
        'Aucune documentation exploitable : ajoutez d’abord de la documentation exploitable à ce thème.',
      );
    });

    it('explains a failed analysis, and can run again', async () => {
      const { api, element, click } = await render(['author_qasets'], {
        [COMPLETENESS]: engineError(502, 'completeness_engine_error'),
      });
      const panel = completeness(element)!;

      await click('Analyser la complétude', panel);
      expect(text(panel.querySelector('[role="alert"]'))).toBe(
        'L’analyse de complétude a échoué. Rien n’a été modifié : réessayez.',
      );

      api.answers[COMPLETENESS] = { uncovered_notions: ['Dosage de la CTA'] };
      await click('Analyser la complétude', panel);
      expect(panel.querySelector('[role="alert"]')).toBeNull();
      expect([...panel.querySelectorAll('li')].map(text)).toEqual(['Dosage de la CTA']);
    });
  });
});
