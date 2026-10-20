/**
 * Veilleur - Page « Mon parcours » : points, niveau, badges, série, classement opt-in
 */

import { creerElement, vider } from '../utils/dom';
import { icone, iconeHtml } from '../utils/icones';
import { formatNombre } from '../utils/format';
import { auth, progression as apiProgression, communaute, estAuthentifie } from '../services/api';
import type { Progression, LigneClassement, Utilisateur } from '../services/api';
import { toast } from '../utils/toast';

export async function afficherPageProgression(container: Element): Promise<void> {
  vider(container);
  if (!estAuthentifie()) {
    container.innerHTML = `
      <div class="la-empty">
        <div class="la-empty-icon">${iconeHtml('military_tech')}</div>
        <p class="la-empty-title">Connectez-vous pour suivre votre parcours</p>
        <a href="/connexion" class="la-btn primary" data-nav>Se connecter</a>
      </div>`;
    return;
  }
  const page = creerElement('div', { classes: ['page-progression'] });
  const entete = creerElement('div', { classes: ['page-entete'] });
  entete.append(
    creerElement('h1', { classes: ['page-titre'], texte: 'Mon parcours' }),
    creerElement('p', { classes: ['page-description'], texte: 'Chaque lecture, note, favori ou source suivie compte. Les badges se débloquent au fil de votre veille.' }),
  );
  const contenu = creerElement('div', { classes: ['progression-contenu'], attrs: { id: 'progression-contenu' } });
  contenu.innerHTML = '<div class="chargement"><div class="la-spinner lg"></div><p>Calcul de votre progression…</p></div>';
  page.append(entete, contenu);
  container.append(page);

  try {
    const [progression, classement, utilisateur] = await Promise.all([
      apiProgression.obtenir(),
      communaute.classement().catch(() => ({ donnees: [] as LigneClassement[] })),
      auth.profil().catch(() => null),
    ]);
    vider(contenu);
    contenu.append(
      creerCarteNiveau(progression),
      creerDetailPoints(progression),
      creerGrilleBadges(progression),
      creerClassement(classement.donnees, utilisateur),
    );
  } catch {
    vider(contenu);
    contenu.append(creerElement('div', { classes: ['la-empty'], texte: 'Impossible de charger votre progression pour le moment.' }));
  }
}

function creerCarteNiveau(p: Progression): HTMLElement {
  const carte = creerElement('section', { classes: ['progression-niveau'], attrs: { id: 'progression-niveau' } });
  const medaille = creerElement('div', { classes: ['progression-medaille'], enfants: [icone('military_tech', { plein: true })] });
  const infos = creerElement('div', { classes: ['progression-niveau-infos'] });
  infos.append(
    creerElement('p', { classes: ['progression-niveau-nom'], texte: `Niveau ${p.niveau.numero} · ${p.niveau.nom}` }),
    creerElement('p', { classes: ['progression-points'], texte: `${formatNombre(p.points)} point${p.points > 1 ? 's' : ''}` }),
  );
  const barre = creerElement('div', {
    classes: ['la-progress'],
    attrs: { role: 'progressbar', 'aria-valuenow': String(p.niveau.progression), 'aria-valuemin': '0', 'aria-valuemax': '100' },
  });
  const remplissage = creerElement('div', { classes: ['la-progress-bar', 'progression-barre'] });
  remplissage.style.width = `${p.niveau.progression}%`;
  barre.append(remplissage);
  infos.append(
    barre,
    creerElement('p', {
      classes: ['la-help'],
      texte: p.niveau.prochainSeuil
        ? `${formatNombre(p.niveau.prochainSeuil - p.points)} points avant le niveau suivant (${p.niveau.prochainSeuil})`
        : 'Niveau maximal atteint !',
    }),
  );
  const serie = creerElement('div', { classes: ['progression-serie', p.serie.courante > 0 ? 'active' : ''] });
  serie.append(
    icone('local_fire_department', { plein: p.serie.courante > 0 }),
    creerElement('div', {
      enfants: [
        creerElement('p', { classes: ['progression-serie-valeur'], texte: `${p.serie.courante} jour${p.serie.courante > 1 ? 's' : ''} d'affilée` }),
        creerElement('p', {
          classes: ['la-help'],
          texte: p.serie.activeAujourdhui ? `Record : ${p.serie.record}. Lecture du jour faite.` : `Record : ${p.serie.record}. Lisez un article aujourd'hui pour continuer.`,
        }),
      ],
    }),
  );
  carte.append(medaille, infos, serie);
  return carte;
}

function creerDetailPoints(p: Progression): HTMLElement {
  const section = creerElement('section', { classes: ['progression-section'] });
  section.append(creerElement('h2', { classes: ['progression-section-titre'], texte: 'D\'où viennent vos points' }));
  const liste = creerElement('ul', { classes: ['progression-detail'] });
  for (const ligne of p.detail) {
    const item = creerElement('li', { classes: ['progression-detail-ligne'] });
    item.append(
      creerElement('span', { texte: ligne.libelle }),
      creerElement('span', { classes: ['progression-detail-calcul'], texte: `${formatNombre(ligne.nombre)} × ${ligne.parUnite}` }),
      creerElement('strong', { texte: formatNombre(ligne.total) }),
    );
    liste.append(item);
  }
  section.append(liste);
  return section;
}

function creerGrilleBadges(p: Progression): HTMLElement {
  const section = creerElement('section', { classes: ['progression-section'], attrs: { id: 'progression-badges' } });
  const obtenus = p.badges.filter(b => b.obtenu).length;
  section.append(creerElement('h2', { classes: ['progression-section-titre'], texte: `Badges · ${obtenus}/${p.badges.length}` }));
  const grille = creerElement('div', { classes: ['badges-grille'] });
  for (const badge of p.badges) {
    const carte = creerElement('div', {
      classes: ['badge-carte', badge.obtenu ? 'obtenu' : 'verrouille'],
      attrs: { title: badge.obtenu ? `${badge.nom} — obtenu` : `${badge.nom} — ${badge.progression} %` },
    });
    carte.append(
      creerElement('div', { classes: ['badge-icone'], enfants: [icone(badge.icone, { plein: badge.obtenu })] }),
      creerElement('p', { classes: ['badge-nom'], texte: badge.nom }),
      creerElement('p', { classes: ['badge-description'], texte: badge.description }),
    );
    if (!badge.obtenu) {
      const barre = creerElement('div', { classes: ['la-progress', 'badge-progression'] });
      const remplissage = creerElement('div', { classes: ['la-progress-bar'] });
      remplissage.style.width = `${badge.progression}%`;
      barre.append(remplissage);
      carte.append(barre);
    }
    grille.append(carte);
  }
  section.append(grille);
  return section;
}

function creerClassement(lignes: LigneClassement[], utilisateur: Utilisateur | null): HTMLElement {
  const section = creerElement('section', { classes: ['progression-section'], attrs: { id: 'progression-classement'} });
  section.append(creerElement('h2', { classes: ['progression-section-titre'], texte: 'Classement des volontaires' }));

  // Participation : opt-in explicite, avec un pseudo
  const preferences = utilisateur?.preferences ?? {};
  const form = creerElement('form', { classes: ['classement-optin'], attrs: { id: 'form-classement' } });
  form.innerHTML = `
    <label class="la-checkbox">
      <input type="checkbox" name="classementPublic" id="classement-public" ${preferences.classementPublic ? 'checked' : ''}>
      <span>Apparaître dans le classement public</span>
    </label>
    <div class="la-form-group classement-pseudo">
      <label for="classement-pseudo">Pseudo affiché</label>
      <input type="text" id="classement-pseudo" name="pseudo" class="la-input" maxlength="30" minlength="2" placeholder="Votre pseudo" value="${(preferences.pseudo ?? '').replace(/"/g, '&quot;')}">
    </div>
    <button type="submit" class="la-btn secondary sm">Enregistrer</button>
    <p class="la-help">Seuls votre pseudo, vos points, votre niveau, vos badges et votre série sont visibles. Jamais votre adresse.</p>
  `;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const donnees = new FormData(form);
    const classementPublic = donnees.get('classementPublic') === 'on';
    const pseudo = String(donnees.get('pseudo') ?? '').trim();
    if (classementPublic && pseudo.length < 2) {
      toast.erreur('Choisissez un pseudo d\'au moins deux caractères');
      return;
    }
    try {
      await auth.mettreAJourProfil({ classementPublic, ...(pseudo ? { pseudo } : {}) });
      toast.succes(classementPublic ? 'Vous apparaîtrez au prochain calcul du classement' : 'Vous ne figurez plus au classement');
    } catch {
      toast.erreur('Impossible d\'enregistrer ce choix');
    }
  });
  section.append(form);

  if (lignes.length === 0) {
    section.append(creerElement('p', { classes: ['la-help'], texte: 'Personne ne participe encore. Soyez le premier !' }));
    return section;
  }
  const table = creerElement('table', { classes: ['la-table', 'classement-table'] });
  table.innerHTML = `<thead><tr><th>#</th><th>Pseudo</th><th>Niveau</th><th>Points</th><th>Badges</th><th>Série</th></tr></thead>`;
  const corps = creerElement('tbody');
  for (const ligne of lignes) {
    const tr = creerElement('tr', { classes: [ligne.pseudo === preferences.pseudo ? 'moi' : ''] });
    for (const valeur of [String(ligne.rang), ligne.pseudo, ligne.niveau, formatNombre(ligne.points), String(ligne.badges), String(ligne.serie)]) {
      tr.append(creerElement('td', { texte: valeur }));
    }
    corps.append(tr);
  }
  table.append(corps);
  section.append(table);
  return section;
}
