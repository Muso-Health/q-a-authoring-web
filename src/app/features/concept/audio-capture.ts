import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { RecorderPort, type Recording } from '../../core/audio/recorder-port';
import { FileUpload } from '../../shared/ui/file-upload';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { formatDuration } from '../audio/audio-player';
import { ConceptEditor } from './concept-editor';
import type { ItemRole, ItemView } from './concept-view';

type Panel = 'closed' | 'choose' | 'record' | 'upload';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/** A name for a take, from its browser-native type; the engine trusts the bytes, not the name. */
export function recordingName(type: string): string {
  return `enregistrement.${EXTENSIONS[type.split(';')[0].trim()] ?? 'webm'}`;
}

let nextId = 0;

/**
 * Recording or uploading the audio of one answer or one variant, in a chosen voice — always that
 * exact item. A voice that already speaks it is replaced. A take (or, in the upload control, a
 * chosen file) stays until it is sent or discarded, so a refusal can be retried as is.
 */
@Component({
  selector: 'app-audio-capture',
  imports: [NgTemplateOutlet, TranslocoPipe, FileUpload, FocusReturnTarget],
  templateUrl: './audio-capture.html',
  styleUrl: './audio-capture.scss',
})
export class AudioCapture {
  protected readonly editor = inject(ConceptEditor);
  protected readonly recorder = inject(RecorderPort);
  readonly #focus = inject(FocusReturn);
  protected readonly id = `audio-capture-${nextId++}`;

  readonly role = input.required<ItemRole>();
  readonly qasetId = input.required<string>();
  readonly item = input.required<ItemView>();
  /** The item as a phrase, completing the controls' names: « la réponse », « la variante 2 ». */
  readonly label = input.required<string>();

  protected readonly panel = signal<Panel>('closed');
  protected readonly take = signal<Recording | null>(null);
  protected readonly voiceId = signal('');
  protected readonly voiceMissing = signal(false);

  protected readonly target = computed(() => `audio:${this.item().id}`);
  protected readonly opener = computed(() => `audio-add:${this.item().id}`);
  protected readonly canRecord = computed(() => this.recorder.state() !== 'unsupported');
  protected readonly elapsed = computed(() => formatDuration(this.recorder.elapsedMs()));
  /** Every voice, marked when it already speaks the item: sending in it replaces that take. */
  protected readonly voices = computed(() => {
    const recorded = new Set(this.item().audios.map((audio) => audio.voiceId));
    return this.editor.voices().map((voice) => ({ ...voice, recorded: recorded.has(voice.id) }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.panel() === 'record') this.recorder.discard();
    });
  }

  protected open(): void {
    this.voiceId.set('');
    this.voiceMissing.set(false);
    this.panel.set('choose');
  }

  protected chooseVoice(voiceId: string): void {
    this.voiceId.set(voiceId);
    if (voiceId) this.voiceMissing.set(false);
  }

  /** Recording or uploading starts only once the voice is known. */
  protected start(panel: 'record' | 'upload'): void {
    if (!this.voiceId()) {
      this.voiceMissing.set(true);
      return;
    }
    this.panel.set(panel);
    if (panel === 'record') void this.recorder.start();
  }

  protected async stop(): Promise<void> {
    this.take.set(await this.recorder.stop());
  }

  protected redo(): void {
    this.recorder.discard();
    this.take.set(null);
    void this.recorder.start();
  }

  protected async sendTake(): Promise<void> {
    const take = this.take();
    if (take) await this.#send(take.blob, recordingName(take.blob.type));
  }

  protected async sendFile(file: File): Promise<void> {
    await this.#send(file, file.name);
  }

  /** Back to the closed controls; focus returns to the button that opened the panel. */
  protected close(): void {
    if (this.panel() === 'record' || this.take()) this.recorder.discard();
    this.take.set(null);
    this.panel.set('closed');
    this.editor.clearError(this.target());
    this.#focus.to(this.opener());
  }

  async #send(file: Blob, filename: string): Promise<void> {
    const sent = await this.editor.setAudio(
      this.qasetId(),
      this.role(),
      this.item().id,
      this.voiceId(),
      file,
      filename,
    );
    if (sent) this.close();
  }
}
