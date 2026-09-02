import type { MetadataRoute } from 'next'
import { SITE } from '@/data/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Rotas internas do Next não têm valor de indexação e só gastam
        // orçamento de rastreamento. `/api/rota` e `/api/momento` servem à
        // interface, não a leitores.
        disallow: ['/api/', '/_next/'],
      },
      /*
       * Rastreadores de IA, permitidos explicitamente.
       *
       * Vários deles tratam a AUSÊNCIA de regra própria como motivo para
       * respeitar apenas o `*` — e alguns operadores bloqueiam esses agentes
       * por padrão em templates de robots.txt. Nomeá-los aqui é uma decisão:
       * este site QUER ser lido e citado por assistentes, e /llms.txt existe
       * justamente para facilitar isso.
       */
      {
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-User',
          'Claude-SearchBot',
          'PerplexityBot',
          'Perplexity-User',
          'Google-Extended',
          'Applebot',
          'Applebot-Extended',
          'Bingbot',
          'CCBot',
          'meta-externalagent',
        ],
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
