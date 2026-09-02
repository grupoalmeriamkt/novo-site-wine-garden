'use client'

import { useCallback, useState } from 'react'

/**
 * Posição do aparelho, sob permissão explícita.
 *
 * REGRAS DE PRIVACIDADE QUE ESTE HOOK IMPÕE:
 *
 * 1. NUNCA pede sozinho. A permissão só é solicitada quando `pedir()` é
 *    chamado — ou seja, depois de um gesto do visitante. Um site que dispara o
 *    diálogo do navegador no carregamento é o motivo de tanta gente negar
 *    localização por reflexo.
 * 2. A coordenada não é guardada em lugar nenhum. Ela vive no estado do
 *    componente enquanto a aba está aberta, vai uma vez ao nosso servidor para
 *    calcular a rota, e acaba aí.
 * 3. Precisão grosseira basta. `enableHighAccuracy: false` evita ligar o GPS —
 *    para dizer "você está a 15 minutos daqui", a triangulação por rede é
 *    suficiente, resolve mais rápido e gasta menos bateria.
 */

export type EstadoGeo = 'ocioso' | 'pedindo' | 'concedido' | 'negado' | 'indisponivel' | 'erro'

export type Posicao = { lat: number; lng: number; precisao: number }

export function useGeolocalizacao() {
  const [estado, setEstado] = useState<EstadoGeo>('ocioso')
  const [posicao, setPosicao] = useState<Posicao | null>(null)

  /**
   * `aoObter` roda quando a posição chega.
   *
   * O callback existe para que quem chama reaja DENTRO da resposta do
   * navegador, em vez de num efeito que observa o estado — um efeito assim
   * dispararia `setState` em cascata e é sinalizado pelo lint do React.
   */
  const pedir = useCallback((aoObter?: (posicao: Posicao) => void) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setEstado('indisponivel')
      return
    }

    setEstado('pedindo')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const proxima: Posicao = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: pos.coords.accuracy,
        }
        setPosicao(proxima)
        setEstado('concedido')
        aoObter?.(proxima)
      },
      (erro) => {
        // PERMISSION_DENIED = 1. Os outros (posição indisponível, timeout) são
        // falhas técnicas e merecem mensagem diferente da recusa deliberada.
        setEstado(erro.code === erro.PERMISSION_DENIED ? 'negado' : 'erro')
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        // Aceita uma leitura de até 5 min: quem acabou de abrir o mapa do
        // celular não precisa esperar uma nova triangulação.
        maximumAge: 300_000,
      },
    )
  }, [])

  const limpar = useCallback(() => {
    setPosicao(null)
    setEstado('ocioso')
  }, [])

  return { estado, posicao, pedir, limpar }
}
