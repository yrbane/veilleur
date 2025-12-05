CREATE TABLE `articles` (
	`id` varchar(36) NOT NULL,
	`source_id` varchar(36) NOT NULL,
	`titre` varchar(512) NOT NULL,
	`lien` varchar(2048) NOT NULL,
	`date_publication` timestamp NOT NULL,
	`resume` text,
	`url_image` varchar(2048),
	`auteur` varchar(255),
	`meta_open_graph` json DEFAULT ('{}'),
	`meta_twitter` json DEFAULT ('{}'),
	`hash_contenu` char(32),
	`date_extraction` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_hash_contenu_unique` UNIQUE(`hash_contenu`)
);
--> statement-breakpoint
CREATE TABLE `caches_sources` (
	`id` varchar(36) NOT NULL,
	`source_id` varchar(36) NOT NULL,
	`donnees_json` text NOT NULL,
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	`date_expiration` timestamp NOT NULL,
	CONSTRAINT `caches_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `caches_sources_source_id_unique` UNIQUE(`source_id`)
);
--> statement-breakpoint
CREATE TABLE `parametres_sources` (
	`id` varchar(36) NOT NULL,
	`utilisateur_source_id` varchar(36) NOT NULL,
	`nombre_max_articles` int DEFAULT 20,
	`frequence_minutes` int DEFAULT 30,
	`retention_jours` int DEFAULT 30,
	`priorite` enum('haute','normale','basse') DEFAULT 'normale',
	`mode_extraction` enum('rss','scraping','auto') DEFAULT 'auto',
	`filtres_mots_cles` json DEFAULT ('{}'),
	`notifications` enum('aucune','nouveaux','tous') DEFAULT 'nouveaux',
	`plage_horaire` json,
	CONSTRAINT `parametres_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `parametres_sources_utilisateur_source_id_unique` UNIQUE(`utilisateur_source_id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`utilisateur_id` varchar(36) NOT NULL,
	`token` char(64) NOT NULL,
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	`date_expiration` timestamp NOT NULL,
	`est_revoque` boolean DEFAULT false,
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` varchar(36) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`nom` varchar(255) NOT NULL,
	`type_source` enum('rss','atom','html') NOT NULL,
	`statut` enum('active','inactive','erreur') DEFAULT 'active',
	`url_favicon` varchar(2048),
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	`date_derniere_synchro` timestamp,
	`hash_url_normalise` char(32),
	`nombre_echecs` int DEFAULT 0,
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sources_hash_url_normalise_unique` UNIQUE(`hash_url_normalise`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(36) NOT NULL,
	`nom` varchar(50) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `utilisateurs` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`mot_de_passe_hash` varchar(255) NOT NULL,
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	`date_derniere_connexion` timestamp,
	`preferences` json DEFAULT ('{}'),
	`est_actif` boolean DEFAULT true,
	CONSTRAINT `utilisateurs_id` PRIMARY KEY(`id`),
	CONSTRAINT `utilisateurs_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `utilisateurs_sources` (
	`id` varchar(36) NOT NULL,
	`utilisateur_id` varchar(36) NOT NULL,
	`source_id` varchar(36) NOT NULL,
	`date_ajout` timestamp NOT NULL DEFAULT (now()),
	`note` tinyint,
	`est_en_pause` boolean DEFAULT false,
	CONSTRAINT `utilisateurs_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_utilisateur_source_unique` UNIQUE(`utilisateur_id`,`source_id`)
);
--> statement-breakpoint
CREATE TABLE `utilisateurs_sources_tags` (
	`id` varchar(36) NOT NULL,
	`utilisateur_source_id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `utilisateurs_sources_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ust_unique` UNIQUE(`utilisateur_source_id`,`tag_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_article_source_date` ON `articles` (`source_id`,`date_publication`);--> statement-breakpoint
CREATE INDEX `idx_article_hash` ON `articles` (`hash_contenu`);--> statement-breakpoint
CREATE INDEX `idx_article_date` ON `articles` (`date_publication`);--> statement-breakpoint
CREATE INDEX `idx_refresh_token` ON `refresh_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_refresh_utilisateur` ON `refresh_tokens` (`utilisateur_id`);--> statement-breakpoint
CREATE INDEX `idx_source_hash` ON `sources` (`hash_url_normalise`);--> statement-breakpoint
CREATE INDEX `idx_source_statut` ON `sources` (`statut`);--> statement-breakpoint
CREATE INDEX `idx_tag_slug` ON `tags` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tag_nom` ON `tags` (`nom`);--> statement-breakpoint
CREATE INDEX `idx_utilisateur_email` ON `utilisateurs` (`email`);--> statement-breakpoint
CREATE INDEX `idx_utilisateur_source_utilisateur` ON `utilisateurs_sources` (`utilisateur_id`);--> statement-breakpoint
CREATE INDEX `idx_ust_tag` ON `utilisateurs_sources_tags` (`tag_id`);