// @vitest-environment jsdom
/**
 * Veilleur - Téléchargement d'un fichier généré côté client
 */

import { describe, it, expect, vi } from 'vitest';
import { telechargerFichier, suffixeDate } from '@/client/utils/telechargement';

describe('telechargerFichier', () => {
  it('crée un lien de téléchargement, le clique puis libère l\'URL', () => {
    const createObjectURL = vi.fn(() => 'blob:veilleur/1');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clics: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push(`${this.download}|${this.href}`);
    });

    telechargerFichier('a;b', 'export.csv', 'text/csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clics).toEqual(['export.csv|blob:veilleur/1']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:veilleur/1');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('suffixeDate', () => {
  it('formate la date en AAAA-MM-JJ', () => {
    expect(suffixeDate(new Date('2026-10-21T22:00:00Z'))).toBe('2026-10-21');
  });
});
