import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Schemas } from '../../../core/api/api-types';
import { ApiPort } from '../../../core/api/api-port';
import { FakeApiPort } from '../../../core/api/testing/fake-api-port';
import { RecorderPort } from '../../../core/audio/recorder-port';
import { FakeRecorder } from '../../../core/audio/testing/fake-recorder';
import { CONCEPT, IDS, ME_AUTHOR, world } from '../../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../../core/i18n/testing/provide-test-i18n';
import { ConceptPage } from '../concept-page';

export const C = `/concepts/${IDS.concept}`;

export const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

/** The concept as the engine returns it after an edit; `change` edits a deep copy. */
export function edited(
  change: (detail: Schemas['ConceptResponse']) => void,
): Schemas['ConceptResponse'] {
  const detail = structuredClone(CONCEPT);
  change(detail);
  return detail;
}

export const qasetIn = (detail: Schemas['ConceptResponse'], languageId: string) =>
  detail.qasets.find((q) => q.language_id === languageId)!;

const attached: HTMLElement[] = [];
afterEach(() => attached.splice(0).forEach((host) => host.remove()));

export interface RenderOptions {
  readonly me?: Schemas['MeResponse'];
  readonly answers?: Record<string, unknown>;
  readonly prepare?: (recorder: FakeRecorder) => void;
}

/** The concept page over the fixture world, attached so focus can be asserted. */
export async function renderConcept({
  me = ME_AUTHOR,
  answers = {},
  prepare = () => undefined,
}: RenderOptions = {}) {
  const api = new FakeApiPort({ ...world(), '/me': me, ...answers });
  const recorder = new FakeRecorder();
  prepare(recorder);
  TestBed.configureTestingModule({
    imports: [ConceptPage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: api },
      { provide: RecorderPort, useValue: recorder },
    ],
  });
  const fixture = TestBed.createComponent(ConceptPage);
  document.body.appendChild(fixture.nativeElement);
  attached.push(fixture.nativeElement);
  fixture.componentRef.setInput('conceptId', IDS.concept);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const settle = () => fixture.whenStable();
  const section = (code: string) =>
    element.querySelector<HTMLElement>(`section.language[data-lang="${code}"]`)!;
  const header = () => element.querySelector<HTMLElement>('header')!;
  /** A button by its accessible name: its aria-label, or else its text. */
  const buttonNamed = (name: string, scope: ParentNode = element) =>
    [...scope.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
    );
  const button = (name: string, scope: ParentNode = element) => {
    const found = buttonNamed(name, scope);
    if (!found) throw new Error(`no button named "${name}"`);
    return found;
  };
  const click = async (name: string, scope?: ParentNode) => {
    button(name, scope).click();
    await settle();
  };
  const type = (
    field: HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement,
    value: string,
  ) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const toggle = (box: HTMLInputElement) => {
    box.click();
    fixture.detectChanges();
  };
  const submit = async (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit'));
    await settle();
  };
  /** The calls made since the first write, so "and then re-fetched" can be asserted. */
  const afterFirstWrite = () =>
    api.calls.slice(api.calls.findIndex((call) => !call.startsWith('GET')));
  return {
    api,
    recorder,
    fixture,
    element,
    section,
    header,
    buttonNamed,
    button,
    click,
    type,
    toggle,
    submit,
    afterFirstWrite,
    settle,
  };
}
