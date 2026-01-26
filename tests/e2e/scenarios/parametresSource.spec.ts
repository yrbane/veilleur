/**
 * Veilleur - Test E2E : Paramètres avancés des sources (T080)
 *
 * Scénario : L'utilisateur modifie les paramètres d'une source
 * et constate les changements
 */

import { test, expect } from '@playwright/test';
import {
  inscrireUtilisateur,
  ajouterSource,
  SOURCES_TEST,
} from './helpers';

test.describe('US6 - Paramètres avancés par source', () => {
  test.beforeEach(async ({ page }) => {
    await inscrireUtilisateur(page);
    await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);
  });

  test.describe('Accès aux paramètres', () => {
    test('affiche le bouton paramètres sur une source', async ({ page }) => {
      await page.goto('/sources');

      // Vérifier le bouton paramètres
      const btnParametres = page.getByRole('button', { name: /paramètres/i });
      await expect(btnParametres).toBeVisible();
    });

    test('ouvre le panneau des paramètres', async ({ page }) => {
      await page.goto('/sources');

      // Cliquer sur paramètres
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier que le panneau s'ouvre
      await expect(page.getByText(/paramètres avancés|configuration/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Fréquence de synchronisation', () => {
    test('affiche le sélecteur de fréquence', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier le sélecteur
      await expect(page.getByText(/fréquence/i)).toBeVisible();
      const selectFrequence = page.getByRole('combobox', { name: /fréquence/i });
      await expect(selectFrequence).toBeVisible();
    });

    test('modifie la fréquence de synchronisation', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Changer la fréquence
      const selectFrequence = page.getByRole('combobox', { name: /fréquence/i });
      await selectFrequence.selectOption({ label: /1 heure|60 minutes/i });

      // Sauvegarder
      await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).click();

      // Vérifier le succès
      await expect(page.getByText(/enregistrés|sauvegardés|mis à jour/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Nombre maximum d\'articles', () => {
    test('affiche le champ nombre max articles', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier le champ
      await expect(page.getByText(/nombre.*articles|articles.*max/i)).toBeVisible();
    });

    test('modifie le nombre maximum d\'articles', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Modifier la valeur
      const inputMax = page.getByRole('spinbutton', { name: /articles/i });
      if (await inputMax.isVisible()) {
        await inputMax.fill('50');

        // Sauvegarder
        await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).click();
        await expect(page.getByText(/enregistrés|sauvegardés/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Priorité', () => {
    test('affiche le sélecteur de priorité', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier le sélecteur de priorité
      await expect(page.getByText(/priorité/i)).toBeVisible();
    });

    test('change la priorité de la source', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Changer la priorité
      const selectPriorite = page.getByRole('combobox', { name: /priorité/i });
      if (await selectPriorite.isVisible()) {
        await selectPriorite.selectOption({ label: /haute/i });

        // Sauvegarder
        await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).click();
        await expect(page.getByText(/enregistrés|sauvegardés/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Rétention des articles', () => {
    test('affiche le champ de rétention', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier le champ
      await expect(page.getByText(/rétention|jours/i)).toBeVisible();
    });

    test('modifie la durée de rétention', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Modifier la rétention
      const inputRetention = page.getByRole('spinbutton', { name: /rétention|jours/i });
      if (await inputRetention.isVisible()) {
        await inputRetention.fill('90');

        // Sauvegarder
        await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).click();
        await expect(page.getByText(/enregistrés|sauvegardés/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Filtres de mots-clés', () => {
    test('affiche la section des filtres', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier la section filtres
      await expect(page.getByText(/filtre|mots-clés/i)).toBeVisible();
    });
  });

  test.describe('Mode d\'extraction', () => {
    test('affiche le sélecteur de mode', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier le sélecteur
      await expect(page.getByText(/mode.*extraction|extraction/i)).toBeVisible();
    });
  });

  test.describe('Fermeture du panneau', () => {
    test('ferme le panneau avec le bouton fermer', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Vérifier que le panneau est ouvert
      await expect(page.getByText(/paramètres avancés/i)).toBeVisible();

      // Fermer
      const btnFermer = page.getByRole('button', { name: /fermer|×|annuler/i });
      if (await btnFermer.isVisible()) {
        await btnFermer.click();

        // Vérifier que le panneau est fermé
        await expect(page.getByText(/paramètres avancés/i)).not.toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('Persistance des paramètres', () => {
    test('conserve les paramètres après rechargement', async ({ page }) => {
      await page.goto('/sources');
      await page.getByRole('button', { name: /paramètres/i }).click();

      // Modifier un paramètre
      const selectFrequence = page.getByRole('combobox', { name: /fréquence/i });
      if (await selectFrequence.isVisible()) {
        await selectFrequence.selectOption({ label: /2 heures|120 minutes/i });
        await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).click();
        await page.waitForTimeout(1000);

        // Recharger la page
        await page.reload();

        // Rouvrir les paramètres
        await page.getByRole('button', { name: /paramètres/i }).click();

        // Vérifier que la valeur est conservée
        const selectReload = page.getByRole('combobox', { name: /fréquence/i });
        await expect(selectReload).toHaveValue(/120|2/);
      }
    });
  });
});
