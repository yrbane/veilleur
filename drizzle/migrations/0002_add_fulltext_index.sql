-- Migration: Ajout index FULLTEXT sur les articles pour la recherche
ALTER TABLE `articles` ADD FULLTEXT `idx_article_recherche_fulltext` (`titre`, `resume`);
