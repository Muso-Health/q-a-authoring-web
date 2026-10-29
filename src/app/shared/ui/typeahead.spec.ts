import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { Typeahead, type TypeaheadOption } from './typeahead';

const CATALOGUE: TypeaheadOption[] = [
  { id: 'i1', label: 'moustiquaire' },
  { id: 'i2', label: 'moustique' },
  { id: 'i3', label: 'paludisme' },
];

async function render({ exclude = [] as string[], canCreate = true, listAll = false } = {}) {
  const queries: string[] = [];
  TestBed.configureTestingModule({ imports: [Typeahead], providers: [provideTestI18n()] });
  const fixture = TestBed.createComponent(Typeahead);
  fixture.componentRef.setInput('label', 'Intention');
  fixture.componentRef.setInput('search', async (q: string) => {
    queries.push(q);
    const prefix = q.trim().toLowerCase().replace(/\s+/g, ' ');
    return CATALOGUE.filter((o) => o.label.startsWith(prefix));
  });
  fixture.componentRef.setInput('exclude', exclude);
  fixture.componentRef.setInput('canCreate', canCreate);
  fixture.componentRef.setInput('listAll', listAll);
  const picked: TypeaheadOption[] = [];
  const created: string[] = [];
  fixture.componentInstance.picked.subscribe((o) => picked.push(o));
  fixture.componentInstance.created.subscribe((t) => created.push(t));
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const input = element.querySelector('input')!;
  const type = async (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const key = async (key: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await fixture.whenStable();
  };
  const options = () =>
    [...element.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => o.textContent?.trim());
  return { fixture, element, input, type, key, options, queries, picked, created };
}

describe('Typeahead', () => {
  it('is a labelled combobox that searches with what is typed', async () => {
    const { element, input, type, queries, options } = await render();

    expect(input.getAttribute('role')).toBe('combobox');
    expect(element.querySelector('label')?.getAttribute('for')).toBe(input.id);
    await type('mous');

    expect(queries).toEqual(['mous']);
    expect(options()).toEqual(['moustiquaire', 'moustique', 'Créer « mous »']);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('searches nothing until something is typed, by default', async () => {
    const { queries, options } = await render();

    expect(queries).toEqual([]);
    expect(options()).toEqual([]);
  });

  it('lists the whole catalogue before anything is typed when asked to, minus what is attached', async () => {
    const { queries, options, type } = await render({ listAll: true, exclude: ['i3'] });

    expect(queries).toEqual(['']);
    expect(options()).toEqual(['moustiquaire', 'moustique']);
    await type('moustique');
    expect(options()).toEqual(['moustique']);
  });

  it('reuses an exact match, ignoring case and spaces, instead of offering to create', async () => {
    const { type, options } = await render();

    await type('  Moustique ');

    expect(options()).toEqual(['moustique']);
  });

  it('leaves out what is already attached, and says so for an exact match', async () => {
    const { element, type, options } = await render({ exclude: ['i1', 'i2'] });

    await type('moustique');

    expect(options()).toEqual([]);
    expect(element.textContent).toContain('« moustique » est déjà attaché.');
  });

  it('offers no creation without the permission to create', async () => {
    const { element, type, options } = await render({ canCreate: false });

    await type('fièvre');

    expect(options()).toEqual([]);
    expect(element.textContent).toContain('Aucun résultat.');
  });

  it('picks a suggestion by click', async () => {
    const { element, type, picked } = await render();
    await type('palu');

    element.querySelector<HTMLElement>('[role="option"]')!.click();

    expect(picked).toEqual([{ id: 'i3', label: 'paludisme' }]);
  });

  it('creates the typed text, trimmed, from the keyboard', async () => {
    const { input, type, key, created } = await render();
    await type(' fièvre forte ');

    await key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-0$/);
    await key('Enter');

    expect(created).toEqual(['fièvre forte']);
  });
});
