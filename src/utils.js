import { REVERSED_SUITS } from 'bridge-commons/core/constants'

export function compareBidInfoToPlayerHand(bidInfo, playerCards, suitTolerance, hcpTolerance) {
  const reports = []

  // Vérifier le nombre de points d'honneur
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

  // Vérifier le nombre de cartes par couleur
  const suitNames = ['club', 'diamond', 'heart', 'spade']

  for (let i = 0; i < REVERSED_SUITS.length; i++) {
    const suitCode = REVERSED_SUITS[i]
    const suitName = suitNames[i]

    const playerSuitCount = playerCards.getBySuit(suitCode).length
    const suitRange = bidInfo[suitName]

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
