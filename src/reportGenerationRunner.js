import pino from 'pino'
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { ArgineInterface, Bid, Game } from 'bridge-commons/core/classes'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'
import { compareBidInfoToPlayerHand } from './utils.js'
import { DEFAULT_CONVENTIONS } from 'bridge-commons/core/constants'

// SQL Queries
const ReportGenerationQueries = Object.freeze({
  saveReport: `
    INSERT INTO public.report (dealer, vulnerability, distribution, bids, conventions_bids, conventions_profile_bids, parameter, expected_min, expected_max, actual_value, gap)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
  getRunningReportGenerationCount: `
    SELECT COUNT(*) as count 
    FROM public.request 
    WHERE status = 'RUNNING'`,
  getFirstPendingReportGeneration: `
    SELECT id 
    FROM public.request 
    WHERE status = 'PENDING' 
    ORDER BY created_at ASC 
    LIMIT 1`,
  getReportGenerationDetails: `
    SELECT deal_nb, conventions_bids, conventions_profile_bids, suit_tolerance, hcp_tolerance, bid_index_min, bid_index_max, status
    FROM public.request 
    WHERE id = $1`,
  updateReportGenerationStatus: `
    UPDATE public.request 
    SET status = $2 
    WHERE id = $1 
    RETURNING *`,
  checkDuplicateReport: `
    SELECT COUNT(*) as count 
    FROM public.report 
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
      'Pending BidInfo Report Scheduled Task',
      async () => {
        const runningCount = await this.getRunningReportGenerationCount()
        if (runningCount < this.CONCURRENT_REPORT_GENERATION_EXECUTION_NB) {
          const reportGeneration = await this.getFirstPendingReportGeneration()
          if (reportGeneration) {
            this.logger.info(`Running bidInfo report generation ${reportGeneration.id}`)
            try {
              await this.generateReports(reportGeneration.id)
            } catch (err) {
              this.logger.error(`Error running bidInfo report generation ${reportGeneration.id}: ${err.message}`)
              await this.updateReportGenerationError(reportGeneration.id)
            }
          }
        }
      },
      (err) => {
        this.logger.error(`Error in the scheduled task: ${err.message}`)
      }
    )
    return new SimpleIntervalJob({ seconds: 30 }, pendingMatchesTask, { preventOverrun: true })
  }

  // CONSTANTS
  CONCURRENT_REPORT_GENERATION_EXECUTION_NB = 1

  // POSTGRESQL FUNCTIONS
  async saveReport(data) {
    // Valider les données avant la sauvegarde
    if (!data || !data.distribution || !data.bids || !data.parameter) {
      this.logger.warn('Invalid report data, skipping save:', data)
      return null
    }

    try {
      // Vérifier si une séquence identique pour le même système existe déjà
      const duplicateCheck = await this.dbClient.runQuery(ReportGenerationQueries.checkDuplicateReport, [
        data.distribution,
        data.bids,
        data.conventionsBids,
        data.conventionsProfileBids,
        data.parameter
      ])

      if (duplicateCheck[0].count > 0) {
        this.logger.info(`BidInfo report skipped: identical sequence already exists for the same conventions system`)
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
    } catch (error) {
      this.logger.error(`Error saving report: ${error.message}`, { data })
      throw error
    }
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
      throw new Error(`BidInfo report generation ${reportGenerationId} not found`)
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
    for (let i = 0; i < dealNb; i++) {
      try {
        const game = Game.random()
        game.setCustomParams({
          nsConventions: conventions,
          ewConventions: conventions
        })

        // On demande des enchères tant qu'on se situe avant maxIndex (ou jusqu'à la fin des enchères si maxIndex vaut -1)
        while ((game.bidList.length < options.bidIndex.max || options.bidIndex.max === -1) && !game.isBiddingFinished) {
          const nextBidWithInfo = await this.argineInterface.getBidWithInfo(game.toArgine())
          const nextBid = Bid.fromName(nextBidWithInfo.bid)

          // On analyse que dans la plage demandée
          if (game.bidList.length > options.bidIndex.min || options.bidIndex.min === -1) {
            const reports = compareBidInfoToPlayerHand(
              nextBidWithInfo.bidInfo,
              game.distribution.getPlayerHand(game.currentPlayer),
              options.suitTolerance,
              options.hcpTolerance
            )
            for (const report of reports) {
              await this.saveReport({
                dealer: game.dealer.name,
                vulnerability: game.vulnerability,
                distribution: game.distribution.toArgineString(),
                bids: game.bidList.toArgineString() + nextBid.name,
                problematicBidIdx: game.bidList.length + 1,
                conventionsBids: conventions.bids,
                conventionsProfileBids: conventions.profileBids,
                parameter: report.parameter,
                expectedMin: report.expectedRange.min,
                expectedMax: report.expectedRange.max,
                actualValue: report.value,
                gap: report.gap
              })
            }
            // On arrête l'analyse si on a trouvé une erreur car les enchères suivantes seront tout autant impactées
            if (reports.length > 0) {
              console.log(`Report generated for deal ${game.distribution.toArgineString()}.`)
              break
            }
          }
          game.addBid(nextBid)
        }
      } catch (dealError) {
        this.logger.error(`Error processing deal ${i + 1}: ${dealError.message}`)
        continue
      }
    }
    await this.updateReportGenerationStatus(reportGenerationId, 'COMPLETED')
    this.logger.info(`BidInfo report generation ${reportGenerationId} completed successfully`)
  }
}
