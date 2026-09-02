import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// generate() is the only thing watch() does with the format option, so the
// assertion is simply: whatever format watch was given reaches generate.
const generateMock = vi.hoisted(() =>
    vi.fn(async () => ({ success: true, filesWritten: [] })),
)

vi.mock('../../../src/cli/commands/generate.js', () => ({
    generate: generateMock,
}))

// Keep watch() offline and stop it before it opens an SSE connection: the
// initial generation happens first, which is what these tests inspect.
vi.mock('../../../src/cli/utils/api-client.js', () => ({
    createApiClient: () => ({
        ping: async () => true,
        sseUrl: 'http://localhost:1337/sse',
        getHeaders: () => ({}),
    }),
}))

vi.mock('../../../src/shared/sse-client.js', () => ({
    SseConnection: class {
        connect() {}
        close() {}
    },
}))

// No client.ts/client.js on disk => no local hash => watch generates initially.
vi.mock('../../../src/cli/utils/file-writer.js', async importOriginal => ({
    ...(await importOriginal<object>()),
    readLocalSchemaHash: () => null,
}))

const { watch, createWatchCommand } =
    await import('../../../src/cli/commands/watch.js')

describe('watch --format', () => {
    beforeEach(() => {
        generateMock.mockClear()
    })

    it('forwards format: ts to generate on the initial generation', async () => {
        await watch({ output: './src/strapi', format: 'ts' })

        expect(generateMock).toHaveBeenCalledOnce()
        expect(generateMock.mock.calls[0][0]).toMatchObject({
            output: './src/strapi',
            format: 'ts',
        })
    })

    it('leaves format undefined when not given, so generate detects it', async () => {
        await watch({ output: './src/strapi' })

        expect(generateMock.mock.calls[0][0].format).toBeUndefined()
    })

    it('registers --format on the watch command', () => {
        const program = new Command()
        createWatchCommand(program)

        const watchCmd = program.commands.find(c => c.name() === 'watch')
        const formatOpt = watchCmd?.options.find(o => o.long === '--format')

        expect(formatOpt).toBeDefined()
        expect(formatOpt?.flags).toBe('--format <js|ts>')
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})
