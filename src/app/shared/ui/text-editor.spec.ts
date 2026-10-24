import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { TextEditor } from './text-editor';

function render(initial = 'Texte initial') {
  TestBed.configureTestingModule({ imports: [TextEditor], providers: [provideTestI18n()] });
  const fixture = TestBed.createComponent(TextEditor);
  fixture.componentRef.setInput('label', 'Réponse');
  fixture.componentRef.setInput('initial', initial);
  const saved: string[] = [];
  fixture.componentInstance.save.subscribe((text) => saved.push(text));
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const textarea = element.querySelector('textarea')!;
  const type = (value: string) => {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = () => {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  return { fixture, element, textarea, type, submit, saved };
}

describe('TextEditor', () => {
  it('starts from the current text, labelled', () => {
    const { element, textarea } = render();

    expect(textarea.value).toBe('Texte initial');
    expect(element.querySelector('label')?.textContent?.trim()).toBe('Réponse');
    expect(element.querySelector('label')?.getAttribute('for')).toBe(textarea.id);
  });

  it('saves the trimmed text', () => {
    const { type, submit, saved } = render();

    type('  Nouveau texte  ');
    submit();

    expect(saved).toEqual(['Nouveau texte']);
  });

  it('refuses a blank text without saving, saying why', () => {
    const { element, textarea, type, submit, saved } = render();

    type('   ');
    submit();

    expect(saved).toEqual([]);
    expect(element.textContent).toContain('Le texte est obligatoire.');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });

  it('accepts a blank text when the field is optional', () => {
    const { fixture, type, submit, saved } = render();
    fixture.componentRef.setInput('required', false);

    type('   ');
    submit();

    expect(saved).toEqual(['']);
  });

  it('shows the engine’s refusal inline', () => {
    const { fixture, element } = render();

    fixture.componentRef.setInput('error', 'Le texte ne peut pas être vide.');
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Le texte ne peut pas être vide.',
    );
  });
});
