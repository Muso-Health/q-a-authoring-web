import type { Schemas } from '../../api/api-types';
import { IDS } from './catalog-fixtures';

export const DOC_IDS = {
  guide: '0d000000-0000-0000-0000-000000000001',
  poster: '0d000000-0000-0000-0000-000000000002',
} as const;

export const GUIDE: Schemas['DocumentationResponse'] = {
  id: DOC_IDS.guide,
  theme_id: IDS.theme,
  filename: 'guide-paludisme.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1_520_000,
  checksum_sha256: 'a'.repeat(64),
  created_at: '2026-10-03T09:30:00Z',
};

export const POSTER: Schemas['DocumentationResponse'] = {
  id: DOC_IDS.poster,
  theme_id: IDS.theme,
  filename: 'affiche-moustiquaire.png',
  mime_type: 'image/png',
  size_bytes: 840,
  checksum_sha256: 'b'.repeat(64),
  created_at: '2026-10-05T14:00:00Z',
};

export const DOCUMENTS: Schemas['DocumentationListResponse'] = { items: [GUIDE, POSTER] };

export const SIGNED_URL = 'https://storage.example.org/docs/guide-paludisme.pdf?sig=abc';
