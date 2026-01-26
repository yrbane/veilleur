/**
 * Veilleur - Page Mes Sources
 * Gestion des sources de l'utilisateur
 */

import { creerElement, $, vider } from '../utils/dom';
import { sources, estAuthentifie } from '../services/api';
import { creerCarteSource } from '../composants/CarteSource';
import { creerFormulaireSource } from '../composants/FormulaireSource';
import { toast } from '../utils/toast';
import type { Source, ResultatImportOPML } from '../services/api';

let sourcesList: Source[] = [];

/**
 * Affiche la page des sources
 */
export async function afficherPageSources(container: Element): Promise<void> {
  vider(container);

  if (!estAuthentifie()) {
    container.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">🔒</div>
        <div class="message-vide-titre">Connexion requise</div>
        <p>Connectez-vous pour gérer vos sources.</p>
        <a href="/connexion" class="btn btn-primaire" data-nav>Se connecter</a>
      </div>
    `;
    return;
  }

  const page = creerElement('div', {
    classes: ['page-sources'],
  });

  // En-tête
  const entete = creerElement('div', {
    classes: ['page-sources-entete'],
  });

  const titreContainer = creerElement('div');

  const titre = creerElement('h1', {
    classes: ['page-sources-titre'],
    texte: 'Mes sources',
  });

  const description = creerElement('p', {
    classes: ['page-sources-description'],
    texte: 'Gérez vos flux RSS, Atom et sites web favoris.',
  });

  titreContainer.append(titre, description);

  // Boutons OPML
  const actionsOPML = creerElement('div', {
    classes: ['actions-opml'],
  });

  const btnExporter = creerElement('button', {
    classes: ['btn', 'btn-secondaire'],
    texte: 'Exporter OPML',
    attrs: { title: 'Exporter toutes vos sources au format OPML' },
  });
  btnExporter.addEventListener('click', exporterOPML);

  const btnImporter = creerElement('button', {
    classes: ['btn', 'btn-secondaire'],
    texte: 'Importer OPML',
    attrs: { title: 'Importer des sources depuis un fichier OPML' },
  });
  btnImporter.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        importerOPML(input.files[0]);
      }
    });
    input.click();
  });

  actionsOPML.append(btnExporter, btnImporter);
  entete.append(titreContainer, actionsOPML);

  // Formulaire d'ajout
  const formulaire = creerFormulaireSource({
    onAjout: (source) => {
      sourcesList.unshift(source);
      mettreAJourListeSources();
    },
  });

  // Liste des sources
  const listeContainer = creerElement('div');

  const listeEntete = creerElement('div', {
    classes: ['liste-sources-entete'],
  });

  const listeTitre = creerElement('h2', {
    texte: 'Sources actives',
  });

  const compteur = creerElement('span', {
    classes: ['liste-sources-compteur'],
    attrs: { id: 'sources-compteur' },
  });

  listeEntete.append(listeTitre, compteur);

  const liste = creerElement('div', {
    classes: ['liste-sources'],
    attrs: { id: 'sources-liste' },
  });

  listeContainer.append(listeEntete, liste);

  page.append(entete, formulaire, listeContainer);
  container.append(page);

  // Charger les sources
  await chargerSources();
}

/**
 * Charge les sources de l'utilisateur
 */
async function chargerSources(): Promise<void> {
  const liste = $('#sources-liste');
  if (!liste) return;

  liste.innerHTML = `
    <div class="chargement">
      <div class="spinner"></div>
      <p>Chargement des sources...</p>
    </div>
  `;

  try {
    const result = await sources.lister(1, 100);
    sourcesList = result.donnees;
    mettreAJourListeSources();
  } catch {
    toast.erreur('Erreur lors du chargement des sources');
    liste.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">❌</div>
        <div class="message-vide-titre">Erreur de chargement</div>
        <p>Impossible de charger les sources.</p>
      </div>
    `;
  }
}

/**
 * Met à jour l'affichage de la liste des sources
 */
function mettreAJourListeSources(): void {
  const liste = $('#sources-liste');
  const compteur = $('#sources-compteur');

  if (!liste) return;

  vider(liste);

  if (compteur) {
    compteur.textContent = `${sourcesList.length} source${sourcesList.length > 1 ? 's' : ''}`;
  }

  if (sourcesList.length === 0) {
    liste.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">📡</div>
        <div class="message-vide-titre">Aucune source</div>
        <p>Ajoutez votre première source pour commencer.</p>
      </div>
    `;
    return;
  }

  for (const source of sourcesList) {
    const carte = creerCarteSource(source, {
      onSupprimer: (id) => {
        sourcesList = sourcesList.filter((s) => s.id !== id);
        mettreAJourListeSources();
      },
      onPause: () => {
        mettreAJourListeSources();
      },
    });
    liste.append(carte);
  }
}

/**
 * Exporte les sources au format OPML
 */
async function exporterOPML(): Promise<void> {
  try {
    const contenu = await sources.exporterOPML();

    // Créer un blob et télécharger
    const blob = new Blob([contenu], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veilleur-sources-${new Date().toISOString().split('T')[0]}.opml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.succes('Sources exportées avec succès');
  } catch {
    toast.erreur('Erreur lors de l\'export des sources');
  }
}

/**
 * Importe des sources depuis un fichier OPML
 */
async function importerOPML(fichier: File): Promise<void> {
  try {
    const contenu = await fichier.text();
    const resultat: ResultatImportOPML = await sources.importerOPML(contenu);

    // Afficher le résultat
    if (resultat.importees > 0) {
      toast.succes(`${resultat.importees} source(s) importée(s)`);
      // Recharger la liste
      await chargerSources();
    } else if (resultat.ignorees > 0) {
      toast.info(`${resultat.ignorees} source(s) déjà présente(s)`);
    }

    if (resultat.erreurs.length > 0) {
      toast.erreur(`${resultat.erreurs.length} erreur(s) lors de l'import`);
    }
  } catch {
    toast.erreur('Erreur lors de l\'import du fichier OPML');
  }
}
