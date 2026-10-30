/**
 * Veilleur - Tests du service d'administration : séries complétées et règles sur les comptes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceAdministration, completerSerie, completerHeures, ErreurAdministration, type DepotAdministration, type UtilisateurAdmin } from '@/domaine/services/ServiceAdministration';

const utilisateur = (id: string, role: 'admin' | 'membre' = 'membre'): UtilisateurAdmin => ({
  id, email: `${id}@exemple.org`, role, estActif: true, totpActif: false, dateCreation: new Date('2026-10-01'), dateDerniereConnexion: null, nombreSources: 0, nombreLectures: 0,
});

describe('completerSerie', () => {
  it('produit un point par jour, à zéro quand la base ne dit rien, dans l\'ordre', () => {
    const serie = completerSerie([{ jour: '2026-10-29', valeur: 3 }, { jour: '2026-10-27T00:00:00.000Z', valeur: 1 }], 4, new Date(2026, 9, 30));
    expect(serie).toEqual([
      { jour: '2026-10-27', valeur: 1 },
      { jour: '2026-10-28', valeur: 0 },
      { jour: '2026-10-29', valeur: 3 },
      { jour: '2026-10-30', valeur: 0 },
    ]);
  });

  it('convertit les compteurs textuels renvoyés par le pilote SQL', () => {
    const [point] = completerSerie([{ jour: '2026-10-30', valeur: '7' as unknown as number }], 1, new Date(2026, 9, 30));
    expect(point.valeur).toBe(7);
  });
});

describe('completerHeures', () => {
  it('remplit 24 cases', () => {
    const heures = completerHeures([{ heure: 8, nombre: 5 }, { heure: 23, nombre: 2 }, { heure: 24, nombre: 9 }]);
    expect(heures).toHaveLength(24);
    expect(heures[8]).toBe(5);
    expect(heures[23]).toBe(2);
    expect(heures[0]).toBe(0);
  });
});

describe('ServiceAdministration — comptes', () => {
  let depot: DepotAdministration;
  let service: ServiceAdministration;

  beforeEach(() => {
    depot = {
      compterUtilisateurs: vi.fn().mockResolvedValue({ total: 2, actifs: 2, admins: 1, avec2fa: 0, nouveaux7j: 0, connectes7j: 0, abonnesPush: 0 }),
      trouverUtilisateur: vi.fn(async (id: string) => (id === 'admin' ? utilisateur('admin', 'admin') : id === 'bob' ? utilisateur('bob') : null)),
      mettreAJourUtilisateur: vi.fn().mockResolvedValue(undefined),
      supprimerUtilisateur: vi.fn().mockResolvedValue(undefined),
    } as unknown as DepotAdministration;
    service = new ServiceAdministration(depot);
  });

  it('promeut un membre administrateur', async () => {
    await service.modifierUtilisateur('admin', 'bob', { role: 'admin' });
    expect(depot.mettreAJourUtilisateur).toHaveBeenCalledWith('bob', { role: 'admin' });
  });

  it('refuse qu\'un administrateur se rétrograde ou se désactive lui-même', async () => {
    await expect(service.modifierUtilisateur('admin', 'admin', { role: 'membre' })).rejects.toMatchObject({ code: 'AUTO_MODIFICATION' });
    await expect(service.modifierUtilisateur('admin', 'admin', { estActif: false })).rejects.toMatchObject({ code: 'AUTO_MODIFICATION' });
    expect(depot.mettreAJourUtilisateur).not.toHaveBeenCalled();
  });

  it('refuse de retirer le dernier administrateur, même par un autre compte', async () => {
    await expect(service.modifierUtilisateur('autre-admin', 'admin', { role: 'membre' })).rejects.toBeInstanceOf(ErreurAdministration);
    await expect(service.supprimerUtilisateur('autre-admin', 'admin')).rejects.toMatchObject({ code: 'DERNIER_ADMIN' });
  });

  it('supprime un membre mais jamais soi-même', async () => {
    await service.supprimerUtilisateur('admin', 'bob');
    expect(depot.supprimerUtilisateur).toHaveBeenCalledWith('bob');
    await expect(service.supprimerUtilisateur('admin', 'admin')).rejects.toMatchObject({ code: 'AUTO_MODIFICATION' });
  });

  it('signale un compte inconnu', async () => {
    await expect(service.modifierUtilisateur('admin', 'inconnu', { estActif: false })).rejects.toMatchObject({ code: 'UTILISATEUR_INTROUVABLE' });
  });
});
