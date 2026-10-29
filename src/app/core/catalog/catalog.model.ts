import type { Schemas } from '../api/api-types';

export interface Language {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly baseLanguageId: string;
}

export interface Protocol {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description: string | null;
}

export interface Theme {
  readonly id: string;
  readonly protocolId: string;
  readonly name: string;
  readonly description: string | null;
}

/** One language of a concept, as a theme lists it. */
export interface QASetSummary {
  readonly id: string;
  readonly languageId: string;
  readonly answerText: string;
  readonly variantCount: number;
}

export interface ConceptSummary {
  readonly id: string;
  readonly themeId: string;
  readonly qasets: readonly QASetSummary[];
}

/** The engine's detail read, mapped per page by the feature that shows it. */
export type ConceptDetail = Schemas['ConceptResponse'];

/** One of the languages a project's content may use. */
export interface ProjectLanguage extends Language {
  readonly isBase: boolean;
}

export interface ProtocolLineage {
  readonly project: Project;
  readonly protocol: Protocol;
}

export interface ThemeLineage extends ProtocolLineage {
  readonly theme: Theme;
}

export type ValidationStatus = 'validated' | 'rejected' | 'pending';

/** Inside a concept the engine sends null for pending (never decided, or reset by an edit). */
export function toValidationStatus(
  state: Schemas['ValidationStateResponse'] | null | undefined,
): ValidationStatus {
  return state?.state === 'validated' || state?.state === 'rejected' ? state.state : 'pending';
}

/** Languages by id; an id the engine did not list still gets a readable label. */
export class LanguageDirectory {
  readonly #byId: ReadonlyMap<string, Language>;

  constructor(languages: readonly Language[]) {
    this.#byId = new Map(languages.map((language) => [language.id, language]));
  }

  /** Every known language, in the engine's order. */
  all(): Language[] {
    return [...this.#byId.values()];
  }

  /** The queues name languages by code. */
  byCode(code: string): Language | undefined {
    return this.all().find((language) => language.code === code);
  }

  of(id: string): Language {
    return this.#byId.get(id) ?? { id, code: '?', name: id.slice(0, 8) };
  }
}
