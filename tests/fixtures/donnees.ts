/**
 * Fixtures de test - Données de test réutilisables
 */

import { TypeSource, StatutSource } from '../../src/domaine/entites/Source';

export const utilisateurTest = {
  id: 'user-test-123',
  email: 'test@example.com',
  motDePasse: 'MotDePasse123!',
  motDePasseHash: '$argon2id$v=19$m=65536,t=3,p=4$hash',
  dateCreation: new Date('2024-01-01'),
  preferences: {},
  estActif: true,
};

export const sourceRssTest = {
  id: 'source-rss-123',
  url: 'https://news.ycombinator.com/rss',
  nom: 'Hacker News',
  typeSource: TypeSource.RSS as const,
  statut: StatutSource.ACTIVE as const,
  urlFavicon: 'https://news.ycombinator.com/favicon.ico',
  dateCreation: new Date('2024-01-01'),
  dateDerniereSynchro: new Date('2024-01-15'),
  hashUrlNormalise: 'abc123hash',
  nombreEchecs: 0,
};

export const sourceAtomTest = {
  id: 'source-atom-456',
  url: 'https://example.com/atom.xml',
  nom: 'Example Atom Feed',
  typeSource: TypeSource.ATOM as const,
  statut: StatutSource.ACTIVE as const,
  dateCreation: new Date('2024-01-02'),
  hashUrlNormalise: 'def456hash',
  nombreEchecs: 0,
};

export const articleTest = {
  id: 'article-test-789',
  sourceId: 'source-rss-123',
  titre: 'Article de test',
  lien: 'https://example.com/article/1',
  datePublication: new Date('2024-01-15T10:00:00Z'),
  resume: 'Ceci est un résumé de l\'article de test.',
  urlImage: 'https://example.com/image.jpg',
  auteur: 'Jean Test',
  metaOpenGraph: { title: 'OG Title', description: 'OG Desc' },
  metaTwitter: { card: 'summary' },
  hashContenu: 'contenuhash123',
  dateExtraction: new Date('2024-01-15T10:05:00Z'),
};

export const articlesTest = [
  articleTest,
  {
    id: 'article-test-790',
    sourceId: 'source-rss-123',
    titre: 'Deuxième article',
    lien: 'https://example.com/article/2',
    datePublication: new Date('2024-01-14T10:00:00Z'),
    resume: 'Résumé du deuxième article.',
    hashContenu: 'contenuhash456',
    dateExtraction: new Date('2024-01-14T10:05:00Z'),
  },
  {
    id: 'article-test-791',
    sourceId: 'source-atom-456',
    titre: 'Article Atom',
    lien: 'https://example.com/article/3',
    datePublication: new Date('2024-01-13T10:00:00Z'),
    hashContenu: 'contenuhash789',
    dateExtraction: new Date('2024-01-13T10:05:00Z'),
  },
];

export const fluxRssTest = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test RSS Feed</title>
    <link>https://example.com</link>
    <description>Un flux RSS de test</description>
    <item>
      <title>Premier article</title>
      <link>https://example.com/article/1</link>
      <description>Description du premier article</description>
      <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Deuxième article</title>
      <link>https://example.com/article/2</link>
      <description>Description du deuxième article</description>
      <pubDate>Sun, 14 Jan 2024 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

export const fluxAtomTest = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <link href="https://example.com"/>
  <entry>
    <title>Article Atom 1</title>
    <link href="https://example.com/atom/1"/>
    <summary>Résumé de l'article Atom</summary>
    <updated>2024-01-15T10:00:00Z</updated>
  </entry>
</feed>`;

export const utilisateurSourceTest = {
  id: 'us-test-001',
  utilisateurId: utilisateurTest.id,
  sourceId: sourceRssTest.id,
  dateAjout: new Date('2024-01-05'),
  note: 4,
  estEnPause: false,
};

export const tokenTest = {
  accessToken: '***SECRET-RETIRE***',
  refreshToken: 'refresh-token-abc123',
  expiresIn: 900,
};
