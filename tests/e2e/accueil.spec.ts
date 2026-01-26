/**
 * Veilleur - Tests E2E Page d'Accueil
 */

import { test, expect } from '@playwright/test';

test.describe('Page Accueil', () => {
  test('affiche le titre et la navigation', async ({ page }) => {
    await page.goto('/');

    // Vérifier le titre de l'application
    await expect(page).toHaveTitle(/Veilleur/);

    // Vérifier la navigation
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByRole('link', { name: /accueil/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sources/i })).toBeVisible();
  });

  test('affiche le message de connexion requise pour utilisateur non connecté', async ({ page }) => {
    await page.goto('/');

    // Vérifier qu'un message invite à se connecter
    await expect(page.getByText(/connexion/i)).toBeVisible();
  });

  test('navigation vers la page de connexion', async ({ page }) => {
    await page.goto('/');

    // Cliquer sur le lien de connexion
    await page.getByRole('link', { name: /connexion/i }).first().click();

    // Vérifier qu'on est sur la page de connexion
    await expect(page).toHaveURL(/connexion/);
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();
  });
});
