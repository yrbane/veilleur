/**
 * Veilleur - Tests unitaires de la lecture de version
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { lireVersion, VERSION } from '@/config/version';
import packageJson from '../../../package.json';

describe('lireVersion', () => {
  it('retourne la version du package.json du projet par défaut', () => {
    expect(VERSION).toBe(packageJson.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('lit la version d\'un package.json donné', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'veilleur-version-'));
    const chemin = join(dossier, 'package.json');
    writeFileSync(chemin, JSON.stringify({ version: '9.8.7' }));

    expect(lireVersion(chemin)).toBe('9.8.7');
  });

  it('retourne 0.0.0 si le fichier est absent', () => {
    expect(lireVersion('/chemin/inexistant/package.json')).toBe('0.0.0');
  });

  it('retourne 0.0.0 si la version est absente ou invalide', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'veilleur-version-'));
    const chemin = join(dossier, 'package.json');
    writeFileSync(chemin, JSON.stringify({ name: 'sans-version' }));

    expect(lireVersion(chemin)).toBe('0.0.0');
  });
});
