-- Migration : mots-clés extraits automatiquement des articles ; les tags manuels d'articles (0.4.x) disparaissent
CREATE TABLE IF NOT EXISTS `articles_mots_cles` (
  `id` varchar(36) NOT NULL,
  `article_id` varchar(36) NOT NULL,
  `mot` varchar(50) NOT NULL,
  `position` tinyint NOT NULL DEFAULT 0,
  CONSTRAINT `articles_mots_cles_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_article_mot_unique` UNIQUE(`article_id`,`mot`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_article_mot_mot` ON `articles_mots_cles` (`mot`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_article_mot_article` ON `articles_mots_cles` (`article_id`);
--> statement-breakpoint
DROP TABLE IF EXISTS `utilisateurs_articles_tags`;
