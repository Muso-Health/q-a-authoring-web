import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ConfirmAction } from './confirm-action';

function render() {
  TestBed.configureTestingModule({ imports: [ConfirmAction], providers: [provideTestI18n()] });
  const fixture = TestBed.createComponent(ConfirmAction);
  fixture.componentRef.setInput('label', 'Supprimer la variante');
  fixture.componentRef.setInput('warning', 'La variante sera supprimée.');
  let confirmed = 0;
  fixture.componentInstance.confirmed.subscribe(() => confirmed++);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
  return { fixture, element, button, confirmed: () => confirmed };
}

describe('ConfirmAction', () => {
  it('asks before acting, with the warning, and acts only on confirmation', () => {
    const { fixture, element, button, confirmed } = render();

    button('Supprimer la variante').click();
    fixture.detectChanges();

    expect(confirmed()).toBe(0);
    expect(element.textContent).toContain('La variante sera supprimée.');
    button('Confirmer').click();
    fixture.detectChanges();
    expect(confirmed()).toBe(1);
  });

  it('backs out on cancel without acting', () => {
    const { fixture, element, button, confirmed } = render();

    button('Supprimer la variante').click();
    fixture.detectChanges();
    button('Annuler').click();
    fixture.detectChanges();

    expect(confirmed()).toBe(0);
    expect(element.textContent).not.toContain('La variante sera supprimée.');
  });

  it('moves focus to cancel when asking, the safe default', () => {
    const { fixture, button } = render();
    document.body.appendChild(fixture.nativeElement);

    button('Supprimer la variante').click();
    fixture.detectChanges();

    expect(document.activeElement?.textContent?.trim()).toBe('Annuler');
    fixture.nativeElement.remove();
  });
});
