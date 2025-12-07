/**
 * Veilleur - Utilitaire de retry avec backoff exponentiel
 * Gestion des opérations qui peuvent échouer temporairement
 *
 * Fonctionnalités:
 * - Retry automatique avec backoff exponentiel
 * - Jitter pour éviter thundering herd
 * - Circuit breaker intégré
 * - Timeout par tentative
 * - Filtrage des erreurs retryable
 * - Hooks pour logging/monitoring
 */

import { logger } from '@/infrastructure/logging/logger';

const loggerRetry = logger.child({ module: 'retry' });

// ============================================================
// TYPES ET INTERFACES
// ============================================================

/**
 * Options de retry
 */
export interface OptionsRetry {
  // Nombre maximum de tentatives (défaut: 3)
  maxTentatives?: number;
  // Délai initial entre tentatives en ms (défaut: 1000)
  delaiInitial?: number;
  // Facteur multiplicateur pour backoff (défaut: 2)
  facteurBackoff?: number;
  // Délai maximum entre tentatives en ms (défaut: 30000)
  delaiMax?: number;
  // Ajouter du jitter aléatoire (défaut: true)
  jitter?: boolean;
  // Timeout par tentative en ms (optionnel)
  timeoutTentative?: number;
  // Fonction pour déterminer si une erreur est retryable
  estRetryable?: (erreur: unknown) => boolean;
  // Hook appelé avant chaque retry
  onRetry?: (erreur: unknown, tentative: number, prochainDelai: number) => void;
  // Hook appelé en cas d'échec final
  onEchecFinal?: (erreur: unknown, tentatives: number) => void;
}

/**
 * Résultat d'un retry
 */
export interface ResultatRetry<T> {
  succes: boolean;
  resultat?: T;
  erreur?: unknown;
  tentatives: number;
  tempsTotal: number;
}

/**
 * État du circuit breaker
 */
type EtatCircuit = 'ferme' | 'ouvert' | 'semi-ouvert';

// ============================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================

const OPTIONS_DEFAUT: Required<Omit<OptionsRetry, 'timeoutTentative' | 'onRetry' | 'onEchecFinal' | 'estRetryable'>> = {
  maxTentatives: 3,
  delaiInitial: 1000,
  facteurBackoff: 2,
  delaiMax: 30000,
  jitter: true,
};

// ============================================================
// FONCTIONS DE RETRY
// ============================================================

/**
 * Calcule le délai pour la prochaine tentative
 */
function calculerDelai(
  tentative: number,
  delaiInitial: number,
  facteurBackoff: number,
  delaiMax: number,
  jitter: boolean,
): number {
  let delai = delaiInitial * Math.pow(facteurBackoff, tentative - 1);
  delai = Math.min(delai, delaiMax);

  if (jitter) {
    // Ajoute un jitter de ±25%
    const jitterRange = delai * 0.25;
    delai = delai - jitterRange + Math.random() * jitterRange * 2;
  }

  return Math.round(delai);
}

/**
 * Vérifie si une erreur est retryable par défaut
 */
function estRetryableParDefaut(erreur: unknown): boolean {
  // Erreurs réseau
  if (erreur instanceof TypeError && erreur.message.includes('fetch')) {
    return true;
  }

  // Erreurs avec code HTTP
  if (erreur && typeof erreur === 'object' && 'status' in erreur) {
    const status = (erreur as { status: number }).status;
    // Retry pour 408 (Timeout), 429 (Too Many Requests), 500+
    return status === 408 || status === 429 || status >= 500;
  }

  // Erreurs avec code
  if (erreur && typeof erreur === 'object' && 'code' in erreur) {
    const code = (erreur as { code: string }).code;
    const codesRetryable = [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
      'EPIPE', 'EHOSTUNREACH', 'EAI_AGAIN',
    ];
    return codesRetryable.includes(code);
  }

  return false;
}

/**
 * Attend un délai
 */
function attendre(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exécute une fonction avec retry
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: OptionsRetry = {},
): Promise<T> {
  const opts = { ...OPTIONS_DEFAUT, ...options };
  const estRetryable = opts.estRetryable ?? estRetryableParDefaut;

  let dernierErreur: unknown;

  for (let tentative = 1; tentative <= opts.maxTentatives; tentative++) {
    try {
      // Appliquer le timeout si configuré
      if (opts.timeoutTentative) {
        const resultat = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout tentative')), opts.timeoutTentative),
          ),
        ]);
        return resultat;
      }

      return await fn();
    } catch (erreur) {
      dernierErreur = erreur;

      // Si c'est la dernière tentative ou non retryable, on lance l'erreur
      if (tentative >= opts.maxTentatives || !estRetryable(erreur)) {
        opts.onEchecFinal?.(erreur, tentative);
        throw erreur;
      }

      // Calculer le délai avant le retry
      const delai = calculerDelai(
        tentative,
        opts.delaiInitial,
        opts.facteurBackoff,
        opts.delaiMax,
        opts.jitter,
      );

      opts.onRetry?.(erreur, tentative, delai);

      loggerRetry.debug(
        { tentative, maxTentatives: opts.maxTentatives, delai, erreur: String(erreur) },
        'Retry après erreur',
      );

      await attendre(delai);
    }
  }

  // Ne devrait jamais arriver
  throw dernierErreur;
}

/**
 * Version avec résultat détaillé
 */
export async function retryAvecDetails<T>(
  fn: () => Promise<T>,
  options: OptionsRetry = {},
): Promise<ResultatRetry<T>> {
  const debut = Date.now();
  let tentatives = 0;

  try {
    const resultat = await retry(fn, {
      ...options,
      onRetry: (erreur, tentative, delai) => {
        tentatives = tentative;
        options.onRetry?.(erreur, tentative, delai);
      },
    });

    return {
      succes: true,
      resultat,
      tentatives: tentatives + 1,
      tempsTotal: Date.now() - debut,
    };
  } catch (erreur) {
    return {
      succes: false,
      erreur,
      tentatives: tentatives + 1,
      tempsTotal: Date.now() - debut,
    };
  }
}

// ============================================================
// CIRCUIT BREAKER
// ============================================================

/**
 * Options du circuit breaker
 */
export interface OptionsCircuitBreaker {
  // Seuil d'échecs pour ouvrir le circuit
  seuilEchecs?: number;
  // Durée en ms avant de tester la réouverture
  dureeFermeture?: number;
  // Pourcentage minimum d'échecs pour ouvrir
  pourcentageEchec?: number;
  // Fenêtre de temps pour le calcul du taux d'échec
  fenetreCalcul?: number;
  // Callback quand l'état change
  onChangementEtat?: (ancien: EtatCircuit, nouveau: EtatCircuit) => void;
}

const OPTIONS_CIRCUIT_DEFAUT: Required<Omit<OptionsCircuitBreaker, 'onChangementEtat'>> = {
  seuilEchecs: 5,
  dureeFermeture: 30000,
  pourcentageEchec: 50,
  fenetreCalcul: 60000,
};

/**
 * Circuit breaker pour protéger les services
 */
export class CircuitBreaker {
  private etat: EtatCircuit = 'ferme';
  private echecs: number[] = [];
  private succes: number[] = [];
  private derniereOuverture = 0;
  private options: Required<Omit<OptionsCircuitBreaker, 'onChangementEtat'>> & Pick<OptionsCircuitBreaker, 'onChangementEtat'>;

  constructor(options: OptionsCircuitBreaker = {}) {
    this.options = { ...OPTIONS_CIRCUIT_DEFAUT, ...options };
  }

  /**
   * Exécute une fonction avec protection circuit breaker
   */
  async executer<T>(fn: () => Promise<T>): Promise<T> {
    if (this.estOuvert()) {
      throw new Error('Circuit ouvert - service temporairement indisponible');
    }

    try {
      const resultat = await fn();
      this.enregistrerSucces();
      return resultat;
    } catch (erreur) {
      this.enregistrerEchec();
      throw erreur;
    }
  }

  /**
   * Vérifie si le circuit est ouvert
   */
  private estOuvert(): boolean {
    this.nettoyerHistorique();

    if (this.etat === 'ferme') {
      return false;
    }

    if (this.etat === 'ouvert') {
      // Vérifier si on peut passer en semi-ouvert
      if (Date.now() - this.derniereOuverture >= this.options.dureeFermeture) {
        this.changerEtat('semi-ouvert');
        return false;
      }
      return true;
    }

    // Semi-ouvert: laisser passer une requête
    return false;
  }

  /**
   * Enregistre un succès
   */
  private enregistrerSucces(): void {
    this.succes.push(Date.now());

    if (this.etat === 'semi-ouvert') {
      this.changerEtat('ferme');
      this.echecs = [];
    }
  }

  /**
   * Enregistre un échec
   */
  private enregistrerEchec(): void {
    this.echecs.push(Date.now());

    if (this.etat === 'semi-ouvert') {
      this.changerEtat('ouvert');
      this.derniereOuverture = Date.now();
      return;
    }

    if (this.etat === 'ferme' && this.doitOuvrir()) {
      this.changerEtat('ouvert');
      this.derniereOuverture = Date.now();
    }
  }

  /**
   * Vérifie si le circuit doit s'ouvrir
   */
  private doitOuvrir(): boolean {
    // Vérifier le seuil absolu
    if (this.echecs.length >= this.options.seuilEchecs) {
      return true;
    }

    // Vérifier le pourcentage d'échec
    const total = this.echecs.length + this.succes.length;
    if (total >= 10) { // Au moins 10 requêtes pour calculer
      const pourcentage = (this.echecs.length / total) * 100;
      return pourcentage >= this.options.pourcentageEchec;
    }

    return false;
  }

  /**
   * Nettoie l'historique ancien
   */
  private nettoyerHistorique(): void {
    const seuil = Date.now() - this.options.fenetreCalcul;
    this.echecs = this.echecs.filter(t => t >= seuil);
    this.succes = this.succes.filter(t => t >= seuil);
  }

  /**
   * Change l'état du circuit
   */
  private changerEtat(nouvelEtat: EtatCircuit): void {
    const ancien = this.etat;
    this.etat = nouvelEtat;

    loggerRetry.info({ ancien, nouveau: nouvelEtat }, 'Changement état circuit breaker');
    this.options.onChangementEtat?.(ancien, nouvelEtat);
  }

  /**
   * Obtient l'état actuel
   */
  obtenirEtat(): EtatCircuit {
    return this.etat;
  }

  /**
   * Obtient les statistiques
   */
  obtenirStatistiques(): {
    etat: EtatCircuit;
    echecs: number;
    succes: number;
    tauxEchec: number;
  } {
    this.nettoyerHistorique();
    const total = this.echecs.length + this.succes.length;

    return {
      etat: this.etat,
      echecs: this.echecs.length,
      succes: this.succes.length,
      tauxEchec: total > 0 ? (this.echecs.length / total) * 100 : 0,
    };
  }

  /**
   * Force la fermeture du circuit
   */
  forcerFermeture(): void {
    this.changerEtat('ferme');
    this.echecs = [];
    this.succes = [];
  }
}

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Combine retry avec circuit breaker
 */
export function creerRetryAvecCircuit(
  circuitBreaker: CircuitBreaker,
  optionsRetry: OptionsRetry = {},
): <T>(fn: () => Promise<T>) => Promise<T> {
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return retry(() => circuitBreaker.executer(fn), optionsRetry);
  };
}

/**
 * Décorateur de méthode avec retry
 */
export function avecRetry(options: OptionsRetry = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const methodOriginal = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return retry(() => methodOriginal.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Timeout wrapper pour promises
 */
export async function avecTimeout<T>(
  promesse: Promise<T>,
  timeoutMs: number,
  message = 'Opération timeout',
): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs),
    ),
  ]);
}

/**
 * Batch retry pour plusieurs opérations
 */
export async function retryBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: OptionsRetry & { concurrence?: number } = {},
): Promise<Array<ResultatRetry<R>>> {
  const concurrence = options.concurrence ?? 5;
  const resultats: Array<ResultatRetry<R>> = [];

  for (let i = 0; i < items.length; i += concurrence) {
    const batch = items.slice(i, i + concurrence);
    const batchResultats = await Promise.all(
      batch.map(item => retryAvecDetails(() => fn(item), options)),
    );
    resultats.push(...batchResultats);
  }

  return resultats;
}
