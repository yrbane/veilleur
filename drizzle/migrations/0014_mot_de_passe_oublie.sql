-- Migration : mot de passe oublié (0.25.0) — demandes de réinitialisation, jeton conservé haché
CREATE TABLE IF NOT EXISTS `reinitialisations_mot_de_passe` (
  `id` varchar(36) NOT NULL,
  `utilisateur_id` varchar(36) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `date_creation` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_expiration` timestamp NOT NULL,
  `date_utilisation` timestamp NULL DEFAULT NULL,
  CONSTRAINT `reinitialisations_mot_de_passe_id` PRIMARY KEY(`id`),
  CONSTRAINT `reinitialisations_mot_de_passe_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reinit_utilisateur` ON `reinitialisations_mot_de_passe` (`utilisateur_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reinit_expiration` ON `reinitialisations_mot_de_passe` (`date_expiration`);
