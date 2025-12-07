/**
 * Veilleur - Schémas de validation Zod centralisés
 * Validation type-safe avec messages d'erreur personnalisés en français
 *
 * Fonctionnalités:
 * - Schémas réutilisables pour entités communes
 * - Messages d'erreur localisés
 * - Transformations et raffinements
 * - Validateurs personnalisés
 * - Export des types inférés
 */

import { z } from 'zod';

// ============================================================
// MESSAGES D'ERREUR PERSONNALISÉS
// ============================================================

const messages = {
  required: 'Ce champ est requis',
  invalid_type: 'Type de données invalide',
  too_small: {
    string: (min: number) => `Minimum ${min} caractères`,
    array: (min: number) => `Minimum ${min} éléments`,
    number: (min: number) => `Minimum ${min}`,
  },
  too_big: {
    string: (max: number) => `Maximum ${max} caractères`,
    array: (max: number) => `Maximum ${max} éléments`,
    number: (max: number) => `Maximum ${max}`,
  },
  invalid_email: 'Email invalide',
  invalid_url: 'URL invalide',
  invalid_uuid: 'Identifiant invalide',
  invalid_date: 'Date invalide',
  custom: {
    password_weak: 'Mot de passe trop faible (min 8 caractères, 1 majuscule, 1 chiffre)',
    url_protocol: 'L\'URL doit commencer par http:// ou https://',
    future_date: 'La date doit être dans le futur',
    past_date: 'La date doit être dans le passé',
  },
};

// ============================================================
// PRIMITIVES RÉUTILISABLES
// ============================================================

/**
 * String non vide
 */
export const stringNonVide = z.string({
  required_error: messages.required,
  invalid_type_error: messages.invalid_type,
}).min(1, messages.required);

/**
 * Email validé
 */
export const email = z.string({
  required_error: messages.required,
}).email(messages.invalid_email).toLowerCase().trim();

/**
 * URL validée avec protocole
 */
export const url = z.string({
  required_error: messages.required,
}).url(messages.invalid_url).refine(
  (val) => val.startsWith('http://') || val.startsWith('https://'),
  { message: messages.custom.url_protocol },
);

/**
 * URL optionnelle (peut être vide ou null)
 */
export const urlOptionnelle = z.union([
  url,
  z.literal(''),
  z.null(),
]).optional().transform(val => val || null);

/**
 * UUID v4
 */
export const uuid = z.string({
  required_error: messages.required,
}).uuid(messages.invalid_uuid);

/**
 * Date ISO 8601
 */
export const dateIso = z.string({
  required_error: messages.required,
}).datetime({ message: messages.invalid_date });

/**
 * Date JavaScript
 */
export const dateJs = z.date({
  required_error: messages.required,
  invalid_type_error: messages.invalid_date,
});

/**
 * Mot de passe sécurisé
 */
export const motDePasse = z.string({
  required_error: messages.required,
}).min(8, messages.too_small.string(8)).regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
  messages.custom.password_weak,
);

/**
 * Entier positif
 */
export const entierPositif = z.number({
  required_error: messages.required,
  invalid_type_error: messages.invalid_type,
}).int('Nombre entier requis').positive('Doit être positif');

/**
 * Entier positif depuis string (pour query params)
 */
export const entierPositifString = z.string()
  .transform((val) => parseInt(val, 10))
  .pipe(entierPositif);

/**
 * Booléen depuis string (pour query params)
 */
export const booleanString = z.union([
  z.literal('true').transform(() => true),
  z.literal('false').transform(() => false),
  z.literal('1').transform(() => true),
  z.literal('0').transform(() => false),
  z.boolean(),
]);

// ============================================================
// SCHÉMAS D'ENTITÉS
// ============================================================

/**
 * Schéma de source RSS/Atom
 */
export const schemaSource = z.object({
  titre: stringNonVide.max(255, messages.too_big.string(255)),
  url: url,
  description: z.string().max(1000, messages.too_big.string(1000)).optional(),
  categorie: z.string().max(100, messages.too_big.string(100)).optional(),
  icone: urlOptionnelle,
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale invalide').optional(),
  estPublique: z.boolean().default(false),
  intervalleSync: entierPositif.min(5, 'Minimum 5 minutes').max(1440, 'Maximum 24h').default(60),
});

export type Source = z.infer<typeof schemaSource>;

/**
 * Schéma de création de source (URL seule, le reste est extrait)
 */
export const schemaCreationSource = z.object({
  url: url,
  categorie: z.string().max(100).optional(),
});

export type CreationSource = z.infer<typeof schemaCreationSource>;

/**
 * Schéma de mise à jour de source
 */
export const schemaMiseAJourSource = schemaSource.partial();

export type MiseAJourSource = z.infer<typeof schemaMiseAJourSource>;

/**
 * Schéma d'article
 */
export const schemaArticle = z.object({
  titre: stringNonVide.max(500, messages.too_big.string(500)),
  lien: url,
  description: z.string().max(5000, messages.too_big.string(5000)).optional(),
  contenu: z.string().optional(),
  auteur: z.string().max(255, messages.too_big.string(255)).optional(),
  datePublication: dateJs.optional(),
  image: urlOptionnelle,
  categories: z.array(z.string().max(100)).max(20, messages.too_big.array(20)).default([]),
  sourceId: uuid,
});

export type Article = z.infer<typeof schemaArticle>;

/**
 * Schéma utilisateur
 */
export const schemaUtilisateur = z.object({
  email: email,
  nom: z.string().min(2, messages.too_small.string(2)).max(100, messages.too_big.string(100)),
  avatar: urlOptionnelle,
  preferences: z.object({
    theme: z.enum(['clair', 'sombre', 'auto']).default('auto'),
    langue: z.enum(['fr', 'en']).default('fr'),
    articlesPardPage: entierPositif.min(5).max(100).default(20),
    notificationsEmail: z.boolean().default(true),
  }).default({}),
});

export type Utilisateur = z.infer<typeof schemaUtilisateur>;

/**
 * Schéma d'inscription
 */
export const schemaInscription = z.object({
  email: email,
  motDePasse: motDePasse,
  nom: z.string().min(2, messages.too_small.string(2)).max(100, messages.too_big.string(100)),
}).refine(
  (data) => !data.email.includes('+'),
  { message: 'Les alias email avec + ne sont pas autorisés', path: ['email'] },
);

export type Inscription = z.infer<typeof schemaInscription>;

/**
 * Schéma de connexion
 */
export const schemaConnexion = z.object({
  email: email,
  motDePasse: z.string().min(1, messages.required),
  seRappeler: z.boolean().default(false),
});

export type Connexion = z.infer<typeof schemaConnexion>;

/**
 * Schéma de changement de mot de passe
 */
export const schemaChangementMotDePasse = z.object({
  motDePasseActuel: z.string().min(1, messages.required),
  nouveauMotDePasse: motDePasse,
  confirmation: z.string().min(1, messages.required),
}).refine(
  (data) => data.nouveauMotDePasse === data.confirmation,
  { message: 'Les mots de passe ne correspondent pas', path: ['confirmation'] },
).refine(
  (data) => data.motDePasseActuel !== data.nouveauMotDePasse,
  { message: 'Le nouveau mot de passe doit être différent', path: ['nouveauMotDePasse'] },
);

export type ChangementMotDePasse = z.infer<typeof schemaChangementMotDePasse>;

// ============================================================
// SCHÉMAS DE REQUÊTES API
// ============================================================

/**
 * Paramètres de pagination
 */
export const schemaPagination = z.object({
  page: entierPositifString.default('1').optional(),
  limite: z.string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .default('20')
    .optional(),
  curseur: z.string().optional(),
  direction: z.enum(['suivant', 'precedent']).default('suivant').optional(),
});

export type Pagination = z.infer<typeof schemaPagination>;

/**
 * Paramètres de tri
 */
export const schemaTri = z.object({
  tri: z.string().optional(),
  ordre: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type Tri = z.infer<typeof schemaTri>;

/**
 * Paramètres de filtrage d'articles
 */
export const schemaFiltresArticles = z.object({
  sourceId: uuid.optional(),
  categorie: z.string().max(100).optional(),
  recherche: z.string().max(200).optional(),
  depuis: dateIso.optional(),
  jusqua: dateIso.optional(),
  nonLus: booleanString.optional(),
  favoris: booleanString.optional(),
});

export type FiltresArticles = z.infer<typeof schemaFiltresArticles>;

/**
 * Requête de liste d'articles complète
 */
export const schemaRequeteArticles = schemaPagination
  .merge(schemaTri)
  .merge(schemaFiltresArticles);

export type RequeteArticles = z.infer<typeof schemaRequeteArticles>;

// ============================================================
// UTILITAIRES DE VALIDATION
// ============================================================

/**
 * Valide et parse des données avec un schéma
 * Retourne soit les données validées, soit les erreurs formatées
 */
export type ResultatValidation<T> =
  | { succes: true; donnees: T }
  | { succes: false; erreurs: ErreurValidation[] };

export interface ErreurValidation {
  chemin: string;
  message: string;
  code: string;
}

/**
 * Valide des données avec un schéma Zod
 */
export function valider<T>(
  schema: z.ZodSchema<T>,
  donnees: unknown,
): ResultatValidation<T> {
  const resultat = schema.safeParse(donnees);

  if (resultat.success) {
    return { succes: true, donnees: resultat.data };
  }

  const erreurs: ErreurValidation[] = resultat.error.errors.map((err) => ({
    chemin: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return { succes: false, erreurs };
}

/**
 * Valide ou lance une exception
 */
export function validerOuErreur<T>(
  schema: z.ZodSchema<T>,
  donnees: unknown,
): T {
  return schema.parse(donnees);
}

/**
 * Crée un middleware de validation pour Express
 */
export function creerMiddlewareValidation<T>(
  schema: z.ZodSchema<T>,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: { body?: unknown; query?: unknown; params?: unknown }, res: { status: (code: number) => { json: (data: unknown) => void } }, next: () => void) => {
    const donnees = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const resultat = valider(schema, donnees);

    if (!resultat.succes) {
      return res.status(400).json({
        succes: false,
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        erreurs: resultat.erreurs,
      });
    }

    // Remplacer les données par les données validées/transformées
    if (source === 'body') req.body = resultat.donnees;
    else if (source === 'query') req.query = resultat.donnees as unknown as typeof req.query;
    else req.params = resultat.donnees as unknown as typeof req.params;

    next();
  };
}

/**
 * Combine plusieurs schémas en un seul
 */
export function combinerSchemas<T extends z.ZodRawShape[]>(
  ...schemas: { [K in keyof T]: z.ZodObject<T[K]> }
): z.ZodObject<T[number]> {
  return schemas.reduce((acc, schema) => acc.merge(schema)) as z.ZodObject<T[number]>;
}

// ============================================================
// VALIDATEURS PERSONNALISÉS
// ============================================================

/**
 * Vérifie qu'une URL est accessible (async)
 */
export const urlAccessible = url.superRefine(async (val, ctx) => {
  try {
    const response = await fetch(val, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `URL inaccessible (${response.status})`,
      });
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'URL inaccessible',
    });
  }
});

/**
 * Vérifie que la date est dans le futur
 */
export const dateFuture = dateJs.refine(
  (date) => date > new Date(),
  { message: messages.custom.future_date },
);

/**
 * Vérifie que la date est dans le passé
 */
export const datePasse = dateJs.refine(
  (date) => date < new Date(),
  { message: messages.custom.past_date },
);

/**
 * Slugify une chaîne
 */
export const slug = z.string().transform((val) =>
  val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
);

// ============================================================
// EXPORTS GROUPÉS
// ============================================================

export const schemas = {
  // Entités
  source: schemaSource,
  creationSource: schemaCreationSource,
  miseAJourSource: schemaMiseAJourSource,
  article: schemaArticle,
  utilisateur: schemaUtilisateur,
  inscription: schemaInscription,
  connexion: schemaConnexion,
  changementMotDePasse: schemaChangementMotDePasse,

  // Requêtes
  pagination: schemaPagination,
  tri: schemaTri,
  filtresArticles: schemaFiltresArticles,
  requeteArticles: schemaRequeteArticles,

  // Primitives
  email,
  url,
  uuid,
  motDePasse,
  dateIso,
  dateJs,
  stringNonVide,
  entierPositif,
  booleanString,
  slug,
};
