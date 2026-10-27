import type { Schemas } from '../api/api-types';

/** A role held within a scope. A null project or language means any — the role applies to all. */
export interface Assignment {
  readonly id: string;
  readonly role: { readonly id: string; readonly name: string };
  readonly project: { readonly id: string; readonly name: string } | null;
  readonly language: { readonly id: string; readonly code: string; readonly name: string } | null;
}

/** A permission as the engine resolved it from the assignments, with its scope (null = any). */
export interface Grant {
  readonly permission: string;
  readonly projectId: string | null;
  readonly languageId: string | null;
}

// Field by field, as `/me` and `/users` are read, so nothing the engine adds reaches a template.
export const toAssignment = (raw: Schemas['AssignmentResponse']): Assignment => ({
  id: raw.id,
  role: { id: raw.role.id, name: raw.role.name },
  project: raw.project === null ? null : { id: raw.project.id, name: raw.project.name },
  language:
    raw.language === null
      ? null
      : { id: raw.language.id, code: raw.language.code, name: raw.language.name },
});

export const toGrant = (raw: Schemas['GrantResponse']): Grant => ({
  permission: raw.permission,
  projectId: raw.project_id,
  languageId: raw.language_id,
});
