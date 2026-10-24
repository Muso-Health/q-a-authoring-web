import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;

/**
 * Choosing one file and sending it. The choice stays until it is sent and cleared, so a refusal
 * can be retried as is; what counts as acceptable is the engine's call, `accept` only a hint.
 */
@Component({
  selector: 'app-file-upload',
  imports: [TranslocoPipe],
  template: `
    <label [for]="id">{{ label() }}</label>
    <input #picker [id]="id" type="file" [attr.accept]="accept()" (change)="pick($event)" />
    @if (file(); as chosen) {
      <p class="selected muso-meta">{{ 'upload.selected' | transloco: { name: chosen.name } }}</p>
    }
    <div class="actions">
      <button type="button" [disabled]="busy() || !file()" (click)="sendChosen()">
        {{ submitLabel() }}
      </button>
      @if (cancellable()) {
        <button type="button" class="secondary" (click)="cancel.emit()">
          {{ 'authoring.cancel' | transloco }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class FileUpload {
  protected readonly id = `file-upload-${nextId++}`;

  /** Already translated. */
  readonly label = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly accept = input<string | null>(null);
  readonly busy = input(false);
  readonly cancellable = input(false);
  readonly send = output<File>();
  readonly cancel = output();

  protected readonly file = signal<File | null>(null);
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  /** Once the file has been accepted. */
  clear(): void {
    this.file.set(null);
    const picker = this.picker()?.nativeElement;
    if (picker) picker.value = '';
  }

  protected pick(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected sendChosen(): void {
    const file = this.file();
    if (file) this.send.emit(file);
  }
}
