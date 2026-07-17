import { Project } from 'ts-morph'
import { ParsedRoute } from '../shared/route-types.js'
import { toCamelCase } from '../shared/index.js'
import type { AuthMode } from '../shared/strapi-schema-types.js'

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
    generateAuthTypes(authMode: AuthMode = 'legacy'): string {
        const project = new Project({ useInMemoryFileSystem: true })
        const sf = project.createSourceFile('auth-types.ts')

        // Present only when the backend returns refresh tokens in the body (sessions.httpOnly: false)
        const refreshTokenProp = {
            name: 'refreshToken',
            type: 'string',
            hasQuestionToken: true,
        }

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
                ...(authMode === 'refresh' ? [refreshTokenProp] : []),
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
                ...(authMode === 'refresh' ? [refreshTokenProp] : []),
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
        authMode: AuthMode = 'legacy',
    ): string {
        // No routes discovered → fall back to the standard users-permissions
        // routes so the same builder still produces a complete AuthAPI.
        const usingDefaults = authRoutes.length === 0 && userRoutes.length === 0
        let effectiveAuthRoutes = usingDefaults
            ? DEFAULT_AUTH_ROUTES
            : authRoutes
        const effectiveUserRoutes = usingDefaults
            ? DEFAULT_USER_ROUTES
            : userRoutes

        // Refresh-mode backends register these as regular routes — the typed implementations must win
        if (authMode === 'refresh') {
            effectiveAuthRoutes = effectiveAuthRoutes.filter(
                r => !['refresh', 'logout'].includes(this.methodNameFor(r)),
            )
        }

        return this.buildAuthApiClass(
            effectiveAuthRoutes,
            effectiveUserRoutes,
            usingDefaults,
            authMode,
        )
    }

    private buildAuthApiClass(
        authRoutes: ParsedRoute[],
        userRoutes: ParsedRoute[],
        usingDefaults: boolean,
        authMode: AuthMode,
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

        // Names already produced by the route/user methods — so the injected
        // client-side helpers don't collide with a real route (e.g. a custom
        // `auth.logout` endpoint vs the deprecated `logout` alias).
        const emitted = new Set<string>([
            ...authRoutes.map(r => this.methodNameFor(r)),
            ...specialUserRoutes.map(r => this.methodNameFor(r)),
        ])

        return `${header}
class AuthAPI extends BaseAPI {
  constructor(config: StrapiClientConfig) {
    super(config)
  }

${authMethods}

${userMethods}

${this.generateClientSideHelpers(emitted, authMode)}
}`
    }

    /**
     * The method name a route will be emitted under — mirrors the renames in
     * generateAuthMethod (login, confirmEmail). Used to detect collisions with
     * the injected client-side helpers.
     */
    private methodNameFor(route: ParsedRoute): string {
        if (
            route.action === 'callback' &&
            route.path === '/auth/local' &&
            route.method === 'POST'
        ) {
            return 'login'
        }
        if (route.action === 'emailConfirmation') return 'confirmEmail'
        return toCamelCase(route.action)
    }

    private generateAuthMethod(route: ParsedRoute): string {
        // Method name (login/confirmEmail renames handled in methodNameFor)
        const methodName = this.methodNameFor(route)

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

        // AuthResponse methods feed the session store so Bearer flows right after login
        const requestExpr = (requestCall: string): string =>
            returnType === 'AuthResponse'
                ? `    return this._captureSession(await ${requestCall.trimStart()})`
                : `    return ${requestCall.trimStart()}`

        const bodyBlock = hasBody
            ? requestExpr(`this.request<${returnType}>(
      url,
      {
        method: '${route.method}',
        body: ${route.params.length > 0 ? 'JSON.stringify(data)' : 'data ? JSON.stringify(data) : undefined'},
      },
      nextOptions,
      'Strapi Auth'
    )`)
            : requestExpr(`this.request<${returnType}>(
      url,
      ${route.method !== 'GET' ? `{ method: '${route.method}' }` : '{}'},
      nextOptions,
      'Strapi Auth'
    )`)

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
    return this._captureSession(await this.request<AuthResponse>(url, {}, nextOptions, "Strapi Auth"))
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
    return this._captureSession(await this.request<EmailConfirmationResponse>(
      url,
      {},
      nextOptions,
      'Strapi Auth'
    ))
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

    private generateClientSideHelpers(
        emitted: Set<string>,
        authMode: AuthMode,
    ): string {
        const clearToken = `  /**
   * Clear the stored auth token${authMode === 'refresh' ? ' and the in-memory session' : ''}. Client-side only — does not call the server.${
       authMode === 'refresh'
           ? '\n   * Also parks the automatic refresh (a signed-out client must not\n   * silently resurrect the session from the cookie) until the next\n   * login or explicit refresh().'
           : ''
   }
   */
  async clearToken(): Promise<void> {
    this.config.token = undefined
    const session = getAuthSession(this.config)
    session.accessToken = undefined
    session.refreshToken = undefined
    session.dead = true
  }`

        if (authMode === 'refresh') {
            const refresh = `  /**
   * Rotate the refresh token and obtain a new access token — call once on
   * app startup to bootstrap the session (e.g. after a page reload).
   * Concurrent calls share a single in-flight request.
   * Always attempts the request: unlike the automatic 401 handling it goes
   * through the dead-session latch (and lifts it on success), so use it to
   * resume a session started elsewhere, e.g. a login in another tab.
   * @returns false when there is no live session to resume.
   */
  async refresh(): Promise<boolean> {
    return this._refreshSession()
  }`

            const logout = `  /**
   * POST /api/auth/logout — revoke the server-side session, then clear the
   * in-memory tokens. Best-effort: local state is cleared even when the
   * server call fails (e.g. the session is already dead).
   */
  async logout(): Promise<void> {
    const session = getAuthSession(this.config)
    try {
      await this.request<unknown>(
        \`\${this.config.baseURL}/api/auth/logout\`,
        {
          method: 'POST',
          ...(session.refreshToken && { body: JSON.stringify({ refreshToken: session.refreshToken }) }),
        },
        undefined,
        'Strapi Auth'
      )
    } catch {
      // Best-effort — local cleanup below is what matters.
    } finally {
      await this.clearToken()
    }
  }`

            return `${refresh}\n\n${logout}\n\n${clearToken}`
        }

        // Skip the deprecated logout alias when a real route already emits a
        // \`logout\` method (a server-backed /auth/logout should win over the
        // client-side token clear). clearToken is always emitted.
        if (emitted.has('logout')) return clearToken

        const logoutAlias = `  /**
   * @deprecated Use \`clearToken()\` instead. Will be removed in a future major.
   */
  async logout(): Promise<void> {
    return this.clearToken()
  }`

        return `${clearToken}\n\n${logoutAlias}`
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
