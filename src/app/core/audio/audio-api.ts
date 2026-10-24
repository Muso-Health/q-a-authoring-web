import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

export type AudioOwner = 'answer' | 'variant';

const audioPath = (qasetId: string, owner: AudioOwner, itemId: string): string =>
  `/qasets/${encodeURIComponent(qasetId)}/${owner === 'answer' ? 'answers' : 'variants'}/${encodeURIComponent(itemId)}/audio`;

@Service()
export class AudioApi {
  readonly #api = inject(ApiPort);

  /** A short-lived signed URL; ask again rather than keeping one. */
  async playbackUrl(audioId: string): Promise<string> {
    const path = `/audios/${encodeURIComponent(audioId)}/playback-url`;
    return (await this.#api.get<Schemas['PlaybackUrlResponse']>(path)).url;
  }

  /** Sets — or replaces — the item's recording; the engine validates type and size. */
  async setAudio(
    qasetId: string,
    owner: AudioOwner,
    itemId: string,
    file: Blob,
    filename: string,
  ): Promise<void> {
    const body = new FormData();
    body.append('file', file, filename);
    await this.#api.post(audioPath(qasetId, owner, itemId), body);
  }

  deleteAudio(qasetId: string, owner: AudioOwner, itemId: string): Promise<void> {
    return this.#api.delete(audioPath(qasetId, owner, itemId));
  }
}
