import { CardList } from 'bridge-commons/core/classes'
import { BidInfo } from 'bridge-commons/core/types'
import { SUITS } from 'bridge-commons/core/constants'

export function compareBidInfoToPlayerHand(bidInfo: BidInfo, playerCards: CardList, suitTolerance: number, hcpTolerance: number) {
  // Vérifier le nombre de points d'honneur avec tolérance
  const hcpMin = Math.max(0, bidInfo.hcp.min - hcpTolerance)
  const hcpMax = Math.max(0, bidInfo.hcp.max + hcpTolerance)

  if (playerCards.hcp < hcpMin || playerCards.hcp > hcpMax) {
    console.log(`HCP hors tolérance: attendu entre ${hcpMin} et ${hcpMax}, trouvé ${playerCards.hcp}`)
  }

  // Vérifier le nombre de cartes par couleur avec tolérance
  const suitNames = ['spade', 'heart', 'diamond', 'club'] as const

  for (let i = 0; i < SUITS.length; i++) {
    const suitCode = SUITS[i]
    const suitName = suitNames[i]

    const playerSuitCount = playerCards.getBySuit(suitCode).length
    const suitRange = (bidInfo as BidInfo)[suitName]

    const suitMin = Math.max(0, suitRange.min - suitTolerance)
    const suitMax = Math.max(0, suitRange.max + suitTolerance)

    if (playerSuitCount < suitMin || playerSuitCount > suitMax) {
      console.log(`Couleur ${suitName} hors tolérance: attendu entre ${suitMin} et ${suitMax}, trouvé ${playerSuitCount}`)
    }
  }
}
