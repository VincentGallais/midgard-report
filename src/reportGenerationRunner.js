import pino from 'pino'
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { ArgineInterface, BidList, Game } from 'bridge-commons/core/classes'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'
import { compareBidInfoToPlayerHand } from './utils.js'
import { DEFAULT_CONVENTIONS } from 'bridge-commons/core/constants'

// SQL Queries
const ReportGenerationQueries = Object.freeze({
  saveReport: `
    INSERT INTO public.bidinfo_report (dealer, vulnerability, distribution, bids, conventions_bids, conventions_profile_bids, parameter, expected_min, expected_max, actual_value, gap)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
  getRunningReportGenerationCount: `
    SELECT COUNT(*) as count 
    FROM public.bidinfo_request 
    WHERE status = 'RUNNING'`,
  getFirstPendingReportGeneration: `
    SELECT id 
    FROM public.bidinfo_request 
    WHERE status = 'PENDING' 
    ORDER BY created_at ASC 
    LIMIT 1`,
  getReportGenerationDetails: `
    SELECT deal_nb, conventions_bids, conventions_profile_bids, suit_tolerance, hcp_tolerance, bid_index_min, bid_index_max, status
    FROM public.bidinfo_request 
    WHERE id = $1`,
  updateReportGenerationStatus: `
    UPDATE public.bidinfo_request 
    SET status = $2 
    WHERE id = $1 
    RETURNING *`,
  checkDuplicateReport: `
    SELECT COUNT(*) as count 
    FROM public.bidinfo_report 
    WHERE distribution = $1 
    AND bids = $2 
    AND conventions_bids = $3 
    AND conventions_profile_bids = $4 
    AND parameter = $5`
})

export class ReportGenerationRunner {
  constructor(fastifyInstance) {
    this.logger = pino({
      level: 'info'
    })
    this.dbClient = new PostgresClient(fastifyInstance)
    this.argineInterface = new ArgineInterface()
  }

  createScheduledJob() {
    const pendingMatchesTask = new AsyncTask(
      'Pending Match Scheduled Task',
      async () => {
        const runningCount = await this.getRunningReportGenerationCount()
        if (runningCount < this.CONCURRENT_REPORT_GENERATION_EXECUTION_NB) {
          const reportGeneration = await this.getFirstPendingReportGeneration()
          if (reportGeneration) {
            this.logger.info(`Running report generation ${reportGeneration.id}`)
            try {
              await this.generateReports(reportGeneration.id)
            } catch (err) {
              this.logger.error(`Error running report generation ${reportGeneration.id}: ${err.message}`)
              await this.updateReportGenerationError(reportGeneration.id)
            }
          }
        }
      },
      (err) => {
        this.logger.error(`Error in the scheduled task: ${err.message}`)
      }
    )
    return new SimpleIntervalJob({ seconds: 5 }, pendingMatchesTask, { preventOverrun: true })
  }

  // CONSTANTS
  CONCURRENT_REPORT_GENERATION_EXECUTION_NB = 1

  // POSTGRESQL FUNCTIONS
  async saveReport(data) {
    // Vérifier si une séquence identique pour le même système existe déjà
    const duplicateCheck = await this.dbClient.runQuery(ReportGenerationQueries.checkDuplicateReport, [
      data.distribution,
      data.bids,
      data.conventionsBids,
      data.conventionsProfileBids,
      data.parameter
    ])

    if (duplicateCheck[0].count > 0) {
      this.logger.info(`Rapport ignoré : séquence identique déjà existante pour le même système`)
      return null
    }

    return await this.dbClient.runQuery(ReportGenerationQueries.saveReport, [
      data.dealer,
      data.vulnerability,
      data.distribution,
      data.bids,
      data.conventionsBids,
      data.conventionsProfileBids,
      data.parameter,
      data.expectedMin,
      data.expectedMax,
      data.actualValue,
      data.gap
    ])
  }

  async getRunningReportGenerationCount() {
    return (await this.dbClient.runQuery(ReportGenerationQueries.getRunningReportGenerationCount, []))[0].count
  }

  async getFirstPendingReportGeneration() {
    return (await this.dbClient.runQuery(ReportGenerationQueries.getFirstPendingReportGeneration, []))[0]
  }

  async getReportGenerationDetails(reportGenerationId) {
    const result = await this.dbClient.runQuery(ReportGenerationQueries.getReportGenerationDetails, [reportGenerationId])

    if (result.length === 0) {
      throw new Error(`Report generation ${reportGenerationId} not found`)
    }

    const reportGen = result[0]
    await this.updateReportGenerationStatus(reportGenerationId, 'RUNNING')

    return {
      dealNb: reportGen.deal_nb,
      conventions: {
        ...DEFAULT_CONVENTIONS,
        bids: reportGen.conventions_bids,
        profileBids: reportGen.conventions_profile_bids
      },
      options: {
        suitTolerance: reportGen.suit_tolerance,
        hcpTolerance: reportGen.hcp_tolerance,
        bidIndex: {
          min: reportGen.bid_index_min,
          max: reportGen.bid_index_max
        }
      }
    }
  }

  async updateReportGenerationStatus(reportGenerationId, status) {
    return await this.dbClient.runQuery(ReportGenerationQueries.updateReportGenerationStatus, [reportGenerationId, status])
  }

  async updateReportGenerationError(reportGenerationId) {
    return await this.updateReportGenerationStatus(reportGenerationId, 'ERROR')
  }

  async generateReports(reportGenerationId) {
    const { dealNb, conventions, options } = await this.getReportGenerationDetails(reportGenerationId)
    const { suitTolerance = 0, hcpTolerance = 0, bidIndex = { min: -1, max: -1 } } = options || {}

    for (let i = 0; i < dealNb; i++) {
      const game = Game.random()

      game.setCustomParams({
        nsConventions: conventions,
        ewConventions: conventions
      })

      await this.argineInterface.runGame(game, { bidsOnly: true })

      // On analyse les enchères comprises entre l'index min et max
      const minIndex = bidIndex.min < 0 ? 0 : Math.min(bidIndex.min, game.bidList.length)
      const maxIndex = bidIndex.max < 0 ? game.bidList.length : Math.min(bidIndex.max, game.bidList.length)

      const bidsToAnalyze = BidList.fromBidsList(game.bidList.list.slice(minIndex, maxIndex))

      if (bidsToAnalyze.length === 0) continue

      const query = game.toArgine()
      query.game.bids = query.game.bids.slice(0, minIndex * 2)

      for (const [idx, bid] of bidsToAnalyze.entries()) {
        query.game.bids += bid.name

        const bidInfo = await this.argineInterface.getBidInfo(query)

        const reports = compareBidInfoToPlayerHand(bidInfo, game.distribution.getPlayerHand(bid.player), suitTolerance, hcpTolerance)
        for (const report of reports) {
          console.log(report)
          this.saveReport({
            dealer: game.dealer.name,
            vulnerability: game.vulnerability,
            distribution: game.distribution.toArgineString(),
            bids: game.bidList.toArgineString(),
            conventionsBids: conventions.bids,
            conventionsProfileBids: conventions.profileBids,
            parameter: report.parameter,
            expectedMin: report.expectedRange.min,
            expectedMax: report.expectedRange.max,
            actualValue: report.value,
            gap: report.gap
          })
        }
        // On arrête l'analyse si on a trouvé une erreur car les enchères suivantes sont tout autant impactées
        break
      }
    }
    await this.updateReportGenerationStatus(reportGenerationId, 'COMPLETED')
    this.logger.info(`Report generation ${reportGenerationId} completed successfully`)
  }
}
