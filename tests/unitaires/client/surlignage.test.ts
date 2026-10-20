// @vitest-environment jsdom
/**
 * Veilleur - Surlignage des termes recherchés
 */

import { describe, it, expect } from 'vitest';
import { termesRecherche, surligner } from '@/client/utils/surlignage';

describe('termesRecherche', () => {
  it('extrait les termes positifs, ignore les exclusions et les opérateurs', () => {
    expect(termesRecherche('climat -pétrole +énergie "accord de paris" sol*')).toEqual(['accord de paris', 'énergie', 'climat', 'sol']);
  });

  it('écarte les termes d\'une lettre et dédoublonne sans tenir compte de la casse', () => {
    expect(termesRecherche('a Climat climat')).toEqual(['climat']);
    expect(termesRecherche('')).toEqual([]);
    expect(termesRecherche(undefined)).toEqual([]);
  });
});

describe('surligner', () => {
  const html = (fragment: DocumentFragment): string => {
    const div = document.createElement('div');
    div.append(fragment);
    return div.innerHTML;
  };

  it('enveloppe chaque occurrence dans <mark>, sans tenir compte de la casse', () => {
    expect(html(surligner('Le Climat et le climat', ['climat']))).toBe('Le <mark class="surligne">Climat</mark> et le <mark class="surligne">climat</mark>');
  });

  it('n\'interprète jamais le texte comme du HTML', () => {
    expect(html(surligner('<b>climat</b>', ['climat']))).toBe('&lt;b&gt;<mark class="surligne">climat</mark>&lt;/b&gt;');
  });

  it('rend le texte tel quel sans terme', () => {
    expect(html(surligner('Rien à voir', []))).toBe('Rien à voir');
  });

  it('échappe les caractères spéciaux des termes', () => {
    expect(html(surligner('C++ et C#', ['c++']))).toBe('<mark class="surligne">C++</mark> et C#');
  });
});
