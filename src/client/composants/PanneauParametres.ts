/**
 * Veilleur - Panneau de paramètres par source
 * Permet de configurer les paramètres avancés d'une source
 */

import { creerElement, vider } from '../utils/dom';
import { sources } from '../services/api';
import { toast } from '../utils/toast';
import type { Source, ParametresSource, FiltresMotsCles, PlageHoraire } from '../services/api';

interface OptionsPanneauParametres {
  onFermer: () => void;
  onSauvegarder?: () => void;
}

const JOURS_SEMAINE = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Crée un panneau de paramètres pour une source
 */
export function creerPanneauParametres(
  source: Source,
  options: OptionsPanneauParametres,
): HTMLElement {
  const panneau = creerElement('div', {
    classes: ['panneau-parametres'],
    attrs: { 'data-source-id': source.id },
  });

  // En-tête
  const entete = creerElement('div', {
    classes: ['panneau-parametres-entete'],
  });

  const titre = creerElement('h3', {
    classes: ['panneau-parametres-titre'],
    texte: `Paramètres - ${source.nom}`,
  });

  const btnFermer = creerElement('button', {
    classes: ['btn', 'btn-ghost', 'btn-icone'],
    texte: '✕',
    attrs: { 'aria-label': 'Fermer' },
  });
  btnFermer.addEventListener('click', options.onFermer);

  entete.append(titre, btnFermer);

  // Contenu (chargé dynamiquement)
  const contenu = creerElement('div', {
    classes: ['panneau-parametres-contenu'],
    attrs: { id: `panneau-contenu-${source.id}` },
  });

  contenu.innerHTML = `
    <div class="chargement">
      <div class="spinner"></div>
      <p>Chargement des paramètres...</p>
    </div>
  `;

  panneau.append(entete, contenu);

  // Charger les paramètres
  chargerParametres(source.id, contenu, options);

  return panneau;
}

/**
 * Charge les paramètres depuis l'API
 */
async function chargerParametres(
  sourceId: string,
  contenu: HTMLElement,
  options: OptionsPanneauParametres,
): Promise<void> {
  try {
    const parametres = await sources.obtenirParametres(sourceId);
    afficherFormulaire(sourceId, contenu, parametres, options);
  } catch {
    toast.erreur('Erreur lors du chargement des paramètres');
    contenu.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">❌</div>
        <p>Impossible de charger les paramètres.</p>
      </div>
    `;
  }
}

/**
 * Affiche le formulaire de paramètres
 */
function afficherFormulaire(
  sourceId: string,
  contenu: HTMLElement,
  parametres: ParametresSource,
  options: OptionsPanneauParametres,
): void {
  vider(contenu);

  const form = creerElement('form', {
    classes: ['panneau-parametres-form'],
  }) as HTMLFormElement;

  // Préparer les valeurs des filtres
  const filtresInclure = parametres.filtresMotsCles?.inclure?.join(', ') || '';
  const filtresExclure = parametres.filtresMotsCles?.exclure?.join(', ') || '';

  // Préparer les valeurs de plage horaire
  const plageActive = parametres.plageHoraire !== null;
  const plageDebut = parametres.plageHoraire?.debut || '08:00';
  const plageFin = parametres.plageHoraire?.fin || '20:00';
  const joursActifs = parametres.plageHoraire?.joursActifs || [1, 2, 3, 4, 5];

  form.innerHTML = `
    <div class="param-section">
      <h4 class="param-section-titre">Synchronisation</h4>

      <div class="param-groupe">
        <label for="param-frequence-${sourceId}">Fréquence de synchronisation</label>
        <select id="param-frequence-${sourceId}" name="frequenceMinutes" class="form-select">
          <option value="5" ${parametres.frequenceMinutes === 5 ? 'selected' : ''}>5 minutes</option>
          <option value="15" ${parametres.frequenceMinutes === 15 ? 'selected' : ''}>15 minutes</option>
          <option value="30" ${parametres.frequenceMinutes === 30 ? 'selected' : ''}>30 minutes</option>
          <option value="60" ${parametres.frequenceMinutes === 60 ? 'selected' : ''}>1 heure</option>
          <option value="120" ${parametres.frequenceMinutes === 120 ? 'selected' : ''}>2 heures</option>
          <option value="360" ${parametres.frequenceMinutes === 360 ? 'selected' : ''}>6 heures</option>
          <option value="720" ${parametres.frequenceMinutes === 720 ? 'selected' : ''}>12 heures</option>
          <option value="1440" ${parametres.frequenceMinutes === 1440 ? 'selected' : ''}>24 heures</option>
        </select>
      </div>

      <div class="param-groupe">
        <label for="param-mode-${sourceId}">Mode d'extraction</label>
        <select id="param-mode-${sourceId}" name="modeExtraction" class="form-select">
          <option value="auto" ${parametres.modeExtraction === 'auto' ? 'selected' : ''}>Automatique</option>
          <option value="rss" ${parametres.modeExtraction === 'rss' ? 'selected' : ''}>RSS/Atom uniquement</option>
          <option value="scraping" ${parametres.modeExtraction === 'scraping' ? 'selected' : ''}>Scraping HTML</option>
        </select>
        <small class="form-aide">Le mode automatique utilise RSS si disponible, sinon scraping</small>
      </div>
    </div>

    <div class="param-section">
      <h4 class="param-section-titre">Articles</h4>

      <div class="param-groupe">
        <label for="param-max-articles-${sourceId}">Nombre max d'articles</label>
        <input type="number" id="param-max-articles-${sourceId}" name="nombreMaxArticles"
               class="form-input" min="1" max="100" value="${parametres.nombreMaxArticles}">
        <small class="form-aide">Maximum d'articles à conserver (1-100)</small>
      </div>

      <div class="param-groupe">
        <label for="param-retention-${sourceId}">Rétention (jours)</label>
        <input type="number" id="param-retention-${sourceId}" name="retentionJours"
               class="form-input" min="1" max="365" value="${parametres.retentionJours}">
        <small class="form-aide">Durée de conservation des articles (1-365 jours)</small>
      </div>

      <div class="param-groupe">
        <label for="param-priorite-${sourceId}">Priorité d'affichage</label>
        <select id="param-priorite-${sourceId}" name="priorite" class="form-select">
          <option value="haute" ${parametres.priorite === 'haute' ? 'selected' : ''}>Haute</option>
          <option value="normale" ${parametres.priorite === 'normale' ? 'selected' : ''}>Normale</option>
          <option value="basse" ${parametres.priorite === 'basse' ? 'selected' : ''}>Basse</option>
        </select>
        <small class="form-aide">Les sources prioritaires apparaissent en premier</small>
      </div>
    </div>

    <div class="param-section">
      <h4 class="param-section-titre">Filtres par mots-clés</h4>

      <div class="param-groupe">
        <label for="param-filtres-inclure-${sourceId}">Mots à inclure</label>
        <input type="text" id="param-filtres-inclure-${sourceId}" name="filtresInclure"
               class="form-input" placeholder="tech, innovation, IA" value="${filtresInclure}">
        <small class="form-aide">Séparez les mots par des virgules. Seuls les articles contenant au moins un de ces mots seront affichés.</small>
      </div>

      <div class="param-groupe">
        <label for="param-filtres-exclure-${sourceId}">Mots à exclure</label>
        <input type="text" id="param-filtres-exclure-${sourceId}" name="filtresExclure"
               class="form-input" placeholder="pub, sponsorisé" value="${filtresExclure}">
        <small class="form-aide">Les articles contenant ces mots seront masqués.</small>
      </div>
    </div>

    <div class="param-section">
      <h4 class="param-section-titre">Plage horaire</h4>

      <div class="param-groupe">
        <label class="param-checkbox">
          <input type="checkbox" id="param-plage-active-${sourceId}" name="plageActive" ${plageActive ? 'checked' : ''}>
          <span>Limiter la récupération à certaines heures</span>
        </label>
      </div>

      <div class="param-plage-horaire ${plageActive ? '' : 'masque'}" id="param-plage-container-${sourceId}">
        <div class="param-groupe param-row">
          <div>
            <label for="param-plage-debut-${sourceId}">De</label>
            <input type="time" id="param-plage-debut-${sourceId}" name="plageDebut"
                   class="form-input" value="${plageDebut}">
          </div>
          <div>
            <label for="param-plage-fin-${sourceId}">À</label>
            <input type="time" id="param-plage-fin-${sourceId}" name="plageFin"
                   class="form-input" value="${plageFin}">
          </div>
        </div>

        <div class="param-groupe">
          <label>Jours actifs</label>
          <div class="param-jours">
            ${JOURS_SEMAINE.map((jour, index) => `
              <label class="param-jour">
                <input type="checkbox" name="joursActifs" value="${index}" ${joursActifs.includes(index) ? 'checked' : ''}>
                <span>${jour}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="param-section">
      <h4 class="param-section-titre">Notifications</h4>

      <div class="param-groupe">
        <label for="param-notif-${sourceId}">Niveau de notifications</label>
        <select id="param-notif-${sourceId}" name="notifications" class="form-select">
          <option value="aucune" ${parametres.notifications === 'aucune' ? 'selected' : ''}>Aucune</option>
          <option value="nouveaux" ${parametres.notifications === 'nouveaux' ? 'selected' : ''}>Nouveaux articles</option>
          <option value="tous" ${parametres.notifications === 'tous' ? 'selected' : ''}>Toutes les mises à jour</option>
        </select>
      </div>
    </div>

    <div class="panneau-parametres-actions">
      <button type="button" class="btn btn-ghost" id="btn-reinit-${sourceId}">Réinitialiser</button>
      <div class="btn-group">
        <button type="button" class="btn btn-secondaire" id="btn-annuler-${sourceId}">Annuler</button>
        <button type="submit" class="btn btn-primaire">Enregistrer</button>
      </div>
    </div>
  `;

  // Toggle plage horaire
  const checkboxPlage = form.querySelector(`#param-plage-active-${sourceId}`) as HTMLInputElement;
  const containerPlage = form.querySelector(`#param-plage-container-${sourceId}`);
  checkboxPlage?.addEventListener('change', () => {
    containerPlage?.classList.toggle('masque', !checkboxPlage.checked);
  });

  // Événement annuler
  const btnAnnuler = form.querySelector(`#btn-annuler-${sourceId}`);
  btnAnnuler?.addEventListener('click', options.onFermer);

  // Événement réinitialiser
  const btnReinit = form.querySelector(`#btn-reinit-${sourceId}`);
  btnReinit?.addEventListener('click', async () => {
    if (confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) {
      try {
        await sources.mettreAJourParametres(sourceId, {
          nombreMaxArticles: 20,
          frequenceMinutes: 30,
          retentionJours: 30,
          priorite: 'normale',
          modeExtraction: 'auto',
          filtresMotsCles: {},
          notifications: 'nouveaux',
          plageHoraire: null,
        });
        toast.succes('Paramètres réinitialisés');
        const nouveauxParams = await sources.obtenirParametres(sourceId);
        afficherFormulaire(sourceId, contenu, nouveauxParams, options);
      } catch {
        toast.erreur('Erreur lors de la réinitialisation');
      }
    }
  });

  // Événement soumettre
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sauvegarderParametres(sourceId, form, options);
  });

  contenu.append(form);
}

/**
 * Parse les mots-clés depuis une chaîne
 */
function parseMotsCles(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Sauvegarde les paramètres
 */
async function sauvegarderParametres(
  sourceId: string,
  form: HTMLFormElement,
  options: OptionsPanneauParametres,
): Promise<void> {
  const formData = new FormData(form);
  const btnSubmit = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  // Construire les filtres
  const filtresInclure = parseMotsCles(formData.get('filtresInclure') as string);
  const filtresExclure = parseMotsCles(formData.get('filtresExclure') as string);
  const filtresMotsCles: FiltresMotsCles = {};
  if (filtresInclure.length > 0) filtresMotsCles.inclure = filtresInclure;
  if (filtresExclure.length > 0) filtresMotsCles.exclure = filtresExclure;

  // Construire la plage horaire
  const plageActive = formData.get('plageActive') === 'on';
  let plageHoraire: PlageHoraire | null = null;

  if (plageActive) {
    const joursActifs = formData.getAll('joursActifs').map(v => parseInt(v as string, 10));
    plageHoraire = {
      debut: formData.get('plageDebut') as string,
      fin: formData.get('plageFin') as string,
      joursActifs: joursActifs.length > 0 ? joursActifs : [1, 2, 3, 4, 5],
    };
  }

  const parametres: Partial<ParametresSource> = {
    frequenceMinutes: parseInt(formData.get('frequenceMinutes') as string, 10),
    nombreMaxArticles: parseInt(formData.get('nombreMaxArticles') as string, 10),
    retentionJours: parseInt(formData.get('retentionJours') as string, 10),
    priorite: formData.get('priorite') as ParametresSource['priorite'],
    modeExtraction: formData.get('modeExtraction') as ParametresSource['modeExtraction'],
    filtresMotsCles,
    notifications: formData.get('notifications') as ParametresSource['notifications'],
    plageHoraire,
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Enregistrement...';

  try {
    await sources.mettreAJourParametres(sourceId, parametres);
    toast.succes('Paramètres enregistrés');
    options.onSauvegarder?.();
    options.onFermer();
  } catch {
    toast.erreur('Erreur lors de la sauvegarde');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Enregistrer';
  }
}
