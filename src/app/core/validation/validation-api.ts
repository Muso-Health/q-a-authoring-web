import { Service, inject } from '@angular/core';
import { ApiPort, type QueryParams } from '../api/api-port';
import type { Schemas } from '../api/api-types';

export type QueueKind = 'clinical' | 'translation' | 'audio';
export type QueueState = 'pending' | 'rejected' | 'validated' | 'all';
export type Decision = 'validated' | 'rejected';

export interface QueueFilter {
  readonly state: QueueState;
  readonly projectId?: string;
  readonly themeId?: string;
  readonly cursor?: string;
}

export type QueueItemResponse = {
  clinical: Schemas['ClinicalQueueItemResponse'];
  translation: Schemas['TranslationQueueItemResponse'];
  audio: Schemas['AudioQueueItemResponse'];
};

export interface QueuePage<K extends QueueKind> {
  readonly items: QueueItemResponse[K][];
  readonly total: number;
  readonly nextCursor: string | null;
}

/**
 * What a decision is about: the base-language QASet (clinical), a translated QASet as a whole —
 * its answer and variants together (translation) — or one recording (audio).
 */
export interface DecisionSubject {
  readonly kind: 'clinical' | 'translation' | 'audio';
  readonly id: string;
}

export const QUEUE_PAGE_SIZE = 20;

const DECISION_PATHS: Record<DecisionSubject['kind'], (id: string) => string> = {
  clinical: (id) => `/qasets/${id}/clinical-validation`,
  translation: (id) => `/qasets/${id}/translation-validation`,
  audio: (id) => `/audios/${id}/audio-validation`,
};

/** The validation worklists (keyset pages, ordered by id) and the decisions taken on them. */
@Service()
export class ValidationApi {
  readonly #api = inject(ApiPort);

  async queue<K extends QueueKind>(kind: K, filter: QueueFilter): Promise<QueuePage<K>> {
    const params: Record<string, string | number> = { state: filter.state, limit: QUEUE_PAGE_SIZE };
    if (filter.projectId) params['project_id'] = filter.projectId;
    if (filter.themeId) params['theme_id'] = filter.themeId;
    if (filter.cursor) params['cursor'] = filter.cursor;
    const response = await this.#api.get<{
      items: QueueItemResponse[K][];
      total: number;
      next_cursor: string | null;
    }>(`/validation-queues/${kind}`, { params: params as QueryParams });
    return { items: response.items, total: response.total, nextCursor: response.next_cursor };
  }

  async decide(subject: DecisionSubject, decision: Decision, note: string): Promise<void> {
    const trimmed = note.trim();
    const body: Schemas['DecisionRequest'] = trimmed ? { decision, note: trimmed } : { decision };
    await this.#api.post(DECISION_PATHS[subject.kind](encodeURIComponent(subject.id)), body);
  }
}
