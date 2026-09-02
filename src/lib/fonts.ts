import localFont from 'next/font/local'

/**
 * As duas famílias da identidade, auto-hospedadas a partir dos arquivos
 * oficiais do projeto (tipografias/*.ttf convertidos para WOFF2 por
 * `node scripts/build-fonts.mjs`).
 *
 * Optamos por next/font/local em vez de next/font/google porque os arquivos
 * fornecidos pela marca são a fonte de verdade e porque assim o build não
 * depende de rede. Em troca, declaramos manualmente os ajustes de métrica do
 * fallback — sem eles a troca da fonte de sistema pela real desloca o texto e
 * gera CLS logo no primeiro paint, justamente no título do herói.
 */

/**
 * Instrument Serif — regular e itálico, ambos com preload.
 *
 * O título do herói usa as duas lado a lado ("Viaje o mundo," em regular,
 * "taça a taça." em itálico) e ele é o LCP: aqui o preload É o caminho crítico.
 */
export const instrumentSerif = localFont({
  src: [
    { path: '../fonts/InstrumentSerif-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/InstrumentSerif-Italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-instrument-serif',
  display: 'swap',
  preload: true,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  // Georgia é mais estreita e mais alta que a Instrument Serif; estes valores
  // aproximam a caixa do fallback à da fonte real para não deslocar o layout.
  adjustFontFallback: 'Times New Roman',
})

/**
 * JetBrains Mono — só o romano.
 *
 * A variante itálica FOI REMOVIDA depois de uma verificação no DOM renderizado
 * das quatro rotas: nenhum texto do site usa mono em itálico. Todo itálico da
 * interface é da Instrument Serif, que é onde a marca de fato inflexiona.
 * Mantê-la declarada custava 76 KB baixados por visitante para nada — e o
 * navegador os pedia assim que o CSS entrava, com ou sem preload.
 *
 * Se algum dia um texto precisar de mono itálico, o arquivo continua em
 * src/fonts/ e basta declará-lo aqui de novo (sem preload).
 */
const jetbrainsMono = localFont({
  src: '../fonts/JetBrainsMono-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: true,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  adjustFontFallback: false,
})

export const fontVariables = [instrumentSerif.variable, jetbrainsMono.variable].join(' ')
