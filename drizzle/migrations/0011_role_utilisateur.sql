-- Migration : rôle des comptes (0.21.0) — le premier compte créé devient administrateur
ALTER TABLE `utilisateurs` ADD COLUMN IF NOT EXISTS `role` enum('membre','admin') NOT NULL DEFAULT 'membre';
--> statement-breakpoint
UPDATE `utilisateurs` SET `role` = 'admin'
WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `utilisateurs` ORDER BY `date_creation` ASC, `id` ASC LIMIT 1) AS `premier`)
  AND NOT EXISTS (SELECT 1 FROM (SELECT `id` FROM `utilisateurs` WHERE `role` = 'admin') AS `admins`);
