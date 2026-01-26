/**
 * Veilleur - Service OPML
 * Gère l'export et l'import de sources au format OPML
 */

import { z } from 'zod';

/**
 * Structure d'une source dans le fichier OPML
 */
export interface SourceOPML {
  titre: string;
  url: string;
  urlSite?: string;
  tags?: string[];
}

/**
 * Schéma de validation pour l'import
 */
export const schemaSourceOPML = z.object({
  titre: z.string().min(1),
  url: z.string().url(),
  urlSite: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Génère un fichier OPML à partir d'une liste de sources
 */
export function genererOPML(
  sources: SourceOPML[],
  titreExport = 'Veilleur - Export des sources',
): string {
  const dateCreation = new Date().toISOString();

  const outlines = sources
    .map(source => {
      const attrs = [
        `text="${escapeXML(source.titre)}"`,
        `title="${escapeXML(source.titre)}"`,
        `type="rss"`,
        `xmlUrl="${escapeXML(source.url)}"`,
      ];

      if (source.urlSite) {
        attrs.push(`htmlUrl="${escapeXML(source.urlSite)}"`);
      }

      if (source.tags && source.tags.length > 0) {
        attrs.push(`category="${escapeXML(source.tags.join(','))}"`);
      }

      return `      <outline ${attrs.join(' ')} />`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXML(titreExport)}</title>
    <dateCreated>${dateCreation}</dateCreated>
    <docs>http://opml.org/spec2.opml</docs>
  </head>
  <body>
    <outline text="Flux RSS" title="Flux RSS">
${outlines}
    </outline>
  </body>
</opml>`;
}

/**
 * Parse un fichier OPML et extrait les sources
 */
export function parserOPML(contenu: string): SourceOPML[] {
  const sources: SourceOPML[] = [];

  // Regex pour extraire les outlines avec xmlUrl
  const outlineRegex = /<outline[^>]*xmlUrl\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const attrRegex = /(\w+)\s*=\s*["']([^"']*)["']/gi;

  let match;
  while ((match = outlineRegex.exec(contenu)) !== null) {
    const outlineStr = match[0];
    const attrs: Record<string, string> = {};

    let attrMatch;
    while ((attrMatch = attrRegex.exec(outlineStr)) !== null) {
      const key = attrMatch[1];
      const value = attrMatch[2];
      if (key && value !== undefined) {
        attrs[key.toLowerCase()] = unescapeXML(value);
      }
    }
    attrRegex.lastIndex = 0;

    const xmlUrl = attrs['xmlurl'];
    if (!xmlUrl) continue;

    const source: SourceOPML = {
      titre: attrs['title'] || attrs['text'] || extractDomainFromUrl(xmlUrl),
      url: xmlUrl,
    };

    if (attrs['htmlurl']) {
      source.urlSite = attrs['htmlurl'];
    }

    if (attrs['category']) {
      source.tags = attrs['category'].split(',').map(t => t.trim()).filter(Boolean);
    }

    sources.push(source);
  }

  return sources;
}

/**
 * Échappe les caractères spéciaux XML
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Déséchappe les caractères spéciaux XML
 */
function unescapeXML(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extrait le domaine d'une URL
 */
function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}
