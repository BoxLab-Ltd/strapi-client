/**
 * Schema controller for Strapi Types Plugin
 * Exposes endpoints for fetching schema, schema hash, and SSE schema watch
 */

import { PassThrough } from 'stream'

export interface StrapiContext {
    state: {
        user?: unknown
    }
    request: {
        header: Record<string, string | undefined>
    }
    unauthorized: (message: string) => void
    set: (key: string, value: string) => void
    status: number
    body: unknown
    req: {
        on: (event: string, listener: () => void) => void
    }
}

export interface StrapiInstance {
    config: {
        get: (key: string, defaultValue?: unknown) => unknown
    }
    plugin: (name: string) => {
        service: (name: string) => {
            getSchema: () => unknown
            getSchemaHash: () => unknown
        }
    }
    service: (uid: string) => any
    log: {
        error: (message: string, error?: unknown) => void
        warn?: (message: string, error?: unknown) => void
    }
}

/**
 * Manually validate an API token since routes use auth: false
 * (Strapi skips its auth middleware when auth: false is set)
 */
async function validateApiToken(
    strapi: StrapiInstance,
    ctx: StrapiContext,
): Promise<boolean> {
    // Already authenticated via other means
    if (ctx.state.user) return true

    const authorization = ctx.request.header.authorization
    if (!authorization) return false

    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) return false

    try {
        const apiTokenService = strapi.service('admin::api-token')
        const accessKey = await apiTokenService.hash(token)
        const storedToken =
            typeof apiTokenService.getByAccessKey === 'function'
                ? await apiTokenService.getByAccessKey(accessKey)
                : await apiTokenService.getBy({ accessKey })
        return !!storedToken
    } catch (error) {
        strapi.log?.warn?.(
            '[strapi-typed-client] token validation failed',
            error,
        )
        return false
    }
}

export default ({ strapi }: { strapi: StrapiInstance }) => ({
    /**
     * GET /api/strapi-types/schema
     * Returns the full schema with hash
     */
    async getSchema(ctx: StrapiContext) {
        const requireAuth = strapi.config.get(
            'plugin::strapi-typed-client.requireAuth',
            process.env.NODE_ENV === 'production',
        )

        if (requireAuth) {
            const isAuthenticated = await validateApiToken(strapi, ctx)
            if (!isAuthenticated) {
                return ctx.unauthorized(
                    'Authentication required to access schema',
                )
            }
        }

        try {
            const schemaService = strapi
                .plugin('strapi-typed-client')
                .service('schema')
            const result = schemaService.getSchema()

            ctx.body = result
        } catch (error) {
            strapi.log.error('Error extracting schema:', error)
            throw error
        }
    },

    /**
     * GET /api/strapi-types/schema-hash
     * Returns only the schema hash (lightweight)
     */
    async getSchemaHash(ctx: StrapiContext) {
        const requireAuth = strapi.config.get(
            'plugin::strapi-typed-client.requireAuth',
            process.env.NODE_ENV === 'production',
        )

        if (requireAuth) {
            const isAuthenticated = await validateApiToken(strapi, ctx)
            if (!isAuthenticated) {
                return ctx.unauthorized(
                    'Authentication required to access schema hash',
                )
            }
        }

        try {
            const schemaService = strapi
                .plugin('strapi-typed-client')
                .service('schema')
            const result = schemaService.getSchemaHash()

            ctx.body = result
        } catch (error) {
            strapi.log.error('Error computing schema hash:', error)
            throw error
        }
    },

    /**
     * GET /api/strapi-types/schema-watch
     * SSE stream that sends the current hash on connect.
     * When Strapi restarts the connection drops — the client
     * reconnects and gets the (possibly new) hash automatically.
     */
    async schemaWatch(ctx: StrapiContext) {
        const requireAuth = strapi.config.get(
            'plugin::strapi-typed-client.requireAuth',
            process.env.NODE_ENV === 'production',
        )

        if (requireAuth) {
            const isAuthenticated = await validateApiToken(strapi, ctx)
            if (!isAuthenticated) {
                return ctx.unauthorized(
                    'Authentication required to access schema watch',
                )
            }
        }

        // SSE headers
        ctx.set('Content-Type', 'text/event-stream')
        ctx.set('Cache-Control', 'no-cache')
        ctx.set('Connection', 'keep-alive')
        ctx.status = 200

        const stream = new PassThrough()
        ctx.body = stream

        // Send the current hash immediately
        try {
            const schemaService = strapi
                .plugin('strapi-typed-client')
                .service('schema')
            const { hash, generatedAt } = schemaService.getSchemaHash() as {
                hash: string
                generatedAt: string
            }

            stream.write(`retry: 1000\n`)
            stream.write(`event: connected\n`)
            stream.write(`data: ${JSON.stringify({ hash, generatedAt })}\n\n`)
        } catch (error) {
            strapi.log.error('Error sending initial SSE hash:', error)
            stream.end()
            return
        }

        // Heartbeat to keep the connection alive
        const heartbeat = setInterval(() => {
            stream.write(`: heartbeat\n\n`)
        }, 30_000)

        // Cleanup when client disconnects
        ctx.req.on('close', () => {
            clearInterval(heartbeat)
            stream.end()
        })
    },
})
