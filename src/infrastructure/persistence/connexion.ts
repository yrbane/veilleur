/**
 * Veilleur - Connexion MariaDB
 * Client Drizzle ORM pour MariaDB
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from '@/config/environnement';
import { loggerBdd } from '../logging/logger';
import * as schema from './schema';

let connexion: mysql.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Crée la connexion à la base de données
 */
export async function creerConnexion(): Promise<ReturnType<typeof drizzle>> {
  if (db) {
    return db;
  }

  loggerBdd.info('Connexion à MariaDB...');

  connexion = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  // Tester la connexion
  try {
    const conn = await connexion.getConnection();
    await conn.ping();
    conn.release();
    loggerBdd.info('Connexion à MariaDB établie');
  } catch (erreur) {
    loggerBdd.error({ erreur }, 'Échec de la connexion à MariaDB');
    throw erreur;
  }

  db = drizzle(connexion, { schema, mode: 'default' });
  return db;
}

/**
 * Récupère l'instance de la base de données
 */
export function obtenirBdd(): ReturnType<typeof drizzle> {
  if (!db) {
    throw new Error('La base de données n\'est pas initialisée. Appelez creerConnexion() d\'abord.');
  }
  return db;
}

/**
 * Ferme la connexion à la base de données
 */
export async function fermerConnexion(): Promise<void> {
  if (connexion) {
    loggerBdd.info('Fermeture de la connexion MariaDB...');
    await connexion.end();
    connexion = null;
    db = null;
    loggerBdd.info('Connexion MariaDB fermée');
  }
}

/**
 * Vérifie l'état de la connexion
 */
export async function verifierConnexion(): Promise<boolean> {
  if (!connexion) {
    return false;
  }

  try {
    const conn = await connexion.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Exécute une fonction dans une transaction
 */
export async function dansTransaction<T>(
  fn: (tx: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  // Drizzle gère les transactions via le pool MySQL
  // Pour une vraie transaction, on utilise le client raw
  if (!connexion) {
    throw new Error('Connexion non initialisée');
  }

  const conn = await connexion.getConnection();

  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn, { schema, mode: 'default' });
    const resultat = await fn(txDb);
    await conn.commit();
    return resultat;
  } catch (erreur) {
    await conn.rollback();
    throw erreur;
  } finally {
    conn.release();
  }
}
