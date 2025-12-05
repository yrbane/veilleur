/**
 * Veilleur - Tests E2E Page Sources
 */

import { test, expect } from '@playwright/test';

test.describe('Page Sources', () => {
  test('affiche le message de connexion requise pour utilisateur non connecté', async ({ page }) => {
    await page.goto('/sources');

    // Vérifier qu'un message invite à se connecter
    await expect(page.getByText(/connexion requise/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /connexion/i })).toBeVisible();
  });

  test('redirige vers connexion au clic sur le bouton', async ({ page }) => {
    await page.goto('/sources');

    // Cliquer sur le bouton de connexion
    await page.getByRole('link', { name: /connexion/i }).click();

    // Vérifier la redirection
    await expect(page).toHaveURL(/connexion/);
  });
});

test.describe('Page Découverte', () => {
  test('affiche la page de découverte', async ({ page }) => {
    await page.goto('/decouverte');

    // Vérifier les éléments de la page
    await expect(page.getByRole('heading', { name: /découv/i })).toBeVisible();
  });

  test('affiche une barre de recherche', async ({ page }) => {
    await page.goto('/decouverte');

    // Vérifier la présence de la barre de recherche
    await expect(page.getByPlaceholder(/recherch/i)).toBeVisible();
  });

  test('affiche les filtres de tri', async ({ page }) => {
    await page.goto('/decouverte');

    // Vérifier les boutons de tri
    await expect(page.getByRole('button', { name: /populaire/i })).toBeVisible();
  });
});
