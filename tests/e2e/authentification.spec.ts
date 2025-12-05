/**
 * Veilleur - Tests E2E Authentification
 */

import { test, expect } from '@playwright/test';

test.describe('Authentification', () => {
  test.describe('Page Connexion', () => {
    test('affiche le formulaire de connexion', async ({ page }) => {
      await page.goto('/connexion');

      // Vérifier le formulaire
      await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /connexion/i })).toBeVisible();
    });

    test('affiche une erreur pour email invalide', async ({ page }) => {
      await page.goto('/connexion');

      // Remplir avec un email invalide
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/mot de passe/i).fill('MotDePasse123');
      await page.getByRole('button', { name: /connexion/i }).click();

      // Vérifier l'erreur
      await expect(page.getByText(/invalide/i)).toBeVisible();
    });

    test('lien vers inscription fonctionne', async ({ page }) => {
      await page.goto('/connexion');

      // Cliquer sur le lien d'inscription
      await page.getByRole('link', { name: /inscription|créer un compte/i }).click();

      // Vérifier qu'on est sur la page d'inscription
      await expect(page).toHaveURL(/inscription/);
    });
  });

  test.describe('Page Inscription', () => {
    test('affiche le formulaire d\'inscription', async ({ page }) => {
      await page.goto('/inscription');

      // Vérifier le formulaire
      await expect(page.getByRole('heading', { name: /inscription/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/mot de passe/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /inscription|créer/i })).toBeVisible();
    });

    test('valide les critères du mot de passe', async ({ page }) => {
      await page.goto('/inscription');

      // Remplir avec un mot de passe trop court
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/mot de passe/i).first().fill('short');

      // Tenter de soumettre
      await page.getByRole('button', { name: /inscription|créer/i }).click();

      // Vérifier l'erreur de validation
      await expect(page.getByText(/10 caractères|majuscule|chiffre/i)).toBeVisible();
    });
  });
});
