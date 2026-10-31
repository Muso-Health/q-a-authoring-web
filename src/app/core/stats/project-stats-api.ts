import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

/** Of the concepts present in a language, how many meet a criterion, and how many do not yet. */
export interface Completion {
  readonly complete: number;
  readonly notComplete: number;
}

export interface LanguageStats {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isBase: boolean;
  /** Concepts with a QASet in this language: the total each metric splits. */
  readonly present: number;
  readonly audio: Completion;
  readonly validatedAudio: Completion;
  /** Clinical validation in the base language, translation validation in the others. */
  readonly validation: Completion;
}

/** Concepts with at least one, and without any. */
export interface Coverage {
  readonly with: number;
  readonly without: number;
}

export interface ProjectStats {
  readonly counts: {
    readonly protocols: number;
    readonly themes: number;
    readonly concepts: number;
  };
  /** The base language first. */
  readonly languages: readonly LanguageStats[];
  readonly coverage: { readonly intent: Coverage; readonly category: Coverage };
}

const toCompletion = (c: Schemas['CompletionResponse']): Completion => ({
  complete: c.complete,
  notComplete: c.not_complete,
});

const toLanguage = (l: Schemas['LanguageStatisticsResponse']): LanguageStats => ({
  id: l.language_id,
  code: l.code,
  name: l.name,
  isBase: l.is_base,
  present: l.present,
  audio: toCompletion(l.audio_complete),
  validatedAudio: toCompletion(l.audio_validated_complete),
  validation: toCompletion(l.validation_complete),
});

/** A project's dashboard figures. */
@Service()
export class ProjectStatsApi {
  readonly #api = inject(ApiPort);

  async of(projectId: string): Promise<ProjectStats> {
    const path = `/projects/${encodeURIComponent(projectId)}/stats`;
    const stats = await this.#api.get<Schemas['ProjectStatsResponse']>(path);
    const languages = stats.languages.map(toLanguage);
    return {
      counts: { ...stats.counts },
      languages: [...languages.filter((l) => l.isBase), ...languages.filter((l) => !l.isBase)],
      coverage: {
        intent: { ...stats.coverage.intent },
        category: { ...stats.coverage.category },
      },
    };
  }
}
