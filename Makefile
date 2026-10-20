# Veilleur - Makefile
# Commandes pratiques pour le développement

.PHONY: help dev up down logs shell db-shell redis-shell migrate test lint build prod clean

# Couleurs pour l'affichage
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# =============================================================================
# Aide
# =============================================================================

help: ## Afficher cette aide
	@printf ""
	@printf "$(CYAN)Veilleur$(RESET) - Commandes disponibles"
	@printf ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'
	@printf ""

# =============================================================================
# Développement
# =============================================================================

dev: ## Démarrer l'environnement de développement
	@printf "$(CYAN)Démarrage de Veilleur en mode développement...$(RESET)\n"
	docker compose up -d
	@printf "$(GREEN)Veilleur est prêt !$(RESET)\n"
	@printf "  Frontend (Vite): http://localhost:5173\n"
	@printf "  API Backend:     http://localhost:8080\n"
	@printf "  Adminer:         make debug puis http://localhost:8082\n"
	@printf "  Redis UI:        make debug puis http://localhost:8081\n"

up: dev ## Alias pour dev

down: ## Arrêter tous les conteneurs
	@printf "$(YELLOW)Arrêt des conteneurs...$(RESET)\n"
	docker compose down

stop: down ## Alias pour down

restart: ## Redémarrer tous les conteneurs
	@printf "$(YELLOW)Redémarrage...$(RESET)\n"
	docker compose restart

logs: ## Afficher les logs (tous les services)
	docker compose logs -f

logs-app: ## Afficher les logs de l'application
	docker compose logs -f app

logs-db: ## Afficher les logs de MariaDB
	docker compose logs -f mariadb

logs-redis: ## Afficher les logs de Redis
	docker compose logs -f redis

# =============================================================================
# Debug (outils supplémentaires)
# =============================================================================

debug: ## Démarrer avec les outils de debug (Adminer, Redis Commander)
	@printf "$(CYAN)Démarrage avec outils de debug...$(RESET)\n"
	docker compose --profile debug up -d
	@printf "$(GREEN)Outils de debug disponibles :$(RESET)\n"
	@printf "  Adminer (BDD):  http://localhost:8080"
	@printf "  Redis UI:       http://localhost:8081"

# =============================================================================
# Shells
# =============================================================================

shell: ## Ouvrir un shell dans le conteneur app
	docker compose exec app sh

db-shell: ## Ouvrir un shell MariaDB
	docker compose exec mariadb mariadb -u veilleur -pveilleur_secret veilleur

redis-shell: ## Ouvrir un shell Redis
	docker compose exec redis redis-cli

# =============================================================================
# Base de données
# =============================================================================

migrate: ## Appliquer les migrations Drizzle
	@printf "$(CYAN)Application des migrations...$(RESET)\n"
	docker compose exec app npm run db:migrate

seed: ## Initialiser les données par défaut (médias de gauche et scientifiques)
	@printf "$(CYAN)Initialisation des sources par défaut...$(RESET)\n"
	docker compose exec app npm run db:seed

migrate-generate: ## Générer une nouvelle migration
	docker compose exec app npm run db:generate

db-studio: ## Ouvrir Drizzle Studio
	docker compose exec app npm run db:studio

db-push: ## Push le schéma (dev only)
	docker compose exec app npm run db:push

# =============================================================================
# Tests
# =============================================================================

test: ## Lancer les tests unitaires
	docker compose exec app npm run test:run

test-watch: ## Lancer les tests en mode watch
	docker compose exec app npm run test

test-coverage: ## Lancer les tests avec couverture
	docker compose exec app npm run test:coverage

test-e2e: ## Lancer les tests E2E
	docker compose exec app npm run test:e2e

# =============================================================================
# Qualité
# =============================================================================

lint: ## Vérifier le code avec ESLint
	docker compose exec app npm run lint

lint-fix: ## Corriger automatiquement avec ESLint
	docker compose exec app npm run lint:fix

format: ## Formater le code avec Prettier
	docker compose exec app npm run format

typecheck: ## Vérifier les types TypeScript
	docker compose exec app npm run typecheck

check: lint typecheck test ## Vérification complète (lint + types + tests)

# =============================================================================
# Build
# =============================================================================

build: ## Builder l'image de production
	@printf "$(CYAN)Build de l'image de production...$(RESET)\n"
	docker build -t veilleur:latest --target production .

build-dev: ## Builder l'image de développement
	docker build -t veilleur:dev --target development .

# =============================================================================
# Production
# =============================================================================

prod: ## Démarrer en mode production
	@printf "$(CYAN)Démarrage en mode production...$(RESET)\n"
	docker compose -f docker-compose.prod.yml up -d

prod-down: ## Arrêter le mode production
	docker compose -f docker-compose.prod.yml down

prod-logs: ## Logs en production
	docker compose -f docker-compose.prod.yml logs -f

# =============================================================================
# Nettoyage
# =============================================================================

clean: ## Nettoyer les conteneurs et volumes
	@printf "$(YELLOW)Nettoyage complet...$(RESET)\n"
	docker compose down -v --remove-orphans
	docker compose --profile debug down -v --remove-orphans

clean-images: ## Supprimer les images Veilleur
	docker rmi veilleur:latest veilleur:dev 2>/dev/null || true

clean-all: clean clean-images ## Nettoyage total (conteneurs, volumes, images)
	@printf "$(GREEN)Nettoyage terminé !$(RESET)\n"

# =============================================================================
# Status
# =============================================================================

status: ## Afficher le statut des conteneurs
	docker compose ps

ps: status ## Alias pour status

health: ## Vérifier la santé des services
	@printf "$(CYAN)État de santé des services :$(RESET)\n"
	@docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
