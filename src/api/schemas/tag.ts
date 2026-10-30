/**
 * Veilleur - Schéma JSON de réponse d'un tag
 * Partagé par les routes qui renvoient des tags : sans propriétés déclarées, Fastify
 * (fast-json-stringify) sérialiserait chaque tag en objet vide.
 */

export const schemaReponseTag = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    nom: { type: 'string' },
    slug: { type: 'string' },
    dateCreation: { type: 'string' },
  },
} as const;
