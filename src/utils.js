import { REVERSED_SUITS } from 'bridge-commons/core/constants'

export function compareBidInfoToPlayerHand(bidInfo, playerCards, suitTolerance, hcpTolerance) {
  const reports = []

  // Vérifier le nombre de points d'honneur
  const gap = playerCards.hcp < bidInfo.hcp.min ? bidInfo.hcp.min - playerCards.hcp : playerCards.hcp - bidInfo.hcp.max
  if (gap > hcpTolerance) {
    reports.push({
      parameter: 'hcp',
      expectedRange: { min: bidInfo.hcp.min, max: bidInfo.hcp.max },
      tolerance: hcpTolerance,
      value: playerCards.hcp,
      gap
    })
  }

  // Vérifier le nombre de cartes par couleur
  const suitNames = ['club', 'diamond', 'heart', 'spade']

  for (let i = 0; i < REVERSED_SUITS.length; i++) {
    const suitCode = REVERSED_SUITS[i]
    const suitName = suitNames[i]

    const playerSuitCount = playerCards.getBySuit(suitCode).length
    const suitRange = bidInfo[suitName]

    const gap = playerSuitCount < suitRange.min ? suitRange.min - playerSuitCount : playerSuitCount - suitRange.max
    if (gap > suitTolerance) {
      reports.push({
        parameter: suitName,
        expectedRange: { min: suitRange.min, max: suitRange.max },
        tolerance: suitTolerance,
        value: playerSuitCount,
        gap
      })
    }
  }

  return reports
}
