import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { Generator } from '../../../src/generator/index.js'
import { mockSchema } from './fixtures/mock-schema.js'

/**
 * The interceptor weaving (onRequest/onResponse/onError) was previously covered
 * only by emitted-shape `.toContain` and strict typecheck — never EXECUTED. This
 * harness compiles the client to real .js, imports it, and drives it against a
 * fake fetch so the runtime behaviour is pinned: the onRequest partial-return
 * merge (method/body can't be silently dropped), onResponse-before-parse, and
 * onError observe-and-rethrow on both the network and HTTP error paths.
 */

interface Captured {
    url: string
    init: RequestInit
}

function recordingFetch(makeResponse: () => Response): {
    fetch: typeof fetch
    calls: Captured[]
} {
    const calls: Captured[] = []
    const fn = async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} })
        return makeResponse()
    }
    return { fetch: fn as unknown as typeof fetch, calls }
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

describe('generated client runtime behaviour', () => {
    let tmpDir: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let StrapiClient: new (config: any) => any

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-rt-'))
        await new Generator(tmpDir).generate(
            mockSchema,
            [],
            undefined,
            '',
            '',
            'js',
        )
        const mod = await import(
            pathToFileURL(path.join(tmpDir, 'index.js')).href
        )
        StrapiClient = mod.StrapiClient
    })

    afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

    it('onRequest mutating in place reaches fetch', async () => {
        const { fetch, calls } = recordingFetch(() => json({ data: [] }))
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            onRequest: (req: { headers: Record<string, string> }) => {
                req.headers['X-Token'] = 'abc'
            },
        })
        await client.items.find()
        expect(
            (calls[0].init.headers as Record<string, string>)['X-Token'],
        ).toBe('abc')
    })

    it('a partial onRequest return keeps method and body (no silent drop)', async () => {
        const { fetch, calls } = recordingFetch(() => json({ data: {} }))
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            onRequest: (req: {
                url: string
                headers: Record<string, string>
            }) => ({
                url: req.url,
                headers: req.headers,
            }),
        })
        await client.items.create({ title: 'x' })
        expect(calls[0].init.method).toBe('POST')
        expect(calls[0].init.body).toBeTruthy()
    })

    it('an explicitly undefined field on the returned config clears it', async () => {
        const { fetch, calls } = recordingFetch(() => json({ data: {} }))
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            onRequest: (req: Record<string, unknown>) => ({
                ...req,
                body: undefined,
            }),
        })
        await client.items.create({ title: 'x' })
        expect(calls[0].init.method).toBe('POST')
        expect(calls[0].init.body).toBeUndefined()
    })

    it('setting body to null in place still clears it (no `??` regression)', async () => {
        const { fetch, calls } = recordingFetch(() => json({ data: {} }))
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            onRequest: (req: { body: unknown }) => {
                req.body = null
            },
        })
        await client.items.create({ title: 'x' })
        expect(calls[0].init.body).toBeNull()
    })

    it('a hook returning signal: undefined keeps the configured timeout signal', async () => {
        const { fetch, calls } = recordingFetch(() => json({ data: [] }))
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            timeout: 5000,
            onRequest: (req: Record<string, unknown>) => ({
                ...req,
                signal: undefined,
            }),
        })
        await client.items.find()
        expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
    })

    it('onResponse observes the response before parse and the parsed result survives', async () => {
        const { fetch } = recordingFetch(() =>
            json({ data: { documentId: '1', title: 'hi' } }),
        )
        let clonedBody: unknown
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            onResponse: async (res: Response) => {
                clonedBody = await res.clone().json()
            },
        })
        const result = await client.items.findOne('1')
        expect(clonedBody).toEqual({ data: { documentId: '1', title: 'hi' } })
        expect(result).toMatchObject({ documentId: '1', title: 'hi' })
    })

    it('onError observes a network failure and the call still rejects', async () => {
        const failingFetch = (async () => {
            throw new Error('boom')
        }) as unknown as typeof fetch
        let seen: { name?: string } | undefined
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch: failingFetch,
            onError: (err: { name?: string }) => {
                seen = err
            },
        })
        await expect(client.items.find()).rejects.toBeInstanceOf(Error)
        expect(seen?.name).toBe('StrapiConnectionError')
    })

    it('onError observes an HTTP error response and the call still rejects', async () => {
        const { fetch } = recordingFetch(() =>
            json(
                {
                    error: {
                        status: 400,
                        name: 'ValidationError',
                        message: 'bad',
                    },
                },
                400,
            ),
        )
        let seen: unknown
        const client = new StrapiClient({
            baseURL: 'http://x',
            fetch,
            onError: (err: unknown) => {
                seen = err
            },
        })
        await expect(client.items.find()).rejects.toBeInstanceOf(Error)
        expect(seen).toBeInstanceOf(Error)
    })
})
