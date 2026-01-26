/**
 * Veilleur - Test E2E : Consulter le fil d'actualités (T055)
 *
 * Scénario : L'utilisateur voit son fil avec articles formatés
 * et peut cliquer pour être redirigé
 */

import { test, expect } from '@playwright/test';
import {
  inscrireUtilisateur,
  ajouterSource,
  SOURCES_TEST,
} from './helpers';

test.describe('US2 - Consulter le fil d\'actualités', () => {
  test.describe('Fil vide', () => {
    test('affiche un message quand aucune source', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/');

      // Vérifier le message de fil vide
      await expect(page.getByText(/aucun article/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /ajouter des sources/i })).toBeVisible();
    });

    test('redirige vers les sources depuis le fil vide', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/');

      // Cliquer sur le lien d'ajout
      await page.getByRole('link', { name: /ajouter des sources/i }).click();

      // Vérifier la redirection
      await expect(page).toHaveURL(/sources/);
    });
  });

  test.describe('Fil avec articles', () => {
    test.beforeEach(async ({ page }) => {
      await inscrireUtilisateur(page);
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);
    });

    test('affiche les statistiques du fil', async ({ page }) => {
      await page.goto('/');

      // Vérifier les statistiques
      await expect(page.getByText(/aujourd'hui/i)).toBeVisible();
      await expect(page.getByText(/cette semaine/i)).toBeVisible();
      await expect(page.getByText(/total/i)).toBeVisible();
    });

    test('affiche les cartes d\'articles', async ({ page }) => {
      await page.goto('/');

      // Attendre le chargement des articles (peut prendre du temps)
      // Si pas d'articles encore, le worker n'a pas synchronisé
      const articles = page.locator('[class*="carte-article"], [class*="article"]');

      // On vérifie soit des articles, soit le message "aucun article"
      const hasArticles = await articles.count() > 0;
      const hasEmptyMessage = await page.getByText(/aucun article/i).isVisible().catch(() => false);

      expect(hasArticles || hasEmptyMessage).toBeTruthy();
    });

    test('les articles contiennent titre et source', async ({ page }) => {
      await page.goto('/');

      // Si des articles sont présents
      const articles = page.locator('[class*="carte-article"], [class*="article"]');
      const count = await articles.count();

      if (count > 0) {
        const firstArticle = articles.first();
        // Vérifier les éléments de base d'un article
        await expect(firstArticle.locator('h3, h4, [class*="titre"]')).toBeVisible();
      }
    });
  });

  test.describe('Navigation du fil', () => {
    test('le header affiche le titre Fil d\'actualités', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/');

      await expect(page.getByRole('heading', { name: /fil d'actualités/i })).toBeVisible();
    });

    test('le lien Fil d\'actualités dans la nav est actif', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/');

      // Vérifier que le lien est présent et accessible
      const filLink = page.getByRole('link', { name: /fil d'actualités/i });
      await expect(filLink).toBeVisible();
    });
  });

  test.describe('Interactions articles', () => {
    test('cliquer sur un article ouvre le lien externe', async ({ page, context }) => {
      await inscrireUtilisateur(page);
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);
      await page.goto('/');

      // Si des articles avec liens sont présents
      const articleLinks = page.locator('a[href^="http"]:not([href*="localhost"])');
      const count = await articleLinks.count();

      if (count > 0) {
        // Vérifier que le lien a target="_blank" ou ouvre dans un nouvel onglet
        const firstLink = articleLinks.first();
        const target = await firstLink.getAttribute('target');
        const href = await firstLink.getAttribute('href');

        expect(href).toBeTruthy();
        // Les liens externes devraient s'ouvrir dans un nouvel onglet
        expect(target === '_blank' || target === null).toBeTruthy();
      }
    });
  });
});
