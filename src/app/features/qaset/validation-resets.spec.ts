import { LanguageDirectory } from '../../core/catalog/catalog.model';
import { IDS, LANGUAGES, QASET } from '../../core/catalog/testing/catalog-fixtures';
import type { Schemas } from '../../core/api/api-types';
import { toQASetView } from './qaset-view';
import { validationResets } from './validation-resets';

const directory = new LanguageDirectory(LANGUAGES.items);
const view = (detail: Schemas['QASetResponse']) => toQASetView(detail, directory, IDS.fr);

/** The fixture after an edit of the English answer: the engine reset what depended on it. */
function afterEnglishEdit(): Schemas['QASetResponse'] {
  const detail = structuredClone(QASET);
  detail.clinical_validation = null;
  const en = detail.languages.find((l) => l.language_id === IDS.en)!;
  en.answer.translation_validation = null;
  const fr = detail.languages.find((l) => l.language_id === IDS.fr)!;
  fr.variants[0].audio!.audio_validation = null;
  return detail;
}

describe('validationResets', () => {
  it('lists every decided state that came back pending, in page order', () => {
    expect(validationResets(view(QASET), view(afterEnglishEdit()))).toEqual([
      { kind: 'clinical' },
      { kind: 'audio', item: 'variant', number: 1, language: 'Français' },
      { kind: 'translation', item: 'answer', language: 'English' },
    ]);
  });

  it('lists nothing when nothing decided changed', () => {
    expect(validationResets(view(QASET), view(structuredClone(QASET)))).toEqual([]);
  });

  it('ignores states that were already pending and items that are gone', () => {
    const detail = structuredClone(QASET);
    detail.languages = detail.languages.filter((l) => l.language_id !== IDS.en);

    expect(validationResets(view(QASET), view(detail))).toEqual([]);
  });
});
