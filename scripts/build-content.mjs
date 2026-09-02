/**
 * Gera src/data/generated/{wines,menu}.ts a partir da extração estruturada do
 * cardápio oficial, e VALIDA cada registro contra o markdown de origem.
 *
 * A extração foi feita por leitura assistida do documento; este script existe
 * para que nada dependa dessa confiança: todo nome e todo preço são conferidos
 * contra "Wine Garden  Cardapio Completo.md" antes de virar código. Divergência
 * derruba o build — é preferível a um preço errado no ar.
 *
 * Uso: node scripts/build-content.mjs <dir-com-os-json>
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_MD = path.join(ROOT, 'Wine Garden  Cardapio Completo.md')
const OUT_DIR = path.join(ROOT, 'src', 'data', 'generated')
const INPUT_DIR = process.argv[2]

if (!INPUT_DIR) {
  console.error('uso: node scripts/build-content.mjs <dir-com-wines_all.json-e-menu_items.json>')
  process.exit(1)
}

/* -------------------------------------------------------- normalização */

/** Os literais do documento. Qualquer variação de acento converge para cá. */
const WINE_CATEGORIES = [
  'Espumante',
  'Branco Leve Fresco',
  'Brancos Aromáticos',
  'Branco Amadeirado',
  'Rosé e Laranja',
  'Tinto Leve',
  'Tinto Médio Corpo',
  'Tinto Encorpado',
  'Vinho Sobremesa',
]

const deaccent = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

function canonicalCategory(raw) {
  const key = deaccent(raw)
  const hit = WINE_CATEGORIES.find((c) => deaccent(c) === key)
  if (hit) return hit
  // "Vinho Sobremesa (50 ml)" e variantes
  const loose = WINE_CATEGORIES.find((c) => key.startsWith(deaccent(c)))
  if (loose) return loose
  throw new Error(`categoria de vinho desconhecida: "${raw}"`)
}

function slug(value) {
  return deaccent(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/* ------------------------------------------------- fonte de verdade (md) */

/**
 * Varre o markdown e devolve todos os pares nome→preço, com a seção e a
 * categoria em que aparecem. É contra este índice que a extração é conferida.
 */
async function parseSourceMarkdown() {
  const md = await readFile(SOURCE_MD, 'utf8')
  const lines = md.split('\n')
  const entries = []
  let section = ''
  let category = ''

  const priceToNumber = (raw) => Number(raw.replace(/\./g, '').replace(',', '.'))

  for (const line of lines) {
    const h2 = line.match(/^##\s+\d*\.?\s*(.+?)\s*$/)
    if (h2) {
      section = h2[1].trim()
      category = ''
      continue
    }
    const h3 = line.match(/^###\s+(.+?)\s*$/)
    if (h3) {
      category = h3[1].trim()
      continue
    }
    // **Nome** — R$ 195,00   (com ou sem descrição na mesma linha)
    const bold = line.match(/^\*\*(.+?)\*\*\s+—\s+R\$\s*([\d.]+,\d{2})/)
    if (bold) {
      entries.push({ name: bold[1].trim(), price: priceToNumber(bold[2]), section, category })
      continue
    }
    // | Macallan 12 | R$ 120,00 |
    const row = line.match(/^\|\s*([^|]+?)\s*\|\s*R\$\s*([\d.]+,\d{2})\s*\|/)
    if (row && !/^item$/i.test(row[1].trim())) {
      entries.push({ name: row[1].trim(), price: priceToNumber(row[2]), section, category })
    }
  }
  return entries
}

/* ------------------------------------------------------------- validação */

function validate(records, source, label) {
  const problems = []
  // Chave = nome + preço: um mesmo rótulo aparece em garrafa e em taça com
  // preços diferentes, então só o nome não identifica.
  const index = new Map()
  for (const entry of source) {
    const key = `${deaccent(entry.name)}|${entry.price}`
    index.set(key, (index.get(key) ?? 0) + 1)
  }

  for (const record of records) {
    const key = `${deaccent(record.name)}|${record.price}`
    if (!index.has(key)) {
      const sameName = source.filter((e) => deaccent(e.name) === deaccent(record.name))
      problems.push(
        sameName.length > 0
          ? `${label}: "${record.name}" com preço ${record.price}, mas o documento traz ${sameName
              .map((e) => e.price)
              .join(' ou ')}`
          : `${label}: "${record.name}" (R$ ${record.price}) não existe no documento`,
      )
    }
  }
  return problems
}

/* ------------------------------------------------------------ derivações */

/** Perfis aceitos pelo tipo WineProfile. */
const PROFILES = new Set([
  'fresco',
  'aromatico',
  'frutado',
  'mineral',
  'tostado',
  'floral',
  'estruturado',
  'cremoso',
  'citrico',
  'especiado',
])

/**
 * Reconstrói o perfil a partir do texto da carta, em vez de confiar no que a
 * extração inferiu. Determinístico e auditável: cada descritor tem gatilhos
 * literais, e o que o texto não disser não entra.
 */
function profileFromDescription(description) {
  const text = deaccent(description)
  const rules = [
    ['fresco', /frescor|fresco|refrescante|acidez vibrante|acidez equilibrada/],
    ['aromatico', /aromatico|aromas intensos|perfil aromatico/],
    ['frutado', /frutas|frutado|cereja|ameixa|amora|cassis|morango|framboesa|maca|pera|citric/],
    ['mineral', /mineral/],
    ['tostado', /tostado|barrica|carvalho|tonel|baunilha|defumad/],
    ['floral', /floral|flores|violeta|rosas/],
    ['estruturado', /estrutura|encorpado|taninos firmes|corpo estruturado/],
    ['cremoso', /cremosidade|cremoso|aveludad|sedos|textura/],
    ['citrico', /citric|lima|limao|toranja|casca de laranja/],
    ['especiado', /especiaria|pimenta|cravo|canela|alcacuz|cardamomo|anis/],
  ]
  const found = rules.filter(([, re]) => re.test(text)).map(([name]) => name)
  return found.filter((p) => PROFILES.has(p))
}

function bodyFromDescription(description, category) {
  const text = deaccent(description)
  if (/corpo encorpado|encorpado|corpo medio a encorpado/.test(text)) return 'encorpado'
  if (/corpo medio|medio corpo/.test(text)) return 'medio'
  if (/leve|corpo leve|textura leve/.test(text)) return 'leve'
  // Sem afirmação no texto, a categoria da carta já é uma declaração de corpo.
  if (category === 'Tinto Encorpado') return 'encorpado'
  if (category === 'Tinto Médio Corpo') return 'medio'
  if (category === 'Tinto Leve') return 'leve'
  return ''
}

function oakFromDescription(description) {
  return /barrica|carvalho|tonel|tonéis|toneis|pipa|casco|ânfora|anfora/i.test(description)
}

/* ------------------------------------------------------------------ main */

async function main() {
  const source = await parseSourceMarkdown()
  console.log(`documento: ${source.length} itens com preço`)

  const winesRaw = JSON.parse(await readFile(path.join(INPUT_DIR, 'wines_all.json'), 'utf8'))
  const menuRaw = JSON.parse(await readFile(path.join(INPUT_DIR, 'menu_items.json'), 'utf8'))

  const wines = winesRaw.map((w) => {
    const category = canonicalCategory(w.category)
    const description = (w.description ?? '').trim()
    return {
      id: `${slug(w.name)}${w.servingType === 'taca' ? '-taca' : ''}`,
      name: w.name.trim(),
      price: w.price,
      category,
      servingType: w.servingType,
      description,
      country: (w.country ?? '').trim(),
      region: (w.region ?? '').trim(),
      grapes: (w.grapes ?? []).map((g) => g.trim()).filter(Boolean),
      body: bodyFromDescription(description, category),
      profile: profileFromDescription(description),
      pairings: (w.pairings ?? []).map((p) => p.trim().toLowerCase()).filter(Boolean),
      vegan: Boolean(w.vegan),
      oakAged: oakFromDescription(description),
    }
  })

  const SECTION_OF = {
    'Tábuas e Antipasti': 'Cardápio',
    Crudos: 'Cardápio',
    Tapas: 'Cardápio',
    Panelinha: 'Cardápio',
    Saladas: 'Cardápio',
    Principais: 'Cardápio',
    Sobremesas: 'Cardápio',
    Autorais: 'Drinks e Doses',
    Clássicos: 'Drinks e Doses',
    'Sem Álcool': 'Drinks e Doses',
    Whiskies: 'Drinks e Doses',
    'Licores e Digestivos': 'Drinks e Doses',
    Outros: 'Drinks e Doses',
    Cervejas: 'Cervejas',
    Água: 'Bebidas',
    Refrigerantes: 'Bebidas',
    Sucos: 'Bebidas',
    Café: 'Bebidas',
    'Red Bull': 'Bebidas',
    Sodas: 'Bebidas',
    Adicionais: 'Bebidas',
  }

  const menu = menuRaw.map((m) => {
    const category = m.category.trim()
    const isKids = /kids/i.test(m.name) || /kids/i.test(category)
    return {
      id: slug(m.name),
      name: m.name.trim(),
      price: m.price,
      category,
      section: SECTION_OF[category] ?? m.section ?? 'Cardápio',
      description: (m.description ?? '').trim(),
      pairings: (m.pairings ?? []).map((p) => p.trim()).filter(Boolean),
      vegan: Boolean(m.vegan),
      glutenFree: Boolean(m.glutenFree),
      lactoseFree: Boolean(m.lactoseFree),
      kids: isKids,
    }
  })

  // Desambiguação de id. Nomes repetidos são um fato do cardápio, não um erro
  // de extração: o mesmo rótulo aparece em garrafa e em taça, e a Herdade do
  // Peso Sossego aparece duas vezes em garrafa — um branco e um tinto, mesmo
  // nome e mesmo preço. O sufixo de serviço resolve o primeiro caso; a
  // categoria, o segundo. Os ids entram em URLs, então precisam ser estáveis.
  for (const [label, list] of [
    ['vinhos', wines],
    ['cardápio', menu],
  ]) {
    const taken = new Set()
    for (const item of list) {
      if (!taken.has(item.id)) {
        taken.add(item.id)
        continue
      }
      const withCategory = `${item.id}-${slug(item.category)}`
      if (!taken.has(withCategory)) {
        item.id = withCategory
        taken.add(withCategory)
        console.log(`  · id desambiguado em ${label}: ${item.name} → ${withCategory}`)
        continue
      }
      throw new Error(`id irredutivelmente duplicado em ${label}: ${item.id} (${item.name})`)
    }
  }

  const problems = [...validate(wines, source, 'vinho'), ...validate(menu, source, 'item')]
  if (problems.length > 0) {
    console.error(`\n✕ ${problems.length} divergência(s) com o documento oficial:\n`)
    for (const p of problems) console.error(`  · ${p}`)
    process.exit(1)
  }

  const extracted = wines.length + menu.length
  console.log(`✓ ${extracted} registros conferidos contra o documento`)
  if (extracted < source.length) {
    console.warn(
      `⚠ documento tem ${source.length} itens com preço; extraímos ${extracted}. ` +
        `Diferença: ${source.length - extracted}.`,
    )
    const extractedKeys = new Set([...wines, ...menu].map((r) => `${deaccent(r.name)}|${r.price}`))
    const missing = source.filter((e) => !extractedKeys.has(`${deaccent(e.name)}|${e.price}`))
    for (const m of missing) console.warn(`  faltando: [${m.category}] ${m.name} — R$ ${m.price}`)
  }

  await mkdir(OUT_DIR, { recursive: true })

  await writeFile(
    path.join(OUT_DIR, 'wines.ts'),
    `// GERADO POR scripts/build-content.mjs — NÃO EDITAR À MÃO.
// Fonte: "Wine Garden  Cardapio Completo.md" · ${wines.length} rótulos
// Todo nome e preço foi conferido contra o documento oficial na geração.

import type { Wine } from '@/types/content'

export const WINES: readonly Wine[] = ${JSON.stringify(wines, null, 2)}
`,
    'utf8',
  )

  await writeFile(
    path.join(OUT_DIR, 'menu.ts'),
    `// GERADO POR scripts/build-content.mjs — NÃO EDITAR À MÃO.
// Fonte: "Wine Garden  Cardapio Completo.md" · ${menu.length} itens
// Todo nome e preço foi conferido contra o documento oficial na geração.

import type { MenuItem } from '@/types/content'

export const MENU_ITEMS: readonly MenuItem[] = ${JSON.stringify(menu, null, 2)}
`,
    'utf8',
  )

  console.log(`✓ ${wines.length} vinhos → src/data/generated/wines.ts`)
  console.log(`✓ ${menu.length} itens → src/data/generated/menu.ts`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
