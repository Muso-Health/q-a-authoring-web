import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { Toolbar, type ToolbarAction } from './toolbar';

@Component({
  imports: [Toolbar],
  template: `<app-toolbar label="Outils de test" [actions]="actions()" />`,
})
class Host {
  readonly runs: string[] = [];
  readonly actions = signal<readonly ToolbarAction[]>([
    { id: 'edit', icon: 'edit', label: 'Modifier', handler: () => this.runs.push('edit') },
    {
      id: 'audio',
      icon: 'audio',
      label: 'Gérer l’audio',
      disabled: true,
      handler: () => this.runs.push('audio'),
    },
    { id: 'delete', icon: 'delete', label: 'Supprimer', handler: () => this.runs.push('delete') },
  ]);
}

describe('Toolbar', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    onTestFinished(() => fixture.nativeElement.remove());
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('button')];
    return { fixture, host: fixture.componentInstance, element, buttons };
  }

  it('is a labelled toolbar of icon-only buttons, each named by its tool', async () => {
    const { element, buttons } = await render();

    const bar = element.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Outils de test');
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Modifier',
      'Gérer l’audio',
      'Supprimer',
    ]);
    for (const button of buttons()) {
      expect(button.textContent?.trim()).toBe('');
      expect(button.querySelector('svg, img')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('shows each tool’s name as its tooltip', async () => {
    const { fixture } = await render();

    const tooltips = fixture.debugElement
      .queryAll(By.directive(MatTooltip))
      .map((node) => node.injector.get(MatTooltip).message);
    expect(tooltips).toEqual(['Modifier', 'Gérer l’audio', 'Supprimer']);
  });

  it('runs a tool’s handler on click', async () => {
    const { host, buttons } = await render();

    buttons()[0].click();
    buttons()[2].click();

    expect(host.runs).toEqual(['edit', 'delete']);
  });

  it('keeps a disabled tool focusable and named, but never runs it', async () => {
    const { host, buttons } = await render();
    const audio = buttons()[1];

    audio.focus();
    audio.click();

    expect(document.activeElement).toBe(audio);
    expect(audio.getAttribute('aria-disabled')).toBe('true');
    expect(host.runs).toEqual([]);
  });

  it('is reachable by Tab, and arrows move between its tools', async () => {
    const { buttons } = await render();

    expect(buttons().every((b) => b.tabIndex === 0)).toBe(true);
    buttons()[0].focus();
    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons()[1]);
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons()[2]);
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons()[0]);
  });
});
