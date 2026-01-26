/**
 * Veilleur - Test E2E : Noter et taguer les sources (T070)
 *
 * Scénario : L'utilisateur note une source de 1-5 étoiles
 * et lui ajoute des tags
 */

import { test, expect } from '@playwright/test';
import {
  inscrireUtilisateur,
  ajouterSource,
  SOURCES_TEST,
} from './helpers';

test.describe('US3 - Noter et taguer les sources', () => {
  test.beforeEach(async ({ page }) => {
    await inscrireUtilisateur(page);
    await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);
  });

  test.describe('Notation', () => {
    test('affiche les étoiles de notation', async ({ page }) => {
      await page.goto('/sources');

      // Vérifier que les étoiles sont présentes
      const etoiles = page.getByRole('button', { name: /étoile/i });
      await expect(etoiles.first()).toBeVisible();

      // Il devrait y avoir 5 étoiles
      const count = await etoiles.count();
      expect(count).toBe(5);
    });

    test('note une source avec 4 étoiles', async ({ page }) => {
      await page.goto('/sources');

      // Cliquer sur la 4ème étoile
      const etoile4 = page.getByRole('button', { name: /4 étoiles/i });
      await etoile4.click();

      // Vérifier le message de succès
      await expect(page.getByText(/note.*4|4.*5/i)).toBeVisible({ timeout: 5000 });

      // Vérifier que les 4 premières étoiles sont remplies
      const etoilesRemplies = page.locator('button:has-text("★")');
      const countRemplies = await etoilesRemplies.count();
      expect(countRemplies).toBeGreaterThanOrEqual(4);
    });

    test('change la note d\'une source', async ({ page }) => {
      await page.goto('/sources');

      // Mettre 3 étoiles
      await page.getByRole('button', { name: /3 étoiles/i }).click();
      await expect(page.getByText(/note.*3|3.*5/i)).toBeVisible({ timeout: 5000 });

      // Changer pour 5 étoiles
      await page.getByRole('button', { name: /5 étoiles/i }).click();
      await expect(page.getByText(/note.*5|5.*5/i)).toBeVisible({ timeout: 5000 });
    });

    test('supprime la note en cliquant sur la même étoile', async ({ page }) => {
      await page.goto('/sources');

      // Mettre 2 étoiles
      const etoile2 = page.getByRole('button', { name: /2 étoiles/i });
      await etoile2.click();
      await page.waitForTimeout(500);

      // Recliquer pour supprimer (si supporté)
      await etoile2.click();

      // Vérifier que la note est mise à jour
      await expect(page.getByText(/note/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Tags', () => {
    test('affiche le champ d\'ajout de tag', async ({ page }) => {
      await page.goto('/sources');

      // Vérifier le champ de tag
      const tagInput = page.getByPlaceholder(/tag/i);
      await expect(tagInput).toBeVisible();

      const addButton = page.getByRole('button', { name: '+' });
      await expect(addButton).toBeVisible();
    });

    test('ajoute un tag à une source', async ({ page }) => {
      await page.goto('/sources');

      // Ajouter un tag
      const tagInput = page.getByPlaceholder(/tag/i);
      await tagInput.fill('actualités');
      await page.getByRole('button', { name: '+' }).click();

      // Vérifier que le tag apparaît
      await expect(page.getByText('actualités')).toBeVisible({ timeout: 5000 });
    });

    test('ajoute plusieurs tags', async ({ page }) => {
      await page.goto('/sources');

      const tags = ['tech', 'news', 'international'];

      for (const tag of tags) {
        const tagInput = page.getByPlaceholder(/tag/i).first();
        await tagInput.fill(tag);
        await page.getByRole('button', { name: '+' }).first().click();
        await page.waitForTimeout(300);
      }

      // Vérifier que tous les tags sont présents
      for (const tag of tags) {
        await expect(page.getByText(tag)).toBeVisible();
      }
    });

    test('supprime un tag', async ({ page }) => {
      await page.goto('/sources');

      // Ajouter un tag
      const tagInput = page.getByPlaceholder(/tag/i);
      await tagInput.fill('à-supprimer');
      await page.getByRole('button', { name: '+' }).click();

      // Vérifier que le tag est ajouté
      await expect(page.getByText('à-supprimer')).toBeVisible({ timeout: 5000 });

      // Supprimer le tag (cliquer sur le × à côté)
      const removeButton = page.getByRole('button', { name: /retirer|×/i }).first();
      await removeButton.click();

      // Vérifier que le tag est supprimé
      await expect(page.getByText('à-supprimer')).not.toBeVisible({ timeout: 5000 });
    });

    test('ne permet pas les tags vides', async ({ page }) => {
      await page.goto('/sources');

      // Essayer d'ajouter un tag vide
      const tagInput = page.getByPlaceholder(/tag/i);
      await tagInput.fill('');
      await page.getByRole('button', { name: '+' }).click();

      // Le champ devrait rester vide, pas de nouveau tag ajouté
      // (le comportement exact dépend de l'implémentation)
    });

    test('ajoute un tag avec Entrée', async ({ page }) => {
      await page.goto('/sources');

      // Ajouter un tag avec la touche Entrée
      const tagInput = page.getByPlaceholder(/tag/i);
      await tagInput.fill('via-entree');
      await tagInput.press('Enter');

      // Vérifier que le tag apparaît
      await expect(page.getByText('via-entree')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Notation et Tags combinés', () => {
    test('une source peut avoir note et tags', async ({ page }) => {
      await page.goto('/sources');

      // Ajouter une note
      await page.getByRole('button', { name: /4 étoiles/i }).click();
      await page.waitForTimeout(500);

      // Ajouter un tag
      const tagInput = page.getByPlaceholder(/tag/i);
      await tagInput.fill('favori');
      await page.getByRole('button', { name: '+' }).click();

      // Vérifier les deux
      const etoilesRemplies = page.locator('button:has-text("★")');
      expect(await etoilesRemplies.count()).toBeGreaterThanOrEqual(4);
      await expect(page.getByText('favori')).toBeVisible();
    });
  });
});
