import type { Schemas } from '../../api/api-types';

export const ADMIN_IDS = {
  awa: 'a0000000-0000-0000-0000-000000000001',
  moussa: 'a0000000-0000-0000-0000-000000000002',
  authors: 'b0000000-0000-0000-0000-000000000001',
  validators: 'b0000000-0000-0000-0000-000000000002',
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

export const AWA: Schemas['UserResponse'] = {
  id: ADMIN_IDS.awa,
  email: 'awa@example.org',
  display_name: 'Awa Traoré',
  is_active: true,
  roles: [{ id: ADMIN_IDS.authors, name: 'Auteurs' }],
};

export const MOUSSA: Schemas['UserResponse'] = {
  id: ADMIN_IDS.moussa,
  email: 'moussa@example.org',
  display_name: 'Moussa Keita',
  is_active: false,
  roles: [],
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
