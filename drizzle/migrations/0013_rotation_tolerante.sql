-- Migration : rotation tolérante des refresh tokens (0.24.1) — date de rotation pour la fenêtre de grâce
ALTER TABLE `refresh_tokens` ADD COLUMN IF NOT EXISTS `date_rotation` timestamp NULL DEFAULT NULL;
