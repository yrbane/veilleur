/**
 * Veilleur - Tests unitaires du script de migration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = { nom: 'db-factice' };
const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  creerConnexion: vi.fn(),
  fermerConnexion: vi.fn(),
}));

vi.mock('drizzle-orm/mysql2/migrator', () => ({ migrate: mocks.migrate }));
vi.mock('@/infrastructure/persistence/connexion', () => ({
  creerConnexion: mocks.creerConnexion,
  fermerConnexion: mocks.fermerConnexion,
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerBdd: { info: vi.fn(), error: vi.fn() },
}));

import { appliquerMigrations, DOSSIER_MIGRATIONS } from '@/infrastructure/persistence/migrer';

describe('appliquerMigrations', () => {
  beforeEach(() => {
    mocks.creerConnexion.mockResolvedValue(mockDb);
    mocks.fermerConnexion.mockResolvedValue(undefined);
    mocks.migrate.mockResolvedValue(undefined);
  });

  it('applique les migrations du dossier par défaut avec la connexion ouverte', async () => {
    await appliquerMigrations();

    expect(DOSSIER_MIGRATIONS).toBe('drizzle/migrations');
    expect(mocks.migrate).toHaveBeenCalledWith(mockDb, { migrationsFolder: 'drizzle/migrations' });
  });

  it('accepte un dossier de migrations personnalisé', async () => {
    await appliquerMigrations('/tmp/migrations');

    expect(mocks.migrate).toHaveBeenCalledWith(mockDb, { migrationsFolder: '/tmp/migrations' });
  });

  it('ferme la connexion après succès', async () => {
    await appliquerMigrations();

    expect(mocks.fermerConnexion).toHaveBeenCalledTimes(1);
  });

  it('ferme la connexion même en cas d\'échec et propage l\'erreur', async () => {
    mocks.migrate.mockRejectedValue(new Error('SQL cassé'));

    await expect(appliquerMigrations()).rejects.toThrow('SQL cassé');
    expect(mocks.fermerConnexion).toHaveBeenCalledTimes(1);
  });
});
