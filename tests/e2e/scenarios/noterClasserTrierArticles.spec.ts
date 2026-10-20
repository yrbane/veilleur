/**
 * Veilleur - Test E2E : noter, classer, mettre en favori, rechercher et trier les articles
 *
 * Les articles dépendent de la synchronisation d'une source réelle : chaque test
 * s'arrête proprement si le fil est encore vide.
 */

import { test, expect, type Page } from '@playwright/test';
import { inscrireUtilisateur, ajouterSource, SOURCES_TEST } from './helpers';

async function ouvrirFilAvecArticles(page: Page): Promise<boolean> {
  await page.goto('/');
  const cartes = page.locator('.carte-article:not(.squelette)');
  try {
    await expect(cartes.first()).toBeVisible({ timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('US4 - Noter, classer et trier les articles', () => {
  test.beforeEach(async ({ page }) => {
    await inscrireUtilisateur(page);
    await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);
  });

  test('affiche la recherche, le tri et les filtres en haut du fil', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('searchbox', { name: /rechercher/i })).toBeVisible();
    await expect(page.getByLabel(/trier/i)).toBeVisible();
    await expect(page.getByLabel(/^note$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /favoris/i })).toBeVisible();
    // Plus de boutons de pagination : le fil se charge au défilement
    await expect(page.getByRole('button', { name: /suivant/i })).toHaveCount(0);
  });

  test('note un article puis retire la note en recliquant', async ({ page }) => {
    test.skip(!(await ouvrirFilAvecArticles(page)), 'Aucun article synchronisé');
    const carte = page.locator('.carte-article').first();

    await carte.getByRole('button', { name: /noter 4 étoiles/i }).click();
    await expect(page.getByText(/note : 4\/5/i)).toBeVisible();
    await expect(carte.locator('.btn-etoile.active')).toHaveCount(4);

    await carte.getByRole('button', { name: /noter 4 étoiles/i }).click();
    await expect(page.getByText(/note retirée/i)).toBeVisible();
    await expect(carte.locator('.btn-etoile.active')).toHaveCount(0);
  });

  test('met un article en favori et filtre le fil sur les favoris', async ({ page }) => {
    test.skip(!(await ouvrirFilAvecArticles(page)), 'Aucun article synchronisé');
    const carte = page.locator('.carte-article').first();
    const titre = await carte.locator('.carte-article-titre').textContent();

    await carte.getByRole('button', { name: /ajouter aux favoris/i }).click();
    await expect(page.getByText(/ajouté aux favoris/i)).toBeVisible();

    await page.getByRole('button', { name: /favoris/i }).click();
    await expect(page.locator('.carte-article:not(.squelette)')).toHaveCount(1);
    await expect(page.locator('.carte-article-titre').first()).toHaveText(titre ?? '');
  });

  test('classe un article avec un tag et filtre dessus', async ({ page }) => {
    test.skip(!(await ouvrirFilAvecArticles(page)), 'Aucun article synchronisé');
    const carte = page.locator('.carte-article').first();

    await carte.getByLabel(/ajouter un tag à cet article/i).fill('Économie');
    await carte.getByLabel(/ajouter un tag à cet article/i).press('Enter');
    await expect(carte.locator('.badge-tag', { hasText: 'Économie' })).toBeVisible();

    const chip = page.locator('#fil-tags .chip-filtre', { hasText: /Économie/ });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.locator('.carte-article:not(.squelette)')).toHaveCount(1);
  });

  test('recherche dans les articles', async ({ page }) => {
    test.skip(!(await ouvrirFilAvecArticles(page)), 'Aucun article synchronisé');
    const premierTitre = (await page.locator('.carte-article-titre').first().textContent()) ?? '';
    const mot = premierTitre.split(/\s+/).find(m => m.length >= 5) ?? premierTitre;

    await page.getByRole('searchbox', { name: /rechercher/i }).fill(mot);
    await page.getByRole('searchbox', { name: /rechercher/i }).press('Enter');

    const cartes = page.locator('.carte-article:not(.squelette)');
    await expect(cartes.first()).toBeVisible({ timeout: 10000 });
    await expect(cartes.first().locator('.carte-article-titre')).toContainText(mot, { ignoreCase: true });
  });

  test('trie par titre', async ({ page }) => {
    test.skip(!(await ouvrirFilAvecArticles(page)), 'Aucun article synchronisé');

    await page.getByLabel(/trier/i).selectOption('titre:asc');
    await expect(page.locator('.carte-article:not(.squelette)').first()).toBeVisible({ timeout: 10000 });

    const titres = await page.locator('.carte-article-titre').allTextContents();
    const tries = [...titres].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    expect(titres.map(t => t.toLowerCase())).toEqual(tries.map(t => t.toLowerCase()));
  });
});
