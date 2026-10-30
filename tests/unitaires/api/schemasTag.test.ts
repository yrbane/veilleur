/**
 * Veilleur - Schéma de réponse des tags
 * Fastify sérialise les réponses d'après leur schéma JSON : un tag déclaré comme simple
 * `{ type: 'object' }` ressort vide ({}). Le schéma partagé doit conserver id, nom et slug.
 */

import { describe, it, expect } from 'vitest';
import fastJson from 'fast-json-stringify';
import { schemaReponseTag } from '@/api/schemas/tag';

describe('schemaReponseTag', () => {
  it('conserve id, nom, slug et dateCreation à la sérialisation', () => {
    const serialiser = fastJson({ type: 'array', items: schemaReponseTag });

    const json = serialiser([{ id: 't1', nom: 'Écologie', slug: 'ecologie', dateCreation: '2026-10-30T09:00:00.000Z' }]);

    expect(JSON.parse(json)).toEqual([{ id: 't1', nom: 'Écologie', slug: 'ecologie', dateCreation: '2026-10-30T09:00:00.000Z' }]);
  });

  it('tolère un tag sans date (tags joints aux sources)', () => {
    const serialiser = fastJson(schemaReponseTag);

    expect(JSON.parse(serialiser({ id: 't1', nom: 'Tech', slug: 'tech' }))).toEqual({ id: 't1', nom: 'Tech', slug: 'tech' });
  });
});
