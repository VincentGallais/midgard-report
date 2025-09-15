// Si l'on trouve une différence entre la reglette et la main réelle du joueur avec une tolérance fixée
// On ajoute un rapport dans la base de données

import { ArgineInterface, BidList, Game } from 'bridge-commons/core/classes'
import { Range } from 'bridge-commons/core/types'
import { compareBidInfoToPlayerHand } from './utils'

const argineInterface = new ArgineInterface()
argineInterface.setArgineUrl('http://localhost:3000')

generateReport(1)

// TODO
// NS/EW conventions (EW_Profile)
// f"{{Solution \"\"\nRéglette \"-\"\nL'écart vaut {gap} entre la réglette et la main du joueur {fr_player} sur le paramètre {parameter} de l'enchère {bid_fr_name}.\nIntervalle : {expected_range}, valeur : {value}}}\n"
// result.append(f'[Contract "{contract}"]')

export async function generateReport(
  dealNb: number,
  options?: {
    suitTolerance?: number
    hcpTolerance?: number
    bidIndex?: Range
  }
) {
  const { suitTolerance = 2, hcpTolerance = 3, bidIndex = { min: -1, max: -1 } } = options || {}

  for (let i = 0; i < dealNb; i++) {
    const game = Game.random()
    await argineInterface.runGame(game, { bidsOnly: true })

    // On analyse les enchères comprises entre l'index min et max
    const minIndex = bidIndex.min < 0 ? 0 : Math.min(bidIndex.min * 2, game.bidList.length)
    const maxIndex = bidIndex.max < 0 ? game.bidList.length : Math.min(bidIndex.max * 2, game.bidList.length)

    const bidsToAnalyze = game.bidList.slice(minIndex, maxIndex)

    const query = game.toArgine()
    query.game.bids = query.game.bids.slice(0, minIndex * 2)

    for (const bid of bidsToAnalyze) {
      query.game.bids += bid.name
      const bidInfo = await argineInterface.getBidInfo(query)

      compareBidInfoToPlayerHand(bidInfo, game.distribution.getPlayerHand(bid.player!), suitTolerance, hcpTolerance)
    }
  }
}
