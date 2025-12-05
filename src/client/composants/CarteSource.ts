/**
 * Veilleur - Composant CarteSource
 * Affiche une source dans la liste avec tags et note
 */

import { creerElement } from '../utils/dom';
import { extraireDomaine } from '../utils/format';
import { sources, articles, tags as apiTags } from '../services/api';
import { toast } from '../utils/toast';
import { creerPanneauParametres } from './PanneauParametres';
import type { Source, Tag } from '../services/api';

interface OptionsCarteSource {
  onSupprimer?: (id: string) => void;
  onPause?: (id: string, enPause: boolean) => void;
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
      attrs: { 'data-note': String(i), title: `${i} étoile${i > 1 ? 's' : ''}` },
      texte: note && i <= note ? '★' : '☆',
      onClick: async () => {
        try {
          await sources.noter(sourceId, i);
          // Mettre à jour l'affichage
          conteneur.querySelectorAll('.btn-etoile').forEach((btn, index) => {
            const isActive = index < i;
            btn.classList.toggle('active', isActive);
            btn.textContent = isActive ? '★' : '☆';
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

  // Afficher les tags existants
  const afficherTags = (tagsList: Tag[]) => {
    listeTags.innerHTML = '';
    tagsList.forEach(tag => {
      const badge = creerElement('span', {
        classes: ['badge-tag'],
        attrs: { 'data-tag-id': tag.id },
      });

      const nomTag = creerElement('span', { texte: tag.nom });
      const btnRetirer = creerElement('button', {
        classes: ['btn-retirer-tag'],
        attrs: { title: 'Retirer ce tag' },
        texte: '×',
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
      listeTags.append(badge);
    });
  };

  afficherTags(tagsInitiaux);

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
    classes: ['btn', 'btn-sm'],
    texte: '+',
    onClick: async () => {
      const nom = inputTag.value.trim();
      if (!nom) return;

      try {
        const { tag } = await apiTags.ajouterASource(sourceId, nom);

        // Ajouter visuellement le nouveau tag
        const badge = creerElement('span', {
          classes: ['badge-tag'],
          attrs: { 'data-tag-id': tag.id },
        });

        const nomTag = creerElement('span', { texte: tag.nom });
        const btnRetirer = creerElement('button', {
          classes: ['btn-retirer-tag'],
          attrs: { title: 'Retirer ce tag' },
          texte: '×',
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
        listeTags.append(badge);

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

  if (source.urlFavicon) {
    const img = creerElement('img', {
      attrs: {
        src: source.urlFavicon,
        alt: '',
      },
    });
    img.onerror = () => {
      favicon.innerHTML = '<span class="carte-source-favicon-placeholder">🌐</span>';
    };
    favicon.append(img);
  } else {
    favicon.innerHTML = '<span class="carte-source-favicon-placeholder">🌐</span>';
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

  entete.append(nom, notation);

  const url = creerElement('div', {
    classes: ['carte-source-url'],
    texte: extraireDomaine(source.url),
  });

  info.append(entete, url);

  // Badges de statut
  if (source.estEnPause) {
    const badge = creerElement('span', {
      classes: ['badge', 'badge-neutre'],
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
    classes: ['btn', 'btn-icone', 'btn-ghost'],
    attrs: {
      title: source.estEnPause ? 'Reprendre' : 'Mettre en pause',
    },
    texte: source.estEnPause ? '▶️' : '⏸️',
    onClick: async () => {
      try {
        const nouvelEtat = !source.estEnPause;
        await sources.mettreEnPause(source.id, nouvelEtat);
        source.estEnPause = nouvelEtat;
        btnPause.textContent = nouvelEtat ? '▶️' : '⏸️';
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
    classes: ['btn', 'btn-icone', 'btn-ghost'],
    attrs: { title: 'Synchroniser' },
    texte: '🔄',
    onClick: async () => {
      try {
        btnSync.textContent = '⏳';
        const result = await articles.synchroniser(source.id);
        btnSync.textContent = '🔄';
        toast.succes(`${result.nouveauxArticles} nouveaux articles`);
      } catch {
        btnSync.textContent = '🔄';
        toast.erreur('Erreur lors de la synchronisation');
      }
    },
  });

  // Bouton paramètres
  const btnParams = creerElement('button', {
    classes: ['btn', 'btn-icone', 'btn-ghost'],
    attrs: { title: 'Paramètres avancés' },
    texte: '⚙️',
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
    classes: ['btn', 'btn-icone', 'btn-ghost'],
    attrs: { title: 'Supprimer' },
    texte: '🗑️',
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
