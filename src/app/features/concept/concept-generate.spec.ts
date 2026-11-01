import { engineError } from '../../core/api/testing/fake-api-port';
import { IDS } from '../../core/catalog/testing/catalog-fixtures';
import { C, edited, qasetIn, renderConcept as render, text } from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const GENERATE = `POST ${FR}/generate-variants`;
const ADD_FR_VARIANT = `POST ${FR}/variants`;
const PROPOSALS = ['Comment se protéger ?', 'Que faire la nuit ?', 'Et les enfants ?'];

/** The wizard opens in the CDK's overlay, at the end of <body>, not inside the tab. */
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = <T extends Element = HTMLElement>(selector: string) =>
  dialog()!.querySelector<T>(selector);
const boxes = () => [...dialog()!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
const proposals = () => [...dialog()!.querySelectorAll('.proposals li')].map((li) => text(li));
const escape = () =>
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
  );

/** Holds the engine's answer until the test lets it go. */
function held<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (release = resolve));
  return { promise, release };
}

describe('ConceptPage variant generation wizard', () => {
  async function open(
    answers: Record<string, unknown> = { [GENERATE]: { candidates: PROPOSALS } },
  ) {
    const page = await render({ answers });
    const trigger = page.button('Générer des variantes', page.panel('fr'));
    trigger.focus();
    await page.click('Générer des variantes', page.panel('fr'));
    const generate = async (context?: string) => {
      if (context !== undefined) page.type(inDialog<HTMLTextAreaElement>('textarea')!, context);
      await page.submit(inDialog<HTMLFormElement>('form')!);
    };
    const press = (name: string) => page.click(name, dialog()!);
    return { ...page, trigger, generate, press };
  }

  it('opens a dialog titled for generation, with an optional context field focused', async () => {
    const { api } = await open();

    const title = document.getElementById(dialog()!.getAttribute('aria-labelledby')!);
    expect(text(title)).toBe('Générer des variantes');
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    const field = inDialog<HTMLTextAreaElement>('textarea')!;
    expect(text(inDialog(`label[for="${field.id}"]`))).toBe('Contexte (facultatif)');
    expect(field.required).toBe(false);
    expect(document.activeElement).toBe(field);
    expect(api.writes).toEqual([]);
  });

  it('shows a spinner while the engine thinks, controls disabled and the dialog held open', async () => {
    const answer = held<{ candidates: string[] }>();
    const { press, settle, fixture } = await open({ [GENERATE]: () => answer.promise });

    void press('Générer');
    fixture.detectChanges();

    expect(text(inDialog('[role="status"]'))).toBe('Génération en cours…');
    expect(inDialog('.spinner')).not.toBeNull();
    expect(inDialog<HTMLTextAreaElement>('textarea')!.disabled).toBe(true);
    expect(
      [...dialog()!.querySelectorAll<HTMLButtonElement>('button')].every((b) => b.disabled),
    ).toBe(true);
    escape();
    document.querySelector<HTMLElement>('.muso-dialog-backdrop')!.click();
    fixture.detectChanges();
    expect(dialog()).not.toBeNull();

    answer.release({ candidates: PROPOSALS });
    await settle();

    expect(inDialog('[role="status"]')).toBeNull();
    expect(proposals()).toEqual(PROPOSALS);
  });

  it('proposes with the context, every proposal ticked, nothing added yet', async () => {
    const { api, generate, afterFirstWrite } = await open();

    await generate('Pour les mères');

    expect(api.writes).toEqual([
      { method: 'POST', path: `${FR}/generate-variants`, body: { context: 'Pour les mères' } },
    ]);
    expect(proposals()).toEqual(PROPOSALS);
    expect(boxes().map((box) => box.checked)).toEqual([true, true, true]);
    expect(document.activeElement).toBe(boxes()[0]);
    expect(afterFirstWrite()).toEqual([GENERATE]);
  });

  it('proposes without context too', async () => {
    const { api, generate } = await open();

    await generate();

    expect(api.writes).toEqual([
      { method: 'POST', path: `${FR}/generate-variants`, body: { context: '' } },
    ]);
    expect(proposals()).toEqual(PROPOSALS);
  });

  it('generates only from the base language: no other tab offers it', async () => {
    const page = await render({ answers: { [GENERATE]: { candidates: PROPOSALS } } });

    for (const code of ['en', 'bm', 'ff']) {
      expect(page.buttonNamed('Générer des variantes', page.panel(code))).toBeUndefined();
    }
    await page.click('Générer des variantes', page.panel('fr'));
    await page.submit(inDialog<HTMLFormElement>('form')!);

    expect(page.api.writes.map((w) => w.path)).toEqual([
      `/qasets/${IDS.qasetFr}/generate-variants`,
    ]);
    expect(inDialog('.proposals')?.getAttribute('lang')).toBe('fr');
  });

  it('adds only the ticked proposals, in order, then closes onto the re-fetched QASet', async () => {
    const after = edited((detail) => {
      const fr = qasetIn(detail, IDS.fr);
      const added = (id: string, text: string) => ({ ...fr.variants[0], id, text, audios: [] });
      fr.variants.push(
        added('v-new-1', 'Comment se protéger ?'),
        added('v-new-2', 'Et les enfants ?'),
      );
    });
    const { api, generate, toggle, press, panel, trigger, afterFirstWrite } = await open({
      [GENERATE]: { candidates: PROPOSALS },
    });
    await generate();
    api.answers[C] = after;

    toggle(boxes()[1]);
    await press('Accepter la sélection (2)');

    expect(api.writes.slice(1)).toEqual([
      { method: 'POST', path: `${FR}/variants`, body: { text: 'Comment se protéger ?' } },
      { method: 'POST', path: `${FR}/variants`, body: { text: 'Et les enfants ?' } },
    ]);
    expect(afterFirstWrite()).toEqual([GENERATE, ADD_FR_VARIANT, ADD_FR_VARIANT, `GET ${C}`]);
    expect(dialog()).toBeNull();
    const variants = [...panel('fr').querySelectorAll('.variant .text')].map((v) => text(v));
    expect(variants).toContain('Comment se protéger ?');
    expect(variants).toContain('Et les enfants ?');
    expect(variants).not.toContain('Que faire la nuit ?');
    expect(document.activeElement).toBe(trigger);
  });

  it('cannot accept an empty selection', async () => {
    const { generate, toggle } = await open({ [GENERATE]: { candidates: ['Une seule ?'] } });
    await generate();

    toggle(boxes()[0]);

    const accept = [...dialog()!.querySelectorAll('button')].find((b) =>
      text(b)?.startsWith('Accepter'),
    )!;
    expect(text(accept)).toBe('Accepter la sélection (0)');
    expect(accept.disabled).toBe(true);
  });

  for (const [how, leave] of [
    ['Discard', (page: { press: (name: string) => Promise<void> }) => page.press('Abandonner')],
    [
      'Escape',
      async (page: { settle: () => Promise<void> }) => {
        escape();
        await page.settle();
      },
    ],
    [
      'the overlay',
      async (page: { settle: () => Promise<void> }) => {
        document.querySelector<HTMLElement>('.muso-dialog-backdrop')!.click();
        await page.settle();
      },
    ],
  ] as const) {
    it(`adds nothing when the proposals are left by ${how}, focus back on the trigger`, async () => {
      const page = await open();
      await page.generate();

      await leave(page as never);

      expect(page.api.writes).toHaveLength(1);
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(page.trigger);
    });
  }

  it('cancels before generating, without a call', async () => {
    const { api, press, trigger } = await open();

    await press('Annuler');

    expect(api.writes).toEqual([]);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('shows the engine’s failure in the dialog, then retries', async () => {
    const { api, generate, press } = await open({
      [GENERATE]: engineError(502, 'generation_engine_error'),
    });

    await generate('Pour les mères');

    expect(text(inDialog('[role="alert"]'))).toBe(
      'La génération a échoué : aucune variante n’a été proposée. Réessayez.',
    );
    expect(inDialog('.proposals')).toBeNull();
    expect(document.activeElement).toBe(dialog()!.querySelector('button.retry'));

    api.answers[GENERATE] = { candidates: PROPOSALS };
    await press('Réessayer');

    expect(api.writes.map((w) => w.body)).toEqual([
      { context: 'Pour les mères' },
      { context: 'Pour les mères' },
    ]);
    expect(inDialog('[role="alert"]')).toBeNull();
    expect(proposals()).toEqual(PROPOSALS);
  });

  it('says so when the engine proposes nothing, with Retry and Cancel', async () => {
    const { api, generate, press } = await open({ [GENERATE]: { candidates: [] } });

    await generate();

    expect(text(inDialog('[role="alert"]'))).toBe('Le moteur n’a proposé aucune variante.');
    expect(inDialog('button.retry')).not.toBeNull();

    await press('Annuler');
    expect(api.writes).toHaveLength(1);
    expect(dialog()).toBeNull();
  });

  it('stops at a failed add, keeps what was added, and leaves the rest to accept again', async () => {
    const { api, generate, press, afterFirstWrite } = await open();
    await generate();
    api.answers[ADD_FR_VARIANT] = (body: { text: string }) =>
      body.text === 'Que faire la nuit ?' ? engineError(422, 'invalid_text') : {};

    await press('Accepter la sélection (3)');

    expect(afterFirstWrite()).toEqual([GENERATE, ADD_FR_VARIANT, ADD_FR_VARIANT, `GET ${C}`]);
    expect(text(inDialog('[role="alert"]'))).toBe(
      'Le texte a été refusé : il ne peut pas être vide.',
    );
    expect(proposals()).toEqual(['Que faire la nuit ?', 'Et les enfants ?']);
  });
});
