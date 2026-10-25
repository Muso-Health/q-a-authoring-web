import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ValidationStatus } from '../../core/catalog/catalog.model';

export type ValidationKind = 'clinical' | 'translation' | 'audio';

const KIND_KEYS = {
  clinical: 'validation.kind.clinical',
  translation: 'validation.kind.translation',
  audio: 'validation.kind.audio',
} as const;

const STATUS_KEYS = {
  validated: 'validation.status.validated',
  rejected: 'validation.status.rejected',
  pending: 'validation.status.pending',
} as const;

/** The current state of one validation, said in words; colour only reinforces it. */
@Component({
  selector: 'app-validation-badge',
  imports: [TranslocoPipe],
  template: `
    <span class="badge" [class]="status()" [attr.data-kind]="kind()">
      {{ kindKey() | transloco }} : {{ statusKey() | transloco }}
    </span>
  `,
  styles: `
    .badge {
      display: inline-block;
      padding: 0.1rem var(--muso-space-1);
      border: 1px solid;
      border-radius: var(--muso-radius);
      font-size: var(--muso-caption-size);
      font-weight: 600;
      white-space: nowrap;
    }
    .validated {
      background: var(--badge-validated-bg);
      border-color: var(--badge-validated-border);
      color: var(--muso-text);
    }
    .rejected {
      background: var(--badge-rejected-bg);
      border-color: var(--badge-rejected-border);
      color: var(--muso-text);
    }
    .pending {
      background: var(--badge-pending-bg);
      border-color: var(--badge-pending-border);
      border-style: dashed;
      color: var(--muso-text);
    }
  `,
})
export class ValidationBadge {
  readonly kind = input.required<ValidationKind>();
  readonly status = input.required<ValidationStatus>();

  protected readonly kindKey = computed(() => KIND_KEYS[this.kind()]);
  protected readonly statusKey = computed(() => STATUS_KEYS[this.status()]);
}
