/**
 * Veilleur - Composant FormulaireSource
 * Formulaire d'ajout de source
 */

import { creerElement } from '../utils/dom';
import { sources, ErreurAPI } from '../services/api';
import { toast } from '../utils/toast';
import type { Source } from '../services/api';

interface OptionsFormulaireSource {
  onAjout?: (source: Source) => void;
}

/**
 * Crée le formulaire d'ajout de source
 */
export function creerFormulaireSource(
  options: OptionsFormulaireSource = {},
): HTMLElement {
  const container = creerElement('div', {
    classes: ['formulaire-ajout-source'],
  });

  const titre = creerElement('h3', {
    classes: ['formulaire-ajout-source-titre'],
    texte: 'Ajouter une source',
  });

  const form = creerElement('form', {
    classes: ['formulaire'],
  });

  const row = creerElement('div', {
    classes: ['formulaire-ajout-source-row'],
  });

  // Champ URL
  const champUrl = creerElement('div', {
    classes: ['champ'],
  });

  const labelUrl = creerElement('label', {
    classes: ['champ-label', 'requis'],
    attrs: { for: 'source-url' },
    texte: 'URL du flux RSS ou site',
  });

  const inputUrl = creerElement('input', {
    classes: ['champ-input'],
    attrs: {
      type: 'url',
      id: 'source-url',
      name: 'url',
      placeholder: 'https://example.com/rss',
      required: 'true',
    },
  }) as HTMLInputElement;

  const aideUrl = creerElement('span', {
    classes: ['champ-aide'],
    texte: 'Flux RSS, Atom ou page web',
  });

  champUrl.append(labelUrl, inputUrl, aideUrl);

  // Champ nom (optionnel)
  const champNom = creerElement('div', {
    classes: ['champ'],
  });

  const labelNom = creerElement('label', {
    classes: ['champ-label'],
    attrs: { for: 'source-nom' },
    texte: 'Nom personnalisé',
  });

  const inputNom = creerElement('input', {
    classes: ['champ-input'],
    attrs: {
      type: 'text',
      id: 'source-nom',
      name: 'nom',
      placeholder: 'Mon site préféré',
    },
  }) as HTMLInputElement;

  const aideNom = creerElement('span', {
    classes: ['champ-aide'],
    texte: 'Optionnel, sinon détecté automatiquement',
  });

  champNom.append(labelNom, inputNom, aideNom);

  row.append(champUrl, champNom);

  // Bouton submit
  const btnSubmit = creerElement('button', {
    classes: ['btn', 'btn-primaire'],
    attrs: { type: 'submit' },
    texte: 'Ajouter la source',
  }) as HTMLButtonElement;

  // Erreur
  const erreurDiv = creerElement('div', {
    classes: ['champ-erreur', 'masque'],
  });

  // Gestion soumission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = inputUrl.value.trim();
    const nom = inputNom.value.trim() || undefined;

    if (!url) {
      erreurDiv.textContent = 'Veuillez entrer une URL';
      erreurDiv.classList.remove('masque');
      return;
    }

    erreurDiv.classList.add('masque');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Ajout en cours...';

    try {
      const source = await sources.ajouter(url, nom);
      toast.succes(`Source "${source.nom}" ajoutée`);
      inputUrl.value = '';
      inputNom.value = '';
      options.onAjout?.(source);
    } catch (error) {
      if (error instanceof ErreurAPI) {
        erreurDiv.textContent = error.message;
      } else {
        erreurDiv.textContent = "Erreur lors de l'ajout de la source";
      }
      erreurDiv.classList.remove('masque');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Ajouter la source';
    }
  });

  form.append(row, erreurDiv, btnSubmit);
  container.append(titre, form);

  return container;
}
