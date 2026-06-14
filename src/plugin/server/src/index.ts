/**
 * Strapi Types Plugin
 *
 * Exposes Strapi schema through REST API for automatic TypeScript type generation.
 *
 * Endpoints:
 * - GET /api/strapi-typed-client/schema - Returns full schema with hash
 * - GET /api/strapi-typed-client/schema-hash - Returns only hash (lightweight)
 *
 * Usage in Strapi:
 * ```typescript
 * // config/plugins.ts
 * export default {
 *   'strapi-typed-client': {
 *     enabled: true,
 *     config: {
 *       requireAuth: false, // Optional: allow unauthenticated access
 *     },
 *   },
 * }
 * ```
 *
 * @packageDocumentation
 */

import config from './config/index.js'
import controllers from './controllers/schema.js'
import schemaService from './services/schema.js'
import endpointsService from './services/endpoints.js'
import routes from './routes/index.js'

// Re-export types for consumers
export type { StrapiContext, StrapiInstance } from './controllers/schema.js'
export type {
    StrapiAttribute,
    StrapiContentType,
    StrapiComponent,
    ExtractedSchema,
    SchemaResponse,
    HashResponse,
    ParsedEndpoint,
} from './services/schema.js'
export type { EndpointType, EndpointsResponse } from './services/endpoints.js'

interface StrapiPluginInstance {
    log: {
        info: (message: string) => void
    }
}

export default () => ({
    /**
     * Register phase - runs before bootstrap
     */
    register({ strapi: _strapi }: { strapi: StrapiPluginInstance }) {
        // Nothing to register
    },

    /**
     * Bootstrap phase - runs after all plugins are registered
     */
    bootstrap({ strapi }: { strapi: StrapiPluginInstance }) {
        strapi.log.info('strapi-types plugin loaded')
    },

    /**
     * Destroy phase - cleanup
     */
    destroy({ strapi: _strapi }: { strapi: StrapiPluginInstance }) {
        // Nothing to cleanup
    },

    /**
     * Plugin configuration
     */
    config,

    /**
     * Controllers
     */
    controllers: {
        schema: controllers,
    },

    /**
     * Services
     */
    services: {
        schema: schemaService,
        endpoints: endpointsService,
    },

    /**
     * Routes
     */
    routes: {
        'content-api': {
            type: 'content-api',
            routes,
        },
        admin: {
            type: 'admin',
            routes: [
                {
                    method: 'GET',
                    path: '/schema',
                    handler: 'schema.getSchema',
                    config: {
                        policies: [],
                    },
                },
            ],
        },
    },
})
