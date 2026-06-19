import { Project } from 'ts-morph'
import { ParsedRoute } from '../shared/route-types.js'
import { toCamelCase } from '../shared/index.js'

/**
 * Standard users-permissions auth routes, used as the fallback when the schema
 * API reports no auth routes (a real Strapi always registers these). Feeding
 * them through the same builder as discovered routes keeps a single code path —
 * there is no separate hand-written "hardcoded" class to drift out of sync.
 */
const DEFAULT_AUTH_ROUTES: ParsedRoute[] = [
    {
        method: 'POST',
        path: '/auth/local',
        handler: 'auth.callback',
        controller: 'auth',
        action: 'callback',
        params: [],
    },
    {
        method: 'POST',
        path: '/auth/local/register',
        handler: 'auth.register',
        controller: 'auth',
        action: 'register',
        params: [],
    },
    {
        method: 'GET',
        path: '/auth/:provider/callback',
        handler: 'auth.callback',
        controller: 'auth',
        action: 'callback',
        params: ['provider'],
    },
    {
        method: 'POST',
        path: '/auth/forgot-password',
        handler: 'auth.forgotPassword',
        controller: 'auth',
        action: 'forgotPassword',
        params: [],
    },
    {
        method: 'POST',
        path: '/auth/reset-password',
        handler: 'auth.resetPassword',
        controller: 'auth',
        action: 'resetPassword',
        params: [],
    },
    {
        method: 'POST',
        path: '/auth/change-password',
        handler: 'auth.changePassword',
        controller: 'auth',
        action: 'changePassword',
        params: [],
    },
    {
        method: 'GET',
        path: '/auth/email-confirmation',
        handler: 'auth.emailConfirmation',
        controller: 'auth',
        action: 'emailConfirmation',
        params: [],
    },
    {
        method: 'POST',
        path: '/auth/send-email-confirmation',
        handler: 'auth.sendEmailConfirmation',
        controller: 'auth',
        action: 'sendEmailConfirmation',
        params: [],
    },
]

const DEFAULT_USER_ROUTES: ParsedRoute[] = [
    {
        method: 'GET',
        path: '/users/me',
        handler: 'user.me',
        controller: 'user',
        action: 'me',
        params: [],
    },
    {
        method: 'PUT',
        path: '/users/me',
        handler: 'user.updateMe',
        controller: 'user',
        action: 'updateMe',
        params: [],
    },
]

export class AuthApiGenerator {
    generateAuthTypes(): string {
        const project = new Project({ useInMemoryFileSystem: true })
        const sf = project.createSourceFile('auth-types.ts')

        sf.addStatements('// Auth API types for users-permissions plugin')

        sf.addInterface({
            name: 'LoginCredentials',
            isExported: true,
            properties: [
                { name: 'identifier', type: 'string' },
                { name: 'password', type: 'string' },
            ],
        })

        sf.addInterface({
            name: 'RegisterData',
            isExported: true,
            properties: [
                { name: 'username', type: 'string' },
                { name: 'email', type: 'string' },
                { name: 'password', type: 'string' },
                {
                    name: 'referralCode',
                    type: 'string',
                    hasQuestionToken: true,
                },
                {
                    name: 'referralSource',
                    type: '"code" | "link" | "share"',
                    hasQuestionToken: true,
                },
            ],
        })

        sf.addInterface({
            name: 'AuthResponse',
            isExported: true,
            properties: [
                { name: 'jwt', type: 'string' },
                { name: 'user', type: 'User' },
            ],
        })

        sf.addInterface({
            name: 'ForgotPasswordData',
            isExported: true,
            properties: [{ name: 'email', type: 'string' }],
        })

        sf.addInterface({
            name: 'ResetPasswordData',
            isExported: true,
            properties: [
                { name: 'code', type: 'string' },
                { name: 'password', type: 'string' },
                { name: 'passwordConfirmation', type: 'string' },
            ],
        })

        sf.addInterface({
            name: 'ChangePasswordData',
            isExported: true,
            properties: [
                { name: 'currentPassword', type: 'string' },
                { name: 'password', type: 'string' },
                { name: 'passwordConfirmation', type: 'string' },
            ],
        })

        sf.addInterface({
            name: 'EmailConfirmationResponse',
            isExported: true,
            properties: [
                { name: 'jwt', type: 'string' },
                { name: 'user', type: 'User' },
            ],
        })

        // POST /api/auth/forgot-password always answers `{ ok: true }` (Strapi
        // never reveals whether the email exists — anti-enumeration).
        sf.addInterface({
            name: 'ForgotPasswordResponse',
            isExported: true,
            properties: [{ name: 'ok', type: 'true' }],
        })

        // POST /api/auth/send-email-confirmation echoes the target address and
        // a delivery flag.
        sf.addInterface({
            name: 'SendEmailConfirmationResponse',
            isExported: true,
            properties: [
                { name: 'email', type: 'string' },
                { name: 'sent', type: 'boolean' },
            ],
        })

        return sf.getFullText()
    }

    generateAuthApiClass(
        authRoutes: ParsedRoute[] = [],
        userRoutes: ParsedRoute[] = [],
    ): string {
        // No routes discovered → fall back to the standard users-permissions
        // routes so the same builder still produces a complete AuthAPI.
        const usingDefaults = authRoutes.length === 0 && userRoutes.length === 0
        const effectiveAuthRoutes = usingDefaults
            ? DEFAULT_AUTH_ROUTES
            : authRoutes
        const effectiveUserRoutes = usingDefaults
            ? DEFAULT_USER_ROUTES
            : userRoutes

        return this.buildAuthApiClass(
            effectiveAuthRoutes,
            effectiveUserRoutes,
            usingDefaults,
        )
    }

    private buildAuthApiClass(
        authRoutes: ParsedRoute[],
        userRoutes: ParsedRoute[],
        usingDefaults: boolean,
    ): string {
        const authMethods = authRoutes
            .map(route => this.generateAuthMethod(route))
            .join('\n\n')

        // Only special user routes belong on AuthAPI; the rest of the users
        // collection is reached via the generated UsersAPI.
        const specialUserRoutes = userRoutes.filter(
            r =>
                r.action === 'me' ||
                r.action === 'updateMe' ||
                r.action === 'count',
        )
        const userMethods = specialUserRoutes
            .map(route => this.generateAuthMethod(route))
            .join('\n\n')

        const header = usingDefaults
            ? '// Auth API wrapper for users-permissions plugin'
            : '// Auth API wrapper for users-permissions plugin (generated from actual routes)'

        return `${header}
class AuthAPI extends BaseAPI {
  constructor(config: StrapiClientConfig) {
    super(config)
  }

${authMethods}

${userMethods}

${this.generateClientSideHelpers()}
}`
    }

    private generateAuthMethod(route: ParsedRoute): string {
        // Generate method name from action, with special handling for callback
        let methodName = toCamelCase(route.action)

        // Special case: rename auth.callback on /auth/local to "login"
        if (
            route.action === 'callback' &&
            route.path === '/auth/local' &&
            route.method === 'POST'
        ) {
            methodName = 'login'
        }

        // Special handling for me() - it should support populate with type inference
        if (route.action === 'me') {
            return this.generateMeMethod(route)
        }

        // Special handling for updateMe() - safe way to update current user
        if (route.action === 'updateMe') {
            return this.generateUpdateMeMethod(route)
        }

        // Special handling for OAuth callback() - needs query params support
        if (
            route.action === 'callback' &&
            route.method === 'GET' &&
            route.path.includes(':provider')
        ) {
            return this.generateCallbackMethod(route)
        }

        // Special handling for confirmEmail() - token goes in the query string
        if (route.action === 'emailConfirmation') {
            return this.generateConfirmEmailMethod(route)
        }

        // Special handling for sendEmailConfirmation() - takes a bare email
        if (route.action === 'sendEmailConfirmation') {
            return this.generateSendEmailConfirmationMethod(route)
        }

        // Determine return type based on route path/action
        const returnType = this.getReturnType(route)
        const params = this.generateAuthMethodParams(route)
        const pathExpression = this.generateAuthPathExpression(route)
        const hasBody =
            route.method === 'POST' ||
            route.method === 'PUT' ||
            route.method === 'PATCH'

        const bodyBlock = hasBody
            ? `    return this.request<${returnType}>(
      url,
      {
        method: '${route.method}',
        body: ${route.params.length > 0 ? 'JSON.stringify(data)' : 'data ? JSON.stringify(data) : undefined'},
      },
      nextOptions,
      'Strapi Auth'
    )`
            : `    return this.request<${returnType}>(
      url,
      ${route.method !== 'GET' ? `{ method: '${route.method}' }` : '{}'},
      nextOptions,
      'Strapi Auth'
    )`

        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   */
  async ${methodName}(${params}): Promise<${returnType}> {
    const url = \`\${this.config.baseURL}${pathExpression.slice(1, -1)}\`
${bodyBlock}
  }`
    }

    private getReturnType(route: ParsedRoute): string {
        if (
            route.action === 'callback' ||
            route.action === 'register' ||
            route.action === 'resetPassword' ||
            route.action === 'changePassword'
        ) {
            return 'AuthResponse'
        } else if (route.action === 'findOne') {
            return 'User'
        } else if (route.action === 'find') {
            return 'User[]'
        } else if (route.action === 'forgotPassword') {
            return 'ForgotPasswordResponse'
        }
        return 'any'
    }

    private generateMeMethod(route: ParsedRoute): string {
        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   * Supports populate with automatic type inference
   */

  // Overload: with populate object → populated return type
  me<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>(
    params: { populate: TPopulate } & QueryParams<User, UserFilters, TPopulate, TFields>,
    nextOptions?: NextOptions
  ): Promise<SelectFields<GetPopulated<User, TPopulate>, User, TFields>>
  // Overload: with populate '*' or true → all fields populated
  me<const TFields extends Exclude<keyof User & string, '__typename'> = never>(
    params: { populate: '*' | true } & QueryParams<User, UserFilters, '*' | true, TFields>,
    nextOptions?: NextOptions
  ): Promise<SelectFields<GetPopulated<User, '*'>, User, TFields>>
  // Overload: general case → base return type
  me<const TFields extends Exclude<keyof User & string, '__typename'> = never>(
    params?: QueryParams<User, UserFilters, UserPopulateParam | (keyof UserPopulateParam & string)[] | '*' | boolean, TFields>,
    nextOptions?: NextOptions
  ): Promise<SelectFields<User, User, TFields>>

  async me(params?: any, nextOptions?: any): Promise<any> {
    const queryString = params ? this.buildQueryString(params) : ''
    const url = queryString ? \`\${this.config.baseURL}/api/users/me\${queryString}\` : \`\${this.config.baseURL}/api/users/me\`
    const response = await this.request<any>(url, {}, nextOptions, "Strapi Auth")
    return response
  }`
    }

    private generateUpdateMeMethod(route: ParsedRoute): string {
        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   * Safe way to update current user without knowing their ID
   * Supports populate with automatic type inference
   */

  // Overload: with populate object → populated return type
  updateMe<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>(
    data: UserUpdateInput,
    params: { populate: TPopulate } & QueryParams<User, UserFilters, TPopulate, TFields>,
    nextOptions?: NextOptions
  ): Promise<SelectFields<GetPopulated<User, TPopulate>, User, TFields>>
  // Overload: with populate '*' or true → all fields populated
  updateMe<const TFields extends Exclude<keyof User & string, '__typename'> = never>(
    data: UserUpdateInput,
    params: { populate: '*' | true } & QueryParams<User, UserFilters, '*' | true, TFields>,
    nextOptions?: NextOptions
  ): Promise<SelectFields<GetPopulated<User, '*'>, User, TFields>>
  // Overload: general case → base return type
  updateMe<const TFields extends Exclude<keyof User & string, '__typename'> = never>(
    data: UserUpdateInput,
    params?: QueryParams<User, UserFilters, UserPopulateParam | (keyof UserPopulateParam & string)[] | '*' | boolean, TFields>,
    nextOptions?: NextOptions
  ): Promise<SelectFields<User, User, TFields>>

  async updateMe(data: UserUpdateInput, params?: any, nextOptions?: any): Promise<any> {
    const queryString = params ? this.buildQueryString(params) : ''
    const url = queryString ? \`\${this.config.baseURL}/api/users/me\${queryString}\` : \`\${this.config.baseURL}/api/users/me\`
    const response = await this.request<any>(
      url,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      nextOptions,
      "Strapi Auth"
    )
    return response
  }`
    }

    private generateCallbackMethod(route: ParsedRoute): string {
        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   * OAuth callback with query string support
   * @param provider - OAuth provider name (google, github, etc.)
   * @param search - Query string (e.g., "access_token=xxx&code=yyy" or "?access_token=xxx")
   */
  async callback(
    provider: string,
    search?: string,
    nextOptions?: NextOptions
  ): Promise<AuthResponse> {
    let path = \`/api/auth/\${provider}/callback\`
    if (search) {
      // Add search string, handling both "?key=val" and "key=val" formats
      path += search.startsWith("?") ? search : \`?\${search}\`
    }
    const url = \`\${this.config.baseURL}\${path}\`
    return this.request<AuthResponse>(url, {}, nextOptions, "Strapi Auth")
  }`
    }

    private generateConfirmEmailMethod(route: ParsedRoute): string {
        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   * Confirm a user's email address with the token from the confirmation email.
   */
  async confirmEmail(confirmationToken: string, nextOptions?: NextOptions): Promise<EmailConfirmationResponse> {
    const url = \`\${this.config.baseURL}/api/auth/email-confirmation?confirmation=\${confirmationToken}\`
    return this.request<EmailConfirmationResponse>(
      url,
      {},
      nextOptions,
      'Strapi Auth'
    )
  }`
    }

    private generateSendEmailConfirmationMethod(route: ParsedRoute): string {
        return `  /**
   * ${route.method} ${route.path}
   * Handler: ${route.handler}
   * Resend the confirmation email to a user who hasn't confirmed yet.
   */
  async sendEmailConfirmation(email: string): Promise<SendEmailConfirmationResponse> {
    const url = \`\${this.config.baseURL}/api/auth/send-email-confirmation\`
    return this.request<SendEmailConfirmationResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, undefined, 'Strapi Auth')
  }`
    }

    private generateClientSideHelpers(): string {
        return `  /**
   * Clear the stored auth token. Client-side only — does not call the server.
   */
  async clearToken(): Promise<void> {
    this.config.token = undefined
  }

  /**
   * @deprecated Use \`clearToken()\` instead. Will be removed in a future major.
   */
  async logout(): Promise<void> {
    return this.clearToken()
  }`
    }

    private generateAuthMethodParams(route: ParsedRoute): string {
        const params: string[] = []

        // Add path parameters
        for (const param of route.params) {
            params.push(`${param}: string`)
        }

        // Add data parameter for POST/PUT/PATCH
        if (
            route.method === 'POST' ||
            route.method === 'PUT' ||
            route.method === 'PATCH'
        ) {
            // Infer data type based on action
            if (route.action === 'callback' && route.path === '/auth/local') {
                params.push('data: LoginCredentials')
            } else if (route.action === 'register') {
                params.push('data: RegisterData')
            } else if (route.action === 'forgotPassword') {
                params.push('data: ForgotPasswordData')
            } else if (route.action === 'resetPassword') {
                params.push('data: ResetPasswordData')
            } else if (route.action === 'changePassword') {
                params.push('data: ChangePasswordData')
            } else {
                params.push('data?: any')
            }
        }

        // Add NextOptions parameter
        params.push('nextOptions?: NextOptions')

        return params.join(', ')
    }

    private generateAuthPathExpression(route: ParsedRoute): string {
        let pathTemplate = route.path

        // Convert :param to ${param}
        pathTemplate = pathTemplate.replace(
            /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
            '${$1}',
        )

        return '`/api' + pathTemplate + '`'
    }
}
