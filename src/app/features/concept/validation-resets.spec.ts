import { LanguageDirectory } from '../../core/catalog/catalog.model';
import { CONCEPT, IDS, LANGUAGES } from '../../core/catalog/testing/catalog-fixtures';
import type { Schemas } from '../../core/api/api-types';
import { toConceptView } from './concept-view';
import { validationResets } from './validation-resets';

const directory = new LanguageDirectory(LANGUAGES.items);
const view = (detail: Schemas['ConceptResponse']) => toConceptView(detail, directory, IDS.fr);
const qaset = (detail: Schemas['ConceptResponse'], languageId: string) =>
  detail.qasets.find((q) => q.language_id === languageId)!;

/** The fixture after edits: the engine reset what depended on them. */
function afterEdits(): Schemas['ConceptResponse'] {
  const detail = structuredClone(CONCEPT);
  const fr = qaset(detail, IDS.fr);
  fr.clinical_validation = null;
  fr.variants[0].audios[0].audio_validation = null;
  fr.answer.audios[1].audio_validation = null;
  qaset(detail, IDS.en).translation_validation = null;
  return detail;
}

describe('validationResets', () => {
  it('lists every decided state that came back pending, in page order', () => {
    expect(validationResets(view(CONCEPT), view(afterEdits()))).toEqual([
      { kind: 'clinical' },
      { kind: 'audio', item: 'answer', language: 'Français', voice: 'Moussa' },
      { kind: 'audio', item: 'variant', number: 1, language: 'Français', voice: 'Awa' },
      { kind: 'translation', language: 'English' },
    ]);
  });

  it('lists nothing when nothing decided changed', () => {
    expect(validationResets(view(CONCEPT), view(structuredClone(CONCEPT)))).toEqual([]);
  });

  it('ignores states that were already pending and QASets that are gone', () => {
    const detail = structuredClone(CONCEPT);
    detail.qasets = detail.qasets.filter((q) => q.language_id !== IDS.en);

    expect(validationResets(view(CONCEPT), view(detail))).toEqual([]);
  });
});
