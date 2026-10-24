import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

@Service()
export class AudioApi {
  readonly #api = inject(ApiPort);

  /** A short-lived signed URL; ask again rather than keeping one. */
  async playbackUrl(audioId: string): Promise<string> {
    const path = `/audios/${encodeURIComponent(audioId)}/playback-url`;
    return (await this.#api.get<Schemas['PlaybackUrlResponse']>(path)).url;
  }
}
