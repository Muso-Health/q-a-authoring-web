import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

/** A document attached to a theme, as its list shows it. */
export interface ThemeDocument {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

const toDocument = (raw: Schemas['DocumentationResponse']): ThemeDocument => ({
  id: raw.id,
  filename: raw.filename,
  mimeType: raw.mime_type,
  sizeBytes: raw.size_bytes,
  createdAt: raw.created_at,
});

const documentation = (themeId: string) => `/themes/${encodeURIComponent(themeId)}/documentation`;

/** A theme's reference documents, and what of them its answers do not cover yet. */
@Service()
export class DocumentationApi {
  readonly #api = inject(ApiPort);

  async list(themeId: string): Promise<ThemeDocument[]> {
    const { items } = await this.#api.get<Schemas['DocumentationListResponse']>(
      documentation(themeId),
    );
    return items.map(toDocument);
  }

  /** The engine validates the type and size. */
  async upload(themeId: string, file: File): Promise<void> {
    const body = new FormData();
    body.append('file', file, file.name);
    await this.#api.post(documentation(themeId), body);
  }

  remove(themeId: string, documentId: string): Promise<void> {
    return this.#api.delete(`${documentation(themeId)}/${encodeURIComponent(documentId)}`);
  }

  /** A short-lived signed URL; ask again rather than keeping one. */
  async downloadUrl(documentId: string): Promise<string> {
    const path = `/documentation/${encodeURIComponent(documentId)}/download-url`;
    return (await this.#api.get<Schemas['DownloadUrlResponse']>(path)).url;
  }

  /** Read-only, despite the POST: the notions of the documentation no answer covers. */
  async completeness(themeId: string): Promise<string[]> {
    const path = `/themes/${encodeURIComponent(themeId)}/completeness`;
    return (await this.#api.post<Schemas['CompletenessResponse']>(path, null)).uncovered_notions;
  }
}
