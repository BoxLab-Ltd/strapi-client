import * as fs from 'fs'
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
    ): Promise<void> {
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true })
        }

        // Generate all source contents
        const typesContent = this.typesGenerator.generate(schema)
        const clientContent = this.clientGenerator.generate(
            schema,
            endpoints,
            extraTypes,
            schemaHash,
            generatorVersion,
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
            for (const [fileName, data] of Object.entries(files)) {
                fs.writeFileSync(
                    path.join(this.outputDir, fileName),
                    stripLocalJsExtensions(data),
                    'utf-8',
                )
            }
            return
        }

        // Compile all files together so cross-file imports resolve correctly
        await this.compileFiles(files)
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

    private async compileFiles(files: Record<string, string>): Promise<void> {
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

        // Compile all files together
        const program = ts.createProgram(fileNames, compilerOptions, host)
        program.emit()

        // Write output files
        for (const [fileName, data] of Object.entries(outputs)) {
            const outputPath = path.join(this.outputDir, fileName)
            fs.writeFileSync(outputPath, data, 'utf-8')
        }
    }
}
