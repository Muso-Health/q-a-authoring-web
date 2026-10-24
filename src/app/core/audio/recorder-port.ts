import { Injectable, type Signal } from '@angular/core';
import { MediaRecorderAdapter } from './media-recorder-adapter';

export type RecorderState =
  'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported';

export interface Recording {
  /** In the browser's own recording type (webm/opus, ogg…); the engine detects it from the bytes. */
  readonly blob: Blob;
  readonly durationMs: number;
  /** A local URL to preview the take before sending it. */
  readonly previewUrl: string;
}

/**
 * Microphone capture, behind a port: the browser SDK stays in its adapter. One recorder for the
 * app, as there is one microphone; whoever opens it discards it when done.
 */
@Injectable({ providedIn: 'root', useExisting: MediaRecorderAdapter })
export abstract class RecorderPort {
  abstract readonly state: Signal<RecorderState>;
  /** Time recorded so far, ticking while recording. */
  abstract readonly elapsedMs: Signal<number>;
  /** Asks for the microphone, then records; ends `denied` or `unsupported` when it cannot. */
  abstract start(): Promise<void>;
  abstract stop(): Promise<Recording>;
  /** Drops any take and releases the microphone. */
  abstract discard(): void;
}
