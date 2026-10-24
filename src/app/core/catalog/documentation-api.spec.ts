import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { DocumentationApi } from './documentation-api';
import { IDS } from './testing/catalog-fixtures';
import { DOC_IDS, DOCUMENTS, SIGNED_URL } from './testing/documentation-fixtures';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, docs: TestBed.inject(DocumentationApi) };
}

describe('DocumentationApi', () => {
  it('lists a theme’s documents', async () => {
    const { docs } = setUp({ [`/themes/${IDS.theme}/documentation`]: DOCUMENTS });

    expect((await docs.list(IDS.theme))[0]).toEqual({
      id: DOC_IDS.guide,
      filename: 'guide-paludisme.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1_520_000,
      createdAt: '2026-10-03T09:30:00Z',
    });
  });

  it('uploads a document as the multipart `file`, and deletes one', async () => {
    const { api, docs } = setUp();
    const file = new File(['%PDF'], 'guide.pdf', { type: 'application/pdf' });

    await docs.upload(IDS.theme, file);
    await docs.remove(IDS.theme, DOC_IDS.guide);

    expect(api.calls).toEqual([
      `POST /themes/${IDS.theme}/documentation`,
      `DELETE /themes/${IDS.theme}/documentation/${DOC_IDS.guide}`,
    ]);
    const sent = (api.writes[0].body as FormData).get('file') as File;
    expect(sent.name).toBe('guide.pdf');
    expect(sent.type).toBe('application/pdf');
  });

  it('asks for a fresh signed download URL', async () => {
    const { docs } = setUp({
      [`/documentation/${DOC_IDS.guide}/download-url`]: {
        url: SIGNED_URL,
        expires_at: '2026-10-24T12:00:00Z',
      },
    });

    expect(await docs.downloadUrl(DOC_IDS.guide)).toBe(SIGNED_URL);
  });

  it('runs the completeness analysis', async () => {
    const { api, docs } = setUp({
      [`POST /themes/${IDS.theme}/completeness`]: { uncovered_notions: ['Dosage de la CTA'] },
    });

    expect(await docs.completeness(IDS.theme)).toEqual(['Dosage de la CTA']);
    expect(api.writes).toEqual([
      { method: 'POST', path: `/themes/${IDS.theme}/completeness`, body: null },
    ]);
  });
});
