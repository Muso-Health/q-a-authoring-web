import type { Schemas } from '../../api/api-types';
import { IDS } from '../../catalog/testing/catalog-fixtures';

const done = (complete: number, notComplete: number): Schemas['CompletionResponse'] => ({
  complete,
  not_complete: notComplete,
});

/** The fixture project's figures: French complete-ish, English partial, Bambara empty. */
export const STATS: Schemas['ProjectStatsResponse'] = {
  project_id: IDS.project,
  counts: { protocols: 2, themes: 5, concepts: 12 },
  languages: [
    {
      language_id: IDS.fr,
      code: 'fr',
      name: 'Français',
      is_base: true,
      present: 12,
      audio_complete: done(9, 3),
      audio_validated_complete: done(6, 6),
      validation_complete: done(10, 2),
    },
    {
      language_id: IDS.en,
      code: 'en',
      name: 'English',
      is_base: false,
      present: 4,
      audio_complete: done(1, 3),
      audio_validated_complete: done(0, 4),
      validation_complete: done(2, 2),
    },
    {
      language_id: IDS.bm,
      code: 'bm',
      name: 'Bambara',
      is_base: false,
      present: 0,
      audio_complete: done(0, 0),
      audio_validated_complete: done(0, 0),
      validation_complete: done(0, 0),
    },
  ],
  coverage: { intent: { with: 8, without: 4 }, category: { with: 11, without: 1 } },
};

/** A project with nothing in it yet. */
export const EMPTY_STATS: Schemas['ProjectStatsResponse'] = {
  project_id: IDS.project,
  counts: { protocols: 0, themes: 0, concepts: 0 },
  languages: [
    {
      language_id: IDS.fr,
      code: 'fr',
      name: 'Français',
      is_base: true,
      present: 0,
      audio_complete: done(0, 0),
      audio_validated_complete: done(0, 0),
      validation_complete: done(0, 0),
    },
  ],
  coverage: { intent: { with: 0, without: 0 }, category: { with: 0, without: 0 } },
};
