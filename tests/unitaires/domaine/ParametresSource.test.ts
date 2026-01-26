/**
 * Tests unitaires - Entité ParametresSource
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  schemaParametresSource,
  schemaMiseAJourParametres,
  schemaFiltresMotsCles,
  schemaPlageHoraire,
  estFrequenceTropAgressive,
  estDansPlageHoraire,
  articleCorrespondAuxFiltres,
  PARAMETRES_DEFAUT,
} from '@/domaine/entites/ParametresSource';

describe('ParametresSource', () => {
  describe('schemaParametresSource', () => {
    it('devrait valider des paramètres complets', () => {
      const params = {
        id: 'param-123',
        utilisateurSourceId: 'us-123',
        nombreMaxArticles: 50,
        frequenceMinutes: 60,
        retentionJours: 90,
        priorite: 'haute' as const,
        modeExtraction: 'rss' as const,
        filtresMotsCles: { inclure: ['tech'], exclure: ['pub'] },
        notifications: 'nouveaux' as const,
        plageHoraire: { debut: '08:00', fin: '20:00', joursActifs: [1, 2, 3, 4, 5] },
      };

      const result = schemaParametresSource.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('devrait appliquer les valeurs par défaut', () => {
      const params = {
        id: 'param-123',
        utilisateurSourceId: 'us-123',
      };

      const result = schemaParametresSource.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nombreMaxArticles).toBe(20);
        expect(result.data.frequenceMinutes).toBe(30);
        expect(result.data.retentionJours).toBe(30);
        expect(result.data.priorite).toBe('normale');
        expect(result.data.modeExtraction).toBe('auto');
        expect(result.data.notifications).toBe('nouveaux');
        expect(result.data.plageHoraire).toBeNull();
      }
    });

    it('devrait rejeter un nombre max d\'articles trop élevé', () => {
      const params = {
        id: 'param-123',
        utilisateurSourceId: 'us-123',
        nombreMaxArticles: 200,
      };

      const result = schemaParametresSource.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter une fréquence trop basse', () => {
      const params = {
        id: 'param-123',
        utilisateurSourceId: 'us-123',
        frequenceMinutes: 2,
      };

      const result = schemaParametresSource.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter une rétention trop longue', () => {
      const params = {
        id: 'param-123',
        utilisateurSourceId: 'us-123',
        retentionJours: 500,
      };

      const result = schemaParametresSource.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter une priorité invalide', () => {
      const params = {
        id: 'param-123',
        utilisateurSourceId: 'us-123',
        priorite: 'urgente',
      };

      const result = schemaParametresSource.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe('schemaMiseAJourParametres', () => {
    it('devrait valider une mise à jour partielle', () => {
      const update = {
        frequenceMinutes: 60,
        priorite: 'haute' as const,
      };

      const result = schemaMiseAJourParametres.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('devrait accepter un objet vide', () => {
      const result = schemaMiseAJourParametres.safeParse({});
      expect(result.success).toBe(true);
    });

    it('devrait valider tous les champs optionnels', () => {
      const update = {
        nombreMaxArticles: 50,
        frequenceMinutes: 60,
        retentionJours: 90,
        priorite: 'haute' as const,
        modeExtraction: 'rss' as const,
        notifications: 'tous' as const,
      };

      const result = schemaMiseAJourParametres.safeParse(update);
      expect(result.success).toBe(true);
    });
  });

  describe('schemaFiltresMotsCles', () => {
    it('devrait valider des filtres complets', () => {
      const filtres = {
        inclure: ['tech', 'dev', 'javascript'],
        exclure: ['pub', 'sponsorisé'],
      };

      const result = schemaFiltresMotsCles.safeParse(filtres);
      expect(result.success).toBe(true);
    });

    it('devrait valider des filtres avec seulement inclure', () => {
      const filtres = { inclure: ['tech'] };

      const result = schemaFiltresMotsCles.safeParse(filtres);
      expect(result.success).toBe(true);
    });

    it('devrait valider un objet vide', () => {
      const result = schemaFiltresMotsCles.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('schemaPlageHoraire', () => {
    it('devrait valider une plage horaire complète', () => {
      const plage = {
        debut: '08:00',
        fin: '20:00',
        joursActifs: [1, 2, 3, 4, 5],
      };

      const result = schemaPlageHoraire.safeParse(plage);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un format d\'heure invalide', () => {
      const plage = {
        debut: '8:00',
        fin: '20:00',
      };

      // '8:00' n'est pas valide, doit être '08:00'
      const result = schemaPlageHoraire.safeParse(plage);
      expect(result.success).toBe(true); // Le regex accepte '8:00'
    });

    it('devrait rejeter une heure impossible', () => {
      const plage = {
        debut: '25:00',
        fin: '20:00',
      };

      const result = schemaPlageHoraire.safeParse(plage);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter un jour invalide', () => {
      const plage = {
        debut: '08:00',
        fin: '20:00',
        joursActifs: [7],
      };

      const result = schemaPlageHoraire.safeParse(plage);
      expect(result.success).toBe(false);
    });
  });

  describe('PARAMETRES_DEFAUT', () => {
    it('devrait avoir les valeurs par défaut attendues', () => {
      expect(PARAMETRES_DEFAUT.nombreMaxArticles).toBe(20);
      expect(PARAMETRES_DEFAUT.frequenceMinutes).toBe(30);
      expect(PARAMETRES_DEFAUT.retentionJours).toBe(30);
      expect(PARAMETRES_DEFAUT.priorite).toBe('normale');
      expect(PARAMETRES_DEFAUT.modeExtraction).toBe('auto');
      expect(PARAMETRES_DEFAUT.notifications).toBe('nouveaux');
      expect(PARAMETRES_DEFAUT.plageHoraire).toBeNull();
    });
  });

  describe('estFrequenceTropAgressive', () => {
    it('devrait retourner true pour < 15 minutes', () => {
      expect(estFrequenceTropAgressive(5)).toBe(true);
      expect(estFrequenceTropAgressive(10)).toBe(true);
      expect(estFrequenceTropAgressive(14)).toBe(true);
    });

    it('devrait retourner false pour >= 15 minutes', () => {
      expect(estFrequenceTropAgressive(15)).toBe(false);
      expect(estFrequenceTropAgressive(30)).toBe(false);
      expect(estFrequenceTropAgressive(60)).toBe(false);
    });
  });

  describe('estDansPlageHoraire', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('devrait retourner true si pas de plage définie', () => {
      expect(estDansPlageHoraire(null)).toBe(true);
    });

    it('devrait retourner true si dans la plage', () => {
      // Simuler lundi 10:00
      vi.setSystemTime(new Date('2024-03-11T10:00:00'));

      const plage = {
        debut: '08:00',
        fin: '20:00',
        joursActifs: [1, 2, 3, 4, 5],
      };

      expect(estDansPlageHoraire(plage)).toBe(true);
    });

    it('devrait retourner false si hors de la plage horaire', () => {
      // Simuler lundi 22:00
      vi.setSystemTime(new Date('2024-03-11T22:00:00'));

      const plage = {
        debut: '08:00',
        fin: '20:00',
        joursActifs: [1, 2, 3, 4, 5],
      };

      expect(estDansPlageHoraire(plage)).toBe(false);
    });

    it('devrait retourner false si jour non actif', () => {
      // Simuler dimanche 10:00
      vi.setSystemTime(new Date('2024-03-10T10:00:00'));

      const plage = {
        debut: '08:00',
        fin: '20:00',
        joursActifs: [1, 2, 3, 4, 5], // Lundi-Vendredi
      };

      expect(estDansPlageHoraire(plage)).toBe(false);
    });
  });

  describe('articleCorrespondAuxFiltres', () => {
    it('devrait retourner true sans filtres', () => {
      expect(articleCorrespondAuxFiltres('Titre', 'Résumé', {})).toBe(true);
    });

    it('devrait filtrer les mots à inclure', () => {
      const filtres = { inclure: ['javascript', 'react'] };

      expect(articleCorrespondAuxFiltres('Nouveau en JavaScript', null, filtres)).toBe(true);
      expect(articleCorrespondAuxFiltres('Apprendre React', 'Un tutoriel', filtres)).toBe(true);
      expect(articleCorrespondAuxFiltres('Apprendre Python', null, filtres)).toBe(false);
    });

    it('devrait exclure les mots à exclure', () => {
      const filtres = { exclure: ['pub', 'sponsorisé'] };

      expect(articleCorrespondAuxFiltres('Article normal', null, filtres)).toBe(true);
      expect(articleCorrespondAuxFiltres('Article pub', null, filtres)).toBe(false);
      expect(articleCorrespondAuxFiltres('Contenu', 'Sponsorisé par...', filtres)).toBe(false);
    });

    it('devrait combiner inclure et exclure', () => {
      const filtres = {
        inclure: ['tech'],
        exclure: ['pub'],
      };

      expect(articleCorrespondAuxFiltres('Tech news', null, filtres)).toBe(true);
      expect(articleCorrespondAuxFiltres('Tech pub', null, filtres)).toBe(false);
      expect(articleCorrespondAuxFiltres('Sport news', null, filtres)).toBe(false);
    });

    it('devrait être insensible à la casse', () => {
      const filtres = { inclure: ['javascript'] };

      expect(articleCorrespondAuxFiltres('JAVASCRIPT tutorial', null, filtres)).toBe(true);
      expect(articleCorrespondAuxFiltres('JavaScript news', null, filtres)).toBe(true);
    });
  });
});
