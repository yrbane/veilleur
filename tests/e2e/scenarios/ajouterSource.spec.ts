/**
 * Veilleur - Test E2E : Ajouter une source RSS (T039)
 *
 * Scénario : L'utilisateur ajoute une URL, voit la source apparaître
 * dans sa liste, et constate que les articles sont récupérés
 */

import { test, expect } from '@playwright/test';
import {
  inscrireUtilisateur,
  ajouterSource,
  SOURCES_TEST,
  genererEmailTest,
  MOT_DE_PASSE_TEST,
} from './helpers';

test.describe('US1 - Ajouter une source', () => {
  test.describe('Ajout de source RSS', () => {
    test('ajoute une source RSS valide', async ({ page }) => {
      // Inscription
      await inscrireUtilisateur(page);

      // Naviguer vers les sources
      await page.goto('/sources');
      await expect(page.getByRole('heading', { name: /mes sources/i })).toBeVisible();

      // Ajouter une source
      await page.getByLabel(/url/i).fill(SOURCES_TEST.bbcNews.url);
      await page.getByLabel(/nom/i).fill(SOURCES_TEST.bbcNews.nom);
      await page.getByRole('button', { name: /ajouter la source/i }).click();

      // Vérifier que la source apparaît
      await expect(page.getByText(SOURCES_TEST.bbcNews.nom)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/1 source/i)).toBeVisible();
    });

    test('détecte automatiquement le nom de la source', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/sources');

      // Ajouter sans nom personnalisé
      await page.getByLabel(/url/i).fill(SOURCES_TEST.hackerNews.url);
      await page.getByRole('button', { name: /ajouter la source/i }).click();

      // Vérifier que la source est ajoutée (nom détecté automatiquement)
      await expect(page.getByText(/news.ycombinator|hacker/i)).toBeVisible({ timeout: 15000 });
    });

    test('affiche une erreur pour URL invalide', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/sources');

      // Tenter d'ajouter une URL invalide
      await page.getByLabel(/url/i).fill('not-a-valid-url');
      await page.getByRole('button', { name: /ajouter la source/i }).click();

      // Vérifier l'erreur
      await expect(page.getByText(/invalide|erreur/i)).toBeVisible({ timeout: 5000 });
    });

    test('empêche les doublons', async ({ page }) => {
      await inscrireUtilisateur(page);

      // Ajouter une source
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);

      // Tenter d'ajouter la même source
      await page.getByLabel(/url/i).fill(SOURCES_TEST.bbcNews.url);
      await page.getByRole('button', { name: /ajouter la source/i }).click();

      // Vérifier l'erreur de doublon
      await expect(page.getByText(/existe déjà|déjà ajoutée/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Gestion des sources', () => {
    test('met en pause et reprend une source', async ({ page }) => {
      await inscrireUtilisateur(page);
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);

      // Mettre en pause
      await page.getByRole('button', { name: /pause/i }).click();
      await expect(page.getByText(/en pause|pausé/i)).toBeVisible({ timeout: 5000 });

      // Reprendre
      await page.getByRole('button', { name: /reprendre|play/i }).click();
      await expect(page.getByText(/active/i)).toBeVisible({ timeout: 5000 });
    });

    test('supprime une source', async ({ page }) => {
      await inscrireUtilisateur(page);
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);

      // Vérifier que la source est présente
      await expect(page.getByText(SOURCES_TEST.bbcNews.nom)).toBeVisible();

      // Supprimer
      await page.getByRole('button', { name: /supprimer/i }).click();

      // Confirmer si dialogue
      const confirmButton = page.getByRole('button', { name: /confirmer|oui/i });
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Vérifier la suppression
      await expect(page.getByText(/aucune source/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Import/Export OPML', () => {
    test('exporte les sources en OPML', async ({ page }) => {
      await inscrireUtilisateur(page);
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);

      // Intercepter le téléchargement
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /exporter opml/i }).click();
      const download = await downloadPromise;

      // Vérifier le fichier
      expect(download.suggestedFilename()).toMatch(/\.opml$/);
    });
  });
});
