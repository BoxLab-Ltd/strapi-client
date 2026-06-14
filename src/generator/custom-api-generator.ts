import { ParsedRoute } from '../shared/route-types.js'
import { ParsedCustomTypes } from '../shared/custom-types.js'
import { toCamelCase, toPascalCase } from '../shared/string-utils.js'

/**
 * CollectionAPI / SingleTypeAPI CRUD surface. A custom route whose action
 * matches one of these would override the inherited method with an
 * incompatible signature (TS2416) and shadow the typed CRUD, so on a
 * content-type class its generated method is name-mangled — e.g. a `create`
 * action on the article controller becomes `createArticle`.
 */
const RESERVED_BASE_METHODS = new Set([
    'find',
    'findOne',
    'findWithMeta',
    'create',
    'update',
    'delete',
])

export class CustomApiGenerator {
    private customTypes?: ParsedCustomTypes

    /**
     * Set custom types to use for type generation
     */
    setCustomTypes(customTypes: ParsedCustomTypes): void {
        this.customTypes = customTypes
    }

    /**
     * Generate custom methods for a specific controller
     * These will be added to the corresponding CollectionAPI class or standalone API class
     * @param controller - Controller name
     * @param routes - Routes for this controller
     * @param isStandalone - Whether this is a standalone API (no collection type)
     * @param endpoint - The collection/single endpoint segment (pluralName for
     *   collections, singularName for single types) — used to strip the leading
     *   resource prefix from route paths. When omitted, falls back to naive
     *   `controller + "s"` pluralization (kept for standalone routes only).
     */
    generateCustomMethods(
        controller: string,
        routes: ParsedRoute[],
        isStandalone: boolean = false,
        endpoint?: string,
        contentTypeName?: string,
    ): string {
        return routes
            .map(
                route =>
                    '\n' +
                    this.generateCustomMethod(
                        route,
                        isStandalone,
                        endpoint,
                        contentTypeName,
                    ),
            )
            .join('\n')
    }

    /**
     * Generate type definitions from API namespace files
     */
    generateTypeDefinitions(): string {
        if (
            !this.customTypes ||
            this.customTypes.typeDefinitions.length === 0
        ) {
            return ''
        }

        return (
            '// Custom API namespace types\n\n' +
            this.customTypes.typeDefinitions.map(td => td + '\n').join('\n')
        )
    }

    private generateCustomMethod(
        route: ParsedRoute,
        isStandalone: boolean = false,
        endpoint?: string,
        contentTypeName?: string,
    ): string {
        const customType = this.customTypes?.types.get(route.handler)
        const inputType = customType?.inputType || 'any'
        const outputType = customType?.outputType || 'any'
        let methodName = toCamelCase(route.action)
        // On a content-type class, a custom action sharing a base CRUD name
        // would emit an incompatible override (TS2416) and hide the typed base
        // method, so mangle it (create -> createArticle). Standalone classes
        // extend BaseAPI, which has no CRUD surface, so they are left as-is.
        if (
            !isStandalone &&
            contentTypeName &&
            RESERVED_BASE_METHODS.has(methodName)
        ) {
            methodName = methodName + toPascalCase(contentTypeName)
        }
        const params = this.generateMethodParams(route, inputType)
        const hasBody =
            route.method === 'POST' ||
            route.method === 'PUT' ||
            route.method === 'PATCH'

        const urlExpression = isStandalone
            ? `\`\${this.config.baseURL}/api${this.generateStandalonePathExpression(route)}\``
            : `\`\${this.config.baseURL}/api/\${this.endpoint}${this.generatePathExpression(route, endpoint)}\``

        const bodyBlock = hasBody
            ? `    // If data is FormData, use it directly; otherwise JSON stringify
    const body = data instanceof FormData
      ? data
      : data ? JSON.stringify(data) : undefined

    const response = await this.request<StrapiResponse<${outputType}>>(
      url,
      {
        method: '${route.method}',
        body,
      }
    )`
            : route.method === 'GET'
              ? `    const response = await this.request<StrapiResponse<${outputType}>>(url)`
              : `    const response = await this.request<StrapiResponse<${outputType}>>(
      url,
      { method: '${route.method}' }
    )`

        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   */
  async ${methodName}(${params}): Promise<${outputType}> {
    const url = ${urlExpression}
${bodyBlock}
    return response.data
  }`
    }

    private generateMethodParams(
        route: ParsedRoute,
        inputType: string = 'any',
    ): string {
        const params: string[] = []

        // Add path parameters
        for (const param of route.params) {
            params.push(`${param}: string`)
        }

        // Add data parameter for POST/PUT/PATCH (support both typed data and FormData)
        if (
            route.method === 'POST' ||
            route.method === 'PUT' ||
            route.method === 'PATCH'
        ) {
            params.push(`data?: ${inputType} | FormData`)
        }

        return params.join(', ')
    }

    private generatePathExpression(
        route: ParsedRoute,
        endpoint?: string,
    ): string {
        // Convert path like '/items/:id/increment-run' to '/${id}/increment-run'
        // by stripping the resource prefix that the StrapiClient base URL already
        // contains (`${this.endpoint}`).
        let pathTemplate = route.path

        if (endpoint) {
            // Use the real Strapi endpoint (pluralName for collections,
            // singularName for single types) — handles irregular plurals and
            // non-English names like `pesquisador`/`pesquisadores`.
            const endpointPath = `/${endpoint}`
            if (pathTemplate.startsWith(endpointPath)) {
                pathTemplate = pathTemplate.substring(endpointPath.length)
            } else if (pathTemplate.startsWith(`/${route.controller}`)) {
                // Fallback: route declared under the singular controller name.
                pathTemplate = pathTemplate.substring(
                    route.controller.length + 1,
                )
            }
        } else {
            // Legacy path (no endpoint hint available) — naive English
            // pluralization. Retained for callers that don't pass the endpoint.
            const controllerPath = `/${route.controller}s`
            if (pathTemplate.startsWith(controllerPath)) {
                pathTemplate = pathTemplate.substring(controllerPath.length)
            } else if (pathTemplate.startsWith(`/${route.controller}`)) {
                pathTemplate = pathTemplate.substring(
                    route.controller.length + 1,
                )
            }
        }

        // Convert :param to ${param}
        pathTemplate = pathTemplate.replace(
            /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
            '${$1}',
        )

        // Return without quotes - will be inserted into template string
        return pathTemplate
    }

    private generateStandalonePathExpression(route: ParsedRoute): string {
        // For standalone routes, use the full path directly
        // Convert ':param' to '${param}'
        let pathTemplate = route.path

        // Add plugin prefix for plugin routes that don't have an empty prefix override
        if (route.pluginName && route.prefix !== '') {
            pathTemplate = `/${route.pluginName}${pathTemplate}`
        }

        // Convert :param to ${param}
        pathTemplate = pathTemplate.replace(
            /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
            '${$1}',
        )

        // Return without quotes - will be inserted into template string
        return pathTemplate
    }
}
