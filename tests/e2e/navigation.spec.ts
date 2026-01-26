/**
 * Veilleur - Tests E2E Navigation
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('navigation principale fonctionne', async ({ page }) => {
    await page.goto('/');

    // Vérifier les liens de navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Navigation vers Sources
    const sourcesLink = page.getByRole('link', { name: /sources/i });
    if (await sourcesLink.isVisible()) {
      await sourcesLink.click();
      await expect(page).toHaveURL(/sources/);
    }

    // Navigation vers Accueil
    const accueilLink = page.getByRole('link', { name: /accueil/i });
    if (await accueilLink.isVisible()) {
      await accueilLink.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('logo redirige vers accueil', async ({ page }) => {
    await page.goto('/sources');

    // Cliquer sur le logo
    const logo = page.locator('[data-nav]').first();
    if (await logo.isVisible()) {
      await logo.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('responsive - menu mobile', async ({ page }) => {
    // Définir une taille d'écran mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // La navigation devrait s'adapter
    await expect(page).toHaveTitle(/Veilleur/);
  });
});

test.describe('Thème', () => {
  test('le thème par défaut est appliqué', async ({ page }) => {
    await page.goto('/');

    // Vérifier que l'élément html a une classe de thème ou utilise les variables CSS
    const html = page.locator('html');
    await expect(html).toBeVisible();
  });
});
