/**
 * Veilleur - Sections de la page Paramètres : celles du compte pour tous,
 * celles de l'administration pour le rôle admin. L'ancre de l'URL désigne la section ouverte.
 */

export interface SectionParametres {
  id: string;
  icone: string;
  libelle: string;
  description: string;
  groupe: 'compte' | 'admin';
}

export const SECTIONS_COMPTE: SectionParametres[] = [
  { id: 'compte', icone: 'person', libelle: 'Compte', description: 'Votre profil, le thème, la langue et le rythme de rafraîchissement.', groupe: 'compte' },
  { id: 'securite', icone: 'shield', libelle: 'Sécurité', description: 'Mot de passe et authentification à deux facteurs.', groupe: 'compte' },
  { id: 'notifications', icone: 'notifications', libelle: 'Notifications', description: 'Alertes push sur cet appareil et résumé par courriel.', groupe: 'compte' },
  { id: 'application', icone: 'install_mobile', libelle: 'Application et données', description: 'Installation sur l\'appareil et export de vos annotations.', groupe: 'compte' },
];

export const SECTIONS_ADMIN: SectionParametres[] = [
  { id: 'apercu', icone: 'monitoring', libelle: 'Vue d\'ensemble', description: 'Statistiques anonymes de l\'instance sur 30 jours.', groupe: 'admin' },
  { id: 'comptes', icone: 'group', libelle: 'Comptes', description: 'Rôles, activation et suppression des comptes.', groupe: 'admin' },
  { id: 'sources', icone: 'rss_feed', libelle: 'Sources', description: 'Toutes les sources de l\'instance : statut, échecs, abonnés, articles.', groupe: 'admin' },
  { id: 'systeme', icone: 'dns', libelle: 'Système', description: 'Serveur, Redis, base de données et files de travaux.', groupe: 'admin' },
];

export function sectionsPour(role: string | undefined): SectionParametres[] {
  return role === 'admin' ? [...SECTIONS_COMPTE, ...SECTIONS_ADMIN] : SECTIONS_COMPTE;
}

export function sectionDepuisHash(hash: string, sections: SectionParametres[]): SectionParametres {
  const id = hash.replace(/^#/, '');
  return sections.find(s => s.id === id) ?? sections[0]!;
}
