/**
 * Veilleur - Test E2E : Gestion du compte (T063)
 *
 * Scénario : L'utilisateur s'inscrit, se connecte,
 * et retrouve ses sources après reconnexion
 */

import { test, expect } from '@playwright/test';
import {
  inscrireUtilisateur,
  connecterUtilisateur,
  deconnecterUtilisateur,
  ajouterSource,
  genererEmailTest,
  MOT_DE_PASSE_TEST,
  SOURCES_TEST,
} from './helpers';

test.describe('US5 - Gestion du compte', () => {
  test.describe('Inscription', () => {
    test('inscrit un nouvel utilisateur avec succès', async ({ page }) => {
      const email = genererEmailTest();
      await page.goto('/inscription');

      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/mot de passe/i).first().fill(MOT_DE_PASSE_TEST);
      await page.getByLabel(/confirmer/i).fill(MOT_DE_PASSE_TEST);
      await page.getByRole('button', { name: /créer/i }).click();

      // Vérifier le succès
      await expect(page.getByText(/compte créé/i)).toBeVisible({ timeout: 10000 });

      // Vérifier la redirection vers le fil
      await expect(page.getByRole('heading', { name: /fil d'actualités/i })).toBeVisible();
    });

    test('affiche une erreur si email déjà utilisé', async ({ page }) => {
      const email = genererEmailTest();

      // Première inscription
      await inscrireUtilisateur(page, email);
      await deconnecterUtilisateur(page);

      // Deuxième inscription avec le même email
      await page.goto('/inscription');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/mot de passe/i).first().fill(MOT_DE_PASSE_TEST);
      await page.getByLabel(/confirmer/i).fill(MOT_DE_PASSE_TEST);
      await page.getByRole('button', { name: /créer/i }).click();

      // Vérifier l'erreur
      await expect(page.getByText(/existe déjà|déjà utilisé/i)).toBeVisible({ timeout: 5000 });
    });

    test('valide la confirmation du mot de passe', async ({ page }) => {
      await page.goto('/inscription');

      await page.getByLabel(/email/i).fill(genererEmailTest());
      await page.getByLabel(/mot de passe/i).first().fill(MOT_DE_PASSE_TEST);
      await page.getByLabel(/confirmer/i).fill('AutreMotDePasse123!');
      await page.getByRole('button', { name: /créer/i }).click();

      // Vérifier l'erreur
      await expect(page.getByText(/correspondent pas|différents/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Connexion', () => {
    test('connecte un utilisateur existant', async ({ page }) => {
      const email = genererEmailTest();
      await inscrireUtilisateur(page, email);
      await deconnecterUtilisateur(page);

      // Reconnecter
      await connecterUtilisateur(page, email);

      // Vérifier la connexion
      await expect(page.getByRole('button', { name: /déconnecter/i })).toBeVisible();
    });

    test('affiche une erreur pour identifiants invalides', async ({ page }) => {
      await page.goto('/connexion');

      await page.getByLabel(/email/i).fill('inexistant@test.com');
      await page.getByLabel(/mot de passe/i).fill('MauvaisMotDePasse123!');
      await page.getByRole('button', { name: /connexion/i }).click();

      // Vérifier l'erreur
      await expect(page.getByText(/invalide|incorrect|erreur/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Persistance des données', () => {
    test('retrouve ses sources après reconnexion', async ({ page }) => {
      const email = genererEmailTest();

      // Inscription et ajout de source
      await inscrireUtilisateur(page, email);
      await ajouterSource(page, SOURCES_TEST.bbcNews.url, SOURCES_TEST.bbcNews.nom);

      // Vérifier la source
      await expect(page.getByText(SOURCES_TEST.bbcNews.nom)).toBeVisible();

      // Déconnexion
      await deconnecterUtilisateur(page);

      // Reconnexion
      await connecterUtilisateur(page, email);

      // Vérifier que la source est toujours là
      await page.goto('/sources');
      await expect(page.getByText(SOURCES_TEST.bbcNews.nom)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Page Paramètres', () => {
    test('affiche les informations du profil', async ({ page }) => {
      const email = genererEmailTest();
      await inscrireUtilisateur(page, email);

      await page.goto('/parametres');

      // Vérifier les informations affichées
      await expect(page.getByRole('heading', { name: /paramètres/i })).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
      await expect(page.getByText(/membre depuis/i)).toBeVisible();
    });

    test('permet de changer le thème', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/parametres');

      // Trouver le sélecteur de thème
      const themeSelect = page.getByRole('combobox', { name: /thème/i });
      await expect(themeSelect).toBeVisible();

      // Changer le thème
      await themeSelect.selectOption({ label: /sombre/i });
    });

    test('permet de changer la fréquence de rafraîchissement', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/parametres');

      // Trouver le sélecteur de fréquence
      const frequenceSelect = page.getByRole('combobox', { name: /fréquence/i });
      await expect(frequenceSelect).toBeVisible();

      // Changer la fréquence
      await frequenceSelect.selectOption({ label: /1 heure/i });

      // Sauvegarder
      await page.getByRole('button', { name: /enregistrer/i }).click();

      // Vérifier le succès
      await expect(page.getByText(/enregistrées|sauvegardées|mis à jour/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Sécurité', () => {
    test('affiche la section changement de mot de passe', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/parametres');

      // Vérifier la section sécurité
      await expect(page.getByRole('heading', { name: /sécurité/i })).toBeVisible();
      await expect(page.getByLabel(/mot de passe actuel/i)).toBeVisible();
      await expect(page.getByLabel(/nouveau mot de passe/i)).toBeVisible();
    });

    test('affiche la section 2FA', async ({ page }) => {
      await inscrireUtilisateur(page);
      await page.goto('/parametres');

      // Vérifier la section 2FA
      await expect(page.getByText(/authentification à deux facteurs|2fa/i)).toBeVisible();
    });
  });

  test.describe('Déconnexion', () => {
    test('déconnecte l\'utilisateur', async ({ page }) => {
      await inscrireUtilisateur(page);

      // Vérifier qu'on est connecté
      await expect(page.getByRole('button', { name: /déconnecter/i })).toBeVisible();

      // Déconnecter
      await page.getByRole('button', { name: /déconnecter/i }).click();

      // Vérifier la déconnexion
      await expect(page.getByRole('link', { name: /connexion/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /déconnecter/i })).not.toBeVisible();
    });

    test('redirige vers l\'accueil après déconnexion', async ({ page }) => {
      await inscrireUtilisateur(page);
      await deconnecterUtilisateur(page);

      // Vérifier qu'on est sur l'accueil non connecté
      await expect(page.getByRole('link', { name: /créer un compte/i })).toBeVisible();
    });
  });
});
