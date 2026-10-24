import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { MEDIA_CAPTURE } from './media-capture';
import type { Recording, RecorderPort, RecorderState } from './recorder-port';

const TICK_MS = 250;
/** Errors meaning "there is nothing to record with", as opposed to "the user said no". */
const NO_DEVICE = new Set(['NotFoundError', 'NotReadableError', 'OverconstrainedError']);

/** getUserMedia + MediaRecorder. */
@Injectable({ providedIn: 'root' })
export class MediaRecorderAdapter implements RecorderPort {
  readonly #capture = inject(MEDIA_CAPTURE);

  readonly #state = signal<RecorderState>(this.#capture ? 'idle' : 'unsupported');
  readonly state = this.#state.asReadonly();
  readonly #elapsed = signal(0);
  readonly elapsedMs = this.#elapsed.asReadonly();

  #stream: MediaStream | null = null;
  #recorder: MediaRecorder | null = null;
  #chunks: Blob[] = [];
  #startedAt = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #previewUrl: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.discard());
  }

  async start(): Promise<void> {
    const capture = this.#capture;
    if (!capture) return;
    this.discard();
    this.#state.set('requesting');
    try {
      this.#stream = await capture.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      this.#state.set(NO_DEVICE.has(name) ? 'unsupported' : 'denied');
      return;
    }
    const recorder = capture.createRecorder(this.#stream);
    this.#chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.#chunks.push(event.data);
    };
    this.#recorder = recorder;
    this.#startedAt = performance.now();
    this.#elapsed.set(0);
    this.#timer = setInterval(
      () => this.#elapsed.set(performance.now() - this.#startedAt),
      TICK_MS,
    );
    recorder.start();
    this.#state.set('recording');
  }

  stop(): Promise<Recording> {
    const recorder = this.#recorder;
    const capture = this.#capture;
    if (!recorder || !capture) return Promise.reject(new Error('not recording'));
    return new Promise((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          const durationMs = performance.now() - this.#startedAt;
          this.#release();
          const blob = new Blob(this.#chunks, { type: recorder.mimeType || 'audio/webm' });
          this.#previewUrl = capture.createObjectUrl(blob);
          this.#elapsed.set(durationMs);
          this.#state.set('recorded');
          resolve({ blob, durationMs, previewUrl: this.#previewUrl });
        },
        { once: true },
      );
      recorder.stop();
    });
  }

  discard(): void {
    if (this.#recorder?.state === 'recording') this.#recorder.stop();
    this.#release();
    if (this.#previewUrl) this.#capture?.revokeObjectUrl(this.#previewUrl);
    this.#previewUrl = null;
    this.#chunks = [];
    this.#elapsed.set(0);
    if (this.#state() !== 'unsupported') this.#state.set('idle');
  }

  #release(): void {
    clearInterval(this.#timer);
    this.#timer = undefined;
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    this.#recorder = null;
  }
}
