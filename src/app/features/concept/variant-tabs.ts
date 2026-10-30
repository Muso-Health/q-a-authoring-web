import { Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { ConceptEditor } from './concept-editor';
import { QASetSection } from './qaset-section';
import { Untranslated } from './untranslated';

/**
 * The notion's variants, one tab per project language in the project's order. The arrows, Home
 * and End move between the tabs and select as they go; the selected one is remembered while the
 * page stays open, across its re-fetches. Every panel stays in the page, the others hidden.
 */
@Component({
  selector: 'app-variant-tabs',
  imports: [TranslocoPipe, QASetSection, Untranslated],
  template: `
    @let current = selected();
    <div
      role="tablist"
      class="tabs"
      [attr.aria-label]="'concept.variantTabs' | transloco"
      (keydown)="move($event)"
    >
      @for (language of languages(); track language.id) {
        @let on = language.id === current;
        <button
          #tab
          type="button"
          role="tab"
          [id]="'tab-' + language.code"
          [attr.aria-controls]="'panel-' + language.code"
          [attr.aria-selected]="on"
          [attr.data-lang]="language.code"
          [tabIndex]="on ? 0 : -1"
          (click)="choice.set(language.id)"
        >
          {{ language.name }}
        </button>
      }
    </div>
    @for (language of languages(); track language.id) {
      @let section = sectionOf(language);
      <div
        role="tabpanel"
        class="panel"
        [id]="'panel-' + language.code"
        [attr.aria-labelledby]="'tab-' + language.code"
        [attr.data-lang]="language.code"
        [hidden]="language.id !== current"
        tabindex="0"
      >
        @if (section) {
          <app-qaset-section [section]="section" />
        } @else {
          <app-untranslated place="tab" [language]="language" />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
      border-block-end: 1px solid var(--card-border);
    }
    [role='tab'] {
      min-block-size: 2.75rem;
      margin-block-end: -1px;
      padding: var(--muso-space-1) var(--muso-space-3);
      border: 0;
      border-block-end: 3px solid transparent;
      border-radius: var(--muso-radius) var(--muso-radius) 0 0;
      background: transparent;
      color: var(--muted-fg);
      font-weight: 600;
    }
    [role='tab']:hover {
      background: var(--surface-alt);
      color: var(--muso-text);
    }
    [role='tab'][aria-selected='true'] {
      border-block-end-color: var(--muso-teal);
      color: var(--muso-navy);
    }
    .panel {
      padding-block-start: var(--muso-space-3);
    }
  `,
})
export class VariantTabs {
  protected readonly editor = inject(ConceptEditor);

  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  /** Every project language, in the project's order: a tab even before its translation. */
  protected readonly languages = computed<readonly Language[]>(() =>
    this.editor.projectLanguages(),
  );

  /** What the author picked; until then, the base language's tab. */
  protected readonly choice = signal<string | null>(null);
  protected readonly selected = computed(() => {
    const languages = this.languages();
    const picked = this.choice();
    if (picked && languages.some((l) => l.id === picked)) return picked;
    const base = this.editor.view()?.sections.find((s) => s.isBase)?.language.id;
    return base ?? languages[0]?.id ?? null;
  });

  protected sectionOf(language: Language) {
    return this.editor.view()?.sections.find((s) => s.language.id === language.id) ?? null;
  }

  protected move(event: KeyboardEvent): void {
    const languages = this.languages();
    const at = languages.findIndex((l) => l.id === this.selected());
    const last = languages.length - 1;
    const next = {
      ArrowRight: at === last ? 0 : at + 1,
      ArrowLeft: at <= 0 ? last : at - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined || last < 0) return;
    event.preventDefault();
    this.choice.set(languages[next].id);
    this.tabs()[next]?.nativeElement.focus();
  }
}
