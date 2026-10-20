/**
 * Veilleur - Utilitaires DOM
 * Helpers pour la manipulation du DOM
 */

import { icone } from './icones';

/**
 * Sélectionne un élément du DOM
 */
export function $(selector: string, parent: ParentNode = document): Element | null {
  return parent.querySelector(selector);
}

/**
 * Sélectionne tous les éléments correspondants
 */
export function $$(selector: string, parent: ParentNode = document): Element[] {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Crée un élément HTML avec des attributs et du contenu
 */
export function creerElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    classes?: string[];
    attrs?: Record<string, string>;
    texte?: string;
    html?: string;
    enfants?: Node[];
    /** Icône Material placée avant le texte */
    icone?: string;
    onClick?: (e: Event) => void;
  },
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options?.classes) {
    // Une entrée peut porter plusieurs classes (« la-btn primary »)
    const validClasses = options.classes.flatMap(c => c.split(' ')).filter(c => c);
    if (validClasses.length > 0) {
      element.classList.add(...validClasses);
    }
  }

  if (options?.icone) {
    element.append(icone(options.icone));
  }

  if (options?.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      element.setAttribute(key, value);
    }
  }

  if (options?.texte) {
    if (options.icone) {
      element.append(document.createTextNode(options.texte));
    } else {
      element.textContent = options.texte;
    }
  }

  if (options?.html) {
    element.innerHTML = options.html;
  }

  if (options?.enfants) {
    element.append(...options.enfants);
  }

  if (options?.onClick) {
    element.addEventListener('click', options.onClick);
  }

  return element;
}

/**
 * Vide le contenu d'un élément
 */
export function vider(element: Element): void {
  element.innerHTML = '';
}

/**
 * Affiche un élément
 */
export function afficher(element: Element): void {
  element.classList.remove('masque');
}

/**
 * Masque un élément
 */
export function masquer(element: Element): void {
  element.classList.add('masque');
}

/**
 * Bascule la visibilité d'un élément
 */
export function basculer(element: Element, visible?: boolean): void {
  if (visible === undefined) {
    element.classList.toggle('masque');
  } else if (visible) {
    afficher(element);
  } else {
    masquer(element);
  }
}
