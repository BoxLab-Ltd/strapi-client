import {
    PLUGIN_REGISTRY,
    PluginContract,
    PluginEndpoint,
} from './plugin-registry.js'

/**
 * Generates standalone API classes for Strapi plugins listed in
 * `PLUGIN_REGISTRY`. Each contract becomes a `class XxxAPI extends BaseAPI`
 * with one method per endpoint.
 *
 * Pattern parallels `AuthApiGenerator` — the output is plain TypeScript
 * source assembled via template literals. Body/URL/options shapes are
 * derived declaratively from each `PluginEndpoint`.
 */
export class PluginApiGenerator {
    /**
     * Generate the block of plugin API classes for the supplied contracts.
     * Defaults to all entries in `PLUGIN_REGISTRY`. Caller passes a filtered
     * list to skip contracts whose `clientProperty` collides with a
     * user-defined standalone controller.
     */
    generateAllPluginClasses(
        contracts: PluginContract[] = PLUGIN_REGISTRY,
    ): string {
        return contracts
            .map(contract => this.generatePluginClass(contract))
            .join('\n\n')
    }

    private generatePluginClass(contract: PluginContract): string {
        const methods = contract.endpoints
            .map(ep => this.generateMethod(ep, contract.errorPrefix))
            .join('\n\n')

        return `// API for "${contract.pluginName}" plugin
class ${contract.className} extends BaseAPI {
  constructor(config: StrapiClientConfig) {
    super(config)
  }

${methods}
}`
    }

    private generateMethod(ep: PluginEndpoint, errorPrefix: string): string {
        const params = this.buildParameters(ep)
        const urlLines = this.buildUrlLines(ep)
        const reqOptions = this.buildRequestOptions(ep)
        const docComment = this.buildDocComment(ep)

        const indentedUrl = urlLines.map(line => `    ${line}`).join('\n')

        const method = `${docComment}
  async ${ep.methodName}(${params}): Promise<${ep.responseType}> {
${indentedUrl}
    return this.request<${ep.responseType}>(url, ${reqOptions}, nextOptions, '${errorPrefix}')
  }`

        if (!ep.deprecatedAlias) return method

        return `${method}

  /**
   * @deprecated Use \`${ep.methodName}()\` instead. Will be removed in a future major.
   */
  async ${ep.deprecatedAlias}(${params}): Promise<${ep.responseType}> {
    return this.${ep.methodName}(${this.buildArgNames(ep)})
  }`
    }

    /** Argument names (no types) for delegating to the renamed method. */
    private buildArgNames(ep: PluginEndpoint): string {
        const names: string[] = []
        if (ep.paramTypes) names.push(...Object.keys(ep.paramTypes))
        if (ep.bodyType) names.push('body')
        if (ep.queryType) names.push('params')
        names.push('nextOptions')
        return names.join(', ')
    }

    private buildParameters(ep: PluginEndpoint): string {
        const parts: string[] = []

        if (ep.paramTypes) {
            for (const [name, type] of Object.entries(ep.paramTypes)) {
                parts.push(`${name}: ${type}`)
            }
        }

        if (ep.bodyType) {
            parts.push(`body: ${ep.bodyType}`)
        }

        if (ep.queryType) {
            parts.push(`params?: ${ep.queryType}`)
        }

        parts.push('nextOptions?: NextOptions')
        return parts.join(', ')
    }

    private buildUrlLines(ep: PluginEndpoint): string[] {
        let path = ep.path
        if (ep.paramTypes) {
            for (const name of Object.keys(ep.paramTypes)) {
                path = path.split(`:${name}`).join(`\${${name}}`)
            }
        }

        if (ep.queryType) {
            return [
                'const query = this.buildQueryString(params)',
                `const url = \`\${this.config.baseURL}/api${path}\${query}\``,
            ]
        }

        return [`const url = \`\${this.config.baseURL}/api${path}\``]
    }

    private buildRequestOptions(ep: PluginEndpoint): string {
        const opts: string[] = []
        if (ep.method !== 'GET') {
            opts.push(`method: '${ep.method}'`)
        }
        if (ep.bodyType) {
            // FormData passes through as-is so the browser sets multipart
            // boundary; everything else gets JSON-serialized.
            if (ep.bodyType === 'FormData') {
                opts.push('body')
            } else {
                opts.push('body: JSON.stringify(body)')
            }
        }
        if (opts.length === 0) return '{}'
        return `{ ${opts.join(', ')} }`
    }

    private buildDocComment(ep: PluginEndpoint): string {
        const route = `${ep.method} /api${ep.path}`
        if (!ep.description) {
            return `  /** ${route} */`
        }
        return `  /**\n   * ${ep.description}\n   *\n   * ${route}\n   */`
    }
}
