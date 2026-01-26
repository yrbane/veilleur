/**
 * Veilleur - Lazy Loading avancé pour les images
 * Utilise IntersectionObserver pour charger les images à la demande
 *
 * Fonctionnalités:
 * - Chargement différé avec IntersectionObserver
 * - Placeholder LQIP (Low Quality Image Placeholder)
 * - Fade-in animation au chargement
 * - Gestion des erreurs avec fallback
 * - Preloading des images proches du viewport
 */

/**
 * Options de configuration du lazy loading
 */
interface OptionsLazyImage {
  // Marge du viewport pour précharger (px ou %)
  rootMargin?: string;
  // Seuil de visibilité pour déclencher le chargement
  threshold?: number;
  // Classe CSS ajoutée pendant le chargement
  classeChargement?: string;
  // Classe CSS ajoutée après le chargement
  classeChargee?: string;
  // Classe CSS ajoutée en cas d'erreur
  classeErreur?: string;
  // Placeholder par défaut (data URL)
  placeholderDefaut?: string;
  // Callback après chargement
  onLoad?: (img: HTMLImageElement) => void;
  // Callback en cas d'erreur
  onError?: (img: HTMLImageElement, error: Event) => void;
}

/**
 * Configuration par défaut
 */
const OPTIONS_DEFAUT: Required<OptionsLazyImage> = {
  rootMargin: '50px 0px', // Précharger 50px avant le viewport
  threshold: 0.1,
  classeChargement: 'image-chargement',
  classeChargee: 'image-chargee',
  classeErreur: 'image-erreur',
  placeholderDefaut: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"%3E%3Crect fill="%23f0f0f0" width="16" height="9"/%3E%3C/svg%3E',
  onLoad: () => {},
  onError: () => {},
};

/**
 * Classe singleton pour gérer le lazy loading des images
 */
class GestionnaireLazyImage {
  private observer: IntersectionObserver | null = null;
  private options: Required<OptionsLazyImage>;
  private imagesObservees = new Set<HTMLImageElement>();

  constructor(options?: OptionsLazyImage) {
    this.options = { ...OPTIONS_DEFAUT, ...options };
    this.initialiser();
  }

  /**
   * Initialise l'IntersectionObserver
   */
  private initialiser(): void {
    // Vérifier le support de IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver non supporté, chargement immédiat des images');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.gererIntersection(entries),
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      },
    );
  }

  /**
   * Gère les intersections détectées
   */
  private gererIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.chargerImage(img);
        this.arreterObservation(img);
      }
    });
  }

  /**
   * Charge une image
   */
  private chargerImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (!src) return;

    // Ajouter la classe de chargement
    img.classList.add(this.options.classeChargement);

    // Créer une image temporaire pour précharger
    const tempImg = new Image();

    tempImg.onload = () => {
      // Appliquer la source réelle
      img.src = src;
      if (srcset) {
        img.srcset = srcset;
      }

      // Mettre à jour les classes
      img.classList.remove(this.options.classeChargement);
      img.classList.add(this.options.classeChargee);

      // Nettoyer les data attributes
      delete img.dataset.src;
      delete img.dataset.srcset;

      this.options.onLoad(img);
    };

    tempImg.onerror = (error) => {
      img.classList.remove(this.options.classeChargement);
      img.classList.add(this.options.classeErreur);

      // Appliquer un placeholder d'erreur
      img.src = this.options.placeholderDefaut;
      img.alt = 'Image non disponible';

      this.options.onError(img, error as Event);
    };

    // Démarrer le chargement
    tempImg.src = src;
  }

  /**
   * Observe une image pour lazy loading
   */
  observer_image(img: HTMLImageElement): void {
    if (this.imagesObservees.has(img)) return;

    // Stocker la source réelle dans data-src
    if (img.src && !img.dataset.src && !img.src.startsWith('data:')) {
      img.dataset.src = img.src;
      if (img.srcset) {
        img.dataset.srcset = img.srcset;
        img.removeAttribute('srcset');
      }
      img.src = this.options.placeholderDefaut;
    }

    if (this.observer) {
      this.observer.observe(img);
      this.imagesObservees.add(img);
    } else {
      // Fallback: charger immédiatement
      this.chargerImage(img);
    }
  }

  /**
   * Arrête d'observer une image
   */
  arreterObservation(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(img);
    }
    this.imagesObservees.delete(img);
  }

  /**
   * Observe toutes les images avec l'attribut data-lazy
   */
  observerToutesImages(conteneur: HTMLElement = document.body): void {
    const images = conteneur.querySelectorAll<HTMLImageElement>('img[data-lazy]');
    images.forEach((img) => this.observer_image(img));
  }

  /**
   * Force le chargement de toutes les images observées
   */
  forcerChargement(): void {
    this.imagesObservees.forEach((img) => {
      this.chargerImage(img);
      this.arreterObservation(img);
    });
  }

  /**
   * Détruit le gestionnaire
   */
  detruire(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.imagesObservees.clear();
  }

  /**
   * Retourne les statistiques
   */
  obtenirStatistiques(): { enAttente: number } {
    return {
      enAttente: this.imagesObservees.size,
    };
  }
}

/**
 * Instance singleton du gestionnaire
 */
let instance: GestionnaireLazyImage | null = null;

/**
 * Obtient ou crée l'instance du gestionnaire
 */
export function obtenirGestionnaireLazyImage(
  options?: OptionsLazyImage,
): GestionnaireLazyImage {
  if (!instance) {
    instance = new GestionnaireLazyImage(options);
  }
  return instance;
}

/**
 * Crée un élément image avec lazy loading
 */
export function creerImageLazy(
  src: string,
  alt: string = '',
  options?: {
    classes?: string[];
    placeholder?: string;
  },
): HTMLImageElement {
  const img = document.createElement('img');

  img.alt = alt;
  img.dataset.lazy = 'true';
  img.dataset.src = src;
  img.src = options?.placeholder ?? OPTIONS_DEFAUT.placeholderDefaut;

  if (options?.classes) {
    img.classList.add(...options.classes);
  }

  // Observer automatiquement
  const gestionnaire = obtenirGestionnaireLazyImage();
  // Différer l'observation pour que l'image soit dans le DOM
  requestAnimationFrame(() => {
    gestionnaire.observer_image(img);
  });

  return img;
}

/**
 * Initialise le lazy loading sur les images existantes
 */
export function initialiserLazyLoading(
  conteneur: HTMLElement = document.body,
  options?: OptionsLazyImage,
): void {
  const gestionnaire = obtenirGestionnaireLazyImage(options);
  gestionnaire.observerToutesImages(conteneur);
}

/**
 * Nettoie le lazy loading
 */
export function nettoyerLazyLoading(): void {
  if (instance) {
    instance.detruire();
    instance = null;
  }
}
