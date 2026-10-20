/**
 * Veilleur - Composition du résumé courriel (quotidien ou hebdomadaire)
 */

import type { ArticleAvecSource } from '@/domaine/entites/Article';
import type { FrequenceResume } from '@/domaine/ports/DepotNotifications';
import type { Courriel } from '@/domaine/ports/EnvoyeurCourriel';

export interface OptionsResume {
  frequence: FrequenceResume;
  articles: ArticleAvecSource[];
  /** Nombre total d'articles non lus sur la période (peut dépasser la liste) */
  total: number;
  urlApp: string;
  destinataire: string;
}

export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tronquer(texte: string, max: number): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  return propre.length > max ? `${propre.slice(0, max - 1).trimEnd()}…` : propre;
}

/**
 * Regroupe les articles par source en gardant l'ordre d'apparition des sources
 */
export function grouperParSource(articles: ArticleAvecSource[]): { nom: string; articles: ArticleAvecSource[] }[] {
  const groupes = new Map<string, ArticleAvecSource[]>();
  for (const article of articles) {
    const liste = groupes.get(article.source.nom) ?? [];
    liste.push(article);
    groupes.set(article.source.nom, liste);
  }
  return [...groupes.entries()].map(([nom, liste]) => ({ nom, articles: liste }));
}

export function composerResume(options: OptionsResume): Omit<Courriel, 'a'> & { a: string } {
  const { frequence, articles, total, urlApp, destinataire } = options;
  const periode = frequence === 'quotidien' ? 'des dernières 24 heures' : 'de la semaine';
  const sujet = `Veilleur · ${total} article${total > 1 ? 's' : ''} à lire ${frequence === 'quotidien' ? 'aujourd\'hui' : 'cette semaine'}`;
  const urlFil = `${urlApp}/?nonLus=1`;
  const urlParametres = `${urlApp}/parametres`;
  const groupes = grouperParSource(articles);

  const texte = [
    `Veilleur — votre résumé ${periode}`,
    `${total} article${total > 1 ? 's' : ''} non lu${total > 1 ? 's' : ''} vous attendent.`,
    '',
    ...groupes.flatMap(g => [
      `## ${g.nom}`,
      ...g.articles.map(a => `- ${tronquer(a.titre, 120)}\n  ${a.lien}`),
      '',
    ]),
    `Tout lire : ${urlFil}`,
    `Pour changer la fréquence ou ne plus recevoir ce résumé : ${urlParametres}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapperHtml(sujet)}</title></head>
<body style="margin:0;padding:24px;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1e26">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 32px">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7080;text-transform:uppercase;letter-spacing:.06em">Veilleur · résumé ${echapperHtml(periode)}</p>
  <h1 style="margin:0 0 20px;font-size:22px">${total} article${total > 1 ? 's' : ''} non lu${total > 1 ? 's' : ''} vous attendent</h1>
  ${groupes.map(g => `
  <h2 style="margin:24px 0 8px;font-size:15px;color:#2563eb">${echapperHtml(g.nom)}</h2>
  <ul style="margin:0;padding-left:18px">
    ${g.articles.map(a => `<li style="margin:0 0 10px"><a href="${echapperHtml(a.lien)}" style="color:#1c1e26;font-weight:600;text-decoration:none">${echapperHtml(tronquer(a.titre, 140))}</a>${a.resume ? `<br><span style="font-size:13px;color:#6b7080">${echapperHtml(tronquer(a.resume, 160))}</span>` : ''}</li>`).join('\n    ')}
  </ul>`).join('\n')}
  <p style="margin:28px 0 0"><a href="${echapperHtml(urlFil)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Tout lire sur Veilleur</a></p>
  <p style="margin:24px 0 0;font-size:12px;color:#6b7080">Vous recevez ce courriel à ${echapperHtml(destinataire)} parce que vous avez activé le résumé ${frequence === 'quotidien' ? 'quotidien' : 'hebdomadaire'}. <a href="${echapperHtml(urlParametres)}" style="color:#6b7080">Changer la fréquence ou se désabonner</a>.</p>
</div></body></html>`;

  return { a: destinataire, sujet, html, texte };
}
