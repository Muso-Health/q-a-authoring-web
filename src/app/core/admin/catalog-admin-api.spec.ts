import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { IDS } from '../catalog/testing/catalog-fixtures';
import { CatalogAdminApi } from './catalog-admin-api';

function setUp() {
  const api = new FakeApiPort({});
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, catalog: TestBed.inject(CatalogAdminApi) };
}

describe('CatalogAdminApi', () => {
  it('creates a project in its base language, leaving out a description it was not given', async () => {
    const { api, catalog } = setUp();

    await catalog.createProject({ name: 'Nutrition', description: null }, IDS.bm);
    await catalog.createProject({ name: 'Santé', description: 'Pour les ASC' }, IDS.fr);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/projects', body: { name: 'Nutrition', base_language_id: IDS.bm } },
      {
        method: 'POST',
        path: '/projects',
        body: { name: 'Santé', description: 'Pour les ASC', base_language_id: IDS.fr },
      },
    ]);
  });

  it('edits only the name and description, a null description clearing it', async () => {
    const { api, catalog } = setUp();

    await catalog.updateProject(IDS.project, { name: 'Santé', description: null });
    await catalog.updateProtocol(IDS.protocol, { name: 'Paludisme', description: 'Saison' });
    await catalog.updateTheme(IDS.theme, { name: 'Prévention', description: null });

    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        path: `/projects/${IDS.project}`,
        body: { name: 'Santé', description: null },
      },
      {
        method: 'PATCH',
        path: `/protocols/${IDS.protocol}`,
        body: { name: 'Paludisme', description: 'Saison' },
      },
      {
        method: 'PATCH',
        path: `/themes/${IDS.theme}`,
        body: { name: 'Prévention', description: null },
      },
    ]);
  });

  it('creates protocols under a project and themes under a protocol', async () => {
    const { api, catalog } = setUp();

    await catalog.createProtocol(IDS.project, { name: 'Paludisme', description: null });
    await catalog.createTheme(IDS.protocol, { name: 'Prévention', description: 'Moustiquaires' });

    expect(api.writes).toEqual([
      { method: 'POST', path: `/projects/${IDS.project}/protocols`, body: { name: 'Paludisme' } },
      {
        method: 'POST',
        path: `/protocols/${IDS.protocol}/themes`,
        body: { name: 'Prévention', description: 'Moustiquaires' },
      },
    ]);
  });

  it('deletes at every level', async () => {
    const { api, catalog } = setUp();

    await catalog.deleteProject(IDS.project);
    await catalog.deleteProtocol(IDS.protocol);
    await catalog.deleteTheme(IDS.theme);

    expect(api.calls).toEqual([
      `DELETE /projects/${IDS.project}`,
      `DELETE /protocols/${IDS.protocol}`,
      `DELETE /themes/${IDS.theme}`,
    ]);
  });

  it('adds a catalogue language to a project, and removes one', async () => {
    const { api, catalog } = setUp();

    await catalog.addProjectLanguage(IDS.project, IDS.wo);
    await catalog.removeProjectLanguage(IDS.project, IDS.ff);

    expect(api.writes).toEqual([
      { method: 'PUT', path: `/projects/${IDS.project}/languages/${IDS.wo}`, body: undefined },
      { method: 'DELETE', path: `/projects/${IDS.project}/languages/${IDS.ff}`, body: undefined },
    ]);
  });

  it('adds a code-switching language: creates (or reuses) base + other, then adds it to the project', async () => {
    const { api, catalog } = setUp();
    const cs = 'aaaaaaaa-0000-0000-0000-0000000000c5';
    api.answers['POST /languages/code-switching'] = {
      id: cs,
      code: 'fr_bm',
      name: 'Français + Bambara',
      kind: 'code_switching',
      component_language_ids: [IDS.bm, IDS.fr],
    };

    await catalog.addCodeSwitchingLanguage(
      IDS.project,
      { id: IDS.fr, code: 'fr', name: 'Français' },
      { id: IDS.bm, code: 'bm', name: 'Bambara' },
    );

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/languages/code-switching',
        body: {
          code: 'fr_bm',
          name: 'Français + Bambara',
          language_a_id: IDS.fr,
          language_b_id: IDS.bm,
        },
      },
      { method: 'PUT', path: `/projects/${IDS.project}/languages/${cs}`, body: undefined },
    ]);
  });
});
