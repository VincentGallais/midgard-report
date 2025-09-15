import { CommonsServer } from 'midgard-commons/lib/common-server.js'

const server = new CommonsServer()

await server.initialize()
await server.registerDefaultEndpoints('/midgard-deal-report')
await server.setDefaultErrorHandler()

const dealReport = new DealReport(server.fastifyInstance)

await server.fastifyInstance.register(
  (fastifyInstance, opts, next) => {
    dealReport.registerEndpoints(fastifyInstance)
    next()
  },
  { prefix: '/midgard-deal-report' }
)

await server.startServer()
