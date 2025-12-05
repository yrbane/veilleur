-- Veilleur - Script d'initialisation MariaDB
-- Ce script est exécuté automatiquement au premier démarrage du conteneur

-- =============================================================================
-- Configuration de la base de données
-- =============================================================================

-- S'assurer que la base utilise UTF-8
ALTER DATABASE veilleur CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- Privilèges utilisateur
-- =============================================================================

-- Accorder tous les privilèges à l'utilisateur veilleur
GRANT ALL PRIVILEGES ON veilleur.* TO 'veilleur'@'%';
FLUSH PRIVILEGES;

-- =============================================================================
-- Variables de session recommandées
-- =============================================================================

-- Ces paramètres peuvent être ajustés dans my.cnf pour la production
-- SET GLOBAL innodb_buffer_pool_size = 256M;
-- SET GLOBAL max_connections = 100;

-- =============================================================================
-- Message de confirmation
-- =============================================================================

SELECT 'Base de données Veilleur initialisée avec succès!' AS message;
