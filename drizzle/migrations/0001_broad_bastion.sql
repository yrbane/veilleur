-- Migration: Système de cache d'images
-- Cette migration crée la table images_cachees et ajoute la colonne url_image_cache aux articles

-- Table images_cachees
CREATE TABLE IF NOT EXISTS `images_cachees` (
	`id` varchar(36) NOT NULL,
	`hash_url` char(32) NOT NULL,
	`url_originale` varchar(2048) NOT NULL,
	`chemin_local` varchar(512),
	`chemin_miniature_sm` varchar(512),
	`chemin_miniature_md` varchar(512),
	`type_mime` varchar(50),
	`taille_fichier` int,
	`largeur` int,
	`hauteur` int,
	`statut` enum('en_attente','en_cours','termine','echec') DEFAULT 'en_attente',
	`nombre_utilisations` int DEFAULT 1,
	`date_creation` timestamp NOT NULL DEFAULT (now()),
	`date_dernier_acces` timestamp,
	CONSTRAINT `images_cachees_id` PRIMARY KEY(`id`),
	CONSTRAINT `images_cachees_hash_url_unique` UNIQUE(`hash_url`)
);
