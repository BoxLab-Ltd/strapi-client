/**
 * API client for fetching schema from Strapi backend
 */

import type {
    SchemaResponse,
    HashResponse,
} from '../../shared/strapi-schema-types.js'
import { SCHEMA_API_PREFIX } from '../../shared/index.js'

export type { SchemaResponse, HashResponse }

export interface ApiClientOptions {
    baseUrl: string
    token?: string
    timeout?: number
}

export class ApiClient {
    private baseUrl: string
    private token?: string
    private timeout: number

    constructor(options: ApiClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '')
        this.token = options.token
        this.timeout = options.timeout || 30000
    }

    /** Full URL for the SSE schema-watch endpoint */
    get sseUrl(): string {
        return `${this.baseUrl}${SCHEMA_API_PREFIX}/schema-watch`
    }

    /** Build request headers (auth + content-type) */
    getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`
        }
        return headers
    }

    /**
     * Fetch the full schema from Strapi
     */
    async getSchema(): Promise<SchemaResponse> {
        const response = await this.request<SchemaResponse>(
            `${SCHEMA_API_PREFIX}/schema`,
        )
        return response
    }

    /**
     * Fetch only the schema hash from Strapi
     */
    async getSchemaHash(): Promise<HashResponse> {
        const response = await this.request<HashResponse>(
            `${SCHEMA_API_PREFIX}/schema-hash`,
        )
        return response
    }

    /**
     * Check if the Strapi instance is reachable
     */
    async ping(): Promise<boolean> {
        try {
            await this.getSchemaHash()
            return true
        } catch {
            return false
        }
    }

    /**
     * Make a request to the Strapi API
     */
    private async request<T>(path: string): Promise<T> {
        const url = `${this.baseUrl}${path}`
        const headers = this.getHeaders()

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal,
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(
                    `API request failed: ${response.status} ${response.statusText}\n${error}`,
                )
            }

            return response.json() as Promise<T>
        } finally {
            clearTimeout(timeoutId)
        }
    }
}

/**
 * Create an API client from environment variables or CLI options
 */
export function createApiClient(options: {
    url?: string
    token?: string
    timeout?: number
}): ApiClient {
    const baseUrl =
        options.url || process.env.STRAPI_URL || 'http://localhost:1337'
    const token = options.token || process.env.STRAPI_TOKEN

    return new ApiClient({
        baseUrl,
        token,
        timeout: options.timeout,
    })
}
