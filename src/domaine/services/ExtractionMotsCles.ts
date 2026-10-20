/**
 * Veilleur - Extraction automatique des mots-clés d'un article
 * Classement sans intervention de l'utilisateur : les cinq mots les plus
 * significatifs du titre et du résumé (titre pondéré, noms propres favorisés,
 * mots vides et pluriels neutralisés). Aucun modèle externe : pure fonction.
 */

export const NOMBRE_MOTS_CLES = 5;

/** Poids d'une occurrence dans le titre */
const POIDS_TITRE = 3;
/** Bonus pour un nom propre (majuscule hors début de phrase, jamais en minuscules) */
const BONUS_NOM_PROPRE = 1.5;
/** Longueur minimale d'un mot candidat */
const LONGUEUR_MIN = 3;

/**
 * Mots vides français et anglais (déterminants, pronoms, prépositions, auxiliaires,
 * adverbes et verbes creux fréquents dans les dépêches)
 */
const MOTS_VIDES = new Set(`
le la les un une des du de d l au aux et ou où mais donc or ni car que qui quoi dont
ce cet cette ces celui celle ceux celles ça cela ceci on il ils elle elles nous vous je tu me te se
moi toi lui leur leurs eux mon ton son ma ta sa mes tes ses notre votre nos vos
à a en y dans par pour sur sous vers chez avec sans contre entre parmi depuis pendant avant après
selon malgré hors sauf dès jusque jusqu afin ainsi alors aussi autant bien très trop peu plus moins
tout tous toute toutes autre autres même mêmes tel telle tels telles quel quelle quels quelles
ne pas non oui si comme quand lorsque puis encore déjà toujours jamais souvent parfois ici là
comment pourquoi combien face gens chose choses façon fois cas point part partie lors via
est sont été être étant suis es êtes sommes était étaient sera seront serait seraient soit soient
ai as avons avez ont avait avaient aura auront aurait avoir ayant eu eut
fait faire faits font faisait fera fait fais ferait peut peuvent pouvait pourra pourrait pu
doit doivent devait devra devrait dû veut veulent voulait voudrait va vont allait ira irait allé
dit dire disent disait dira vient viennent venait viendra voir vu voit voient
cent mille million millions milliard milliards premier première second seconde dernier dernière
lundi mardi mercredi jeudi vendredi samedi dimanche janvier février mars avril mai juin juillet août septembre octobre novembre décembre
hier aujourd aujourd'hui demain matin soir jour jours semaine semaines mois année années ans heure heures
nouveau nouvelle nouveaux nouvelles grand grande grands grandes petit petite petits petites
the a an and or but nor so yet of in on at to for from by with without about into over after before
under between among through during against within across up down out off than then
is are was were be been being am have has had having do does did doing will would shall should can could may might must
this that these those it its it's he she they them his her their there here who whom whose which what when where why how
not no yes also just only very more most much many some any all each every both few other another such same own
new old first last next says said say year years week weeks day days month months today yesterday tomorrow
`.split(/\s+/).filter(Boolean));

export interface TexteArticle {
  titre: string;
  resume?: string | null;
}

interface Candidat {
  score: number;
  premierePosition: number;
  /** Au moins une occurrence en minuscules : nom commun */
  vuEnMinuscules: boolean;
  /** Au moins une occurrence capitalisée hors début de phrase : nom propre probable */
  vuCommeNomPropre: boolean;
  formeOriginale: string;
}

/**
 * Extrait les mots-clés les plus significatifs (ordre : du plus au moins important)
 */
export function extraireMotsCles(texte: TexteArticle, nombre = NOMBRE_MOTS_CLES): string[] {
  const candidats = new Map<string, Candidat>();
  let position = 0;

  const analyser = (contenu: string | null | undefined, poids: number): void => {
    if (!contenu) return;
    const nettoye = contenu.replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/[''’]/g, ' ');
    const regex = /\p{L}[\p{L}-]*/gu;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(nettoye)) !== null) {
      const mot = match[0].replace(/^-+|-+$/g, '');
      position++;
      if (mot.length < LONGUEUR_MIN) continue;
      const minuscule = mot.toLowerCase();
      if (MOTS_VIDES.has(minuscule)) continue;

      const debutDePhrase = estDebutDePhrase(nettoye, match.index);
      const capitalise = mot[0] !== minuscule[0];
      // Un nom propre (majuscule hors début de phrase) garde sa forme : « Limoges » n'est pas un pluriel
      const cle = capitalise && !debutDePhrase ? minuscule : singulariser(minuscule);

      const candidat = candidats.get(cle) ?? {
        score: 0,
        premierePosition: position,
        vuEnMinuscules: false,
        vuCommeNomPropre: false,
        formeOriginale: mot,
      };
      candidat.score += poids;
      if (!capitalise) candidat.vuEnMinuscules = true;
      if (capitalise && !debutDePhrase) {
        candidat.vuCommeNomPropre = true;
        candidat.formeOriginale = mot;
      }
      candidats.set(cle, candidat);
    }
  };

  analyser(texte.titre, POIDS_TITRE);
  analyser(texte.resume, 1);

  return [...candidats.entries()]
    .map(([cle, c]) => {
      const nomPropre = c.vuCommeNomPropre && !c.vuEnMinuscules;
      return { cle, c, nomPropre, score: c.score + (nomPropre ? BONUS_NOM_PROPRE : 0) };
    })
    .sort((a, b) => b.score - a.score || a.c.premierePosition - b.c.premierePosition)
    .slice(0, nombre)
    .map(({ cle, c, nomPropre }) => (nomPropre ? c.formeOriginale : cle));
}

/**
 * Début de phrase : rien avant, ou une ponctuation forte (en ignorant espaces et guillemets)
 */
function estDebutDePhrase(texte: string, index: number): boolean {
  const avant = texte.slice(0, index).replace(/[\s«»"“”([]+$/u, '');
  return avant.length === 0 || /[.!?:;…\n]$/.test(avant);
}

/**
 * Pluriel régulier en -s retiré (sauf finales invariables : -ss, -us, -is, -os, -as, -ès)
 */
function singulariser(mot: string): string {
  if (mot.length > 4 && mot.endsWith('s') && !/(ss|us|is|os|as|ès)$/.test(mot)) {
    return mot.slice(0, -1);
  }
  return mot;
}
