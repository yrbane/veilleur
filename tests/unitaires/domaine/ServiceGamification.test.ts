/**
 * Veilleur - Gamification : points, niveaux, badges, série, classement
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculerSerie,
  calculerPoints,
  calculerNiveau,
  calculerBadges,
  calculerProgression,
  ServiceGamification,
  NIVEAUX,
} from '@/domaine/services/ServiceGamification';
import type { StatistiquesUtilisateur } from '@/domaine/ports/DepotStatistiquesUtilisateur';

const AUJOURDHUI = new Date('2026-10-21T12:00:00Z');

function stats(partiel: Partial<StatistiquesUtilisateur> = {}): StatistiquesUtilisateur {
  return {
    utilisateurId: 'u1',
    articlesLus: 0,
    articlesNotes: 0,
    favoris: 0,
    aLire: 0,
    sources: 0,
    rubriques: 0,
    joursLecture: [],
    lecturesAvant8h: 0,
    maxLecturesParJour: 0,
    dateInscription: new Date('2026-09-01T00:00:00Z'),
    ...partiel,
  };
}

describe('calculerSerie', () => {
  it('compte les jours consécutifs jusqu\'à aujourd\'hui', () => {
    const serie = calculerSerie(['2026-10-21', '2026-10-20', '2026-10-19', '2026-10-10'], AUJOURDHUI);
    expect(serie).toEqual({ courante: 3, record: 3, activeAujourdhui: true });
  });

  it('tient encore si la dernière lecture date d\'hier, et tombe à zéro au-delà', () => {
    expect(calculerSerie(['2026-10-20', '2026-10-19'], AUJOURDHUI)).toEqual({ courante: 2, record: 2, activeAujourdhui: false });
    expect(calculerSerie(['2026-10-18', '2026-10-17'], AUJOURDHUI).courante).toBe(0);
  });

  it('garde le record d\'une série passée plus longue', () => {
    const serie = calculerSerie(['2026-10-21', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], AUJOURDHUI);
    expect(serie.courante).toBe(1);
    expect(serie.record).toBe(4);
  });

  it('est vide sans lecture', () => {
    expect(calculerSerie([], AUJOURDHUI)).toEqual({ courante: 0, record: 0, activeAujourdhui: false });
  });
});

describe('calculerPoints', () => {
  it('additionne chaque activité à son barème', () => {
    const { points, detail } = calculerPoints(stats({ articlesLus: 10, articlesNotes: 2, favoris: 3, aLire: 4, sources: 5, rubriques: 2, joursLecture: ['2026-10-20', '2026-10-21'] }));
    expect(points).toBe(10 * 1 + 2 * 3 + 3 * 2 + 4 * 1 + 5 * 5 + 2 * 2 + 2 * 3);
    expect(detail.find(d => d.libelle === 'Sources suivies')).toEqual({ libelle: 'Sources suivies', nombre: 5, parUnite: 5, total: 25 });
  });
});

describe('calculerNiveau', () => {
  it('place les points sur l\'échelle avec l\'avancement vers le suivant', () => {
    expect(calculerNiveau(0)).toMatchObject({ numero: 1, nom: 'Éclaireur', prochainSeuil: 50, progression: 0 });
    expect(calculerNiveau(125)).toMatchObject({ numero: 2, nom: 'Lecteur', prochainSeuil: 200, progression: 50 });
    expect(calculerNiveau(3000)).toMatchObject({ numero: NIVEAUX.length, nom: 'Oracle', prochainSeuil: null, progression: 100 });
  });
});

describe('calculerBadges', () => {
  it('marque les badges obtenus et l\'avancement des autres', () => {
    const badges = calculerBadges(stats({ articlesLus: 50, sources: 10, lecturesAvant8h: 2 }), { courante: 3, record: 8, activeAujourdhui: true });
    const parCode = Object.fromEntries(badges.map(b => [b.code, b]));
    expect(parCode['premiere-lecture']).toMatchObject({ obtenu: true, progression: 100 });
    expect(parCode['lecteur-assidu']).toMatchObject({ obtenu: false, progression: 50 });
    expect(parCode['curieux']!.obtenu).toBe(true);
    expect(parCode['leve-tot']).toMatchObject({ obtenu: false, progression: 20 });
    expect(parCode['regulier']!.obtenu).toBe(true);
    expect(parCode['inarretable']).toMatchObject({ obtenu: false, progression: 26 });
  });
});

describe('ServiceGamification', () => {
  it('renvoie la progression complète d\'un utilisateur, ou null s\'il est inconnu', async () => {
    const depot = {
      obtenir: vi.fn(async (id: string) => (id === 'u1' ? stats({ articlesLus: 3, joursLecture: ['2026-10-21'] }) : null)),
      listerParticipantsClassement: vi.fn(),
    };
    const service = new ServiceGamification(depot);

    const progression = await service.obtenirProgression('u1', AUJOURDHUI);
    expect(progression).toMatchObject({ points: 6, niveau: { nom: 'Éclaireur' }, serie: { courante: 1 } });
    expect(progression!.badges.find(b => b.code === 'premiere-lecture')!.obtenu).toBe(true);
    expect(await service.obtenirProgression('inconnu', AUJOURDHUI)).toBeNull();
  });

  it('classe les volontaires par points puis badges, limité à vingt, et met en cache', async () => {
    const participants = [
      { utilisateurId: 'a', pseudo: 'Alice', statistiques: stats({ articlesLus: 10 }) },
      { utilisateurId: 'b', pseudo: 'Bob', statistiques: stats({ sources: 10 }) },
      { utilisateurId: 'c', pseudo: 'Chloé', statistiques: stats({ articlesLus: 10 }) },
    ];
    const depot = { obtenir: vi.fn(), listerParticipantsClassement: vi.fn().mockResolvedValue(participants) };
    const cache = { obtenir: vi.fn().mockResolvedValue(null), stocker: vi.fn() };

    const classement = await new ServiceGamification(depot, cache).obtenirClassement(AUJOURDHUI);

    expect(classement.map(l => [l.rang, l.pseudo, l.points])).toEqual([[1, 'Bob', 50], [2, 'Alice', 10], [3, 'Chloé', 10]]);
    expect(classement[1]).toMatchObject({ niveau: 'Éclaireur', badges: 1, serie: 0 });
    expect(cache.stocker).toHaveBeenCalledWith('utilisateur:classement', classement, { ttl: 600 });

    const beaucoup = Array.from({ length: 25 }, (_, i) => ({ utilisateurId: String(i), pseudo: `P${i}`, statistiques: stats({ articlesLus: i }) }));
    expect(ServiceGamification.classer(beaucoup, AUJOURDHUI)).toHaveLength(20);
  });

  it('calculerProgression expose les statistiques brutes', () => {
    const s = stats({ favoris: 2 });
    expect(calculerProgression(s, AUJOURDHUI).statistiques).toBe(s);
  });
});
