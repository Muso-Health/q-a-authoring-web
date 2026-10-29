import { Component, inject, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { VoicesApi, type VoiceDraft } from '../../../core/audio/voices-api';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';
import { VoiceForm } from './voice-form';

const CREATE = 'create';
const voiceTarget = (id: string) => `voice:${id}`;
const EMPTY: VoiceDraft = { name: '', note: null };

/** The voices every recording is made in: added, renamed or annotated, removed while unused. */
@Component({
  selector: 'app-voices-page',
  imports: [TranslocoPipe, Loading, LoadError, VoiceForm, ConfirmAction, FocusReturnTarget],
  providers: [AdminWrites],
  template: `
    <h2>{{ 'admin.voices.title' | transloco }}</h2>
    <p class="muso-lead">{{ 'admin.voices.lead' | transloco }}</p>

    <section class="muso-card" aria-labelledby="create-voice-heading">
      <h3 id="create-voice-heading">{{ 'admin.voices.create' | transloco }}</h3>
      <app-voice-form
        [initial]="createSeed()"
        [busy]="writes.busy()"
        [error]="writes.errorFor(createTarget)"
        (save)="create($event)"
      />
    </section>

    <div aria-live="polite">
      @if (writes.notice(); as notice) {
        <p class="page-notice muso-notice">{{ notice }}</p>
      }
    </div>

    @if (voices.hasValue()) {
      @if (voices.value().length > 0) {
        <ul class="muso-cards">
          @for (voice of voices.value(); track voice.id) {
            <li class="voice muso-card">
              <h3>{{ voice.name }}</h3>
              @if (editing() === voice.id) {
                <app-voice-form
                  mode="edit"
                  [initial]="voice"
                  [busy]="writes.busy()"
                  [error]="writes.errorFor(target(voice.id))"
                  (save)="update(voice.id, $event)"
                  (cancel)="closeEdit(voice.id)"
                />
              } @else {
                @if (voice.note) {
                  <p class="note muso-meta">{{ voice.note }}</p>
                }
                @if (writes.errorFor(target(voice.id)); as message) {
                  <p class="field-error" role="alert">{{ message }}</p>
                }
                <div class="actions">
                  <button
                    type="button"
                    class="secondary small"
                    [appFocusReturn]="'edit-voice:' + voice.id"
                    [disabled]="writes.busy()"
                    [attr.aria-label]="'admin.voices.editName' | transloco: { voice: voice.name }"
                    (click)="openEdit(voice.id)"
                  >
                    {{ 'admin.voices.edit' | transloco }}
                  </button>
                  <app-confirm-action
                    [small]="true"
                    [label]="'admin.catalog.delete' | transloco"
                    [accessibleName]="'admin.voices.deleteName' | transloco: { voice: voice.name }"
                    [warning]="'admin.voices.deleteWarning' | transloco: { voice: voice.name }"
                    [busy]="writes.busy()"
                    (confirmed)="remove(voice.id)"
                  />
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="muso-empty">{{ 'admin.voices.empty' | transloco }}</p>
      }
    } @else if (voices.error()) {
      <app-load-error [error]="voices.error()" (retry)="voices.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    .voice {
      display: grid;
      gap: var(--muso-space-1);
    }
    .voice p {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class VoicesPage {
  readonly #api = inject(VoicesApi);
  readonly #focus = inject(FocusReturn);
  protected readonly writes = inject(AdminWrites);
  protected readonly createTarget = CREATE;

  protected readonly voices = resource({ loader: () => this.#api.list() });
  protected readonly editing = signal<string | null>(null);
  protected readonly createSeed = signal<VoiceDraft>(EMPTY);

  protected target(id: string): string {
    return voiceTarget(id);
  }

  protected async create(draft: VoiceDraft): Promise<void> {
    if (await this.#write(CREATE, () => this.#api.create(draft))) {
      this.createSeed.set({ ...EMPTY });
    }
  }

  protected async update(id: string, draft: VoiceDraft): Promise<void> {
    if (await this.#write(voiceTarget(id), () => this.#api.update(id, draft))) this.closeEdit(id);
  }

  protected remove(id: string): void {
    void this.#write(voiceTarget(id), () => this.#api.delete(id));
  }

  protected openEdit(id: string): void {
    this.writes.clearError(voiceTarget(id));
    this.editing.set(id);
  }

  protected closeEdit(id: string): void {
    this.editing.set(null);
    this.writes.clearError(voiceTarget(id));
    this.#focus.to(`edit-voice:${id}`);
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    return this.writes.run(target, call, () => reread(this.voices, () => this.#api.list()));
  }
}
