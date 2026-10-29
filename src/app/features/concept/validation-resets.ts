import type { ValidationStatus } from '../../core/catalog/catalog.model';
import type { ConceptView } from './concept-view';

export type ValidationReset =
  | { readonly kind: 'clinical' }
  | { readonly kind: 'translation'; readonly language: string }
  | {
      readonly kind: 'audio';
      readonly item: 'answer' | 'variant';
      readonly number?: number;
      readonly language: string;
      readonly voice: string;
    };

interface Tracked {
  readonly status: ValidationStatus | null;
  readonly reset: ValidationReset;
}

function tracked(view: ConceptView): Map<string, Tracked> {
  const states = new Map<string, Tracked>();
  for (const section of view.sections) {
    const language = section.language.name;
    if (section.isBase) {
      states.set('clinical', { status: section.clinical, reset: { kind: 'clinical' } });
    } else {
      states.set(`translation:${section.id}`, {
        status: section.translation,
        reset: { kind: 'translation', language },
      });
    }
    const items = [
      { item: section.answer, where: { item: 'answer' as const, language } },
      ...section.variants.map((variant, i) => ({
        item: variant,
        where: { item: 'variant' as const, number: i + 1, language },
      })),
    ];
    for (const { item, where } of items) {
      for (const audio of item.audios) {
        states.set(`audio:${audio.id}`, {
          status: audio.quality,
          reset: { kind: 'audio', ...where, voice: audio.voiceName },
        });
      }
    }
  }
  return states;
}

const decided = (status: ValidationStatus | null | undefined): boolean =>
  status === 'validated' || status === 'rejected';

/** Every decision the engine reset to pending between two reads of the same concept. */
export function validationResets(before: ConceptView, after: ConceptView): ValidationReset[] {
  const previous = tracked(before);
  return [...tracked(after)]
    .filter(([key, now]) => now.status === 'pending' && decided(previous.get(key)?.status))
    .map(([, now]) => now.reset);
}
