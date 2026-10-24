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
import { ThemePage } from './theme-page';

const NEW_ID = 'eeeeeeee-0000-0000-0000-0000000000ff';
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

async function render(me: Schemas['MeResponse'] = ME_AUTHOR) {
  const api = new FakeApiPort({
    ...world(),
    '/me': me,
    [`POST /themes/${IDS.theme}/qasets`]: { ...QASET, id: NEW_ID },
  });
  TestBed.configureTestingModule({
    imports: [ThemePage],
    providers: [provideTestI18n(), provideRouter([]), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(ThemePage);
  fixture.componentRef.setInput('themeId', IDS.theme);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const open = async () => {
    [...element.querySelectorAll('button')].find((b) => text(b) === 'Créer un ensemble')!.click();
    await fixture.whenStable();
  };
  const fill = async (answer: string) => {
    const textarea = element.querySelector('textarea')!;
    textarea.value = answer;
    textarea.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { api, element, open, fill };
}

describe('ThemePage authoring', () => {
  it('offers to create a QASet only with author_qasets', async () => {
    const reader = await render(ME_READER);
    expect(reader.element.querySelector('button')).toBeNull();
  });

  it('creates a QASet in the base language by default, then opens it', async () => {
    const { api, element, open, fill } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await open();
    const select = element.querySelector<HTMLSelectElement>('select')!;
    expect(select.value).toBe(IDS.fr);
    expect([...select.options].filter((o) => o.value).map((o) => text(o))).toEqual([
      'Bambara',
      'English',
      'Français',
      'Peul',
    ]);
    await fill('Lavez-vous les mains au savon.');

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/themes/${IDS.theme}/qasets`,
        body: { language_id: IDS.fr, answer_text: 'Lavez-vous les mains au savon.' },
      },
    ]);
    expect(navigate).toHaveBeenCalledWith(['/qasets', NEW_ID]);
  });

  it('shows a refusal inline and stays on the theme', async () => {
    const { api, element, open, fill } = await render();
    api.answers[`POST /themes/${IDS.theme}/qasets`] = engineError(404, 'theme_not_found');

    await open();
    await fill('Réponse.');

    expect(text(element.querySelector('form [role="alert"]'))).toBe(
      'Cet élément n’existe plus : la page a été actualisée.',
    );
  });
});
