-- Migration : tags déduits automatiquement à l'ajout d'une source
ALTER TABLE `sources` ADD COLUMN IF NOT EXISTS `tags_suggeres` json;
