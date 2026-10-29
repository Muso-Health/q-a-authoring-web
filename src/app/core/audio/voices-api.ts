import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

/** Who is speaking in a recording. A null note is none, or clears it. */
export interface Voice {
  readonly id: string;
  readonly name: string;
  readonly note: string | null;
}

export type VoiceDraft = Omit<Voice, 'id'>;

const at = (voiceId: string) => `/voices/${encodeURIComponent(voiceId)}`;

/** The voices catalogue: every recording is made in one of them. */
@Service()
export class VoicesApi {
  readonly #api = inject(ApiPort);

  /** Ordered by name, as the engine sends them. */
  async list(): Promise<Voice[]> {
    const { items } = await this.#api.get<Schemas['VoicesResponse']>('/voices');
    return items.map(({ id, name, note }) => ({ id, name, note }));
  }

  async create({ name, note }: VoiceDraft): Promise<void> {
    const body: Schemas['CreateVoiceRequest'] = note === null ? { name } : { name, note };
    await this.#api.post('/voices', body);
  }

  async update(voiceId: string, { name, note }: VoiceDraft): Promise<void> {
    const body: Schemas['UpdateVoiceRequest'] = { name, note };
    await this.#api.patch(at(voiceId), body);
  }

  delete(voiceId: string): Promise<void> {
    return this.#api.delete(at(voiceId));
  }
}
