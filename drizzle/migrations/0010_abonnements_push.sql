-- Migration : abonnements Web Push (0.16.0)
CREATE TABLE IF NOT EXISTS `abonnements_push` (
  `id` varchar(36) NOT NULL,
  `utilisateur_id` varchar(36) NOT NULL,
  `endpoint` varchar(1024) NOT NULL,
  `cle_publique` varchar(255) NOT NULL,
  `secret_auth` varchar(255) NOT NULL,
  `user_agent` varchar(255),
  `date_creation` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `abonnements_push_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_abonnement_push_endpoint` UNIQUE(`endpoint`(191)),
  CONSTRAINT `abonnements_push_utilisateur_id_utilisateurs_id_fk` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_abonnement_push_utilisateur` ON `abonnements_push` (`utilisateur_id`);
