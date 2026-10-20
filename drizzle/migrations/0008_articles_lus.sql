-- Migration : articles lus / non lus (0.9.0)
ALTER TABLE `utilisateurs_articles` ADD COLUMN IF NOT EXISTS `lu_le` timestamp NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_utilisateur_article_lu` ON `utilisateurs_articles` (`utilisateur_id`,`lu_le`);
