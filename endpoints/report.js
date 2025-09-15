import pino from 'pino'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'

export class Report {
  constructor(fastifyInstance) {
    this.logger = pino({
      level: 'info'
    })
    this.dbClient = new PostgresClient(fastifyInstance)
  }

  async handleError(reply, error, type) {
    this.logger.error(`Error ${type}`, error)

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: `An error occurred ${type}.`
    })
  }

  registerEndpoints(fastifyInstance) {
    fastifyInstance.post('/api/report', async (request, reply) => {
      
    })
  }
}
