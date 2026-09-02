import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    // AVIF primeiro: as fotografias do acervo são ricas em gradiente de luz
    // quente, onde o AVIF ganha bastante do WebP no mesmo peso percebido.
    formats: ['image/avif', 'image/webp'],
    // Larguras alinhadas aos breakpoints reais do projeto — a lista padrão do
    // Next gera variantes que este layout nunca pede.
    deviceSizes: [360, 430, 768, 1024, 1280, 1440, 1728, 1920, 2560],
    imageSizes: [64, 96, 128, 200, 280, 384, 512, 640],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },

  experimental: {
    // O GSAP entra em vários Client Components; otimizar o barrel evita
    // arrastar plugins não usados para cada chunk.
    optimizePackageImports: ['gsap'],
  },

  async headers() {
    return [
      {
        // Assets de marca e imagens processadas têm nome estável e conteúdo
        // imutável: cacheia forte, revalida só quando o arquivo muda de nome.
        source: '/:path(brand|img)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
