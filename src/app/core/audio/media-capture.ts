import { InjectionToken } from '@angular/core';

/** The browser's capture APIs, narrowed to what the recorder needs, so tests can stand in. */
export interface MediaCapture {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createRecorder(stream: MediaStream): MediaRecorder;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}

/** Null where the browser cannot record at all (no getUserMedia or no MediaRecorder). */
export const MEDIA_CAPTURE = new InjectionToken<MediaCapture | null>('MEDIA_CAPTURE', {
  providedIn: 'root',
  factory: () => {
    const devices = globalThis.navigator?.mediaDevices;
    if (!devices?.getUserMedia || typeof globalThis.MediaRecorder === 'undefined') return null;
    return {
      getUserMedia: (constraints) => devices.getUserMedia(constraints),
      createRecorder: (stream) => new MediaRecorder(stream),
      createObjectUrl: (blob) => URL.createObjectURL(blob),
      revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    };
  },
});
