-- Migration : liste de lecture « à lire plus tard » (0.11.0)
ALTER TABLE `utilisateurs_articles` ADD COLUMN IF NOT EXISTS `a_lire` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_utilisateur_article_a_lire` ON `utilisateurs_articles` (`utilisateur_id`,`a_lire`);
