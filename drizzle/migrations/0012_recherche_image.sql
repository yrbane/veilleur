-- Migration : découverte d'image (0.23.0) — date de la dernière recherche d'image sur la page de l'article
ALTER TABLE `articles` ADD COLUMN IF NOT EXISTS `date_recherche_image` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_article_recherche_image` ON `articles` (`date_recherche_image`);
