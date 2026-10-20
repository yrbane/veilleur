-- Migration: colonne url_image_cache sur les articles + index sur images_cachees
-- Idempotente (IF NOT EXISTS) : les bases où la colonne a été ajoutée à la main restent valides
ALTER TABLE `articles` ADD COLUMN IF NOT EXISTS `url_image_cache` char(32);
--> statement-breakpoint
ALTER TABLE `images_cachees` ADD INDEX IF NOT EXISTS `idx_image_statut` (`statut`);
--> statement-breakpoint
ALTER TABLE `images_cachees` ADD INDEX IF NOT EXISTS `idx_image_dernier_acces` (`date_dernier_acces`);
