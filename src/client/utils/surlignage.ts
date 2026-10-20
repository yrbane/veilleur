/**
 * Veilleur - Surlignage des termes recherchés dans les cartes du fil
 * La recherche serveur est en mode booléen MariaDB : « -mot » exclut, « "phrase" » impose l'ordre,
 * « mot* » accepte un préfixe. On n'éclaire que les termes positifs.
 */

/**
 * Termes positifs d'une requête (sans les exclusions ni les opérateurs)
 */
export function termesRecherche(requete: string | undefined): string[] {
  if (!requete) return [];
  const termes = new Set<string>();
  const expressions = requete.match(/"([^"]+)"|\S+/g) ?? [];
  for (const brut of expressions) {
    if (brut.startsWith('-')) continue;
    const terme = brut.replace(/^[+"~<>()]+|["*~<>()]+$/g, '').trim();
    if (terme.length >= 2) termes.add(terme.toLowerCase());
  }
  return [...termes].sort((a, b) => b.length - a.length);
}

function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fragment DOM où chaque occurrence d'un terme est enveloppée dans <mark> ; sans terme, texte brut
 */
export function surligner(texte: string, termes: string[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (termes.length === 0 || !texte) {
    fragment.append(texte);
    return fragment;
  }
  const motif = new RegExp(`(${termes.map(echapperRegex).join('|')})`, 'gi');
  const morceaux = texte.split(motif);
  for (const morceau of morceaux) {
    if (!morceau) continue;
    if (motif.test(morceau)) {
      const marque = document.createElement('mark');
      marque.className = 'surligne';
      marque.textContent = morceau;
      fragment.append(marque);
    } else {
      fragment.append(morceau);
    }
    motif.lastIndex = 0;
  }
  return fragment;
}
