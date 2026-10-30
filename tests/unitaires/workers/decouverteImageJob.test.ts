/**
 * Veilleur - Tests du traitement d'un job de découverte d'image (dépendances injectées)
 */

import { describe, it, expect, vi, type Mock } from 'vitest';
import { traiterDecouverteImage, type DependancesDecouverte } from '@/infrastructure/workers/decouverteImage';
import type { Article } from '@/domaine/entites/Article';

const article = (surcharge: Partial<Article> = {}): Article => ({
  id: 'a1', sourceId: 's1', titre: 'Titre', lien: 'https://exemple.org/un-article', datePublication: new Date('2026-10-30'),
  resume: null, urlImage: null, auteur: null, metaOpenGraph: {}, metaTwitter: {}, hashContenu: null, dateExtraction: new Date('2026-10-30'), ...surcharge,
});

interface Deps extends DependancesDecouverte {
  mettreAJour: Mock;
  enfilerImage: Mock;
  enrichir: Mock;
}

function dependances(art: Article | null, metas: unknown = { openGraph: {}, twitter: {} }): Deps {
  const mettreAJour = vi.fn().mockResolvedValue(art);
  const enfilerImage = vi.fn().mockResolvedValue('img-1');
  const enrichir = vi.fn().mockResolvedValue(metas);
  return { depotArticles: { trouverParId: vi.fn().mockResolvedValue(art), mettreAJour }, enrichir, enfilerImage, mettreAJour };
}

describe('traiterDecouverteImage', () => {
  it('enregistre l\'image trouvée, garde les métadonnées et enfile son téléchargement', async () => {
    const deps = dependances(article(), { openGraph: { image: '/img/une.jpg', titre: 'OG', description: undefined }, twitter: { card: 'summary' } });
    const resultat = await traiterDecouverteImage({ type: 'decouvrir-image', articleId: 'a1' }, deps);
    expect(resultat).toEqual({ articleId: 'a1', urlImage: 'https://exemple.org/img/une.jpg' });
    expect(deps.enrichir).toHaveBeenCalledWith('https://exemple.org/un-article');
    const changements = deps.mettreAJour.mock.calls[0]![1] as Partial<Article>;
    expect(changements.urlImage).toBe('https://exemple.org/img/une.jpg');
    expect(changements.metaOpenGraph).toEqual({ image: '/img/une.jpg', titre: 'OG' });
    expect(changements.metaTwitter).toEqual({ card: 'summary' });
    expect(changements.dateRechercheImage).toBeInstanceOf(Date);
    expect(deps.enfilerImage).toHaveBeenCalledWith('https://exemple.org/img/une.jpg', 'a1');
  });

  it('marque la recherche faite même sans image, sans rien enfiler', async () => {
    const deps = dependances(article());
    const resultat = await traiterDecouverteImage({ type: 'decouvrir-image', articleId: 'a1' }, deps);
    expect(resultat).toEqual({ articleId: 'a1', urlImage: null });
    const changements = deps.mettreAJour.mock.calls[0]![1] as Partial<Article>;
    expect(changements.dateRechercheImage).toBeInstanceOf(Date);
    expect(changements.urlImage).toBeUndefined();
    expect(deps.enfilerImage).not.toHaveBeenCalled();
  });

  it('ne refait rien pour un article déjà illustré ou disparu', async () => {
    const deja = dependances(article({ urlImage: 'https://exemple.org/deja.jpg' }));
    expect(await traiterDecouverteImage({ type: 'decouvrir-image', articleId: 'a1' }, deja)).toEqual({ articleId: 'a1', urlImage: 'https://exemple.org/deja.jpg' });
    expect(deja.enrichir).not.toHaveBeenCalled();
    const disparu = dependances(null);
    expect(await traiterDecouverteImage({ type: 'decouvrir-image', articleId: 'zz' }, disparu)).toEqual({ articleId: 'zz', urlImage: null });
    expect(disparu.enrichir).not.toHaveBeenCalled();
  });

  it('considère un échec de la page comme une recherche faite (pas de boucle)', async () => {
    const deps = dependances(article());
    deps.enrichir.mockRejectedValue(new Error('timeout'));
    const resultat = await traiterDecouverteImage({ type: 'decouvrir-image', articleId: 'a1' }, deps);
    expect(resultat).toEqual({ articleId: 'a1', urlImage: null });
    expect((deps.mettreAJour.mock.calls[0]![1] as Partial<Article>).dateRechercheImage).toBeInstanceOf(Date);
  });

  it('utilise la vignette YouTube sans lire la page', async () => {
    const deps = dependances(article({ lien: 'https://www.youtube.com/watch?v=MENoB3Rex28' }));
    const resultat = await traiterDecouverteImage({ type: 'decouvrir-image', articleId: 'a1' }, deps);
    expect(resultat.urlImage).toBe('https://i.ytimg.com/vi/MENoB3Rex28/hqdefault.jpg');
    expect(deps.enrichir).not.toHaveBeenCalled();
    expect(deps.enfilerImage).toHaveBeenCalledWith('https://i.ytimg.com/vi/MENoB3Rex28/hqdefault.jpg', 'a1');
  });
});
