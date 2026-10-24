import { TestBed } from '@angular/core/testing';
import { MEDIA_CAPTURE, type MediaCapture } from './media-capture';
import { MediaRecorderAdapter } from './media-recorder-adapter';

class FakeMediaRecorder extends EventTarget {
  state: 'inactive' | 'recording' = 'inactive';
  readonly mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['chunk'], { type: this.mimeType }) });
    this.dispatchEvent(new Event('stop'));
  }
}

function setUp(capture: Partial<MediaCapture> | null) {
  const stopped: string[] = [];
  const track = { stop: () => stopped.push('track') };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const recorder = new FakeMediaRecorder();
  const full: MediaCapture = {
    getUserMedia: async () => stream,
    createRecorder: () => recorder as unknown as MediaRecorder,
    createObjectUrl: () => 'blob:preview',
    revokeObjectUrl: (url) => stopped.push(`revoke ${url}`),
    ...capture,
  };
  TestBed.configureTestingModule({
    providers: [{ provide: MEDIA_CAPTURE, useValue: capture === null ? null : full }],
  });
  return { adapter: TestBed.inject(MediaRecorderAdapter), recorder, stopped };
}

describe('MediaRecorderAdapter', () => {
  it('is unsupported where the browser has no capture', () => {
    expect(setUp(null).adapter.state()).toBe('unsupported');
  });

  it('records, then hands back the blob in its native type with a preview', async () => {
    const { adapter, stopped } = setUp({});

    await adapter.start();
    expect(adapter.state()).toBe('recording');
    const recording = await adapter.stop();

    expect(adapter.state()).toBe('recorded');
    expect(recording.blob.type).toBe('audio/webm;codecs=opus');
    expect(recording.blob.size).toBeGreaterThan(0);
    expect(recording.previewUrl).toBe('blob:preview');
    expect(recording.durationMs).toBeGreaterThanOrEqual(0);
    // The microphone is released as soon as recording stops.
    expect(stopped).toEqual(['track']);
  });

  it('reports a refused microphone as denied', async () => {
    const refusal = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    const { adapter } = setUp({ getUserMedia: () => Promise.reject(refusal) });

    await adapter.start();

    expect(adapter.state()).toBe('denied');
  });

  it('reports a missing microphone as unsupported', async () => {
    const missing = Object.assign(new Error('none'), { name: 'NotFoundError' });
    const { adapter } = setUp({ getUserMedia: () => Promise.reject(missing) });

    await adapter.start();

    expect(adapter.state()).toBe('unsupported');
  });

  it('discards a recording, releasing its preview, back to idle', async () => {
    const { adapter, stopped } = setUp({});
    await adapter.start();
    await adapter.stop();

    adapter.discard();

    expect(adapter.state()).toBe('idle');
    expect(stopped).toContain('revoke blob:preview');
  });
});
