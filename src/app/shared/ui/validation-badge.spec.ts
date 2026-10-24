import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ValidationBadge } from './validation-badge';

beforeEach(() =>
  TestBed.configureTestingModule({ imports: [ValidationBadge], providers: [provideTestI18n()] }),
);

function render(kind: string, status: string) {
  const fixture = TestBed.createComponent(ValidationBadge);
  fixture.componentRef.setInput('kind', kind);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ValidationBadge', () => {
  it('names the kind of validation and its state in French', () => {
    expect(render('clinical', 'validated').textContent?.trim()).toBe(
      'Validation clinique : validée',
    );
    expect(render('translation', 'rejected').textContent?.trim()).toBe('Traduction : rejetée');
    expect(render('audio', 'pending').textContent?.trim()).toBe('Qualité audio : en attente');
  });

  it('styles each state distinctly', () => {
    const classes = ['validated', 'rejected', 'pending'].map(
      (status) => render('clinical', status).querySelector('.badge')?.className,
    );

    expect(new Set(classes).size).toBe(3);
  });
});
