/**
 * Veilleur - Helpers E2E
 * Fonctions utilitaires pour les tests E2E
 */

import { Page, expect } from '@playwright/test';

/**
 * Génère un email unique pour les tests
 */
export function genererEmailTest(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-e2e-${timestamp}-${random}@veilleur.local`;
}

/**
 * Mot de passe valide pour les tests
 */
export const MOT_DE_PASSE_TEST = 'TestPassword123!';

/**
 * Inscrit un nouvel utilisateur
 */
export async function inscrireUtilisateur(
  page: Page,
  email: string = genererEmailTest(),
  motDePasse: string = MOT_DE_PASSE_TEST,
): Promise<string> {
  await page.goto('/inscription');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).first().fill(motDePasse);
  await page.getByLabel(/confirmer/i).fill(motDePasse);
  await page.getByRole('button', { name: /créer/i }).click();

  // Attendre la redirection ou le message de succès
  await expect(page.getByText(/compte créé|fil d'actualités/i)).toBeVisible({ timeout: 10000 });

  return email;
}

/**
 * Connecte un utilisateur existant
 */
export async function connecterUtilisateur(
  page: Page,
  email: string,
  motDePasse: string = MOT_DE_PASSE_TEST,
): Promise<void> {
  await page.goto('/connexion');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(motDePasse);
  await page.getByRole('button', { name: /connexion/i }).click();

  // Attendre la redirection
  await expect(page.getByRole('button', { name: /déconnecter/i })).toBeVisible({ timeout: 10000 });
}

/**
 * Déconnecte l'utilisateur actuel
 */
export async function deconnecterUtilisateur(page: Page): Promise<void> {
  await page.getByRole('button', { name: /déconnecter/i }).click();
  await expect(page.getByRole('link', { name: /connexion/i })).toBeVisible();
}

/**
 * Ajoute une source RSS
 */
export async function ajouterSource(
  page: Page,
  url: string,
  nom?: string,
): Promise<void> {
  await page.goto('/sources');

  await page.getByLabel(/url/i).fill(url);
  if (nom) {
    await page.getByLabel(/nom/i).fill(nom);
  }
  await page.getByRole('button', { name: /ajouter la source/i }).click();

  // Attendre le succès
  await expect(page.getByText(/source ajoutée|ajouté/i)).toBeVisible({ timeout: 15000 });
}

/**
 * Sources RSS de test fiables
 */
export const SOURCES_TEST = {
  bbcNews: {
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    nom: 'BBC News',
  },
  leMonde: {
    url: 'https://www.lemonde.fr/rss/une.xml',
    nom: 'Le Monde',
  },
  hackerNews: {
    url: 'https://news.ycombinator.com/rss',
    nom: 'Hacker News',
  },
};
