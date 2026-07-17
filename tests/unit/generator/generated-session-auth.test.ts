import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
    vi,
} from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { Generator } from '../../../src/generator/index.js'
import { mockSchema } from './fixtures/mock-schema.js'

/**
 * Runtime behaviour of the users-permissions session flow (jwtManagement:
 * 'refresh'): Bearer from the in-memory session, single-flight refresh on 401
 * with one retry, dead-session handling, the SSR guard, and — critically —
 * that a legacy-generated client changes nothing at all.
 */

interface Captured {
    url: string
    init: RequestInit
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

function unauthorized(): Response {
    return json(
        {
            error: {
                status: 401,
                name: 'UnauthorizedError',
                message: 'Missing or invalid credentials',
            },
        },
        401,
    )
}

function authHeader(init: RequestInit): string | undefined {
    return (init.headers as Record<string, string> | undefined)?.[
        'Authorization'
    ]
}

/**
 * Fake backend: /api/auth/refresh is scripted per test; every other request
 * succeeds only with a Bearer token from `validTokens`.
 */
function fakeBackend(opts: {
    validTokens?: string[]
    refresh?: (init: RequestInit) => Response | Promise<Response>
    login?: () => Response
}): { fetch: typeof fetch; calls: Captured[]; refreshCalls: () => number } {
    const calls: Captured[] = []
    const valid = new Set(opts.validTokens ?? [])
    const fn = async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url)
        const i = init ?? {}
        calls.push({ url: u, init: i })
        if (u.endsWith('/api/auth/refresh')) {
            if (!opts.refresh) return unauthorized()
            return opts.refresh(i)
        }
        if (u.endsWith('/api/auth/local')) {
            return opts.login ? opts.login() : unauthorized()
        }
        if (u.endsWith('/api/auth/logout')) {
            return json({ ok: true })
        }
        const bearer = authHeader(i)
        if (bearer && valid.has(bearer.replace('Bearer ', ''))) {
            return json({ data: [] })
        }
        return unauthorized()
    }
    return {
        fetch: fn as unknown as typeof fetch,
        calls,
        refreshCalls: () =>
            calls.filter(c => c.url.endsWith('/api/auth/refresh')).length,
    }
}

describe('generated client session-auth runtime behaviour', () => {
    let refreshDir: string
    let legacyDir: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let RefreshClient: new (config: any) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let LegacyClient: new (config: any) => any

    beforeAll(async () => {
        refreshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-sa-'))
        legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-sl-'))
        await new Generator(refreshDir).generate(
            mockSchema,
            [],
            undefined,
            '',
            '',
            'js',
            true,
            'refresh',
        )
        await new Generator(legacyDir).generate(
            mockSchema,
            [],
            undefined,
            '',
            '',
            'js',
            true,
            'legacy',
        )
        RefreshClient = (
            await import(pathToFileURL(path.join(refreshDir, 'index.js')).href)
        ).StrapiClient
        LegacyClient = (
            await import(pathToFileURL(path.join(legacyDir, 'index.js')).href)
        ).StrapiClient
    }, 60_000)

    afterAll(() => {
        fs.rmSync(refreshDir, { recursive: true, force: true })
        fs.rmSync(legacyDir, { recursive: true, force: true })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const inBrowser = () => vi.stubGlobal('window', {})

    it('login stores the access token and sends it as Bearer afterwards', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['A'],
            login: () => json({ jwt: 'A', user: { id: 1 } }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await client.items.find()
        const last = backend.calls[backend.calls.length - 1]
        expect(last.url).toBe('http://x/api/items')
        expect(authHeader(last.init)).toBe('Bearer A')
    })

    it('on 401 refreshes once, retries the original request, and does not surface the absorbed 401', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['B'],
            refresh: () => json({ jwt: 'B' }),
        })
        const errors: unknown[] = []
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            onError: (e: unknown) => {
                errors.push(e)
            },
        })
        const result = await client.items.find()
        expect(result).toEqual([])
        expect(backend.refreshCalls()).toBe(1)
        const urls = backend.calls.map(c => c.url)
        expect(urls).toEqual([
            'http://x/api/items',
            'http://x/api/auth/refresh',
            'http://x/api/items',
        ])
        expect(authHeader(backend.calls[2].init)).toBe('Bearer B')
        expect(errors).toEqual([])
    })

    it('N parallel 401s share a single-flight refresh', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['B'],
            refresh: async () => {
                await new Promise(r => setTimeout(r, 20))
                return json({ jwt: 'B' })
            },
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        const results = await Promise.all([
            client.items.find(),
            client.items.find(),
            client.items.find(),
        ])
        expect(results).toEqual([[], [], []])
        expect(backend.refreshCalls()).toBe(1)
        // 3 initial 401s + 1 refresh + 3 retries
        expect(backend.calls.length).toBe(7)
    })

    it('dead session: failed refresh clears the tokens and rethrows the original 401', async () => {
        inBrowser()
        const backend = fakeBackend({
            login: () => json({ jwt: 'expired', user: { id: 1 } }),
            refresh: () => unauthorized(),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await expect(client.items.find()).rejects.toMatchObject({
            name: 'StrapiError',
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(1)
        // the session was dropped — the next request goes out anonymous
        await client.items.find().catch(() => undefined)
        const anon = backend.calls.filter(c => c.url.endsWith('/api/items'))[1]
        expect(authHeader(anon.init)).toBeUndefined()
    })

    it('retries only once: a 401 after a successful refresh is surfaced', async () => {
        inBrowser()
        const backend = fakeBackend({
            // 'B' is never valid for /api/items → the retry fails again
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await expect(client.items.find()).rejects.toMatchObject({
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(1)
    })

    it('SSR guard: in Node (no window) a 401 never triggers a refresh', async () => {
        const backend = fakeBackend({
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await expect(client.items.find()).rejects.toMatchObject({
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(0)
    })

    it('non-httpOnly: refreshToken from login is sent in the refresh body and rotated', async () => {
        inBrowser()
        const seenBodies: unknown[] = []
        const backend = fakeBackend({
            validTokens: ['B', 'C'],
            login: () =>
                json({ jwt: 'stale', user: { id: 1 }, refreshToken: 'R1' }),
            refresh: init => {
                seenBodies.push(JSON.parse(String(init.body)))
                return seenBodies.length === 1
                    ? json({ jwt: 'stale2', refreshToken: 'R2' })
                    : json({ jwt: 'C' })
            },
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        // two explicit refreshes: the first must send R1, the second the rotated R2
        await client.auth.refresh()
        await client.auth.refresh()
        expect(seenBodies).toEqual([
            { refreshToken: 'R1' },
            { refreshToken: 'R2' },
        ])
    })

    it('auth.refresh() bootstraps a cookie-based session', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['B'],
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            credentials: 'include',
        })
        await expect(client.auth.refresh()).resolves.toBe(true)
        // the refresh call itself must carry credentials for the cookie
        expect(
            (backend.calls[0].init as { credentials?: string }).credentials,
        ).toBe('include')
        await client.items.find()
        expect(authHeader(backend.calls[1].init)).toBe('Bearer B')
    })

    it('auth.refresh() resolves false when there is no live session', async () => {
        inBrowser()
        const backend = fakeBackend({})
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await expect(client.auth.refresh()).resolves.toBe(false)
    })

    it('logout posts to /api/auth/logout with the in-memory refreshToken and clears the session', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['A'],
            login: () =>
                json({ jwt: 'A', user: { id: 1 }, refreshToken: 'R1' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await client.auth.logout()
        const logoutCall = backend.calls.find(c =>
            c.url.endsWith('/api/auth/logout'),
        )
        expect(logoutCall).toBeDefined()
        expect(JSON.parse(String(logoutCall!.init.body))).toEqual({
            refreshToken: 'R1',
        })
        await client.items.find().catch(() => undefined)
        const after = backend.calls[backend.calls.length - 1]
        expect(authHeader(after.init)).toBeUndefined()
    })

    it('legacy client: login does not attach Bearer and a 401 never triggers a refresh', async () => {
        inBrowser()
        const backend = fakeBackend({
            login: () => json({ jwt: 'A', user: { id: 1 } }),
        })
        const client = new LegacyClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await expect(client.items.find()).rejects.toMatchObject({
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(0)
        const find = backend.calls.find(c => c.url.endsWith('/api/items'))!
        expect(authHeader(find.init)).toBeUndefined()
    })

    it('legacy client: auth.refresh is absent and logout stays the client-side alias', async () => {
        const backend = fakeBackend({})
        const client = new LegacyClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            token: 't',
        })
        expect(client.auth.refresh).toBeUndefined()
        await client.auth.logout()
        expect(backend.calls).toEqual([])
        expect(client.setToken).toBeDefined()
    })

    it('config.authMode: "refresh" enables the flow on a legacy-generated client', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['B'],
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new LegacyClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            authMode: 'refresh',
        })
        const result = await client.items.find()
        expect(result).toEqual([])
        expect(backend.refreshCalls()).toBe(1)
    })

    it('config.authMode: "legacy" disables the flow on a refresh-generated client', async () => {
        inBrowser()
        const backend = fakeBackend({
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            authMode: 'legacy',
        })
        await expect(client.items.find()).rejects.toMatchObject({
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(0)
    })

    it('dead-session latch: a rejected refresh silences the auto-flow on later 401s', async () => {
        inBrowser()
        const backend = fakeBackend({
            refresh: () => unauthorized(),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        expect(backend.refreshCalls()).toBe(1)
        // second 401 must not re-hit /api/auth/refresh
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        expect(backend.refreshCalls()).toBe(1)
    })

    it('a new login lifts the latch', async () => {
        inBrowser()
        let sessionAlive = false
        const backend = fakeBackend({
            validTokens: ['B'],
            login: () => {
                sessionAlive = true
                return json({ jwt: 'stale', user: { id: 1 } })
            },
            refresh: () => (sessionAlive ? json({ jwt: 'B' }) : unauthorized()),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        expect(backend.refreshCalls()).toBe(1) // latched
        await client.auth.login({ identifier: 'u', password: 'p' })
        // stale access token → 401 → the flow is allowed to refresh again
        const result = await client.items.find()
        expect(result).toEqual([])
        expect(backend.refreshCalls()).toBe(2)
    })

    it('explicit auth.refresh() goes through the latch and lifts it on success', async () => {
        inBrowser()
        let sessionAlive = false
        const backend = fakeBackend({
            validTokens: ['B'],
            refresh: () => (sessionAlive ? json({ jwt: 'B' }) : unauthorized()),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        expect(backend.refreshCalls()).toBe(1) // latched
        sessionAlive = true // e.g. the user logged in from another tab
        await expect(client.auth.refresh()).resolves.toBe(true)
        const result = await client.items.find()
        expect(result).toEqual([])
    })

    it('logout parks the auto-flow: no cookie resurrection after signing out', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['A'],
            login: () => json({ jwt: 'A', user: { id: 1 } }),
            refresh: () => json({ jwt: 'A' }), // cookie is still alive
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await client.auth.logout()
        // anonymous 401 must NOT silently resurrect the session via the cookie
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        expect(backend.refreshCalls()).toBe(0)
    })

    it('a 5xx refresh is transient: no latch, tokens survive', async () => {
        inBrowser()
        const refreshBodies: unknown[] = []
        const backend = fakeBackend({
            login: () =>
                json({ jwt: 'stale', user: { id: 1 }, refreshToken: 'R1' }),
            refresh: init => {
                refreshBodies.push(JSON.parse(String(init.body)))
                return json({ error: { status: 500 } }, 500)
            },
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        await expect(client.items.find()).rejects.toMatchObject({ status: 401 })
        // both 401s were allowed to try, and the refreshToken was not dropped
        expect(refreshBodies).toEqual([
            { refreshToken: 'R1' },
            { refreshToken: 'R1' },
        ])
    })

    it('in Node login() does not capture the session (no silent shared-instance mutation)', async () => {
        // no window stub — server environment
        const backend = fakeBackend({
            validTokens: ['A'],
            login: () => json({ jwt: 'A', user: { id: 1 } }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
        })
        await client.auth.login({ identifier: 'u', password: 'p' })
        await client.items.find().catch(() => undefined)
        const find = backend.calls.find(c => c.url.endsWith('/api/items'))!
        expect(authHeader(find.init)).toBeUndefined()
    })

    it('an onRequest hook that sets Authorization takes ownership: no auto-refresh', async () => {
        inBrowser()
        const backend = fakeBackend({
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            onRequest: (req: { headers: Record<string, string> }) => {
                req.headers['Authorization'] = 'Bearer from-hook'
            },
        })
        await expect(client.items.find()).rejects.toMatchObject({
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(0)
    })

    it('a 401 under a static config token is not the session flow’s business', async () => {
        inBrowser()
        const backend = fakeBackend({
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            token: 'stale-api-token',
        })
        await expect(client.items.find()).rejects.toMatchObject({
            status: 401,
        })
        expect(backend.refreshCalls()).toBe(0)
    })

    it('onRequest runs for the refresh request itself (infrastructure headers reach it)', async () => {
        inBrowser()
        const backend = fakeBackend({
            refresh: () => json({ jwt: 'B' }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            onRequest: (req: { headers: Record<string, string> }) => {
                req.headers['X-Tenant'] = 't1'
            },
        })
        await expect(client.auth.refresh()).resolves.toBe(true)
        const refreshCall = backend.calls.find(c =>
            c.url.endsWith('/api/auth/refresh'),
        )!
        const headers = refreshCall.init.headers as Record<string, string>
        expect(headers['X-Tenant']).toBe('t1')
        // the session flow never attaches Authorization to its own refresh
        expect(headers['Authorization']).toBeUndefined()
    })

    it('session token wins over the static config token in refresh mode', async () => {
        inBrowser()
        const backend = fakeBackend({
            validTokens: ['A', 'static'],
            login: () => json({ jwt: 'A', user: { id: 1 } }),
        })
        const client = new RefreshClient({
            baseURL: 'http://x',
            fetch: backend.fetch,
            token: 'static',
        })
        await client.items.find()
        expect(authHeader(backend.calls[0].init)).toBe('Bearer static')
        await client.auth.login({ identifier: 'u', password: 'p' })
        await client.items.find()
        const last = backend.calls[backend.calls.length - 1]
        expect(authHeader(last.init)).toBe('Bearer A')
    })
})
