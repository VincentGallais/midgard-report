import { CommonsServer } from 'midgard-commons/lib/common-server.js'
import { ReportGeneration } from './endpoints/generation.js'
import { ReportGenerationRunner } from './src/reportGenerationRunner.js'

const server = new CommonsServer()

await server.initialize()
await server.registerDefaultEndpoints('/midgard-bidinfo')
await server.setDefaultErrorHandler()

// REPORT GENERATION
const reportGeneration = new ReportGeneration(server.fastifyInstance)

// REPORT GENERATION RUNNER
const reportGenerationRunner = new ReportGenerationRunner(server.fastifyInstance)

await server.fastifyInstance.register(
  (fastifyInstance, opts, next) => {
    reportGeneration.registerEndpoints(fastifyInstance)
    next()
  },
  { prefix: '/midgard-report' }
)

server.fastifyInstance.ready().then(() => {
  server.fastifyInstance.scheduler.addSimpleIntervalJob(reportGenerationRunner.createScheduledJob())
})

await server.startServer()
