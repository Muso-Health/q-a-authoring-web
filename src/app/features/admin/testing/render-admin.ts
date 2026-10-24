import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../../core/api/api-port';
import { FakeApiPort } from '../../../core/api/testing/fake-api-port';
import { provideTestI18n } from '../../../core/i18n/testing/provide-test-i18n';

export const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

const attached: HTMLElement[] = [];
afterEach(() => attached.splice(0).forEach((host) => host.remove()));

/** Renders an admin page against a fake engine, with helpers that find controls by their name. */
export async function renderAdmin<T>(
  component: Type<T>,
  answers: Record<string, unknown>,
  inputs: Record<string, unknown> = {},
) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideTestI18n(), provideRouter([]), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(component);
  document.body.appendChild(fixture.nativeElement);
  attached.push(fixture.nativeElement);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => fixture.whenStable();
  const within = (scope: ParentNode | null) => scope ?? element;
  const buttonNamed = (name: string, scope: ParentNode | null = null) =>
    [...within(scope).querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
    );
  const click = async (name: string, scope: ParentNode | null = null) => {
    const button = buttonNamed(name, scope);
    if (!button) throw new Error(`no button named "${name}"`);
    button.click();
    await settle();
  };
  const fieldLabelled = <E extends HTMLElement>(label: string, scope: ParentNode | null = null) => {
    const found = [...within(scope).querySelectorAll('label')].find((l) => text(l) === label);
    const target = found?.htmlFor
      ? element.querySelector<E>(`#${found.htmlFor}`)
      : found?.querySelector<E>('input, select, textarea');
    if (!target) throw new Error(`no field labelled "${label}"`);
    return target;
  };
  const type = async (label: string, value: string, scope: ParentNode | null = null) => {
    const field = fieldLabelled<HTMLInputElement | HTMLTextAreaElement>(label, scope);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await settle();
  };
  const choose = async (label: string, value: string, scope: ParentNode | null = null) => {
    const field = fieldLabelled<HTMLSelectElement>(label, scope);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    await settle();
  };
  const toggle = async (label: string, scope: ParentNode | null = null) => {
    fieldLabelled<HTMLInputElement>(label, scope).click();
    await settle();
  };
  const submit = async (scope: ParentNode | null = null) => {
    const form = scope instanceof HTMLFormElement ? scope : within(scope).querySelector('form');
    form!.requestSubmit();
    await settle();
  };
  return { api, fixture, element, settle, buttonNamed, click, type, choose, toggle, submit };
}
