/**
 * Veilleur - Utilitaires des graphiques du tableau de bord (Chart.js chargé à la demande)
 * Couleurs tirées du thème courant (variables CSS) pour rester cohérent clair / sombre
 */

import type { Chart as TypeChart, ChartConfiguration, ChartOptions } from 'chart.js';

/** Même teinte de départ que les tags colorés, pour une famille visuelle commune */
const TEINTE_BASE = 262;
const NOMBRE_D_OR = 137.508;

/** `n` couleurs oklch réparties sur la roue, à l'opacité donnée */
export function palette(n: number, opacite = 1): string[] {
  return Array.from({ length: n }, (_, i) => {
    const teinte = Math.round((TEINTE_BASE + i * NOMBRE_D_OR) % 360);
    return opacite >= 1 ? `oklch(0.68 0.15 ${teinte})` : `oklch(0.68 0.15 ${teinte} / ${opacite})`;
  });
}

/** Valeur d'une variable CSS du thème, avec repli */
export function variableTheme(nom: string, repli: string): string {
  if (typeof getComputedStyle === 'undefined') return repli;
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return valeur || repli;
}

export function formatOctets(octets: number): string {
  if (!octets || octets < 1024) return `${Math.round(octets || 0)} o`;
  const unites = ['Ko', 'Mo', 'Go', 'To'];
  let valeur = octets / 1024;
  let i = 0;
  while (valeur >= 1024 && i < unites.length - 1) {
    valeur /= 1024;
    i++;
  }
  return `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unites[i]}`;
}

export function formatDuree(secondes: number): string {
  if (secondes < 60) return 'moins d\'une minute';
  const jours = Math.floor(secondes / 86400);
  const heures = Math.floor((secondes % 86400) / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  if (jours > 0) return `${jours} j ${heures} h`;
  if (heures > 0) return `${heures} h ${minutes} min`;
  return `${minutes} min`;
}

/** « 2026-10-30 » → « 30 oct. » */
export function libellesJours(jours: string[]): string[] {
  const format = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return jours.map(j => {
    const [a = 1970, m = 1, d = 1] = j.split('-').map(Number);
    return format.format(new Date(a, m - 1, d));
  });
}

/** Options partagées : couleurs du thème, pas d'animation (rendu immédiat, captures fidèles) */
export function optionsCommunes(): ChartOptions {
  const texte = variableTheme('--couleur-texte-secondaire', '#667');
  const grille = variableTheme('--couleur-bordure', '#dde');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { labels: { color: texte, boxWidth: 12, usePointStyle: true } },
      tooltip: { backgroundColor: variableTheme('--couleur-fond-carte', '#fff'), titleColor: variableTheme('--couleur-texte', '#111'), bodyColor: texte, borderColor: grille, borderWidth: 1 },
    },
    scales: {
      x: { ticks: { color: texte, maxRotation: 0, autoSkip: true }, grid: { color: grille } },
      y: { ticks: { color: texte, precision: 0 }, grid: { color: grille }, beginAtZero: true },
    },
  };
}

/** Fusion superficielle des options : les axes et plugins spécifiques complètent les communs */
export function fusionnerOptions(base: ChartOptions, specifiques: ChartOptions): ChartOptions {
  return {
    ...base,
    ...specifiques,
    plugins: { ...base.plugins, ...specifiques.plugins },
    scales: specifiques.scales === undefined ? base.scales : specifiques.scales,
  };
}

/**
 * Crée un graphique dans un canvas ; Chart.js n'est téléchargé qu'à la première utilisation
 */
export async function creerGraphique(canvas: HTMLCanvasElement, configuration: ChartConfiguration): Promise<TypeChart> {
  const { Chart } = await import('chart.js/auto');
  Chart.defaults.font.family = variableTheme('--police-sans', 'system-ui, sans-serif');
  return new Chart(canvas, configuration);
}
