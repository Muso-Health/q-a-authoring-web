import type { Schemas } from '../../api/api-types';
import { IDS, PROJECT } from '../../catalog/testing/catalog-fixtures';

export const ADMIN_IDS = {
  awa: 'a0000000-0000-0000-0000-000000000001',
  moussa: 'a0000000-0000-0000-0000-000000000002',
  authors: 'b0000000-0000-0000-0000-000000000001',
  validators: 'b0000000-0000-0000-0000-000000000002',
  awaAuthorsInProject: 'e0000000-0000-0000-0000-000000000001',
  awaValidatorsInBambara: 'e0000000-0000-0000-0000-000000000002',
} as const;

export const PERMISSIONS: Schemas['PermissionsResponse'] = {
  items: ['author_qasets', 'manage_audio', 'validate_clinical', 'manage_access'],
};

export const AUTHORS: Schemas['RoleResponse'] = {
  id: ADMIN_IDS.authors,
  name: 'Auteurs',
  permissions: ['author_qasets', 'manage_audio'],
};

export const VALIDATORS: Schemas['RoleResponse'] = {
  id: ADMIN_IDS.validators,
  name: 'Validateurs cliniques',
  permissions: ['validate_clinical'],
};

export const ROLES: Schemas['RolesResponse'] = { items: [AUTHORS, VALIDATORS] };

/** The engine's identity-provider subject: something the UI must never show. */
export const LEAKED_SUBJECT = 'entra-oid-7f3c2b9e-secret';

/**
 * Awa writes in one project, in every language; and validates in Bambara, in every project. One
 * assignment scoped on each axis, so a test can tell the two scopes and their "any" apart.
 */
export const AWA: Schemas['UserResponse'] = {
  id: ADMIN_IDS.awa,
  email: 'awa@example.org',
  display_name: 'Awa Traoré',
  is_active: true,
  assignments: [
    {
      id: ADMIN_IDS.awaAuthorsInProject,
      role: { id: ADMIN_IDS.authors, name: 'Auteurs' },
      project: { id: PROJECT.id, name: PROJECT.name },
      language: null,
    },
    {
      id: ADMIN_IDS.awaValidatorsInBambara,
      role: { id: ADMIN_IDS.validators, name: 'Validateurs cliniques' },
      project: null,
      language: { id: IDS.bm, code: 'bm', name: 'Bambara' },
    },
  ],
  grants: [
    { permission: 'author_qasets', project_id: PROJECT.id, language_id: null },
    { permission: 'manage_audio', project_id: PROJECT.id, language_id: null },
    { permission: 'validate_clinical', project_id: null, language_id: IDS.bm },
  ],
};

export const MOUSSA: Schemas['UserResponse'] = {
  id: ADMIN_IDS.moussa,
  email: 'moussa@example.org',
  display_name: 'Moussa Keita',
  is_active: false,
  assignments: [],
  grants: [],
};

/** As a careless engine might send them: with the subject riding along. */
export const USERS = {
  items: [AWA, MOUSSA].map((user) => ({ ...user, oid: LEAKED_SUBJECT, subject: LEAKED_SUBJECT })),
} satisfies Schemas['UsersResponse'];

export const TRANSLATE_TEMPLATE: Schemas['PromptTemplateResponse'] = {
  key: 'translate',
  content: 'Traduis {text} de {source_language} vers {target_language}.',
  required_placeholders: ['source_language', 'target_language', 'text'],
  updated_by: 'admin@example.org',
  updated_at: '2026-09-30T14:05:00Z',
};

export const GENERATE_TEMPLATE: Schemas['PromptTemplateResponse'] = {
  key: 'generate_variants',
  content: 'Propose {count} reformulations de {question}.',
  required_placeholders: ['count', 'question'],
  updated_by: null,
  updated_at: '2026-01-01T00:00:00Z',
};

export const TEMPLATES: Schemas['PromptTemplatesResponse'] = {
  items: [TRANSLATE_TEMPLATE, GENERATE_TEMPLATE],
};

export const TAXONOMY_IDS = {
  fever: 'c1000000-0000-0000-0000-000000000001',
  bednet: 'c1000000-0000-0000-0000-000000000002',
  malaria: 'c2000000-0000-0000-0000-000000000001',
  nutrition: 'c2000000-0000-0000-0000-000000000002',
} as const;

export const INTENTS: Schemas['IntentsResponse'] = {
  items: [
    { id: TAXONOMY_IDS.bednet, text: 'Utiliser une moustiquaire' },
    { id: TAXONOMY_IDS.fever, text: 'Reconnaître la fièvre' },
  ],
};

export const CATEGORIES: Schemas['CategoriesResponse'] = {
  items: [
    { id: TAXONOMY_IDS.nutrition, name: 'Nutrition' },
    { id: TAXONOMY_IDS.malaria, name: 'Paludisme' },
  ],
};
