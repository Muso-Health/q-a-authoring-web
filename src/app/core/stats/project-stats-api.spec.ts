import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { IDS } from '../catalog/testing/catalog-fixtures';
import { ProjectStatsApi } from './project-stats-api';
import { STATS } from './testing/stats-fixtures';

function setUp(answers: Record<string, unknown>) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, stats: TestBed.inject(ProjectStatsApi) };
}

describe('ProjectStatsApi', () => {
  it('reads a project’s figures from its stats endpoint', async () => {
    const { api, stats } = setUp({ [`/projects/${IDS.project}/stats`]: STATS });

    const figures = await stats.of(IDS.project);

    expect(api.reads).toEqual([`/projects/${IDS.project}/stats`]);
    expect(figures.counts).toEqual({ protocols: 2, themes: 5, concepts: 12 });
    expect(figures.coverage).toEqual({
      intent: { with: 8, without: 4 },
      category: { with: 11, without: 1 },
    });
    expect(figures.languages[1]).toEqual({
      id: IDS.en,
      code: 'en',
      name: 'English',
      isBase: false,
      present: 4,
      audio: { complete: 1, notComplete: 3 },
      validatedAudio: { complete: 0, notComplete: 4 },
      validation: { complete: 2, notComplete: 2 },
    });
  });

  it('puts the base language first, whatever order the engine answers in', async () => {
    const { stats } = setUp({
      [`/projects/${IDS.project}/stats`]: { ...STATS, languages: [...STATS.languages].reverse() },
    });

    const { languages } = await stats.of(IDS.project);

    expect(languages.map((l) => l.code)).toEqual(['fr', 'bm', 'en']);
  });
});
