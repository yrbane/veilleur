/**
 * Veilleur - Tests du choix d'une image d'illustration dans les métadonnées d'une page
 */

import { describe, it, expect } from 'vitest';
import { choisirImageDecouverte } from '@/domaine/services/decouverteImage';

const page = 'https://exemple.org/articles/2026/un-article';

describe('choisirImageDecouverte', () => {
  it('préfère og:image, puis twitter:image', () => {
    expect(choisirImageDecouverte({ openGraph: { image: 'https://cdn.exemple.org/og.jpg' }, twitter: { image: 'https://cdn.exemple.org/tw.jpg' } }, page)).toBe('https://cdn.exemple.org/og.jpg');
    expect(choisirImageDecouverte({ openGraph: {}, twitter: { image: 'https://cdn.exemple.org/tw.jpg' } }, page)).toBe('https://cdn.exemple.org/tw.jpg');
  });

  it('résout une adresse relative contre la page', () => {
    expect(choisirImageDecouverte({ openGraph: { image: '/images/une.png' }, twitter: {} }, page)).toBe('https://exemple.org/images/une.png');
    expect(choisirImageDecouverte({ openGraph: { image: '//cdn.exemple.org/une.png' }, twitter: {} }, page)).toBe('https://cdn.exemple.org/une.png');
  });

  it('refuse ce qui n\'est pas une image http(s) exploitable', () => {
    expect(choisirImageDecouverte({ openGraph: { image: 'data:image/gif;base64,R0lGOD' }, twitter: {} }, page)).toBeNull();
    expect(choisirImageDecouverte({ openGraph: { image: '   ' }, twitter: {} }, page)).toBeNull();
    expect(choisirImageDecouverte({ openGraph: {}, twitter: {} }, page)).toBeNull();
    expect(choisirImageDecouverte({ openGraph: { image: 'ftp://exemple.org/une.png' }, twitter: {} }, page)).toBeNull();
  });

  it('passe à twitter:image quand og:image est inutilisable', () => {
    expect(choisirImageDecouverte({ openGraph: { image: 'data:,' }, twitter: { image: 'https://cdn.exemple.org/tw.jpg' } }, page)).toBe('https://cdn.exemple.org/tw.jpg');
  });
});

describe('imageConnueDepuisUrl', () => {
  it('déduit la vignette YouTube sans lire la page (la page sert un écran de consentement aux serveurs)', async () => {
    const { imageConnueDepuisUrl } = await import('@/domaine/services/decouverteImage');
    expect(imageConnueDepuisUrl('https://www.youtube.com/watch?v=MENoB3Rex28')).toBe('https://i.ytimg.com/vi/MENoB3Rex28/hqdefault.jpg');
    expect(imageConnueDepuisUrl('https://youtu.be/MENoB3Rex28?t=12')).toBe('https://i.ytimg.com/vi/MENoB3Rex28/hqdefault.jpg');
    expect(imageConnueDepuisUrl('https://m.youtube.com/watch?v=MENoB3Rex28&list=x')).toBe('https://i.ytimg.com/vi/MENoB3Rex28/hqdefault.jpg');
    expect(imageConnueDepuisUrl('https://www.youtube.com/@chaine')).toBeNull();
    expect(imageConnueDepuisUrl('https://exemple.org/video?v=abc')).toBeNull();
    expect(imageConnueDepuisUrl('pas une url')).toBeNull();
  });
});
