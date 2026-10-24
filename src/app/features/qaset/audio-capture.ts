import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { RecorderPort, type Recording } from '../../core/audio/recorder-port';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { FileUpload } from '../../shared/ui/file-upload';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { formatDuration } from '../audio/audio-player';
import { QASetEditor } from './qaset-editor';
import type { ItemRole, ItemView } from './qaset-view';

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

/**
 * Recording or uploading the audio of one answer or one variant — always that exact item. A take
 * (or, in the upload control, a chosen file) stays until it is sent or discarded, so a refusal can
 * be retried as is.
 */
@Component({
  selector: 'app-audio-capture',
  imports: [NgTemplateOutlet, TranslocoPipe, ConfirmAction, FileUpload, FocusReturnTarget],
  templateUrl: './audio-capture.html',
  styleUrl: './audio-capture.scss',
})
export class AudioCapture {
  protected readonly editor = inject(QASetEditor);
  protected readonly recorder = inject(RecorderPort);
  readonly #focus = inject(FocusReturn);

  readonly role = input.required<ItemRole>();
  readonly item = input.required<ItemView>();
  /** The item as a phrase, completing the controls' names: « la réponse », « la variante 2 ». */
  readonly label = input.required<string>();

  protected readonly panel = signal<Panel>('closed');
  protected readonly take = signal<Recording | null>(null);
  #opener = '';

  protected readonly target = computed(() => `audio:${this.item().id}`);
  protected readonly key = (what: string) => `audio-${what}:${this.item().id}`;
  protected readonly canRecord = computed(() => this.recorder.state() !== 'unsupported');
  protected readonly elapsed = computed(() => formatDuration(this.recorder.elapsedMs()));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.panel() === 'record') this.recorder.discard();
    });
  }

  protected open(panel: Panel, opener: string): void {
    this.#opener = opener;
    this.panel.set(panel);
    if (panel === 'record') void this.recorder.start();
  }

  protected chooseRecord(): void {
    this.panel.set('record');
    void this.recorder.start();
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

  /** Back to the closed controls; focus returns to whatever opened the panel. */
  protected close(focusKey = this.#opener): void {
    if (this.panel() === 'record' || this.take()) this.recorder.discard();
    this.take.set(null);
    this.panel.set('closed');
    this.editor.clearError(this.target());
    this.#focus.to(focusKey);
  }

  async #send(file: Blob, filename: string): Promise<void> {
    if (await this.editor.setAudio(this.role(), this.item().id, file, filename)) {
      // The item has audio now, so « Remplacer » is the control that stands where the opener was.
      this.close(this.key('replace'));
    }
  }
}
