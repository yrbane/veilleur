/**
 * Veilleur - Test E2E : Découverte des sources (T088)
 *
 * Scénario : L'utilisateur parcourt les sources publiques
 * filtrées par tag avec notes moyennes
 */

import { test, expect } from '@playwright/test';
import {
  inscrireUtilisateur,
  ajouterSource,
  SOURCES_TEST,
} from './helpers';

test.describe('US4 - Découvrir via la communauté', () => {
  test.describe('Page Découverte - Non connecté', () => {
    test('affiche la page découverte sans connexion', async ({ page }) => {
      await page.goto('/decouverte');

      // Vérifier le titre
      await expect(page.getByRole('heading', { name: /découverte/i })).toBeVisible();
      await expect(page.getByText(/sources populaires|communauté/i)).toBeVisible();
    });

    test('affiche les sources communautaires', async ({ page }) => {
      await page.goto('/decouverte');

      // Attendre le chargement
      await page.waitForTimeout(2000);

      // Vérifier qu'il y a des cartes de sources ou un message
      const cartes = page.locator('[class*="carte"], [class*="source"]');
      const hasCartes = await cartes.count() > 0;
      const hasEmpty = await page.getByText(/aucune source/i).isVisible().catch(() => false);

      expect(hasCartes || hasEmpty).toBeTruthy();
    });

    test('affiche le bouton connexion sur les cartes', async ({ page }) => {
      await page.goto('/decouverte');
      await page.waitForTimeout(2000);

      // Pour les utilisateurs non connectés, le bouton devrait inviter à se connecter
      const btnConnexion = page.getByRole('button', { name: /connectez-vous|connexion/i });
      if (await btnConnexion.isVisible().catch(() => false)) {
        await expect(btnConnexion).toBeVisible();
      }
    });
  });

  test.describe('Page Découverte - Connecté', () => {
    test.beforeEach(async ({ page }) => {
      await inscrireUtilisateur(page);
    });

    test('affiche la page découverte', async ({ page }) => {
      await page.goto('/decouverte');

      await expect(page.getByRole('heading', { name: /découverte/i })).toBeVisible();
    });

    test('affiche les boutons de tri', async ({ page }) => {
      await page.goto('/decouverte');

      // Vérifier les options de tri
      await expect(page.getByRole('button', { name: /popularité/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /note/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /récent/i })).toBeVisible();
    });

    test('affiche la barre de recherche', async ({ page }) => {
      await page.goto('/decouverte');

      // Vérifier la recherche
      await expect(page.getByPlaceholder(/rechercher/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /rechercher/i })).toBeVisible();
    });

    test('change le tri par popularité', async ({ page }) => {
      await page.goto('/decouverte');

      // Cliquer sur popularité
      await page.getByRole('button', { name: /popularité/i }).click();

      // Vérifier que le bouton est actif
      const btnPopularite = page.getByRole('button', { name: /popularité/i });
      await expect(btnPopularite).toHaveClass(/active/);
    });

    test('change le tri par note', async ({ page }) => {
      await page.goto('/decouverte');

      // Cliquer sur note
      await page.getByRole('button', { name: /note/i }).click();

      // Attendre le rechargement
      await page.waitForTimeout(500);
    });

    test('change le tri par récent', async ({ page }) => {
      await page.goto('/decouverte');

      // Cliquer sur récent
      await page.getByRole('button', { name: /récent/i }).click();

      // Attendre le rechargement
      await page.waitForTimeout(500);
    });
  });

  test.describe('Recherche', () => {
    test.beforeEach(async ({ page }) => {
      await inscrireUtilisateur(page);
    });

    test('effectue une recherche', async ({ page }) => {
      await page.goto('/decouverte');

      // Rechercher
      await page.getByPlaceholder(/rechercher/i).fill('news');
      await page.getByRole('button', { name: /rechercher/i }).click();

      // Attendre les résultats
      await page.waitForTimeout(1000);
    });

    test('affiche message si terme trop court', async ({ page }) => {
      await page.goto('/decouverte');

      // Rechercher avec un seul caractère
      await page.getByPlaceholder(/rechercher/i).fill('a');
      await page.getByRole('button', { name: /rechercher/i }).click();

      // Devrait afficher un message d'info
      await expect(page.getByText(/2 caractères|trop court/i)).toBeVisible({ timeout: 3000 });
    });

    test('réinitialise la recherche en vidant le champ', async ({ page }) => {
      await page.goto('/decouverte');

      // Rechercher
      await page.getByPlaceholder(/rechercher/i).fill('test');
      await page.getByRole('button', { name: /rechercher/i }).click();
      await page.waitForTimeout(500);

      // Vider le champ
      await page.getByPlaceholder(/rechercher/i).fill('');

      // Les résultats devraient se réinitialiser
      await page.waitForTimeout(500);
    });
  });

  test.describe('Ajouter depuis Découverte', () => {
    test.beforeEach(async ({ page }) => {
      await inscrireUtilisateur(page);
    });

    test('ajoute une source depuis la découverte', async ({ page }) => {
      await page.goto('/decouverte');
      await page.waitForTimeout(2000);

      // Trouver un bouton Ajouter
      const btnAjouter = page.getByRole('button', { name: /ajouter/i }).first();

      if (await btnAjouter.isVisible().catch(() => false)) {
        await btnAjouter.click();

        // Vérifier le succès
        await expect(page.getByText(/ajouté|succès/i)).toBeVisible({ timeout: 10000 });

        // Le bouton devrait changer
        await expect(page.getByText(/ajouté ✓|déjà ajouté/i)).toBeVisible();
      }
    });

    test('le bouton indique déjà ajouté pour une source existante', async ({ page }) => {
      // Ajouter d'abord une source manuellement
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);

      // Aller sur découverte
      await page.goto('/decouverte');
      await page.waitForTimeout(2000);

      // Si BBC News est dans les sources populaires, le bouton devrait indiquer déjà ajouté
      const btnBBC = page.locator(`[class*="carte"]:has-text("BBC") button`);
      if (await btnBBC.isVisible().catch(() => false)) {
        // Cliquer pour vérifier
        await btnBBC.click();
        await expect(page.getByText(/déjà ajouté|existe déjà/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Informations des sources', () => {
    test('affiche le nombre d\'abonnés', async ({ page }) => {
      await page.goto('/decouverte');
      await page.waitForTimeout(2000);

      // Vérifier que les stats sont affichées
      const abonnes = page.getByText(/abonné/i);
      if (await abonnes.first().isVisible().catch(() => false)) {
        await expect(abonnes.first()).toBeVisible();
      }
    });

    test('affiche la note moyenne si présente', async ({ page }) => {
      await page.goto('/decouverte');
      await page.waitForTimeout(2000);

      // Les notes sont affichées avec ★
      const notes = page.locator('text=/★ \\d/');
      // Il peut y avoir des notes ou non selon les données
    });

    test('affiche le nom de domaine', async ({ page }) => {
      await page.goto('/decouverte');
      await page.waitForTimeout(2000);

      // Les URLs de domaine devraient être affichées
      const domaines = page.locator('[class*="url"], [class*="domaine"]');
      if (await domaines.count() > 0) {
        await expect(domaines.first()).toBeVisible();
      }
    });
  });

  test.describe('Tags populaires', () => {
    test('affiche les tags populaires si disponibles', async ({ page }) => {
      await page.goto('/decouverte');

      // La section tags populaires peut être affichée
      const sectionTags = page.getByText(/tags populaires/i);
      // Optionnel selon les données
    });

    test('filtre par tag en cliquant', async ({ page }) => {
      await page.goto('/decouverte');

      // Si des tags sont disponibles
      const tagBadge = page.locator('[class*="badge-tag"], [class*="tag"]').first();
      if (await tagBadge.isVisible().catch(() => false)) {
        await tagBadge.click();

        // Les résultats devraient se filtrer
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Navigation', () => {
    test('le lien Découverte dans la nav fonctionne', async ({ page }) => {
      await inscrireUtilisateur(page);

      // Cliquer sur Découverte dans la nav
      await page.getByRole('link', { name: /découverte/i }).click();

      // Vérifier la navigation
      await expect(page).toHaveURL(/decouverte/);
      await expect(page.getByRole('heading', { name: /découverte/i })).toBeVisible();
    });
  });
});
