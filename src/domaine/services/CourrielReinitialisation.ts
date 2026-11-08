/**
 * Veilleur - Courriel « Mot de passe oublié » : lien à usage unique vers le formulaire
 */

import type { Courriel } from '@/domaine/ports/EnvoyeurCourriel';
import { echapperHtml } from './ResumeCourriel';

export interface OptionsCourrielReinitialisation {
  destinataire: string;
  urlLien: string;
  dureeMinutes: number;
}

export function composerCourrielReinitialisation(options: OptionsCourrielReinitialisation): Courriel {
  const { destinataire, urlLien, dureeMinutes } = options;
  const validite = `${dureeMinutes} minutes`;

  const texte = [
    'Veilleur — réinitialisation de votre mot de passe',
    '',
    'Vous avez demandé un nouveau mot de passe. Ouvrez ce lien pour le choisir :',
    urlLien,
    '',
    `Le lien est valable ${validite} et ne sert qu'une fois.`,
    'Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer ce message : votre mot de passe reste inchangé.',
  ].join('\n');

  const lienHtml = echapperHtml(urlLien);
  const html = `<!doctype html>
<html lang="fr"><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2933">
  <h1 style="font-size:20px;margin:0 0 16px">Réinitialisation de votre mot de passe</h1>
  <p>Vous avez demandé un nouveau mot de passe pour Veilleur. Cliquez sur le bouton pour le choisir :</p>
  <p style="margin:24px 0"><a href="${lienHtml}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Choisir un nouveau mot de passe</a></p>
  <p style="font-size:14px;color:#52606d">Ou copiez ce lien dans votre navigateur :<br><a href="${lienHtml}">${lienHtml}</a></p>
  <p style="font-size:14px;color:#52606d">Le lien est valable ${validite} et ne sert qu'une fois.</p>
  <p style="font-size:14px;color:#52606d">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message : votre mot de passe reste inchangé.</p>
</body></html>`;

  return { a: destinataire, sujet: 'Veilleur · Réinitialisation de votre mot de passe', texte, html };
}
