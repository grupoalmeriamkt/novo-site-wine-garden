/**
 * Instrumentação centralizada.
 *
 * Todos os eventos passam por `track()`. Nenhum componente chama gtag, dataLayer
 * ou fetch de analytics direto — quando a casa escolher a ferramenta, muda-se
 * só o `dispatch` daqui e nada mais no projeto.
 *
 * Enquanto não há provedor configurado, os eventos vão para o dataLayer (que o
 * GTM consome se existir) e são descartados em silêncio se não existir. Nunca
 * quebram a interação que os originou.
 */

/** O contrato de eventos. Adicionar evento = adicionar variante aqui. */
export type AnalyticsEvent =
  | { name: 'reservation_click'; params: { origin: string } }
  | { name: 'menu_open'; params: { category?: string } }
  | { name: 'menu_search'; params: { query: string; results: number } }
  | { name: 'wine_explorer_open'; params: { origin: string } }
  | { name: 'wine_filter'; params: { facet: string; value: string; results: number } }
  | { name: 'wine_detail'; params: { wineId: string } }
  | { name: 'wine_match_start'; params: Record<string, never> }
  | { name: 'wine_match_step'; params: { step: number; answer: string } }
  | { name: 'wine_match_complete'; params: { results: number; topWineId: string } }
  | { name: 'country_explore'; params: { country: string; wines: number } }
  | { name: 'event_open'; params: { experienceId: string } }
  | { name: 'event_lead'; params: { channel: string } }
  | { name: 'map_open'; params: Record<string, never> }
  | { name: 'directions_click'; params: { platform: string } }
  | { name: 'whatsapp_click'; params: { origin: string } }
  | { name: 'nav_open'; params: Record<string, never> }

type DataLayerWindow = Window & { dataLayer?: unknown[] }

/**
 * Envia um evento. Seguro para chamar de qualquer lugar: no servidor vira
 * no-op, e qualquer erro do provedor é engolido — analytics nunca pode
 * derrubar um clique de reserva.
 */
export function track<E extends AnalyticsEvent>(name: E['name'], params: E['params']): void {
  if (typeof window === 'undefined') return

  try {
    const w = window as DataLayerWindow
    w.dataLayer = w.dataLayer ?? []
    w.dataLayer.push({ event: name, ...params })

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[analytics] ${name}`, params)
    }
  } catch {
    // Silêncio proposital.
  }
}

/**
 * Handler pronto para `onClick`, para os casos em que o único efeito do clique
 * é navegar e registrar.
 */
export function trackOnClick<E extends AnalyticsEvent>(name: E['name'], params: E['params']) {
  return () => track(name, params)
}
