import { ArgineInterface, BidList, Game } from 'bridge-commons/core/classes'
import { ArgineConventions, ArgineQuery, Range } from 'bridge-commons/core/types'
import { compareBidInfoToPlayerHand } from './utils'
import { DEFAULT_CONVENTIONS } from 'bridge-commons/core/constants'

const argineInterface = new ArgineInterface()
argineInterface.setArgineUrl('http://localhost:3000')

const conventions: ArgineConventions = { NS: DEFAULT_CONVENTIONS, EW: DEFAULT_CONVENTIONS }

generateReport(1, conventions)

export async function generateReport(
  dealNb: number,
  conventions: ArgineConventions,
  options?: {
    suitTolerance?: number
    hcpTolerance?: number
    bidIndex?: Range
  }
) {
  const { suitTolerance = 0, hcpTolerance = 0, bidIndex = { min: -1, max: -1 } } = options || {}

  for (let i = 0; i < dealNb; i++) {
    // const game = Game.random()
    const game = Game.fromArgineData({
      deal: {
        dealer: 'S',
        vulnerability: 'N',
        distribution: 'SNSWWEWNWEESNEENNNWNSNSSSNWSWWESNWESWENWESWEEESSNENW'
      },
      game: { bids: 'PAPA1DPA1NPA2DPA3DPA5DPAPAPA', cards: '' },
      conventions: {
        NS: {
          bids: '02010000011000101111011111111111111001112111111011',
          profileBids: 6,
          cards: '122210',
          profileCards: 0
        },
        EW: {
          bids: '02010000011000101111011111111111111001112111111011',
          profileBids: 6,
          cards: '122210',
          profileCards: 0
        }
      },
      options: { argineConfidence: 0, scoringType: 0, lightMode: false },
      maskHand: 1,
      initiationCarding: false,
      simulations: { min: 20, max: 200 }
    })

    game.setCustomParams({
      nsConventions: conventions.NS,
      ewConventions: conventions.EW
    })

    await argineInterface.runGame(game, { bidsOnly: true })

    // On analyse les enchères comprises entre l'index min et max
    const minIndex = bidIndex.min < 0 ? 0 : Math.min(bidIndex.min, game.bidList.length)
    const maxIndex = bidIndex.max < 0 ? game.bidList.length : Math.min(bidIndex.max, game.bidList.length)

    const bidsToAnalyze = BidList.fromBidsList(game.bidList.list.slice(minIndex, maxIndex))

    if (bidsToAnalyze.length === 0) continue

    const query = game.toArgine()
    query.game.bids = query.game.bids.slice(0, minIndex * 2)

    for (const [idx, bid] of bidsToAnalyze.entries()) {
      query.game.bids += bid.name

      const bidInfo = await argineInterface.getBidInfo(query)

      const reports = compareBidInfoToPlayerHand(bidInfo, game.distribution.getPlayerHand(bid.player!), suitTolerance, hcpTolerance)
      if (reports.length > 0) {
        console.log(`Deal ${i + 1}, analyse de l'enchère ${bid.name} d'index ${idx + minIndex} jouée par ${bid.player?.name}`)
        console.log(reports)
        break
      }
    }
  }
}

// TODO : Ne pas enregistrer si une séquence identique pour le même système a déjà été enregistrée
