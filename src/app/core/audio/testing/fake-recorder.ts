import { signal } from '@angular/core';
import { RecorderPort, type Recording, type RecorderState } from '../recorder-port';

/** A recorder for tests: a canned webm take, and the microphone's answer chosen in advance. */
export class FakeRecorder extends RecorderPort {
  readonly #state = signal<RecorderState>('idle');
  readonly state = this.#state.asReadonly();
  readonly #elapsed = signal(0);
  readonly elapsedMs = this.#elapsed.asReadonly();

  readonly blob = new Blob(['webm-bytes'], { type: 'audio/webm' });
  nextStart: 'grant' | 'deny' = 'grant';
  starts = 0;
  discarded = 0;

  setUnsupported(): void {
    this.#state.set('unsupported');
  }

  tick(ms: number): void {
    this.#elapsed.set(ms);
  }

  async start(): Promise<void> {
    if (this.#state() === 'unsupported') return;
    this.starts++;
    this.#elapsed.set(0);
    this.#state.set(this.nextStart === 'deny' ? 'denied' : 'recording');
  }

  async stop(): Promise<Recording> {
    this.#state.set('recorded');
    return { blob: this.blob, durationMs: this.#elapsed(), previewUrl: 'blob:preview' };
  }

  discard(): void {
    this.discarded++;
    this.#elapsed.set(0);
    if (this.#state() !== 'unsupported') this.#state.set('idle');
  }
}
