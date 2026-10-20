/**
 * Veilleur - Tests d'intégration pour le téléchargement d'images
 * Tests de bout en bout du système de cache d'images
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync } from 'fs';

// Mock de la config
vi.mock('@/config/environnement', () => ({
  env: {
    IMAGES_CHEMIN_STOCKAGE: '/tmp/veilleur-test-images',
    IMAGES_MAX_TAILLE_MO: 5,
    IMAGES_RETENTION_JOURS: 90,
    SCRAPING_USER_AGENT: 'VeilleurTestBot/1.0',
  },
}));

// Mock de validation URL pour permettre 127.0.0.1 dans les tests
vi.mock('@/infrastructure/scraping/validationUrl', () => ({
  validerUrlScraping: (url: string) => {
    // Bloquer localhost mais autoriser 127.0.0.1 pour les tests
    if (url.includes('localhost')) {
      return {
        valide: false,
        urlNormalisee: null,
        erreur: 'URL localhost bloquée',
      };
    }
    return {
      valide: true,
      urlNormalisee: url,
    };
  },
}));

// Mock du logger
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerJobs: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  loggerScraping: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Téléchargement d\'images', () => {
  let server: Server;
  const testDir = '/tmp/veilleur-test-images';

  // Image JPEG minimale valide (1x1 pixel rouge)
  const jpegMiniature = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xBA, 0xAB, 0xF7,
    0xA7, 0xFF, 0xD9,
  ]);

  beforeAll(async () => {
    // Créer un serveur HTTP de test
    server = createServer((req, res) => {
      if (req.url === '/valid-image.jpg') {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': jpegMiniature.length.toString(),
        });
        res.end(jpegMiniature);
      } else if (req.url === '/not-found.jpg') {
        res.writeHead(404);
        res.end('Not Found');
      } else if (req.url === '/not-an-image.txt') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
        });
        res.end('This is not an image');
      } else if (req.url === '/huge-image.jpg') {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': (10 * 1024 * 1024).toString(), // 10 Mo
        });
        // On n'envoie pas vraiment 10 Mo
        res.end(jpegMiniature);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    // Nettoyer et créer le dossier de test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // Nettoyer le dossier de test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TelechargeursImages', () => {
    it('devrait rejeter une URL SSRF (localhost)', async () => {
      const { TelechargeursImages } = await import('@/infrastructure/images/TelechargeursImages');
      const telecharger = new TelechargeursImages();

      // localhost est bloqué par la validation SSRF
      const resultat = await telecharger.telecharger('http://localhost/image.jpg');

      expect(resultat.succes).toBe(false);
      expect(resultat.erreur).toBeDefined();
    });

    it('devrait avoir les options par défaut', async () => {
      const { TelechargeursImages } = await import('@/infrastructure/images/TelechargeursImages');
      const telecharger = new TelechargeursImages();

      // Le téléchargeur doit être créé avec succès
      expect(telecharger).toBeDefined();
    });

    it('devrait accepter des options personnalisées', async () => {
      const { TelechargeursImages } = await import('@/infrastructure/images/TelechargeursImages');
      const telecharger = new TelechargeursImages({
        timeout: 5000,
        maxTailleMo: 2,
        userAgent: 'CustomBot/1.0',
      });

      expect(telecharger).toBeDefined();
    });
  });

  describe('GestionnaireStockage', () => {
    it('devrait initialiser les dossiers', async () => {
      const { GestionnaireStockage } = await import('@/infrastructure/images/GestionnaireStockage');
      const gestionnaire = new GestionnaireStockage(testDir);

      await gestionnaire.initialiser();

      expect(existsSync(join(testDir, 'originales'))).toBe(true);
      expect(existsSync(join(testDir, 'miniatures'))).toBe(true);
    });

    it('devrait sauvegarder et lire un fichier', async () => {
      const { GestionnaireStockage } = await import('@/infrastructure/images/GestionnaireStockage');
      const gestionnaire = new GestionnaireStockage(testDir);
      await gestionnaire.initialiser();

      const donnees = Buffer.from('test-image-data');
      const chemin = gestionnaire.genererChemin('testhash', 'originale', 'webp');

      await gestionnaire.sauvegarder(chemin, donnees);
      const lu = await gestionnaire.lire(chemin);

      expect(lu).toEqual(donnees);
    });

    it('devrait générer les bons chemins', async () => {
      const { GestionnaireStockage } = await import('@/infrastructure/images/GestionnaireStockage');
      const gestionnaire = new GestionnaireStockage(testDir);

      const cheminOriginal = gestionnaire.genererChemin('abc123', 'originale', 'webp');
      const cheminSm = gestionnaire.genererChemin('abc123', 'sm', 'webp');
      const cheminMd = gestionnaire.genererChemin('abc123', 'md', 'jpeg');

      expect(cheminOriginal).toContain('originales/abc123.webp');
      expect(cheminSm).toContain('miniatures/abc123-sm.webp');
      expect(cheminMd).toContain('miniatures/abc123-md.jpg');
    });
  });
});
