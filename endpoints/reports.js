import pino from 'pino'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'

// Import schemas
import updateReportRequest from '../schemas/requests/UpdateReportRequest.json' with { type: 'json' }
import updateReportStatusRequest from '../schemas/requests/UpdateReportStatusRequest.json' with { type: 'json' }

// SQL Queries
const ReportQueries = Object.freeze({
  getReports: `
    SELECT * FROM public.report
    WHERE created_at >= NOW() - INTERVAL '30 days'`,
  getReportsByStatus: `
    SELECT * FROM public.report
    WHERE status = $1
    AND created_at >= NOW() - INTERVAL '30 days'`,
  getReportById: `
    SELECT id FROM public.report
    WHERE id = $1`,
  updateReport: `
    UPDATE public.report
    SET status = $2, new_expected_min = $3, new_expected_max = $4, alternative_bid = $5
    WHERE id = $1
    RETURNING *`,
  updateReportStatus: `
    UPDATE public.report
    SET status = $2
    WHERE id = $1
    RETURNING *`
})

export class Reports {
  constructor(fastifyInstance) {
    this.logger = pino({
      level: 'info'
    })
    this.dbClient = new PostgresClient(fastifyInstance)
  }

  // POSTGRESQL FUNCTIONS
  async getReportByStatus(status = null) {
    if (status) {
      return await this.dbClient.runQuery(ReportQueries.getReportsByStatus, [status])
    }
    return await this.dbClient.runQuery(ReportQueries.getReports, [])
  }

  async getReportById(id) {
    return await this.dbClient.runQuery(ReportQueries.getReportById, [id])
  }

  async updateReport(id, status, newExpectedMin, newExpectedMax, alternativeBid) {
    return await this.dbClient.runQuery(ReportQueries.updateReport, [id, status, newExpectedMin, newExpectedMax, alternativeBid])
  }

  // ENDPOINTS
  registerEndpoints(fastifyInstance) {
    fastifyInstance.get('/api/reports', async (request, reply) => {
      const { status } = request.query
      const reports = await this.getReportByStatus(status)
      return reports.map((r) => ({
        id: r.id,
        dealer: r.dealer,
        vulnerability: r.vulnerability,
        distribution: r.distribution,
        bids: r.bids,
        problematicBidIdx: r.problematic_bid_idx,
        conventionsBids: r.conventions_bids,
        conventionsProfileBids: r.conventions_profile_bids,
        parameter: r.parameter,
        expectedMin: r.expected_min,
        expectedMax: r.expected_max,
        actualValue: r.actual_value,
        newExpectedMin: r.new_expected_min,
        newExpectedMax: r.new_expected_max,
        alternativeBid: r.alternative_bid,
        gap: r.gap,
        status: r.status,
        createdAt: r.created_at
      }))
    })

    fastifyInstance.put(
      '/api/reports/:reportId/status',
      {
        schema: {
          body: updateReportStatusRequest
        }
      },
      async (request, reply) => {
        const { reportId } = request.params
        const { status } = request.body

        const existingReport = (await this.getReportById(reportId))[0]
        if (!existingReport) {
          reply.code(404).send({ error: `Report with id ${reportId} not found` })
          return
        }

        await this.updateReport(reportId, status)
        return { value: 'OK' }
      }
    )

    fastifyInstance.put(
      '/api/reports/:reportId',
      {
        schema: {
          body: updateReportRequest
        }
      },
      async (request, reply) => {
        const { reportId } = request.params
        const { status, newExpectedMin, newExpectedMax, alternativeBid } = request.body
        const existingReport = (await this.getReportById(reportId))[0]
        if (!existingReport) {
          reply.code(404).send({ error: `Report with id ${reportId} not found` })
          return
        }
        await this.updateReport(reportId, status, newExpectedMin, newExpectedMax, alternativeBid)
        return { value: 'OK' }
      }
    )
  }
}
