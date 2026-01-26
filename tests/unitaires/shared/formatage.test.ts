/**
 * Tests unitaires - Utilitaires de formatage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatageRelatif,
  formatageDateCourt,
  formatageDateLong,
  formatageDateMoyen,
  formatageDateHeure,
  formattageHeure,
  formatageDuree,
  formatageDureeCourt,
  formatageNombre,
  formatageNombreAbrege,
  formatagePourcentage,
  formatageMonnaie,
  formatageOrdinal,
  formatageTaille,
  tronquer,
  tronquerMot,
  slugify,
  majuscule,
  majusculeChaqueMot,
  labeliser,
  pluriel,
  avecUnite,
  initiales,
  sansBalisesHtml,
  echapperHtml,
  formatageListe,
  extraireDomaine,
  formatageUrl,
  format,
} from '@shared/utils/formatage';

describe('formatage', () => {
  describe('formatageDateCourt', () => {
    it('devrait formater une date en format court', () => {
      const date = new Date('2024-03-15');
      const resultat = formatageDateCourt(date);
      expect(resultat).toMatch(/15\/03\/2024/);
    });

    it('devrait gérer un timestamp', () => {
      const timestamp = new Date('2024-03-15').getTime();
      const resultat = formatageDateCourt(timestamp);
      expect(resultat).toContain('15');
    });

    it('devrait gérer une chaîne ISO', () => {
      const resultat = formatageDateCourt('2024-03-15T14:30:00Z');
      expect(resultat).toContain('15');
    });
  });

  describe('formatageDateLong', () => {
    it('devrait formater avec un format long', () => {
      const date = new Date('2024-03-15');
      const resultat = formatageDateLong(date);
      expect(resultat.toLowerCase()).toContain('mars');
      expect(resultat).toContain('2024');
    });
  });

  describe('formatageDateMoyen', () => {
    it('devrait formater en format moyen', () => {
      const date = new Date('2024-03-15');
      const resultat = formatageDateMoyen(date);
      expect(resultat).toContain('2024');
    });
  });

  describe('formatageDateHeure', () => {
    it('devrait inclure l\'heure', () => {
      const date = new Date('2024-03-15T14:30:00');
      const resultat = formatageDateHeure(date);
      expect(resultat).toMatch(/14[h:]30/);
    });
  });

  describe('formattageHeure', () => {
    it('devrait formater l\'heure', () => {
      const date = new Date('2024-03-15T14:30:00');
      const resultat = formattageHeure(date);
      expect(resultat).toMatch(/14[h:]30/);
    });
  });

  describe('formatageRelatif', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('devrait afficher "à l\'instant" pour maintenant', () => {
      const date = new Date('2024-03-15T12:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/instant/);
    });

    it('devrait afficher les secondes', () => {
      const date = new Date('2024-03-15T11:59:30Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/secondes/);
    });

    it('devrait afficher les minutes', () => {
      const date = new Date('2024-03-15T11:55:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/5.*minutes/i);
    });

    it('devrait afficher les heures', () => {
      const date = new Date('2024-03-15T09:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/3.*heures/i);
    });

    it('devrait afficher "hier"', () => {
      const date = new Date('2024-03-14T12:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toBe('hier');
    });

    it('devrait afficher les jours', () => {
      const date = new Date('2024-03-12T12:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/3.*jours/i);
    });

    it('devrait afficher les semaines', () => {
      const date = new Date('2024-03-01T12:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/semaine/);
    });

    it('devrait afficher les mois', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/mois/);
    });

    it('devrait afficher les années', () => {
      const date = new Date('2022-03-15T12:00:00Z');
      const resultat = formatageRelatif(date);
      expect(resultat.toLowerCase()).toMatch(/ans/);
    });
  });

  describe('formatageNombre', () => {
    it('devrait formater un nombre simple', () => {
      const resultat = formatageNombre(1234);
      // Format français avec espace insécable
      expect(resultat.replace(/\s/g, '')).toBe('1234');
    });

    it('devrait formater avec des décimales', () => {
      const resultat = formatageNombre(1234.56, 2);
      // Format français avec espace insécable ou fin
      expect(resultat.replace(/\s/g, '')).toContain('1234');
      expect(resultat).toContain('56');
    });

    it('devrait gérer les grands nombres', () => {
      const resultat = formatageNombre(1000000);
      expect(resultat.replace(/\s/g, '')).toBe('1000000');
    });

    it('devrait gérer les nombres négatifs', () => {
      const resultat = formatageNombre(-1234);
      expect(resultat).toContain('-');
    });
  });

  describe('formatageNombreAbrege', () => {
    it('devrait formater en k pour les milliers', () => {
      const resultat = formatageNombreAbrege(1500);
      expect(resultat).toBe('1.5k');
    });

    it('devrait formater en M pour les millions', () => {
      const resultat = formatageNombreAbrege(2500000);
      expect(resultat).toBe('2.5M');
    });

    it('devrait formater en Md pour les milliards', () => {
      const resultat = formatageNombreAbrege(3000000000);
      expect(resultat).toBe('3Md');
    });

    it('devrait laisser les petits nombres tels quels', () => {
      const resultat = formatageNombreAbrege(500);
      expect(resultat).toBe('500');
    });
  });

  describe('formatagePourcentage', () => {
    it('devrait formater un pourcentage', () => {
      const resultat = formatagePourcentage(0.75);
      expect(resultat).toContain('75');
      expect(resultat).toContain('%');
    });

    it('devrait formater avec des décimales', () => {
      const resultat = formatagePourcentage(0.7567, 2);
      expect(resultat).toContain('75');
    });
  });

  describe('formatageMonnaie', () => {
    it('devrait formater en euros par défaut', () => {
      const resultat = formatageMonnaie(42.5);
      expect(resultat).toContain('42');
      expect(resultat).toMatch(/€|EUR/);
    });
  });

  describe('formatageOrdinal', () => {
    it('devrait retourner 1er pour 1', () => {
      expect(formatageOrdinal(1)).toBe('1er');
    });

    it('devrait retourner 2e pour 2', () => {
      expect(formatageOrdinal(2)).toBe('2e');
    });
  });

  describe('formatageTaille', () => {
    it('devrait formater des octets', () => {
      expect(formatageTaille(500)).toBe('500 o');
    });

    it('devrait formater des Ko', () => {
      expect(formatageTaille(1024)).toBe('1 Ko');
    });

    it('devrait formater des Mo', () => {
      expect(formatageTaille(1048576)).toBe('1 Mo');
    });

    it('devrait formater des Go', () => {
      expect(formatageTaille(1073741824)).toBe('1 Go');
    });

    it('devrait formater avec précision', () => {
      expect(formatageTaille(1536, 1)).toBe('1.5 Ko');
    });

    it('devrait gérer 0 octet', () => {
      expect(formatageTaille(0)).toBe('0 o');
    });
  });

  describe('formatageDuree', () => {
    it('devrait formater des millisecondes', () => {
      expect(formatageDuree(500)).toBe('500ms');
    });

    it('devrait formater des secondes', () => {
      expect(formatageDuree(3000)).toBe('3s');
    });

    it('devrait formater des minutes et secondes', () => {
      expect(formatageDuree(90000)).toBe('1min 30s');
    });

    it('devrait formater des heures', () => {
      expect(formatageDuree(3600000)).toBe('1h');
    });

    it('devrait formater des jours', () => {
      expect(formatageDuree(86400000)).toBe('1j');
    });
  });

  describe('formatageDureeCourt', () => {
    it('devrait formater en format court', () => {
      expect(formatageDureeCourt(90000)).toBe('01:30');
    });

    it('devrait inclure les heures si nécessaire', () => {
      expect(formatageDureeCourt(3661000)).toBe('1:01:01');
    });
  });

  describe('tronquer', () => {
    it('devrait tronquer un texte long', () => {
      const resultat = tronquer('Ceci est un texte très long', 15);
      expect(resultat).toBe('Ceci est un te…');
      expect(resultat.length).toBe(15);
    });

    it('devrait laisser un texte court intact', () => {
      const resultat = tronquer('Court', 20);
      expect(resultat).toBe('Court');
    });

    it('devrait utiliser un suffixe personnalisé', () => {
      const resultat = tronquer('Texte long', 8, '...');
      expect(resultat).toBe('Texte...');
    });
  });

  describe('tronquerMot', () => {
    it('devrait tronquer au dernier mot entier', () => {
      const resultat = tronquerMot('Ceci est un texte très long', 20);
      expect(resultat).not.toMatch(/\s…$/);
    });
  });

  describe('slugify', () => {
    it('devrait convertir en minuscules', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('devrait retirer les accents', () => {
      expect(slugify('Café résumé')).toBe('cafe-resume');
    });

    it('devrait remplacer les espaces par des tirets', () => {
      expect(slugify('un deux trois')).toBe('un-deux-trois');
    });

    it('devrait retirer les caractères spéciaux', () => {
      expect(slugify('test@#$%test')).toBe('testtest');
    });
  });

  describe('majuscule', () => {
    it('devrait mettre en majuscule la première lettre', () => {
      expect(majuscule('hello')).toBe('Hello');
    });

    it('devrait gérer une chaîne vide', () => {
      expect(majuscule('')).toBe('');
    });
  });

  describe('majusculeChaqueMot', () => {
    it('devrait mettre en majuscule chaque mot', () => {
      expect(majusculeChaqueMot('hello world')).toBe('Hello World');
    });
  });

  describe('labeliser', () => {
    it('devrait convertir camelCase en label', () => {
      expect(labeliser('nomUtilisateur')).toBe('Nom utilisateur');
    });

    it('devrait convertir snake_case en label', () => {
      expect(labeliser('nom_utilisateur')).toBe('Nom utilisateur');
    });
  });

  describe('pluriel', () => {
    it('devrait retourner le singulier pour 0 ou 1', () => {
      expect(pluriel(0, 'article')).toBe('article');
      expect(pluriel(1, 'article')).toBe('article');
    });

    it('devrait retourner le pluriel pour > 1', () => {
      expect(pluriel(2, 'article')).toBe('articles');
    });

    it('devrait utiliser un pluriel personnalisé', () => {
      expect(pluriel(2, 'cheval', 'chevaux')).toBe('chevaux');
    });
  });

  describe('avecUnite', () => {
    it('devrait combiner nombre et unité au pluriel', () => {
      expect(avecUnite(5, 'article')).toContain('5');
      expect(avecUnite(5, 'article')).toContain('articles');
    });
  });

  describe('initiales', () => {
    it('devrait extraire les initiales', () => {
      expect(initiales('Jean Dupont')).toBe('JD');
    });

    it('devrait respecter la limite', () => {
      expect(initiales('Jean Pierre Dupont', 2)).toBe('JP');
    });
  });

  describe('sansBalisesHtml', () => {
    it('devrait retirer les balises HTML', () => {
      expect(sansBalisesHtml('<p>Texte <strong>formaté</strong></p>')).toBe('Texte formaté');
    });
  });

  describe('echapperHtml', () => {
    it('devrait échapper les caractères spéciaux', () => {
      expect(echapperHtml('<script>')).toBe('&lt;script&gt;');
      expect(echapperHtml('"test"')).toBe('&quot;test&quot;');
      expect(echapperHtml("'test'")).toBe('&#039;test&#039;');
      expect(echapperHtml('A & B')).toBe('A &amp; B');
    });
  });

  describe('formatageListe', () => {
    it('devrait retourner vide pour liste vide', () => {
      expect(formatageListe([])).toBe('');
    });

    it('devrait retourner l\'élément seul', () => {
      expect(formatageListe(['un'])).toBe('un');
    });

    it('devrait joindre deux éléments avec "et"', () => {
      expect(formatageListe(['un', 'deux'])).toBe('un et deux');
    });

    it('devrait joindre plusieurs éléments avec virgules et "et"', () => {
      expect(formatageListe(['un', 'deux', 'trois'])).toBe('un, deux et trois');
    });

    it('devrait utiliser une conjonction personnalisée', () => {
      expect(formatageListe(['un', 'deux'], 'ou')).toBe('un ou deux');
    });
  });

  describe('extraireDomaine', () => {
    it('devrait extraire le domaine', () => {
      expect(extraireDomaine('https://www.example.com/path')).toBe('example.com');
    });

    it('devrait retirer www', () => {
      expect(extraireDomaine('https://www.test.fr')).toBe('test.fr');
    });

    it('devrait gérer une URL invalide', () => {
      expect(extraireDomaine('not-a-url')).toBe('not-a-url');
    });
  });

  describe('formatageUrl', () => {
    it('devrait formater sans protocole', () => {
      expect(formatageUrl('https://example.com/page')).toBe('example.com/page');
    });

    it('devrait retirer www', () => {
      expect(formatageUrl('https://www.example.com')).toBe('example.com');
    });

    it('devrait tronquer si nécessaire', () => {
      const resultat = formatageUrl('https://example.com/very/long/path', 15);
      expect(resultat.length).toBe(15);
    });
  });

  describe('format object', () => {
    it('devrait exporter toutes les fonctions', () => {
      expect(typeof format.relatif).toBe('function');
      expect(typeof format.dateCourt).toBe('function');
      expect(typeof format.dateLong).toBe('function');
      expect(typeof format.nombre).toBe('function');
      expect(typeof format.taille).toBe('function');
      expect(typeof format.tronquer).toBe('function');
      expect(typeof format.slugify).toBe('function');
      expect(typeof format.pluriel).toBe('function');
    });
  });
});
