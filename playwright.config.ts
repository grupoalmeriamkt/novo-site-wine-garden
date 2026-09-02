import { defineConfig, devices } from '@playwright/test'

/**
 * Testes de fluxo crítico.
 *
 * Rodam contra o build de produção (`next build && next start`), não contra o
 * dev server: em desenvolvimento o Next injeta overlay de erro e recompila sob
 * demanda, o que produz falhas intermitentes que não existem em produção.
 *
 * Mobile e desktop são projetos separados porque boa parte do que precisa ser
 * garantido aqui — drawer de filtros, barra de reserva, navegação de categoria
 * — só existe em um dos dois.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      // iPhone 13 — 390×844, o recorte mais comum do público do site.
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
