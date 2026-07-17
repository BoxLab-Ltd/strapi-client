import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'
import { ParsedSchema } from '../schema-types.js'
import { TypesGenerator } from './types-generator.js'
import { ClientGenerator } from './client-generator.js'
import { IndexGenerator } from './index-generator.js'
import type {
    ParsedEndpoint,
    ExtraControllerType,
} from '../shared/endpoint-types.js'
import type { AuthMode } from '../shared/strapi-schema-types.js'

function stripLocalJsExtensions(source: string): string {
    return source.replace(
        /(from\s+['"]|export\s+\*\s+from\s+['"])(\.[^'"]*)\.js(['"])/g,
        '$1$2$3',
    )
}

export class Generator {
    private outputDir: string
    private typesGenerator: TypesGenerator
    private clientGenerator: ClientGenerator
    private indexGenerator: IndexGenerator

    constructor(outputDir: string) {
        this.outputDir = outputDir
        this.typesGenerator = new TypesGenerator()
        this.clientGenerator = new ClientGenerator()
        this.indexGenerator = new IndexGenerator()
    }

    async generate(
        schema: ParsedSchema,
        endpoints?: ParsedEndpoint[],
        extraTypes?: ExtraControllerType[],
        schemaHash: string = '',
        generatorVersion: string = '',
        format: 'js' | 'ts' = 'js',
        typecheck: boolean = true,
        authMode: AuthMode = 'legacy',
    ): Promise<void> {
        // Generate all source contents
        const typesContent = this.typesGenerator.generate(schema)
        const clientContent = this.clientGenerator.generate(
            schema,
            endpoints,
            extraTypes,
            schemaHash,
            generatorVersion,
            authMode,
        )
        const indexContent = this.indexGenerator.generate()

        // Format all files with prettier
        const files: Record<string, string> = {
            'types.ts': await this.formatContent(typesContent),
            'client.ts': await this.formatContent(clientContent),
            'index.ts': await this.formatContent(indexContent),
        }

        if (format === 'ts') {
            // Write raw TypeScript for consumers that compile sources
            // themselves (monorepos). Strip `.js` extensions from local
            // relative imports first: tsc under moduleResolution "bundler"
            // accepts them (resolves .js → .ts), but Turbopack (Next 16)
            // doesn't, breaking `next build`.
            const strippedFiles = Object.fromEntries(
                Object.entries(files).map(([name, data]) => [
                    name,
                    stripLocalJsExtensions(data),
                ]),
            )
            // Type-check the exact bytes we're about to write, BEFORE touching
            // the consumer's tree — a guard throw must leave it untouched.
            this.verifyGeneratedTypes(strippedFiles, typecheck)
            this.ensureOutputDir()
            for (const [fileName, data] of Object.entries(strippedFiles)) {
                fs.writeFileSync(
                    path.join(this.outputDir, fileName),
                    data,
                    'utf-8',
                )
            }
            return
        }

        // Compile all files together so cross-file imports resolve correctly
        await this.compileFiles(files, typecheck)
    }

    private ensureOutputDir(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true })
        }
    }

    private async formatContent(content: string): Promise<string> {
        try {
            const prettier = await import('prettier')
            return await prettier.format(content, {
                parser: 'typescript',
                semi: false,
                singleQuote: true,
                tabWidth: 2,
                trailingComma: 'es5',
                printWidth: 100,
            })
        } catch {
            return content
        }
    }

    private async compileFiles(
        files: Record<string, string>,
        typecheck: boolean,
    ): Promise<void> {
        const compilerOptions: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
            declaration: true,
            esModuleInterop: true,
            skipLibCheck: true,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
        }

        const host = ts.createCompilerHost(compilerOptions)
        const fileNames = Object.keys(files)

        // Override file reading to serve in-memory files
        const originalGetSourceFile = host.getSourceFile
        host.getSourceFile = (
            fileName,
            languageVersion,
            onError,
            shouldCreateNewSourceFile,
        ) => {
            if (files[fileName]) {
                return ts.createSourceFile(
                    fileName,
                    files[fileName],
                    languageVersion,
                    true,
                )
            }
            return originalGetSourceFile(
                fileName,
                languageVersion,
                onError,
                shouldCreateNewSourceFile,
            )
        }

        const originalFileExists = host.fileExists
        host.fileExists = fileName => {
            if (files[fileName]) return true
            return originalFileExists(fileName)
        }

        // Capture emitted files
        const outputs: Record<string, string> = {}
        host.writeFile = (fileName: string, data: string) => {
            outputs[fileName] = data
        }

        // The `@ts-nocheck` header is gone, so the generated client must
        // type-check. Verify it the way a consumer's tsc would (on disk, where
        // bundler resolution maps the `.js` import specifiers to the sibling
        // `.ts`) and fail loudly rather than emit broken types into their tree.
        this.verifyGeneratedTypes(files, typecheck)

        // Compile all files together
        const program = ts.createProgram(fileNames, compilerOptions, host)
        program.emit()

        // Write output files
        this.ensureOutputDir()
        for (const [fileName, data] of Object.entries(outputs)) {
            const outputPath = path.join(this.outputDir, fileName)
            fs.writeFileSync(outputPath, data, 'utf-8')
        }
    }

    /**
     * Block on the generated client's type errors. Default throws — broken
     * types must never reach the consumer's tree; `--no-typecheck` downgrades
     * to a warning and writes anyway, so a strict-only false positive can't
     * wedge an upgrade with no recourse.
     */
    private verifyGeneratedTypes(
        files: Record<string, string>,
        typecheck: boolean,
    ): void {
        const message = this.collectTypeErrors(files)
        if (!message) return
        if (typecheck) throw new Error(message)
        console.warn(`${message}\n(--no-typecheck set: writing anyway.)`)
    }

    /**
     * Type-check the generated client the way a consumer's tsc would and return
     * a formatted error message, or null if clean. Run from a temp dir on disk
     * so bundler resolution maps the `.js` import specifiers to the sibling
     * `.ts` files — the in-memory emit program can't resolve those, so it can't
     * double as the check. Strict + skipLibCheck mirrors a typical consumer
     * tsconfig.
     */
    private collectTypeErrors(files: Record<string, string>): string | null {
        const checkDir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'strapi-types-check-'),
        )
        try {
            for (const [name, content] of Object.entries(files)) {
                fs.writeFileSync(path.join(checkDir, name), content, 'utf-8')
            }
            const rootNames = Object.keys(files).map(n =>
                path.join(checkDir, n),
            )
            const program = ts.createProgram(rootNames, {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ES2022,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                strict: true,
                skipLibCheck: true,
                noEmit: true,
            })
            const diagnostics = ts
                .getPreEmitDiagnostics(program)
                .filter(d => d.file && d.file.fileName.startsWith(checkDir))
            if (diagnostics.length === 0) return null

            const details = diagnostics
                .map(d => {
                    const msg = ts.flattenDiagnosticMessageText(
                        d.messageText,
                        '\n',
                    )
                    const loc =
                        d.file && d.start !== undefined
                            ? `${path.basename(d.file.fileName)}:${
                                  d.file.getLineAndCharacterOfPosition(d.start)
                                      .line + 1
                              } `
                            : ''
                    return `  ${loc}TS${d.code}: ${msg}`
                })
                .join('\n')
            return (
                `Generated client failed type-checking (${diagnostics.length} error(s)). ` +
                `This is a strapi-typed-client bug — please report it. ` +
                `If it's a false positive under your setup, bypass with --no-typecheck.\n${details}`
            )
        } finally {
            fs.rmSync(checkDir, { recursive: true, force: true })
        }
    }
}
