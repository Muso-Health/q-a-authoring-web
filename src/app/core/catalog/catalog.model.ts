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

export interface QASetSummary {
  readonly id: string;
  readonly themeId: string;
  readonly languages: readonly { readonly languageId: string; readonly variantCount: number }[];
}

/** The engine's detail read, mapped per page by the feature that shows it. */
export type QASetDetail = Schemas['QASetResponse'];

export interface ProtocolLineage {
  readonly project: Project;
  readonly protocol: Protocol;
}

export interface ThemeLineage extends ProtocolLineage {
  readonly theme: Theme;
}

export type ValidationStatus = 'validated' | 'rejected' | 'pending';

/** Inside a QASet the engine sends null for pending (never decided, or reset by an edit). */
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

  of(id: string): Language {
    return this.#byId.get(id) ?? { id, code: '?', name: id.slice(0, 8) };
  }
}
