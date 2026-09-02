import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * ESLint flat config.
 *
 * Importamos os presets do `eslint-config-next` DIRETAMENTE, sem `FlatCompat`.
 * A partir do Next 16 eles já são arrays de flat config; passá-los pelo
 * FlatCompat faz o ESLint tentar serializar o objeto de plugins, que tem
 * referências circulares (`configs.flat.plugins.react` aponta de volta para o
 * próprio plugin), e o lint morre com "Converting circular structure to JSON"
 * antes de checar uma linha sequer.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'qa/**',
      // Gerados por script — a fonte de verdade é o gerador, não a saída.
      'src/data/generated/**',
      // Node puro, fora do tsconfig da aplicação.
      'scripts/**',
      // Acervo bruto do cliente.
      'content-1/**',
      'content-2/**',
      'Logos-wine-garden/**',
      'elementos-wine/**',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    rules: {
      // `console.warn`/`console.error` são legítimos: avisos de configuração
      // ausente e a fronteira de erro precisam falar.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      /*
       * Neste projeto TODA fotografia passa por `next/image` (via o primitivo
       * Reveal) e todo `<img>` cru é SVG estático de `public/brand/` — selo,
       * mapa, taça, friso. O otimizador do Next não processa SVG, então a
       * regra só produziria ruído aqui.
       *
       * A garantia real de que nenhuma FOTO escapou para um `<img>` cru é o
       * teste `e2e/imagens.spec.ts`, que verifica no DOM renderizado que todo
       * `<img>` fora do next/image aponta para `/brand/`. Um teste que olha o
       * resultado é mais forte que uma regra que olha o código.
       */
      '@next/next/no-img-element': 'off',
    },
  },

  {
    // Testes e ferramentas rodam fora do bundle: as regras de produção sobre
    // console e imports de extensão não se aplicam.
    files: ['e2e/**/*.ts', 'tests/**/*.ts', 'playwright.config.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

export default config
