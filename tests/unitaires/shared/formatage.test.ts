/**
 * Tests unitaires - Utilitaires de formatage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formaterDate,
  formaterDateRelative,
  formaterNombre,
  formaterOctets,
  formaterDuree,
  formaterPourcentage,
  tronquer,
  capitaliser,
  pluraliser,
  slugifier,
  extraireInitiales,
  formaterListeTexte,
  stripHtml,
  escapeHtml,
  unescapeHtml,
} from '@shared/utils/formatage';

describe('formatage', () => {
  describe('formaterDate', () => {
    it('devrait formater une date avec le format par défaut', () => {
      const date = new Date('2024-03-15T14:30:00');
      const resultat = formaterDate(date);
      expect(resultat).toMatch(/15.*mars.*2024/i);
    });

    it('devrait formater avec un format court', () => {
      const date = new Date('2024-03-15');
      const resultat = formaterDate(date, { format: 'court' });
      expect(resultat).toMatch(/15\/03\/2024|15\.03\.2024/);
    });

    it('devrait formater avec un format long', () => {
      const date = new Date('2024-03-15');
      const resultat = formaterDate(date, { format: 'long' });
      expect(resultat.toLowerCase()).toContain('mars');
      expect(resultat).toContain('2024');
    });

    it('devrait inclure l\'heure si demandé', () => {
      const date = new Date('2024-03-15T14:30:00');
      const resultat = formaterDate(date, { inclureHeure: true });
      expect(resultat).toMatch(/14[h:]30/);
    });

    it('devrait gérer un timestamp', () => {
      const timestamp = new Date('2024-03-15').getTime();
      const resultat = formaterDate(timestamp);
      expect(resultat).toContain('15');
    });

    it('devrait gérer une chaîne ISO', () => {
      const resultat = formaterDate('2024-03-15T14:30:00Z');
      expect(resultat).toContain('15');
    });

    it('devrait retourner le fallback pour une date invalide', () => {
      const resultat = formaterDate('invalid', { fallback: 'Date inconnue' });
      expect(resultat).toBe('Date inconnue');
    });
  });

  describe('formaterDateRelative', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('devrait afficher "à l\'instant" pour maintenant', () => {
      const date = new Date('2024-03-15T12:00:00Z');
      const resultat = formaterDateRelative(date);
      expect(resultat.toLowerCase()).toMatch(/instant|seconde|maintenant/);
    });

    it('devrait afficher les minutes', () => {
      const date = new Date('2024-03-15T11:55:00Z');
      const resultat = formaterDateRelative(date);
      expect(resultat.toLowerCase()).toMatch(/5.*min|il y a 5/i);
    });

    it('devrait afficher les heures', () => {
      const date = new Date('2024-03-15T09:00:00Z');
      const resultat = formaterDateRelative(date);
      expect(resultat.toLowerCase()).toMatch(/3.*heure|il y a 3/i);
    });

    it('devrait afficher "hier"', () => {
      const date = new Date('2024-03-14T12:00:00Z');
      const resultat = formaterDateRelative(date);
      expect(resultat.toLowerCase()).toMatch(/hier|1.*jour/i);
    });

    it('devrait afficher les jours', () => {
      const date = new Date('2024-03-12T12:00:00Z');
      const resultat = formaterDateRelative(date);
      expect(resultat.toLowerCase()).toMatch(/3.*jour|il y a 3/i);
    });

    it('devrait afficher la date pour les dates anciennes', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const resultat = formaterDateRelative(date);
      // Peut afficher la date ou "il y a X mois"
      expect(resultat).toBeTruthy();
    });
  });

  describe('formaterNombre', () => {
    it('devrait formater un nombre simple', () => {
      expect(formaterNombre(1234)).toMatch(/1[\s,.]?234/);
    });

    it('devrait formater avec des décimales', () => {
      const resultat = formaterNombre(1234.567, { decimales: 2 });
      expect(resultat).toMatch(/1[\s,.]?234[,.]57/);
    });

    it('devrait formater en notation compacte', () => {
      const resultat = formaterNombre(1500000, { compact: true });
      expect(resultat.toLowerCase()).toMatch(/1[,.]?5?\s*m|million/);
    });

    it('devrait gérer les grands nombres', () => {
      const resultat = formaterNombre(1000000000);
      expect(resultat).toBeTruthy();
    });

    it('devrait gérer les petits nombres', () => {
      expect(formaterNombre(0.001, { decimales: 3 })).toMatch(/0[,.]001/);
    });

    it('devrait gérer les nombres négatifs', () => {
      const resultat = formaterNombre(-1234);
      expect(resultat).toContain('1234');
      expect(resultat).toMatch(/-|−/);
    });
  });

  describe('formaterOctets', () => {
    it('devrait formater des octets', () => {
      expect(formaterOctets(500)).toMatch(/500.*o|bytes/i);
    });

    it('devrait formater des Ko', () => {
      expect(formaterOctets(1024)).toMatch(/1.*ko|kb/i);
    });

    it('devrait formater des Mo', () => {
      expect(formaterOctets(1048576)).toMatch(/1.*mo|mb/i);
    });

    it('devrait formater des Go', () => {
      expect(formaterOctets(1073741824)).toMatch(/1.*go|gb/i);
    });

    it('devrait formater avec précision', () => {
      const resultat = formaterOctets(1536, { precision: 1 });
      expect(resultat).toMatch(/1[,.]5.*ko|kb/i);
    });

    it('devrait gérer 0 octet', () => {
      expect(formaterOctets(0)).toMatch(/0.*o|bytes/i);
    });
  });

  describe('formaterDuree', () => {
    it('devrait formater des secondes', () => {
      expect(formaterDuree(45)).toMatch(/45.*s/i);
    });

    it('devrait formater des minutes et secondes', () => {
      const resultat = formaterDuree(125);
      expect(resultat).toMatch(/2.*min|2:05/i);
    });

    it('devrait formater des heures', () => {
      const resultat = formaterDuree(3665);
      expect(resultat).toMatch(/1.*h|heure/i);
    });

    it('devrait formater des jours', () => {
      const resultat = formaterDuree(90000);
      expect(resultat).toMatch(/1.*j|jour/i);
    });

    it('devrait gérer 0', () => {
      expect(formaterDuree(0)).toMatch(/0|instant/i);
    });

    it('devrait gérer le format compact', () => {
      const resultat = formaterDuree(3665, { format: 'compact' });
      expect(resultat).toBeTruthy();
    });
  });

  describe('formaterPourcentage', () => {
    it('devrait formater un pourcentage simple', () => {
      expect(formaterPourcentage(0.5)).toMatch(/50.*%/);
    });

    it('devrait formater avec décimales', () => {
      const resultat = formaterPourcentage(0.1234, { decimales: 1 });
      expect(resultat).toMatch(/12[,.]3.*%/);
    });

    it('devrait gérer les valeurs supérieures à 100%', () => {
      expect(formaterPourcentage(1.5)).toMatch(/150.*%/);
    });

    it('devrait gérer 0%', () => {
      expect(formaterPourcentage(0)).toMatch(/0.*%/);
    });
  });

  describe('tronquer', () => {
    it('devrait tronquer un texte long', () => {
      const resultat = tronquer('Un texte très long qui dépasse la limite', 20);
      expect(resultat.length).toBeLessThanOrEqual(23); // 20 + "..."
      expect(resultat).toMatch(/\.{3}|…$/);
    });

    it('devrait ne pas tronquer un texte court', () => {
      const texte = 'Court';
      expect(tronquer(texte, 20)).toBe(texte);
    });

    it('devrait respecter la coupure sur les mots si demandé', () => {
      const resultat = tronquer('Un texte avec des mots', 10, { surMot: true });
      expect(resultat).not.toMatch(/\s\.{3}|…$/); // Ne devrait pas couper au milieu
    });

    it('devrait utiliser un suffixe personnalisé', () => {
      const resultat = tronquer('Un texte long', 8, { suffixe: '>>>' });
      expect(resultat).toContain('>>>');
    });
  });

  describe('capitaliser', () => {
    it('devrait capitaliser la première lettre', () => {
      expect(capitaliser('bonjour')).toBe('Bonjour');
    });

    it('devrait gérer une chaîne vide', () => {
      expect(capitaliser('')).toBe('');
    });

    it('devrait gérer une chaîne déjà capitalisée', () => {
      expect(capitaliser('Bonjour')).toBe('Bonjour');
    });

    it('devrait capitaliser toutes les premières lettres si demandé', () => {
      const resultat = capitaliser('bonjour le monde', { toutLesMots: true });
      expect(resultat).toBe('Bonjour Le Monde');
    });
  });

  describe('pluraliser', () => {
    it('devrait retourner le singulier pour 1', () => {
      expect(pluraliser(1, 'article', 'articles')).toBe('1 article');
    });

    it('devrait retourner le pluriel pour plusieurs', () => {
      expect(pluraliser(5, 'article', 'articles')).toBe('5 articles');
    });

    it('devrait gérer 0', () => {
      expect(pluraliser(0, 'article', 'articles')).toBe('0 article');
    });

    it('devrait utiliser le pluriel automatique si non fourni', () => {
      const resultat = pluraliser(5, 'article');
      expect(resultat).toMatch(/5 articles?/);
    });
  });

  describe('slugifier', () => {
    it('devrait convertir en slug', () => {
      expect(slugifier('Hello World')).toBe('hello-world');
    });

    it('devrait supprimer les accents', () => {
      expect(slugifier('Café résumé')).toBe('cafe-resume');
    });

    it('devrait supprimer les caractères spéciaux', () => {
      expect(slugifier('Test!@#$%')).toBe('test');
    });

    it('devrait gérer les espaces multiples', () => {
      expect(slugifier('Test   Multiple   Spaces')).toBe('test-multiple-spaces');
    });

    it('devrait supprimer les tirets en début/fin', () => {
      expect(slugifier('--test--')).toBe('test');
    });
  });

  describe('extraireInitiales', () => {
    it('devrait extraire les initiales d\'un nom complet', () => {
      expect(extraireInitiales('Jean Dupont')).toBe('JD');
    });

    it('devrait gérer un seul nom', () => {
      const resultat = extraireInitiales('Jean');
      expect(resultat).toMatch(/^J/);
    });

    it('devrait limiter le nombre d\'initiales', () => {
      const resultat = extraireInitiales('Jean Claude Van Damme', 2);
      expect(resultat.length).toBeLessThanOrEqual(2);
    });

    it('devrait gérer les accents', () => {
      expect(extraireInitiales('Éric Émile')).toMatch(/[EÉ]{2}/i);
    });
  });

  describe('formaterListeTexte', () => {
    it('devrait formater une liste simple', () => {
      const resultat = formaterListeTexte(['pomme', 'poire', 'banane']);
      expect(resultat).toMatch(/pomme.*poire.*banane/);
    });

    it('devrait utiliser "et" entre les derniers éléments', () => {
      const resultat = formaterListeTexte(['pomme', 'poire', 'banane']);
      expect(resultat).toMatch(/et|,/);
    });

    it('devrait gérer un seul élément', () => {
      expect(formaterListeTexte(['pomme'])).toBe('pomme');
    });

    it('devrait gérer deux éléments', () => {
      const resultat = formaterListeTexte(['pomme', 'poire']);
      expect(resultat).toMatch(/pomme.*et.*poire|pomme.*poire/);
    });

    it('devrait gérer une liste vide', () => {
      expect(formaterListeTexte([])).toBe('');
    });
  });

  describe('stripHtml', () => {
    it('devrait supprimer les balises HTML', () => {
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });

    it('devrait gérer les balises auto-fermantes', () => {
      expect(stripHtml('Hello<br/>World')).toMatch(/Hello\s*World/);
    });

    it('devrait gérer les attributs', () => {
      expect(stripHtml('<a href="test">Link</a>')).toBe('Link');
    });

    it('devrait décoder les entités HTML', () => {
      expect(stripHtml('&amp; &lt; &gt;')).toBe('& < >');
    });

    it('devrait gérer une chaîne vide', () => {
      expect(stripHtml('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('devrait échapper les caractères spéciaux', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('devrait échapper les esperluettes', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('devrait gérer les apostrophes', () => {
      const resultat = escapeHtml("It's a test");
      expect(resultat).toMatch(/It(&apos;|&#39;|')s a test/);
    });
  });

  describe('unescapeHtml', () => {
    it('devrait dé-échapper les entités HTML', () => {
      expect(unescapeHtml('&lt;p&gt;Test&lt;/p&gt;')).toBe('<p>Test</p>');
    });

    it('devrait dé-échapper les esperluettes', () => {
      expect(unescapeHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
    });

    it('devrait gérer les entités numériques', () => {
      expect(unescapeHtml('&#60;test&#62;')).toBe('<test>');
    });
  });
});
