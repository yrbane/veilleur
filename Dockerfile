# Veilleur - Dockerfile
# Multi-stage build pour optimiser la taille de l'image

# =============================================================================
# Stage 1: Base
# =============================================================================
FROM node:22-alpine AS base

# Installer les dépendances système nécessaires
RUN apk add --no-cache libc6-compat

WORKDIR /app

# =============================================================================
# Stage 2: Dependencies
# =============================================================================
FROM base AS deps

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (dev incluses pour le build)
RUN npm ci

# =============================================================================
# Stage 3: Builder
# =============================================================================
FROM base AS builder

WORKDIR /app

# Copier les dépendances installées
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build de l'application
RUN npm run build

# =============================================================================
# Stage 4: Production
# =============================================================================
FROM base AS production

WORKDIR /app

ENV NODE_ENV=production

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 veilleur

# Copier uniquement les fichiers nécessaires
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copier les migrations Drizzle
COPY --from=builder /app/drizzle ./drizzle

# Changer le propriétaire des fichiers
RUN chown -R veilleur:nodejs /app

USER veilleur

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/api/serveur.js"]

# =============================================================================
# Stage 5: Development
# =============================================================================
FROM base AS development

WORKDIR /app

ENV NODE_ENV=development

# Installer les dépendances de développement
COPY package*.json ./
RUN npm ci

# Le code source sera monté en volume
COPY . .

EXPOSE 3000

# Hot reload avec tsx
CMD ["npm", "run", "dev"]
