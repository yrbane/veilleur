/**
 * Veilleur - Composant CarteSource
 * Affiche une source dans la liste avec tags et note
 */

import { icone, iconeHtml } from '../utils/icones';
import { urlFaviconLocale } from '../utils/favicons';
import { creerElement } from '../utils/dom';
import { extraireDomaine } from '../utils/format';
import { sources, articles, tags as apiTags } from '../services/api';
import { toast } from '../utils/toast';
import { creerPanneauParametres } from './PanneauParametres';
import type { Source, Tag } from '../services/api';
import { colorerTag } from '../utils/couleursTags';

interface OptionsCarteSource {
  onSupprimer?: (id: string) => void;
  onPause?: (id: string, enPause: boolean) => void;
  /** Articles non lus de cette source (badge) */
  nonLus?: number;
}

/**
 * Crée les étoiles de notation
 */
function creerNotation(note: number | undefined, sourceId: string): HTMLElement {
  const conteneur = creerElement('div', {
    classes: ['carte-source-note'],
  });

  for (let i = 1; i <= 5; i++) {
    const etoile = creerElement('button', {
      classes: ['btn-etoile', note && i <= note ? 'active' : ''],
      attrs: { 'data-note': String(i), type: 'button', title: `${i} étoile${i > 1 ? 's' : ''}`, 'aria-label': `Noter ${i} étoile${i > 1 ? 's' : ''}` },
      enfants: [icone('star', { plein: !!(note && i <= note) })],
      onClick: async () => {
        try {
          await sources.noter(sourceId, i);
          // Mettre à jour l'affichage
          conteneur.querySelectorAll('.btn-etoile').forEach((btn, index) => {
            const isActive = index < i;
            btn.classList.toggle('active', isActive);
            btn.replaceChildren(icone('star', { plein: isActive }));
          });
          toast.succes(`Note mise à jour : ${i}/5`);
        } catch {
          toast.erreur('Erreur lors de la notation');
        }
      },
    });
    conteneur.append(etoile);
  }

  return conteneur;
}

/**
 * Crée la section des tags
 */
function creerSectionTags(sourceId: string, tagsInitiaux: Tag[] = []): HTMLElement {
  const conteneur = creerElement('div', {
    classes: ['carte-source-tags'],
  });

  const listeTags = creerElement('div', {
    classes: ['liste-tags'],
  });

  // Badge coloré d'après le nom du tag, avec son bouton de retrait
  const creerBadgeTag = (tag: Tag): HTMLElement => {
    const badge = colorerTag(creerElement('span', {
      classes: ['la-badge badge-tag'],
      attrs: { 'data-tag-id': tag.id },
    }), tag.nom);

    const nomTag = creerElement('span', { texte: tag.nom });
    const btnRetirer = creerElement('button', {
      classes: ['btn-retirer-tag'],
      attrs: { type: 'button', title: 'Retirer ce tag', 'aria-label': `Retirer le tag ${tag.nom}` },
      icone: 'close',
      onClick: async (e) => {
        e.stopPropagation();
        try {
          await apiTags.retirerDeSource(sourceId, tag.id);
          badge.remove();
          toast.succes(`Tag "${tag.nom}" retiré`);
        } catch {
          toast.erreur('Erreur lors du retrait du tag');
        }
      },
    });

    badge.append(nomTag, btnRetirer);
    return badge;
  };

  listeTags.append(...tagsInitiaux.map(creerBadgeTag));

  // Formulaire d'ajout de tag
  const formAjout = creerElement('div', {
    classes: ['form-ajout-tag'],
  });

  const inputTag = creerElement('input', {
    attrs: {
      type: 'text',
      placeholder: 'Ajouter un tag...',
      maxlength: '50',
    },
  }) as HTMLInputElement;

  const btnAjouter = creerElement('button', {
    classes: ['la-btn', 'sm', 'icon-only'],
    attrs: { type: 'button', 'aria-label': 'Ajouter le tag' },
    icone: 'add',
    onClick: async () => {
      const nom = inputTag.value.trim();
      if (!nom) return;

      try {
        const { tag } = await apiTags.ajouterASource(sourceId, nom);

        // Ajouter visuellement le nouveau tag
        listeTags.append(creerBadgeTag(tag));

        inputTag.value = '';
        toast.succes(`Tag "${tag.nom}" ajouté`);
      } catch {
        toast.erreur('Erreur lors de l\'ajout du tag');
      }
    },
  });

  // Permettre l'ajout avec Entrée
  inputTag.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAjouter.click();
    }
  });

  formAjout.append(inputTag, btnAjouter);
  conteneur.append(listeTags, formAjout);

  return conteneur;
}

/**
 * Crée une carte de source
 */
export function creerCarteSource(
  source: Source & { tags?: Tag[] },
  options: OptionsCarteSource = {},
): HTMLElement {
  const carte = creerElement('div', {
    classes: ['carte-source'],
    attrs: { 'data-id': source.id },
  });

  // Favicon
  const favicon = creerElement('div', {
    classes: ['carte-source-favicon'],
  });

  const urlFavicon = urlFaviconLocale(source);
  if (urlFavicon) {
    const img = creerElement('img', {
      attrs: {
        src: urlFavicon,
        alt: '',
      },
    });
    img.onerror = () => {
      favicon.innerHTML = `<span class="carte-source-favicon-placeholder">${iconeHtml('public')}</span>`;
    };
    favicon.append(img);
  } else {
    favicon.innerHTML = `<span class="carte-source-favicon-placeholder">${iconeHtml('public')}</span>`;
  }

  // Infos
  const info = creerElement('div', {
    classes: ['carte-source-info'],
  });

  const entete = creerElement('div', {
    classes: ['carte-source-entete'],
  });

  const nom = creerElement('div', {
    classes: ['carte-source-nom'],
    texte: source.nom,
  });

  const notation = creerNotation(source.note, source.id);

  if (options.nonLus) {
    nom.append(
      creerElement('span', {
        classes: ['la-badge', 'primary', 'sm', 'badge-non-lus'],
        attrs: { title: `${options.nonLus} article${options.nonLus > 1 ? 's' : ''} non lu${options.nonLus > 1 ? 's' : ''}` },
        texte: String(options.nonLus),
      }),
    );
  }
  entete.append(nom, notation);

  const url = creerElement('div', {
    classes: ['carte-source-url'],
    texte: extraireDomaine(source.url),
  });

  info.append(entete, url);

  // Badges de statut
  if (source.estEnPause) {
    const badge = creerElement('span', {
      classes: ['la-badge', 'secondary'],
      texte: 'En pause',
    });
    info.append(badge);
  }

  // Section tags
  const sectionTags = creerSectionTags(source.id, source.tags || []);
  info.append(sectionTags);

  // Actions
  const actions = creerElement('div', {
    classes: ['carte-source-actions'],
  });

  // Bouton pause/reprendre
  const btnPause = creerElement('button', {
    classes: ['la-btn', 'icon-only', 'ghost'],
    attrs: {
      type: 'button',
      title: source.estEnPause ? 'Reprendre' : 'Mettre en pause',
    },
    enfants: [icone(source.estEnPause ? 'play_arrow' : 'pause')],
    onClick: async () => {
      try {
        const nouvelEtat = !source.estEnPause;
        await sources.mettreEnPause(source.id, nouvelEtat);
        source.estEnPause = nouvelEtat;
        btnPause.replaceChildren(icone(nouvelEtat ? 'play_arrow' : 'pause'));
        btnPause.title = nouvelEtat ? 'Reprendre' : 'Mettre en pause';
        toast.succes(nouvelEtat ? 'Source mise en pause' : 'Source réactivée');
        options.onPause?.(source.id, nouvelEtat);
      } catch {
        toast.erreur('Erreur lors de la mise à jour');
      }
    },
  });

  // Bouton synchroniser
  const btnSync = creerElement('button', {
    classes: ['la-btn', 'icon-only', 'ghost'],
    attrs: { title: 'Synchroniser', type: 'button', 'aria-label': 'Synchroniser' },
    icone: 'sync',
    onClick: async () => {
      try {
        btnSync.replaceChildren(icone('hourglass_top'));
        const result = await articles.synchroniser(source.id);
        btnSync.replaceChildren(icone('sync'));
        toast.succes(`${result.nouveauxArticles} nouveaux articles`);
      } catch {
        btnSync.replaceChildren(icone('sync'));
        toast.erreur('Erreur lors de la synchronisation');
      }
    },
  });

  // Bouton paramètres
  const btnParams = creerElement('button', {
    classes: ['la-btn', 'icon-only', 'ghost'],
    attrs: { title: 'Paramètres avancés', type: 'button', 'aria-label': 'Paramètres avancés' },
    icone: 'settings',
    onClick: () => {
      // Vérifier si un panneau est déjà ouvert
      const panneauExistant = carte.querySelector('.panneau-parametres');
      if (panneauExistant) {
        panneauExistant.remove();
        return;
      }

      const panneau = creerPanneauParametres(source, {
        onFermer: () => panneau.remove(),
      });
      carte.append(panneau);
    },
  });

  // Bouton supprimer
  const btnSupprimer = creerElement('button', {
    classes: ['la-btn', 'icon-only', 'ghost'],
    attrs: { title: 'Supprimer', type: 'button', 'aria-label': 'Supprimer' },
    icone: 'delete',
    onClick: async () => {
      if (!confirm(`Supprimer la source "${source.nom}" ?`)) return;

      try {
        await sources.supprimer(source.id);
        carte.remove();
        toast.succes('Source supprimée');
        options.onSupprimer?.(source.id);
      } catch {
        toast.erreur('Erreur lors de la suppression');
      }
    },
  });

  actions.append(btnPause, btnSync, btnParams, btnSupprimer);

  // Assemblage
  carte.append(favicon, info, actions);

  return carte;
}
