/**
 * Veilleur - Types utilitaires TypeScript avancés
 * Types génériques réutilisables pour améliorer la type-safety
 *
 * Fonctionnalités:
 * - Manipulation d'objets (Pick, Omit avancés)
 * - Types conditionnels
 * - Branded types pour IDs
 * - Résultats et erreurs typés
 * - Utilitaires pour API
 */

// ============================================================
// MANIPULATION D'OBJETS
// ============================================================

/**
 * Rend certaines propriétés optionnelles
 */
export type PartielSelectif<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Rend certaines propriétés requises
 */
export type RequisSelectif<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Rend toutes les propriétés mutables (retire readonly)
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Rend toutes les propriétés en profondeur optionnelles
 */
export type PartielProfond<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<PartielProfond<U>>
      : PartielProfond<T[P]>
    : T[P];
};

/**
 * Rend toutes les propriétés en profondeur requises
 */
export type RequisProfond<T> = {
  [P in keyof T]-?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<RequisProfond<U>>
      : RequisProfond<T[P]>
    : T[P];
};

/**
 * Rend toutes les propriétés en profondeur readonly
 */
export type ReadonlyProfond<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Array<infer U>
      ? ReadonlyArray<ReadonlyProfond<U>>
      : ReadonlyProfond<T[P]>
    : T[P];
};

/**
 * Extrait les clés dont les valeurs sont d'un type spécifique
 */
export type ClesDeType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Exclut les clés dont les valeurs sont d'un type spécifique
 */
export type ClesExcluantType<T, U> = {
  [K in keyof T]: T[K] extends U ? never : K;
}[keyof T];

/**
 * Pick avec propriétés d'un certain type
 */
export type PickParType<T, U> = Pick<T, ClesDeType<T, U>>;

/**
 * Omit avec propriétés d'un certain type
 */
export type OmitParType<T, U> = Pick<T, ClesExcluantType<T, U>>;

// ============================================================
// BRANDED TYPES (Types nominaux)
// ============================================================

/**
 * Symbole unique pour le branding
 */
declare const __brand: unique symbol;

/**
 * Type brandé pour créer des types nominaux
 */
export type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * IDs typés pour éviter les mélanges
 */
export type UtilisateurId = Brand<string, 'UtilisateurId'>;
export type SourceId = Brand<string, 'SourceId'>;
export type ArticleId = Brand<string, 'ArticleId'>;
export type AbonnementId = Brand<string, 'AbonnementId'>;
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Créateurs d'IDs typés
 */
export const creerUtilisateurId = (id: string): UtilisateurId => id as UtilisateurId;
export const creerSourceId = (id: string): SourceId => id as SourceId;
export const creerArticleId = (id: string): ArticleId => id as ArticleId;
export const creerAbonnementId = (id: string): AbonnementId => id as AbonnementId;
export const creerSessionId = (id: string): SessionId => id as SessionId;

// ============================================================
// RÉSULTATS ET ERREURS
// ============================================================

/**
 * Type Result pour gestion explicite des erreurs
 */
export type Resultat<T, E = Error> =
  | { succes: true; valeur: T }
  | { succes: false; erreur: E };

/**
 * Crée un résultat de succès
 */
export function succes<T>(valeur: T): Resultat<T, never> {
  return { succes: true, valeur };
}

/**
 * Crée un résultat d'erreur
 */
export function echec<E>(erreur: E): Resultat<never, E> {
  return { succes: false, erreur };
}

/**
 * Extrait la valeur ou lance l'erreur
 */
export function deballer<T, E>(resultat: Resultat<T, E>): T {
  if (resultat.succes) return resultat.valeur;
  throw resultat.erreur;
}

/**
 * Extrait la valeur ou retourne une valeur par défaut
 */
export function deballerOuDefaut<T, E>(resultat: Resultat<T, E>, defaut: T): T {
  return resultat.succes ? resultat.valeur : defaut;
}

/**
 * Applique une transformation au résultat
 */
export function mapResultat<T, U, E>(
  resultat: Resultat<T, E>,
  fn: (valeur: T) => U,
): Resultat<U, E> {
  return resultat.succes ? succes(fn(resultat.valeur)) : resultat;
}

/**
 * Type Option pour valeurs potentiellement absentes
 */
export type Option<T> = T | null | undefined;

/**
 * Vérifie si une option a une valeur
 */
export function estDefini<T>(valeur: Option<T>): valeur is T {
  return valeur !== null && valeur !== undefined;
}

// ============================================================
// TYPES POUR API
// ============================================================

/**
 * Réponse API paginée
 */
export interface ReponsePaginee<T> {
  donnees: T[];
  pagination: {
    page: number;
    limite: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Réponse API avec curseur
 */
export interface ReponseCurseur<T> {
  donnees: T[];
  pagination: {
    curseurSuivant: string | null;
    curseurPrecedent: string | null;
    limite: number;
    aPlus: boolean;
  };
}

/**
 * Réponse API de succès
 */
export interface ReponseSucces<T> {
  succes: true;
  donnees: T;
}

/**
 * Réponse API d'erreur
 */
export interface ReponseErreur {
  succes: false;
  code: string;
  message: string;
  erreurs?: Array<{ chemin: string; message: string }>;
}

/**
 * Réponse API générique
 */
export type ReponseApi<T> = ReponseSucces<T> | ReponseErreur;

/**
 * Paramètres de requête de liste
 */
export interface ParamsListe {
  page?: number;
  limite?: number;
  tri?: string;
  ordre?: 'asc' | 'desc';
  recherche?: string;
}

// ============================================================
// TYPES UTILITAIRES DIVERS
// ============================================================

/**
 * Type qui représente une fonction async
 */
export type FonctionAsync<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

/**
 * Extrait le type de retour d'une Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Type union de string literal
 */
export type LiteralUnion<T extends string, U = string> = T | (U & Record<never, never>);

/**
 * Rend un type nullable
 */
export type Nullable<T> = T | null;

/**
 * Rend un type potentiellement undefined
 */
export type Optionnel<T> = T | undefined;

/**
 * Exclut null et undefined
 */
export type NonNullableStrict<T> = T extends null | undefined ? never : T;

/**
 * Tuple de longueur fixe
 */
export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : _TupleOf<T, N, [T, ...R]>;

/**
 * Au moins un élément dans le tableau
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Objet avec clés string et valeurs d'un type
 */
export type Dictionnaire<T> = Record<string, T>;

/**
 * JSON-safe types
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

// ============================================================
// GUARDS DE TYPE
// ============================================================

/**
 * Vérifie si une valeur est un objet
 */
export function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

/**
 * Vérifie si une valeur est un tableau non vide
 */
export function estTableauNonVide<T>(valeur: T[]): valeur is NonEmptyArray<T> {
  return valeur.length > 0;
}

/**
 * Vérifie si une valeur est une string non vide
 */
export function estStringNonVide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.length > 0;
}

/**
 * Vérifie si une valeur est un nombre fini
 */
export function estNombreFini(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isFinite(valeur);
}

// ============================================================
// UTILITAIRES DE MANIPULATION
// ============================================================

/**
 * Extrait les clés d'un objet avec type correct
 */
export function cles<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

/**
 * Extrait les valeurs d'un objet avec type correct
 */
export function valeurs<T extends object>(obj: T): T[keyof T][] {
  return Object.values(obj) as T[keyof T][];
}

/**
 * Extrait les entrées d'un objet avec type correct
 */
export function entrees<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

/**
 * Construit un objet à partir d'entrées
 */
export function depuisEntrees<K extends string, V>(
  entries: Iterable<readonly [K, V]>,
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}

/**
 * Filtre les valeurs nullish d'un tableau
 */
export function filtrerNullish<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((item): item is T => item != null);
}

/**
 * Groupe un tableau par une clé
 */
export function grouperPar<T, K extends string | number>(
  arr: T[],
  fn: (item: T) => K,
): Record<K, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = fn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

/**
 * Crée un dictionnaire à partir d'un tableau
 */
export function enDictionnaire<T, K extends string | number>(
  arr: T[],
  fn: (item: T) => K,
): Record<K, T> {
  return arr.reduce(
    (acc, item) => {
      acc[fn(item)] = item;
      return acc;
    },
    {} as Record<K, T>,
  );
}
