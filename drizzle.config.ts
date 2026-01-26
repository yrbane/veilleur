/**
 * Veilleur - Configuration Drizzle ORM
 * Migrations et schéma MariaDB
 */

import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? 'veilleur',
    password: process.env.DB_PASSWORD ?? 'veilleur_secret',
    database: process.env.DB_NAME ?? 'veilleur',
  },
  verbose: true,
  strict: true,
} satisfies Config;
