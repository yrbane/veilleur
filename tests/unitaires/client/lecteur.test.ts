// @vitest-environment jsdom
/**
 * Veilleur - Lecteur en place (fenêtre modale)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const lecture = vi.fn();
vi.mock('@/client/services/api', () => ({ articles: { lecture: (...args: unknown[]) => lecture(...args) } }));

import { ouvrirLecteur, fermerLecteur } from '@/client/composants/Lecteur';
import type { Article } from '@/client/services/api';

const article = {
  id: 'art-1',
  titre: 'Titre du fil',
  lien: 'https://journal.fr/a',
  datePublication: '2026-10-21T08:00:00.000Z',
  source: { nom: 'Journal' },
} as unknown as Article;

const attendre = () => new Promise(r => setTimeout(r, 0));

describe('Lecteur', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="modal-container"></div><button id="origine">ouvrir</button>';
    lecture.mockReset();
  });

  it('ouvre une fenêtre, charge le contenu et affiche auteur et durée', async () => {
    lecture.mockResolvedValue({ titre: 'Titre complet', contenuHtml: '<p>Corps</p>', auteur: 'Jeanne', dureeLectureMin: 4, nombreMots: 800, extrait: null, lien: article.lien });

    ouvrirLecteur(article);
    expect(document.querySelector('.lecteur-squelette')).not.toBeNull();
    expect(document.body.classList.contains('modal-ouverte')).toBe(true);
    await attendre();

    expect(lecture).toHaveBeenCalledWith('art-1');
    expect(document.querySelector('.lecteur-titre')?.textContent).toBe('Titre complet');
    expect(document.querySelector('.lecteur-meta')?.textContent).toBe('Jeanne · 4 min de lecture');
    expect(document.querySelector('.lecteur-contenu')?.innerHTML).toBe('<p>Corps</p>');
    expect(document.querySelector('.lecteur-source-nom')?.textContent).toBe('Journal');
  });

  it('propose le lien original quand le contenu est indisponible', async () => {
    lecture.mockRejectedValue(new Error('422'));

    ouvrirLecteur(article);
    await attendre();

    expect(document.querySelector('.lecteur-indisponible')).not.toBeNull();
    expect(document.querySelector('.lecteur-indisponible a')?.getAttribute('href')).toBe(article.lien);
  });

  it('se ferme avec Échap, au clic hors de la fenêtre, et rend le focus', async () => {
    lecture.mockResolvedValue({ titre: 'T', contenuHtml: '<p>x</p>', auteur: null, dureeLectureMin: 1, nombreMots: 1, extrait: null, lien: article.lien });
    const origine = document.getElementById('origine') as HTMLButtonElement;
    origine.focus();

    ouvrirLecteur(article);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.lecteur-overlay')).toBeNull();
    expect(document.body.classList.contains('modal-ouverte')).toBe(false);
    expect(document.activeElement).toBe(origine);

    const overlay = ouvrirLecteur(article);
    overlay.click();
    expect(document.querySelector('.lecteur-overlay')).toBeNull();

    ouvrirLecteur(article);
    fermerLecteur();
    expect(document.querySelector('.lecteur-overlay')).toBeNull();
  });

  it('n\'ouvre qu\'un lecteur à la fois', () => {
    lecture.mockReturnValue(new Promise(() => {}));
    ouvrirLecteur(article);
    ouvrirLecteur({ ...article, id: 'art-2' });
    expect(document.querySelectorAll('.lecteur-overlay')).toHaveLength(1);
    fermerLecteur();
  });
});
