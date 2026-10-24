import type { ValidationStatus } from '../../core/catalog/catalog.model';
import type { QASetView } from './qaset-view';

export type ValidationReset =
  | { readonly kind: 'clinical' }
  | {
      readonly kind: 'translation' | 'audio';
      readonly item: 'answer' | 'variant';
      readonly number?: number;
      readonly language: string;
    };

interface Tracked {
  readonly status: ValidationStatus | null;
  readonly reset: ValidationReset;
}

function tracked(view: QASetView): Map<string, Tracked> {
  const states = new Map<string, Tracked>([
    ['clinical', { status: view.clinical, reset: { kind: 'clinical' } }],
  ]);
  for (const section of view.sections) {
    const language = section.language.name;
    const items = [
      { item: section.answer, where: { item: 'answer' as const, language } },
      ...section.variants.map((variant, i) => ({
        item: variant,
        where: { item: 'variant' as const, number: i + 1, language },
      })),
    ];
    for (const { item, where } of items) {
      states.set(`translation:${item.id}`, {
        status: item.translation,
        reset: { kind: 'translation', ...where },
      });
      if (item.audio) {
        states.set(`audio:${item.audio.id}`, {
          status: item.audio.quality,
          reset: { kind: 'audio', ...where },
        });
      }
    }
  }
  return states;
}

const decided = (status: ValidationStatus | null | undefined): boolean =>
  status === 'validated' || status === 'rejected';

/** Every decision the engine reset to pending between two reads of the same QASet. */
export function validationResets(before: QASetView, after: QASetView): ValidationReset[] {
  const previous = tracked(before);
  return [...tracked(after)]
    .filter(([key, now]) => now.status === 'pending' && decided(previous.get(key)?.status))
    .map(([, now]) => now.reset);
}
