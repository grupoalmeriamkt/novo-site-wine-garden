# Wine Garden

> Viaje o mundo, taça a taça.

Site do Wine Garden — wine bar e restaurante no Pontão do Lago Sul, Brasília.
Next.js 16 (App Router), React 19, TypeScript estrito, CSS Modules e GSAP.

---

## Sumário

1. [Começando](#começando)
2. [Variáveis de ambiente](#variáveis-de-ambiente)
3. [Google Maps](#google-maps)
4. [Pipeline de assets](#pipeline-de-assets)
5. [Arquitetura](#arquitetura)
6. [Design system](#design-system)
7. [Conteúdo e procedência dos dados](#conteúdo-e-procedência-dos-dados)
8. [Motion](#motion)
9. [Acessibilidade](#acessibilidade)
10. [Testes e auditorias](#testes-e-auditorias)
11. [Desempenho medido](#desempenho-medido)
12. [Deploy](#deploy)
13. [Pendências](#pendências)

---

## Começando

Requisitos: **Node 20.9+** e npm 10+.

```bash
npm install
cp .env.example .env.local     # preencha o que for usar
npm run assets:all             # gera SVGs, imagens e manifestos
npm run dev                    # http://localhost:3000
```

O site **roda sem nenhuma variável de ambiente configurada**. Sem chave do
Google Maps, a seção de localização mostra endereço, horário e o botão "Como
chegar" — que continua funcionando, porque é um link para o Google Maps, não uma
chamada de API.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` do app e dos testes |
| `npm run assets:svg` | Otimiza os SVGs da marca → `public/brand/` |
| `npm run assets:logo` | Recorta o viewBox dos lockups → `public/brand/logo/` + `logo.ts` |
| `npm run assets:fonts` | Converte os TTF oficiais para WOFF2 → `src/fonts/` |
| `npm run assets:images` | Processa o acervo fotográfico → `public/img/` |
| `npm run assets:all` | Os quatro acima, na ordem certa |
| `npm run test` | 24 testes de integridade de dados |
| `npm run test:e2e` | 90 testes Playwright (sobe o build sozinho) |
| `npm run test:e2e:ui` | Playwright em modo interativo |
| `npm run qa:visual` | 4 rotas × 11 larguras, com capturas em `qa/` |
| `npm run qa:contrast` | Contraste de todo texto contra o fundo real |
| `npm run qa` | Os dois QA acima |
| `npm run test:all` | Tipos + lint + unitários + E2E |

---

## Variáveis de ambiente

Todas estão documentadas com comentários em [`.env.example`](.env.example).
Resumo:

| Variável | Obrigatória | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Em produção | URLs absolutas (OG, canonical, sitemap) ficam com o fallback |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Não | Seção de localização usa o estado sem mapa |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Se usar o mapa | `AdvancedMarkerElement` não renderiza o marcador |
| `NEXT_PUBLIC_WINE_GARDEN_PLACE_ID` | Não | "Como chegar" usa só lat/lng |
| `NEXT_PUBLIC_WINE_GARDEN_LAT` / `_LNG` | Não | Usa as coordenadas em `src/data/site.ts` |
| `NEXT_PUBLIC_RESERVATION_URL` | Não | Usa a URL real do GetIn |
| `NEXT_PUBLIC_GTM_ID` | Não | Eventos vão para `dataLayer` e são descartados |

> **Nunca** coloque uma chave de servidor com o prefixo `NEXT_PUBLIC_`. Esse
> prefixo embute o valor no JavaScript que vai para o navegador.

---

## Google Maps

### Por que a chave é pública (e o que realmente protege)

A Maps JavaScript API roda no navegador; a chave necessariamente aparece no
código-fonte da página. **A proteção não é esconder — é restringir.** Antes de
publicar, no Google Cloud Console:

**1. Restrição de aplicativo → Referenciadores HTTP (sites)**

```
https://winegarden.com.br/*
https://www.winegarden.com.br/*
https://*.vercel.app/*        # apenas enquanto houver preview deploys
http://localhost:3000/*       # apenas em desenvolvimento
```

**2. Restrição de API →** marque **somente** `Maps JavaScript API`.
(Adicione `Places API` só se vier a consumir dados de lugar.)

**3. Faturamento →** defina orçamento e alertas de cota. Uma chave sem
restrição de referenciador pode ser copiada e consumida na sua conta.

### Map ID

`AdvancedMarkerElement` — o único marcador não depreciado — **exige** um Map ID.
Crie um estilo em *Google Maps Platform → Estilos de mapa* e cole o ID em
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Sugestão de paleta para conversar com a
identidade:

| Elemento | Cor |
|---|---|
| Terreno | `#F7F9EA` Offwhite |
| Água | `#C7AE9A` Bege |
| Parques e vegetação | `#414417` Oliva |
| Vias | `#FFFFFF` com traço `#C7AE9A` |
| Rótulos | `#3F0A25` Uva |
| POIs de terceiros | desligados |

### Carregamento

O script do Maps só é baixado quando a seção de localização se aproxima da
viewport (`IntersectionObserver`) — são centenas de KB que não podem entrar no
carregamento inicial. O componente do mapa usa `next/dynamic` com `ssr: false`.

---

## Pipeline de assets

Os arquivos de origem (`content-1/`, `content-2/`, `elementos-wine/`,
`Logos-wine-garden/`, `tipografias/`, PDFs) **não são consumidos em runtime**.
Quatro scripts os transformam nos artefatos que a aplicação usa — rode todos com
`npm run assets:all`:

### `scripts/build-images.mjs` → `public/img/` + `photo-manifest.ts`

200 fotos de ~8 MB (3000×4500) viram masters de 2400 px em JPEG progressivo:
**1,7 GB → 81 MB**. O manifesto carrega dimensões (CLS zero), LQIP em base64
(`placeholder="blur"`), tom dominante e luminância.

`public/img/` está no `.gitignore` — rode `npm run assets:images` no ambiente de
build ou versione o resultado, conforme sua preferência de deploy.

### `scripts/build-svg.mjs` → `public/brand/`

77 SVGs otimizados, **7,2 MB economizados** (os mapas pontilhados iam de ~1,3 MB
para ~300 KB cada).

Dois detalhes que custaram caro e estão documentados no código:

- **`inlineStyles` com `onlyMatchedOnce: false`.** Os arquivos do Illustrator
  guardam a cor em `<style>` com classes `.cls-N` reutilizadas em dezenas de
  paths. Com o padrão do SVGO (`onlyMatchedOnce: true`), essas classes não são
  inlinadas, o `<style>` é removido depois e **os SVGs saem pretos**.
- **Normalização Unicode.** O HFS do macOS devolve nomes em NFD: `taça` chega
  como `ta` + `c` + cedilha combinante, e `/taça/` não casa. Todo `readdir`
  normaliza para NFC antes de comparar.

### `scripts/build-logo.mjs` → `logo.ts` + wordmarks

Os logos originais vêm num canvas 1000×1000 com o lockup horizontal (4,91:1)
centralizado dentro. O script rasteriza com `sharp`, lê o canal alfa para achar a
caixa real do desenho e reescreve o `viewBox`. Também converte `<polygon>` e
`<rect>` em `<path>` — sem isso, o "I" e o "N" (que são retângulos) somem e o
header mostra "W GARD".

### `scripts/build-fonts.mjs` → `src/fonts/`

Converte os TTF oficiais para WOFF2 (−61%). Usamos `next/font/local` em vez de
`next/font/google` porque os arquivos da marca são a fonte de verdade e o build
deixa de depender de rede.

### `scripts/build-content.mjs` → `wines.ts` + `menu.ts`

Converte o cardápio oficial em dados tipados **e valida cada registro contra o
markdown de origem**. Nome ou preço divergente derruba o script. Na última
execução: **245 de 245 registros conferidos, zero divergências.**

---

## Arquitetura

```
src/
├── app/                    rotas (App Router)
│   ├── layout.tsx          metadata, JSON-LD, fontes, shell
│   ├── page.tsx            home
│   ├── cardapio/           cardápio digital
│   ├── vinhos/             wine explorer
│   ├── wine-match/         recomendação guiada
│   ├── robots.ts · sitemap.ts
├── components/
│   ├── brand/              Logo, Trace, GlassFrieze, CountrySeal
│   ├── primitives/         Typography, Section, Reveal, Cta
│   ├── layout/             Header, Footer, Preloader, AtmosphereObserver
│   ├── sections/           as faixas da narrativa
│   ├── wine/ · menu/ · map/ · ui/
├── data/
│   ├── site.ts             institucional (com procedência de cada campo)
│   ├── countries.ts        as 8 origens da identidade
│   ├── photos.ts           curadoria (direção de arte, editado à mão)
│   ├── experiences.ts
│   └── generated/          ⚠️ gerado por script — não editar à mão
├── lib/                    wines, wine-match, sommelier, seo, analytics, motion
├── hooks/                  useGsap, useMediaQuery
├── styles/                 tokens.css, globals.css
└── types/                  contratos de conteúdo
```

### Server vs Client

Server Components são o padrão. `'use client'` aparece só onde há interação real
ou GSAP: `Header`, `Preloader`, `Hero`, `Reveal`, `Cta`, `Trace`, os
exploradores e o mapa. As páginas (`page.tsx`) são Server Components que
carregam os dados e passam adiante — nenhuma delas hidrata a carta inteira.

### CSS Modules, não Tailwind

Escolha deliberada. Este é um site de direção de arte com composições
assimétricas, `clamp()` agressivo e camadas de motion. CSS Modules dá controle
fino sem poluir o markup, e os tokens em custom properties permitem que a troca
de atmosfera aconteça por herança — algo que utilitários não fazem bem.

---

## Design system

### Atmosferas

O site não é bordô do começo ao fim: ele troca de pele. Cada `<Section>` declara
uma atmosfera e redefine os papéis semânticos de cor para tudo dentro dela.

| Atmosfera | Base | Onde |
|---|---|---|
| `editorial` | Offwhite | manifesto, cardápio, explorador, localização |
| `noturna` | Uva | herói, gastronomia, pessoas, rodapé |
| `terroir` | Oliva | o Garden, origem |
| `intensa` | Granada | Wine Match, eventos |
| `bege` | Bege | experiências, respiro |

Um componente **nunca** cita `--granada` diretamente — consome
`--surface`, `--ink`, `--accent`, `--rule`, `--trace`. Trocar a atmosfera do pai
repinta tudo.

`AtmosphereObserver` sincroniza a cor do `<body>` com a seção no meio da tela,
para que o overscroll elástico do iOS não revele a cor errada.

### Tipografia

Especificação do manual, seguida à risca:

| Papel | Fonte | Tracking |
|---|---|---|
| Títulos e destaques | Instrument Serif | −25 (`-0.025em`) |
| Subtítulos | JetBrains Mono maiúsculas | −25 |
| Texto corrido | JetBrains Mono | sem ajuste |

Uma adaptação deliberada, documentada em `tokens.css`: abaixo de ~13 px o −25
fecha demais o mono em caixa alta e prejudica a legibilidade em tela, então
micro-rótulos abrem o tracking. Subtítulos em corpo grande seguem o manual.

### A linha pontilhada

O manual define: *"elemento que simboliza trajetória, caminho, conexão ou
região"*, e é explícito — **nunca reta, nunca geométrica**. Por isso
`src/lib/motion/path.ts` não tem nenhuma função que ligue dois pontos com `L`:
tudo passa por uma spline Catmull-Rom (a curva passa exatamente pelos pontos, o
que importa quando ela liga o selo da França ao da Itália). Dois pontos ainda
assim curvam, com desvio perpendicular de 12%.

A revelação usa uma inversão que vale registrar: animar `stroke-dashoffset` num
traço já pontilhado faz os pontos *deslizarem*. Então o path visível carrega o
pontilhado e nunca é animado, enquanto uma **máscara** com traço sólido e grosso
tem o offset animado — conforme ela cresce, descobre os pontos que já estavam
lá.

---

## Conteúdo e procedência dos dados

**Regra que atravessa o projeto: campo desconhecido é campo vazio, nunca campo
inventado.**

- Pratos, vinhos, preços, descrições e harmonizações vêm do cardápio oficial e
  são validados contra ele na geração.
- Endereço, horário, telefone e Instagram foram levantados em fonte pública
  (Receita Federal, site oficial, GetIn, imprensa) e a procedência de cada campo
  está comentada em `src/data/site.ts`.
- O JSON-LD **não declara** `aggregateRating` nem `priceRange` — ninguém
  confirmou esses dados, e o Google os exibe como fato.
- Fotos de pratos só recebem legenda de prato quando a identificação visual foi
  confiável: 12 dos 34 pratos. Fotos de camarão na brasa, por exemplo, ficaram
  sem legenda porque **não existe prato de camarão grelhado na carta**.

### Um dado real que parece erro

"Herdade do Peso Sossego" aparece **duas vezes em garrafa** no cardápio, ambas a
R$ 209,00 — uma em *Branco Leve Fresco*, outra em *Tinto Médio Corpo*. São dois
vinhos diferentes da mesma vinícola. O gerador desambigua o id por categoria.

---

## Motion

GSAP + ScrollTrigger, sempre via `useGsap`/`useGsapOn`, que embrulham em
`gsap.context` com `revert()` no cleanup. Sem isso, cada remount do Strict Mode
deixa tweens órfãos apontando para nós fora do DOM — o sintoma é o site travar
depois de duas ou três navegações.

- `ScrollTrigger.config({ ignoreMobileResize: true })`: no iOS a barra de
  endereço que recolhe dispara `resize` a cada scroll e provoca refresh em loop.
- `gsap.matchMedia()` separa desktop de mobile. Em mobile: sem pin, menos
  parallax, sem cursor.
- Só `transform` e `opacity` são animados.
- **Sem biblioteca de smooth scroll.** O scroll nativo com
  `scroll-behavior: smooth` preserva âncoras, teclado, histórico e o
  comportamento do Safari no iPhone. Uma lib aqui traria mais risco que ganho.

### `prefers-reduced-motion`

Quando ativo: sem scrub, sem parallax, sem preloader, sem cursor, sem movimentos
grandes. Fades simples permanecem. **Nenhuma informação é perdida** — a linha
pontilhada, por exemplo, aparece inteira em vez de se desenhar.

---

## Acessibilidade

Meta: **WCAG 2.2 AA**.

- Skip link como primeiro tabstop
- Foco visível em tudo (`:focus-visible`, com cor que troca conforme a atmosfera)
- Overlay do menu é `role="dialog"` + `aria-modal`, com foco preso, Escape para
  fechar e retorno do foco ao botão de origem
- Alvos de toque ≥ 44 px
- Zoom até 500% permitido (`maximumScale: 5`)
- `alt` descritivo real — a curadoria em `src/data/photos.ts` escreve a cena,
  não "foto do restaurante"
- Nenhuma informação depende de hover
- Formulários com `<label>` real e erro associado por `aria-describedby`

---

## Testes e auditorias

```bash
npm run typecheck    # tsc do app + tsc dos testes
npm run lint         # ESLint
npm run test         # 24 testes de integridade de dados (node:test via tsx)
npm run test:e2e     # 90 testes Playwright — sobe o build sozinho
npm run qa           # QA visual (44 combinações) + auditoria de contraste
npm run test:all     # tudo em sequência
```

### O que cada camada protege

**`npm run test` — integridade dos dados (24 testes).** Não testa código: testa
a promessa de que nada foi inventado. Confere os 245 registros contra o
markdown do cardápio, verifica que as 64 combinações do Wine Match devolvem
rótulos que existem, e que a barreira anti-alucinação do sommelier descarta um
id inválido vindo de um provedor externo.

**`npm run test:e2e` — 90 testes** em dois projetos: `desktop` (1440×900) e
`mobile` (iPhone 13, WebKit real). Cobrem a home, o foco preso do menu, o
cardápio, os deep links do explorador, o fluxo do Wine Match, a degradação do
mapa sem chave, os CTAs de reserva e a disciplina de imagem (nenhuma fotografia
escapa do `next/image`).

Rodam contra o **build de produção**, não contra o dev server: em
desenvolvimento o Next injeta overlay de erro e recompila sob demanda, gerando
falhas intermitentes que não existem em produção.

**`npm run qa:visual` — 4 rotas × 11 larguras** (320 a 1920). Rola cada página
inteira em cada largura procurando overflow horizontal (e nomeando o elemento
culpado), alvo de toque pequeno, imagem sem alt, heading pulado, erro de console
e CLS. Também salva as 44 capturas em `qa/`.

**`npm run qa:contrast`** calcula a razão de contraste real de todo texto
renderizado contra o fundo efetivo — subindo a árvore até achar um ancestral
opaco, porque quase tudo aqui é transparente por herança de atmosfera. Texto
sobre fotografia é reportado à parte, para conferência visual.

---

## Desempenho medido

Build de produção local, Lighthouse com **throttling real** (`--throttling-method=devtools`),
mediana de 3 execuções:

| | Mobile (4G lento, CPU 4×) | Desktop |
|---|---|---|
| Performance | **85** | **95** |
| Acessibilidade | **100** | 97 |
| Boas práticas | 96 | 96 |
| SEO | **100** | **100** |
| LCP | 2,8 s | 1,1 s |
| CLS | **0** | **0** |
| TBT | 374 ms | 0 ms |

Medição direta com throttling aplicado por CDP, para comparação: LCP de
**1,25 s** em 4G lento e **436 ms** em 4G comum (~20 Mbps). O número do
Lighthouse é mais pessimista porque inclui CPU 4× mais lenta ao longo de toda a
carga.

Peso da home: **539 KB** — 278 KB de JS, 126 KB de fontes, 55 KB de imagem
(o herói sai em AVIF com 26 KB).

### Duas decisões que a medição tomou

**A JetBrains Mono itálica foi removida.** Uma verificação no DOM renderizado
das quatro rotas mostrou que nenhum texto do site usa mono em itálico — todo
itálico é da Instrument Serif. Eram 76 KB baixados por visitante para nada.

**Code splitting das seções pesadas foi testado e descartado.** Pôr Cartografia,
Eventos e Localização em chunks próprios com `next/dynamic` piorou o resultado:
performance 84 → 78 e LCP 2,8 s → 3,4 s. Sob rede lenta, os pedidos extras em
cadeia custam mais do que o bundle único economiza. A decisão está comentada em
`src/app/page.tsx` para que ninguém a refaça. O único `dynamic` que se paga é o
do Google Maps, dentro da Localização, porque lá o código só é buscado se a
chave existir.

---

## Deploy

### Vercel (recomendado)

1. Importe o repositório
2. Framework: **Next.js** (detectado)
3. Adicione as variáveis de ambiente
4. Deploy

`vercel.json` não é necessário. `.vercelignore` já exclui as pastas de origem.

**Atenção às imagens:** `public/img/` está no `.gitignore`. Ou você:

- roda `npm run assets:images` no build (adicione ao `build` do `package.json` e
  garanta que `content-1/` e `content-2/` cheguem ao ambiente de build), **ou**
- remove `public/img` do `.gitignore` e versiona os 81 MB.

A segunda opção é a mais simples e a recomendada aqui: o acervo é estável e
81 MB é aceitável.

### Outro provedor

Precisa de Node 20.9+ e suporte a Next 16 em modo servidor (há otimização de
imagem em runtime). `next export` **não** funciona sem trocar o `next/image` por
`unoptimized`.

### Checklist antes de publicar

- [ ] `NEXT_PUBLIC_SITE_URL` com o domínio real
- [ ] Chave do Maps restrita por referenciador e por API
- [ ] Map ID criado e estilizado
- [ ] Place ID **validado no Place ID Finder** (o candidato veio de espelho de terceiros)
- [ ] Horário confirmado com a casa
- [ ] `npm run build && npm run test:e2e` passando
- [ ] Lighthouse em mobile

---

## Pendências

Itens que dependem de decisão do cliente ou de conteúdo que não temos:

| Item | Situação |
|---|---|
| **Place ID** | Candidato `ChIJxfBMVfclWpMRPGvBVFf5YxY` obtido de espelho público, **não verificado no Google**. Validar antes de produção. |
| **Coordenadas exatas** | Duas fontes divergem ~310 m (ficha do Google × GetIn), ambas dentro do Pontão. Confirmar o pin. |
| **Endereço: Lote 24 × Lote 1/30** | Receita, site oficial e Google usam Lote 24 (é o que está no código). GetIn e assessoria usam Lote 1/30. Decidir qual exibir. |
| **Horário** | 12h–00h / 12h–01h em três fontes concordantes, mas todas anteriores à retomada da marca em jul/2026. Confirmar. |
| **Telefone principal** | Quatro números públicos com origens diferentes. Definir qual é o de atendimento. |
| **Fotos de pratos** | 12 dos 34 pratos têm foto identificada. Os demais aparecem sem imagem, por opção — o layout foi desenhado para isso. |
| **Datas de experiências** | Só "Happy Hour 16–21h" e "música de quarta a sábado" são confirmáveis. Os demais campos de horário estão vazios e a UI mostra "Consulte a casa". |
| **Formulário de eventos** | Não há backend. O envio monta a mensagem e abre o WhatsApp de eventos publicado pela casa. O ponto de plugar um endpoint está comentado no código. |
| **Sommelier conversacional** | Arquitetura pronta em `src/lib/sommelier.ts`, sem provedor. O site funciona inteiro pelo algoritmo determinístico. |

---

## Créditos

Identidade visual: **Oceano** (rebranding, maio/2026).
Fotografia: acervo do cliente.
