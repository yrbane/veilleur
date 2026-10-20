-- Migration : note, favori et tags personnels sur les articles (0.4.0)
CREATE TABLE IF NOT EXISTS `utilisateurs_articles` (
  `id` varchar(36) NOT NULL,
  `utilisateur_id` varchar(36) NOT NULL,
  `article_id` varchar(36) NOT NULL,
  `note` tinyint,
  `favori` boolean NOT NULL DEFAULT false,
  `date_mise_a_jour` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `utilisateurs_articles_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_utilisateur_article_unique` UNIQUE(`utilisateur_id`,`article_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_utilisateur_article_note` ON `utilisateurs_articles` (`utilisateur_id`,`note`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_utilisateur_article_article` ON `utilisateurs_articles` (`article_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_utilisateur_article_favori` ON `utilisateurs_articles` (`utilisateur_id`,`favori`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `utilisateurs_articles_tags` (
  `id` varchar(36) NOT NULL,
  `utilisateur_id` varchar(36) NOT NULL,
  `article_id` varchar(36) NOT NULL,
  `tag_id` varchar(36) NOT NULL,
  `date_creation` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `utilisateurs_articles_tags_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_uat_unique` UNIQUE(`utilisateur_id`,`article_id`,`tag_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_uat_utilisateur_tag` ON `utilisateurs_articles_tags` (`utilisateur_id`,`tag_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_uat_article` ON `utilisateurs_articles_tags` (`article_id`);
