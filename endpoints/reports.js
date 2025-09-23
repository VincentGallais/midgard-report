import pino from 'pino'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'

// Import schemas
import updateReportStatusRequest from '../schemas/requests/UpdateReportStatusRequest.json' with { type: 'json' }

// SQL Queries
const ReportQueries = Object.freeze({
  getReports: `
    SELECT * FROM public.report`,
  getReportsByStatus: `
    SELECT * FROM public.report
    WHERE status = $1`,
  getReportById: `
    SELECT id FROM public.report
    WHERE id = $1`,
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
  async getReports(status = null) {
    if (status) {
      return await this.dbClient.runQuery(ReportQueries.getReportsByStatus, [status])
    }
    return await this.dbClient.runQuery(ReportQueries.getReports, [])
  }

  async getReportById(id) {
    return await this.dbClient.runQuery(ReportQueries.getReportById, [id])
  }

  async updateReportStatus(id, status) {
    return await this.dbClient.runQuery(ReportQueries.updateReportStatus, [id, status])
  }

  // ENDPOINTS
  registerEndpoints(fastifyInstance) {
    fastifyInstance.get('/api/reports', async (request, reply) => {
      const { status } = request.query
      const reports = await this.getReports(status)
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
        gap: r.gap,
        status: r.status,
        createdAt: r.created_at
      }))
    })

    fastifyInstance.put(
      '/api/:reportId',
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

        await this.updateReportStatus(reportId, status)
        return { value: 'OK' }
      }
    )
  }
}
