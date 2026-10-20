/**
 * Veilleur - Partage d'un article : partage natif quand le navigateur le propose, sinon copie du lien
 */

export type ResultatPartage = 'partage' | 'copie' | 'annule' | 'impossible';

export async function partagerArticle(
  article: { titre: string; lien: string },
  nav: Pick<Navigator, 'share' | 'clipboard'> = navigator,
): Promise<ResultatPartage> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: article.titre, url: article.lien });
      return 'partage';
    } catch (erreur) {
      // L'utilisateur a refermé la feuille de partage : rien à copier
      if ((erreur as Error).name === 'AbortError') return 'annule';
    }
  }
  try {
    await nav.clipboard.writeText(article.lien);
    return 'copie';
  } catch {
    return 'impossible';
  }
}
