/**
 * Veilleur - Script d'initialisation des données (Seed)
 * Ajoute des sources par défaut (médias de gauche et scientifiques)
 */

import { DepotSourcesMariaDB } from './DepotSourcesMariaDB';
import { creerConnexion, fermerConnexion } from './connexion';
import { loggerBdd } from '../logging/logger';
import { normaliserUrl } from '@/domaine/entites/Source';
import { createHash } from 'crypto';

const SOURCES_DEFAUT = [
  // Médias de gauche / engagés
  {
    nom: 'Le Monde Diplomatique',
    url: 'https://www.monde-diplomatique.fr/rss/',
    typeSource: 'rss' as const,
  },
  {
    nom: "L'Humanité",
    url: 'https://www.humanite.fr/rss/tout.xml',
    typeSource: 'rss' as const,
  },
  {
    nom: 'Reporterre',
    url: 'https://reporterre.net/spip.php?page=backend',
    typeSource: 'rss' as const,
  },
  {
    nom: 'Basta!',
    url: 'https://bastamag.net/spip.php?page=backend',
    typeSource: 'rss' as const,
  },
  // Médias scientifiques
  {
    nom: 'CNRS Le Journal',
    url: 'https://lejournal.cnrs.fr/rss',
    typeSource: 'rss' as const,
  },
  {
    nom: 'Futura Sciences',
    url: 'https://www.futura-sciences.com/rss/actualites.xml',
    typeSource: 'rss' as const,
  },
  {
    nom: 'Science et Avenir',
    url: 'https://www.sciencesetavenir.fr/rss.xml',
    typeSource: 'rss' as const,
  },
  {
    nom: 'Pour la Science',
    url: 'https://www.pourlascience.fr/rss.xml',
    typeSource: 'rss' as const,
  },
];

function genererHashUrl(url: string): string {
  const normalise = normaliserUrl(url);
  return createHash('md5').update(normalise).digest('hex');
}

async function seed() {
  loggerBdd.info('Démarrage du seeding des sources...');
  
  await creerConnexion();
  const depot = new DepotSourcesMariaDB();
  
  let ajoutees = 0;
  let ignorees = 0;

  for (const s of SOURCES_DEFAUT) {
    const hash = genererHashUrl(s.url);
    const existe = await depot.trouverParHashUrl(hash);
    
    if (!existe) {
      await depot.creer({
        ...s,
        statut: 'active',
        urlFavicon: null,
        dateDerniereSynchro: null,
        hashUrlNormalise: hash,
        nombreEchecs: 0,
      });
      ajoutees++;
    } else {
      ignorees++;
    }
  }

  loggerBdd.info({ ajoutees, ignorees }, 'Seeding terminé');
  await fermerConnexion();
}

seed().catch(err => {
  console.error('Erreur lors du seeding:', err);
  process.exit(1);
});
