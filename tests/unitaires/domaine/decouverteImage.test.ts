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
