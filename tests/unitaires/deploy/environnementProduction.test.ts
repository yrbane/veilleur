/**
 * Veilleur - Gabarits d'environnement et installeur nethttp
 * Le .env de production est lu par systemd (EnvironmentFile) pour le service comme pour
 * les scripts de migration : toute valeur contenant un espace, une parenthèse ou un
 * chevron doit être entre guillemets doubles, sinon un « source » bash s'arrête net au
 * milieu du fichier et les variables suivantes manquent silencieusement.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const RACINE = resolve(__dirname, '../../..');
const GABARITS = ['deploy/nethttp/env.production', '.env.example'];

/** Lignes KEY=valeur, y compris les exemples commentés (« # SMTP_FROM=… ») que l'on décommente tel quel */
function listerAffectations(contenu: string): Array<{ cle: string; valeur: string }> {
  return contenu
    .split('\n')
    .map(ligne => /^#?\s*([A-Z][A-Z0-9_]*)=(.*)$/.exec(ligne))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => ({ cle: m[1], valeur: m[2].trim() }));
}

function estSourcable(valeur: string): boolean {
  if (/^"[^"]*"$/.test(valeur)) return true;
  return !/[\s()<>&|;`$'"]/.test(valeur);
}

describe('gabarits d\'environnement', () => {
  for (const gabarit of GABARITS) {
    it(`${gabarit} : chaque valeur est sourçable par bash ou entre guillemets doubles`, () => {
      const affectations = listerAffectations(readFileSync(resolve(RACINE, gabarit), 'utf8'));

      expect(affectations.length).toBeGreaterThan(10);
      const fautives = affectations.filter(a => !estSourcable(a.valeur)).map(a => a.cle);
      expect(fautives).toEqual([]);
    });
  }

  it('env.production déclare le User-Agent de scraping entre guillemets', () => {
    const affectations = listerAffectations(readFileSync(resolve(RACINE, 'deploy/nethttp/env.production'), 'utf8'));

    const ua = affectations.find(a => a.cle === 'SCRAPING_USER_AGENT');
    expect(ua?.valeur).toMatch(/^"Veilleur\/[0-9.]+ \(\+https:\/\/news\.nethttp\.net\)"$/);
  });
});

describe('installeur nethttp', () => {
  const installeur = readFileSync(resolve(RACINE, 'deploy/nethttp/installer.sh'), 'utf8');

  it('ne « source » jamais le .env avec bash', () => {
    expect(installeur).not.toMatch(/\.\s+"?\$[A-Z_{}1]+\/\.env"?/);
    expect(installeur).not.toMatch(/\bsource\b.*\.env/);
  });

  it('lance migrations et seed avec le même EnvironmentFile que le service', () => {
    expect(installeur).toMatch(/systemd-run[^\n]*--wait/);
    expect(installeur).toMatch(/EnvironmentFile="\$RACINE\/\.env"/);
    expect(installeur).toMatch(/executer_app dist\/migrer\.js/);
    expect(installeur).toMatch(/executer_app dist\/seed\.js/);
  });
});
