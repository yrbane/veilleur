/**
 * Veilleur - Icônes Material Symbols (Google), police auto-hébergée
 * Le nom est une ligature de la police : <span class="icone material-symbols-outlined">search</span>
 */

export interface OptionsIcone {
  /** Variante remplie (étoile notée, cœur favori…) */
  plein?: boolean;
  /** Libellé accessible ; sans libellé l'icône est décorative (aria-hidden) */
  label?: string;
  classes?: string[];
}

export function icone(nom: string, options: OptionsIcone = {}): HTMLSpanElement {
  const span = document.createElement('span');
  span.classList.add('icone', 'material-symbols-outlined', ...(options.classes ?? []));
  if (options.plein) span.classList.add('plein');
  span.textContent = nom;
  if (options.label) {
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', options.label);
  } else {
    span.setAttribute('aria-hidden', 'true');
  }
  return span;
}

/**
 * Même icône sous forme de chaîne HTML, pour les gabarits innerHTML
 */
export function iconeHtml(nom: string, options: OptionsIcone = {}): string {
  return icone(nom, options).outerHTML;
}
