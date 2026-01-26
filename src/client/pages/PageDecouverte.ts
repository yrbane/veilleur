/**
 * Veilleur - Page Découverte
 * Découverte des sources populaires de la communauté
 */

import { creerElement, vider } from '../utils/dom';
import { communaute, sources as apiSources, estAuthentifie } from '../services/api';
import type { SourcePopulaire, TagPopulaire, CriteresCommunaute } from '../services/api';
import { toast } from '../utils/toast';
import { naviguerVers } from '../main';

let criteresActuels: CriteresCommunaute = {
  page: 1,
  limite: 12,
  tri: 'populaire',
};

/**
 * Affiche la page de découverte
 */
export async function afficherPageDecouverte(container: Element): Promise<void> {
  vider(container);
  criteresActuels = { page: 1, limite: 12, tri: 'populaire' };

  const page = creerElement('div', { classes: ['page-decouverte'] });

  // En-tête
  const entete = creerElement('div', { classes: ['page-entete'] });
  const titre = creerElement('h1', { texte: 'Découverte' });
  const description = creerElement('p', {
    classes: ['page-description'],
    texte: 'Explorez les sources populaires partagées par la communauté',
  });
  entete.append(titre, description);

  // Barre de recherche
  const barreRecherche = creerBarreRecherche();

  // Filtres
  const filtres = creerFiltres();

  // Liste des tags populaires
  const sectionTags = creerElement('div', {
    classes: ['section-tags-populaires'],
    attrs: { id: 'tags-populaires' },
  });

  // Grille des sources
  const grilleSources = creerElement('div', {
    classes: ['grille-sources'],
    attrs: { id: 'grille-sources' },
  });

  // Pagination
  const pagination = creerElement('div', {
    classes: ['pagination'],
    attrs: { id: 'pagination' },
  });

  page.append(entete, barreRecherche, filtres, sectionTags, grilleSources, pagination);
  container.append(page);

  // Charger les données
  await Promise.all([
    chargerTagsPopulaires(),
    chargerSourcesPopulaires(),
  ]);
}

/**
 * Crée la barre de recherche
 */
function creerBarreRecherche(): HTMLElement {
  const conteneur = creerElement('div', {
    classes: ['barre-recherche-decouverte'],
  });

  const input = creerElement('input', {
    attrs: {
      type: 'search',
      placeholder: 'Rechercher une source...',
      id: 'recherche-decouverte',
    },
    classes: ['form-input'],
  }) as HTMLInputElement;

  const btnRecherche = creerElement('button', {
    classes: ['btn', 'btn-primaire'],
    texte: 'Rechercher',
    onClick: () => effectuerRecherche(input.value),
  });

  // Recherche sur Entrée
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      effectuerRecherche(input.value);
    }
  });

  // Réinitialiser si champ vidé
  input.addEventListener('input', () => {
    if (input.value === '' && criteresActuels.recherche) {
      delete criteresActuels.recherche;
      criteresActuels.page = 1;
      chargerSourcesPopulaires();
    }
  });

  conteneur.append(input, btnRecherche);
  return conteneur;
}

/**
 * Effectue une recherche
 */
async function effectuerRecherche(terme: string): Promise<void> {
  terme = terme.trim();
  if (terme.length < 2) {
    if (terme.length > 0) {
      toast.info('Entrez au moins 2 caractères');
    }
    return;
  }

  criteresActuels.recherche = terme;
  criteresActuels.page = 1;
  await chargerSourcesPopulaires();
}

/**
 * Crée les filtres de tri
 */
function creerFiltres(): HTMLElement {
  const conteneur = creerElement('div', {
    classes: ['filtres-decouverte'],
  });

  const label = creerElement('span', {
    classes: ['filtre-label'],
    texte: 'Trier par :',
  });

  const options: { valeur: CriteresCommunaute['tri']; label: string }[] = [
    { valeur: 'populaire', label: 'Popularité' },
    { valeur: 'note', label: 'Note' },
    { valeur: 'recent', label: 'Récent' },
  ];

  const groupeBtns = creerElement('div', {
    classes: ['groupe-boutons-tri'],
  });

  options.forEach(opt => {
    const btn = creerElement('button', {
      classes: ['btn', 'btn-tri', criteresActuels.tri === opt.valeur ? 'active' : ''],
      texte: opt.label,
      attrs: { 'data-tri': opt.valeur || '' },
      onClick: async () => {
        criteresActuels.tri = opt.valeur;
        criteresActuels.page = 1;
        // Mettre à jour les classes
        groupeBtns.querySelectorAll('.btn-tri').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await chargerSourcesPopulaires();
      },
    });
    groupeBtns.append(btn);
  });

  conteneur.append(label, groupeBtns);
  return conteneur;
}

/**
 * Charge les tags populaires
 */
async function chargerTagsPopulaires(): Promise<void> {
  const conteneur = document.getElementById('tags-populaires');
  if (!conteneur) return;

  try {
    const { donnees: tags } = await communaute.listerTagsPopulaires(15);

    vider(conteneur);

    if (tags.length === 0) return;

    const titre = creerElement('h3', {
      classes: ['section-titre'],
      texte: 'Tags populaires',
    });

    const listeTags = creerElement('div', { classes: ['liste-tags-populaires'] });

    // Bouton "Tous"
    const btnTous = creerElement('button', {
      classes: ['badge-tag-populaire', !criteresActuels.tag ? 'active' : ''],
      texte: 'Tous',
      onClick: async () => {
        delete criteresActuels.tag;
        criteresActuels.page = 1;
        listeTags.querySelectorAll('.badge-tag-populaire').forEach(b => b.classList.remove('active'));
        btnTous.classList.add('active');
        await chargerSourcesPopulaires();
      },
    });
    listeTags.append(btnTous);

    tags.forEach((tag: TagPopulaire) => {
      const badge = creerElement('button', {
        classes: ['badge-tag-populaire', criteresActuels.tag === tag.slug ? 'active' : ''],
        onClick: async () => {
          criteresActuels.tag = tag.slug;
          criteresActuels.page = 1;
          listeTags.querySelectorAll('.badge-tag-populaire').forEach(b => b.classList.remove('active'));
          badge.classList.add('active');
          await chargerSourcesPopulaires();
        },
      });

      const nom = creerElement('span', { texte: tag.nom });
      const count = creerElement('span', {
        classes: ['tag-count'],
        texte: `(${tag.nombreSources})`,
      });

      badge.append(nom, count);
      listeTags.append(badge);
    });

    conteneur.append(titre, listeTags);
  } catch {
    // Ignorer silencieusement si pas de tags
  }
}

/**
 * Charge les sources populaires
 */
async function chargerSourcesPopulaires(): Promise<void> {
  const grille = document.getElementById('grille-sources');
  const paginationEl = document.getElementById('pagination');
  if (!grille) return;

  grille.innerHTML = `
    <div class="chargement">
      <div class="spinner"></div>
      <p>Chargement des sources...</p>
    </div>
  `;

  try {
    const resultat = await communaute.listerSourcesPopulaires(criteresActuels);

    vider(grille);

    if (resultat.donnees.length === 0) {
      grille.innerHTML = `
        <div class="message-vide">
          <div class="message-vide-icone">🔍</div>
          <h3>Aucune source trouvée</h3>
          <p>${criteresActuels.recherche
            ? 'Essayez avec d\'autres termes de recherche'
            : 'Soyez le premier à partager vos sources !'
          }</p>
        </div>
      `;
      if (paginationEl) vider(paginationEl);
      return;
    }

    // Afficher les sources
    resultat.donnees.forEach((source: SourcePopulaire) => {
      const carte = creerCarteSourcePopulaire(source);
      grille.append(carte);
    });

    // Pagination
    if (paginationEl) {
      afficherPagination(paginationEl, resultat.pagination);
    }
  } catch (erreur) {
    vider(grille);
    grille.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">❌</div>
        <h3>Erreur de chargement</h3>
        <p>Impossible de charger les sources populaires.</p>
      </div>
    `;
  }
}

/**
 * Crée une carte de source populaire
 */
function creerCarteSourcePopulaire(source: SourcePopulaire): HTMLElement {
  const carte = creerElement('div', {
    classes: ['carte-source-populaire'],
    attrs: { 'data-id': source.id },
  });

  // En-tête avec favicon et nom
  const entete = creerElement('div', { classes: ['carte-pop-entete'] });

  const favicon = creerElement('div', { classes: ['carte-pop-favicon'] });
  if (source.urlFavicon) {
    const img = creerElement('img', {
      attrs: { src: source.urlFavicon, alt: '' },
    });
    (img as HTMLImageElement).onerror = () => {
      favicon.innerHTML = '<span>🌐</span>';
    };
    favicon.append(img);
  } else {
    favicon.innerHTML = '<span>🌐</span>';
  }

  const infos = creerElement('div', { classes: ['carte-pop-infos'] });
  const nom = creerElement('h4', {
    classes: ['carte-pop-nom'],
    texte: source.nom,
  });

  const stats = creerElement('div', { classes: ['carte-pop-stats'] });
  const utilisateurs = creerElement('span', {
    classes: ['stat-utilisateurs'],
    texte: `${source.nombreUtilisateurs} abonné${source.nombreUtilisateurs > 1 ? 's' : ''}`,
  });

  stats.append(utilisateurs);

  if (source.noteMoyenne !== null) {
    const note = creerElement('span', {
      classes: ['stat-note'],
      texte: `★ ${source.noteMoyenne.toFixed(1)}`,
    });
    stats.append(note);
  }

  infos.append(nom, stats);
  entete.append(favicon, infos);

  // URL
  const url = creerElement('div', {
    classes: ['carte-pop-url'],
    texte: new URL(source.url).hostname,
  });

  // Tags
  const tagsEl = creerElement('div', { classes: ['carte-pop-tags'] });
  source.tags.slice(0, 3).forEach(tag => {
    const badge = creerElement('span', {
      classes: ['badge-tag-mini'],
      texte: tag.nom,
    });
    tagsEl.append(badge);
  });
  if (source.tags.length > 3) {
    const more = creerElement('span', {
      classes: ['badge-tag-mini', 'badge-more'],
      texte: `+${source.tags.length - 3}`,
    });
    tagsEl.append(more);
  }

  // Bouton d'action
  const actions = creerElement('div', { classes: ['carte-pop-actions'] });

  if (estAuthentifie()) {
    const btnAjouter = creerElement('button', {
      classes: ['btn', 'btn-primaire', 'btn-sm'],
      texte: 'Ajouter',
      onClick: async () => {
        try {
          btnAjouter.textContent = '...';
          (btnAjouter as HTMLButtonElement).disabled = true;
          await apiSources.ajouter(source.url, source.nom);
          btnAjouter.textContent = 'Ajouté ✓';
          btnAjouter.classList.remove('btn-primaire');
          btnAjouter.classList.add('btn-succes');
          toast.succes(`"${source.nom}" ajouté à vos sources`);
        } catch (erreur) {
          const err = erreur as { code?: string };
          if (err.code === 'SOURCE_DEJA_AJOUTEE') {
            btnAjouter.textContent = 'Déjà ajouté';
            btnAjouter.classList.remove('btn-primaire');
          } else {
            btnAjouter.textContent = 'Ajouter';
            (btnAjouter as HTMLButtonElement).disabled = false;
            toast.erreur('Erreur lors de l\'ajout');
          }
        }
      },
    });
    actions.append(btnAjouter);
  } else {
    const btnConnexion = creerElement('button', {
      classes: ['btn', 'btn-secondaire', 'btn-sm'],
      texte: 'Connectez-vous',
      onClick: () => naviguerVers('/connexion'),
    });
    actions.append(btnConnexion);
  }

  carte.append(entete, url, tagsEl, actions);
  return carte;
}

/**
 * Affiche la pagination
 */
function afficherPagination(
  conteneur: HTMLElement,
  pagination: { page: number; totalPages: number },
): void {
  vider(conteneur);

  if (pagination.totalPages <= 1) return;

  const nav = creerElement('nav', { classes: ['pagination-nav'] });

  // Bouton précédent
  if (pagination.page > 1) {
    const btnPrec = creerElement('button', {
      classes: ['btn', 'btn-ghost'],
      texte: '← Précédent',
      onClick: async () => {
        criteresActuels.page = pagination.page - 1;
        await chargerSourcesPopulaires();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
    nav.append(btnPrec);
  }

  // Indicateur de page
  const indicateur = creerElement('span', {
    classes: ['pagination-indicateur'],
    texte: `Page ${pagination.page} sur ${pagination.totalPages}`,
  });
  nav.append(indicateur);

  // Bouton suivant
  if (pagination.page < pagination.totalPages) {
    const btnSuiv = creerElement('button', {
      classes: ['btn', 'btn-ghost'],
      texte: 'Suivant →',
      onClick: async () => {
        criteresActuels.page = pagination.page + 1;
        await chargerSourcesPopulaires();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
    nav.append(btnSuiv);
  }

  conteneur.append(nav);
}
