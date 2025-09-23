import pino from 'pino'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'

// Import schemas
import createReportGenerationRequest from '../schemas/requests/CreateReportGenerationRequest.json' with { type: 'json' }

// SQL Queries
const ReportQueries = Object.freeze({
  createReportGeneration: `
    INSERT INTO public.request (deal_nb, conventions_bids, conventions_profile_bids, suit_tolerance, hcp_tolerance, bid_index_min, bid_index_max)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
  getAllGenerationRequests: `
    SELECT * 
    FROM public.request 
    ORDER BY created_at DESC`
})

export class ReportGeneration {
  constructor(fastifyInstance) {
    this.logger = pino({
      level: 'info'
    })
    this.dbClient = new PostgresClient(fastifyInstance)
  }

  // POSTGRESQL FUNCTIONS
  async createReportGeneration(data) {
    return await this.dbClient.runQuery(ReportQueries.createReportGeneration, [
      data.dealNb,
      data.conventions.bids,
      data.conventions.profileBids,
      data.options?.suitTolerance,
      data.options?.hcpTolerance,
      data.options?.bidIndexMin,
      data.options?.bidIndexMax
    ])
  }

  async getAllGenerationRequests() {
    return await this.dbClient.runQuery(ReportQueries.getAllGenerationRequests, [])
  }

  // ENDPOINTS
  registerEndpoints(fastifyInstance) {
    fastifyInstance.post(
      '/api/generate',
      {
        schema: {
          body: createReportGenerationRequest
        }
      },
      async (request, reply) => {
        await this.createReportGeneration(request.body)
        return { value: 'OK' }
      }
    )
    fastifyInstance.get('/api/generate', async (request, reply) => {
      return await this.getAllGenerationRequests()
    })
  }
}
