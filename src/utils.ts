import { CardList } from 'bridge-commons/core/classes'
import { BidInfo, Range } from 'bridge-commons/core/types'
import { REVERSED_SUITS, SUITS } from 'bridge-commons/core/constants'

interface Report {
  parameter: string
  expectedRange: Range
  tolerance: number
  value: number
  gap: number
}

export function compareBidInfoToPlayerHand(bidInfo: BidInfo, playerCards: CardList, suitTolerance: number, hcpTolerance: number): Report[] {
  const reports: Report[] = []

  // Vérifier le nombre de points d'honneur avec tolérance
  const hcpMin = Math.max(0, bidInfo.hcp.min - hcpTolerance)
  const hcpMax = Math.max(0, bidInfo.hcp.max + hcpTolerance)

  if (playerCards.hcp < hcpMin || playerCards.hcp > hcpMax) {
    reports.push({
      parameter: 'hcp',
      expectedRange: { min: bidInfo.hcp.min, max: bidInfo.hcp.max },
      tolerance: hcpTolerance,
      value: playerCards.hcp,
      gap: Math.min(Math.abs(playerCards.hcp - hcpMin), Math.abs(playerCards.hcp - hcpMax))
    })
  }

  // Vérifier le nombre de cartes par couleur avec tolérance
  const suitNames = ['club', 'diamond', 'heart', 'spade'] as const

  for (let i = 0; i < REVERSED_SUITS.length; i++) {
    const suitCode = REVERSED_SUITS[i]
    const suitName = suitNames[i]

    const playerSuitCount = playerCards.getBySuit(suitCode).length
    const suitRange = (bidInfo as BidInfo)[suitName]

    const suitMin = Math.max(0, suitRange.min - suitTolerance)
    const suitMax = Math.max(0, suitRange.max + suitTolerance)

    if (playerSuitCount < suitMin || playerSuitCount > suitMax) {
      reports.push({
        parameter: suitName,
        expectedRange: { min: suitRange.min, max: suitRange.max },
        tolerance: suitTolerance,
        value: playerSuitCount,
        gap: Math.min(Math.abs(playerSuitCount - suitMin), Math.abs(playerSuitCount - suitMax))
      })
    }
  }

  return reports
}
