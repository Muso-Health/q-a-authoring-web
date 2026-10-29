import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

export type AudioOwner = 'answer' | 'variant';

const id = encodeURIComponent;

/** A QASet's answer is its only one, so it has no id in the path; a variant does. */
const audioPath = (qasetId: string, owner: AudioOwner, itemId: string): string =>
  owner === 'answer'
    ? `/qasets/${id(qasetId)}/answer/audio`
    : `/qasets/${id(qasetId)}/variants/${id(itemId)}/audio`;

/** Recordings of answers and variants: one per voice. */
@Service()
export class AudioApi {
  readonly #api = inject(ApiPort);

  /** A short-lived signed URL; ask again rather than keeping one. */
  async playbackUrl(audioId: string): Promise<string> {
    const path = `/audios/${id(audioId)}/playback-url`;
    return (await this.#api.get<Schemas['PlaybackUrlResponse']>(path)).url;
  }

  /** Sets — or replaces — the item's recording in that voice; the engine checks type and size. */
  async setAudio(
    qasetId: string,
    owner: AudioOwner,
    itemId: string,
    voiceId: string,
    file: Blob,
    filename: string,
  ): Promise<void> {
    const body = new FormData();
    body.append('file', file, filename);
    body.append('voice_id', voiceId);
    await this.#api.post(audioPath(qasetId, owner, itemId), body);
  }

  deleteAudio(qasetId: string, owner: AudioOwner, itemId: string, voiceId: string): Promise<void> {
    return this.#api.delete(`${audioPath(qasetId, owner, itemId)}/${id(voiceId)}`);
  }
}
