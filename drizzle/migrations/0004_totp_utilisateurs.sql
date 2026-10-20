-- Migration: colonnes 2FA (TOTP) sur les utilisateurs, déclarées dans le schéma mais jamais migrées
-- Idempotente (IF NOT EXISTS) : les bases de dev où drizzle-kit push les a déjà posées restent valides
ALTER TABLE `utilisateurs` ADD COLUMN IF NOT EXISTS `totp_secret` varchar(64);
--> statement-breakpoint
ALTER TABLE `utilisateurs` ADD COLUMN IF NOT EXISTS `totp_actif` boolean DEFAULT false;
