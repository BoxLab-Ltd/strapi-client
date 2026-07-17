import { describe, it, expect } from 'vitest'
import { AuthApiGenerator } from '../../../src/generator/auth-api-generator.js'
import type { ParsedRoute } from '../../../src/shared/route-types.js'

const generator = new AuthApiGenerator()

describe('generateAuthTypes', () => {
    const result = generator.generateAuthTypes()

    it('should generate LoginCredentials interface', () => {
        expect(result).toContain('export interface LoginCredentials {')
        expect(result).toContain('  identifier: string')
        expect(result).toContain('  password: string')
    })

    it('should generate RegisterData interface with referralCode and referralSource', () => {
        expect(result).toContain('export interface RegisterData {')
        expect(result).toContain('  username: string')
        expect(result).toContain('  email: string')
        expect(result).toContain('  password: string')
        expect(result).toContain('  referralCode?: string')
        expect(result).toContain('  referralSource?: "code" | "link" | "share"')
    })

    it('should generate AuthResponse interface with jwt and user', () => {
        expect(result).toContain('export interface AuthResponse {')
        expect(result).toContain('  jwt: string')
        expect(result).toContain('  user: User')
    })

    it('should generate ForgotPasswordData interface', () => {
        expect(result).toContain('export interface ForgotPasswordData {')
        expect(result).toContain('  email: string')
    })

    it('should generate ResetPasswordData interface', () => {
        expect(result).toContain('export interface ResetPasswordData {')
        expect(result).toContain('  code: string')
        expect(result).toContain('  password: string')
        expect(result).toContain('  passwordConfirmation: string')
    })

    it('should generate ChangePasswordData interface', () => {
        expect(result).toContain('export interface ChangePasswordData {')
        expect(result).toContain('  currentPassword: string')
        expect(result).toContain('  password: string')
        expect(result).toContain('  passwordConfirmation: string')
    })

    it('should generate EmailConfirmationResponse interface', () => {
        expect(result).toContain('export interface EmailConfirmationResponse {')
        expect(result).toContain('  jwt: string')
        expect(result).toContain('  user: User')
    })

    it('should generate ForgotPasswordResponse interface (ok: true)', () => {
        expect(result).toContain('export interface ForgotPasswordResponse {')
        expect(result).toContain('  ok: true')
    })

    it('should generate SendEmailConfirmationResponse interface', () => {
        expect(result).toContain(
            'export interface SendEmailConfirmationResponse {',
        )
        expect(result).toContain('  email: string')
        expect(result).toContain('  sent: boolean')
    })
})

describe('generateAuthApiClass - default routes (no args)', () => {
    const result = generator.generateAuthApiClass()

    it('should generate AuthAPI class extending BaseAPI', () => {
        expect(result).toContain('class AuthAPI extends BaseAPI {')
        expect(result).toContain('constructor(config: StrapiClientConfig)')
        expect(result).toContain('super(config)')
    })

    it('should generate login method (POST /auth/local)', () => {
        expect(result).toContain('async login(')
        expect(result).toContain('data: LoginCredentials')
        expect(result).toContain('Promise<AuthResponse>')
        expect(result).toContain('POST /auth/local')
        expect(result).toContain("method: 'POST'")
        expect(result).toContain('body: JSON.stringify(data)')
    })

    it('should generate register method (POST /auth/local/register)', () => {
        expect(result).toContain('async register(')
        expect(result).toContain('data: RegisterData')
        expect(result).toContain('Promise<AuthResponse>')
        expect(result).toContain('POST /auth/local/register')
        expect(result).toContain('body: JSON.stringify(data)')
    })

    it('should generate me() with 3 overloads', () => {
        // Overload 1: TPopulate + TFields generics, SelectFields return
        expect(result).toContain(
            "me<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>(",
        )
        expect(result).toContain(
            '    params: { populate: TPopulate } & QueryParams<User, UserFilters, TPopulate, TFields>,',
        )
        expect(result).toContain(
            '  ): Promise<SelectFields<GetPopulated<User, TPopulate>, User, TFields>>',
        )

        // Overload 2: populate '*' | true, SelectFields return
        expect(result).toContain(
            "    params: { populate: '*' | true } & QueryParams<User, UserFilters, '*' | true, TFields>,",
        )
        expect(result).toContain(
            "  ): Promise<SelectFields<GetPopulated<User, '*'>, User, TFields>>",
        )

        // Overload 3: general case, SelectFields return
        expect(result).toContain(
            "    params?: QueryParams<User, UserFilters, UserPopulateParam | (keyof UserPopulateParam & string)[] | '*' | boolean, TFields>,",
        )
        expect(result).toContain(
            '  ): Promise<SelectFields<User, User, TFields>>',
        )

        // Implementation signature
        expect(result).toContain(
            'async me(params?: any, nextOptions?: any): Promise<any>',
        )
    })

    it('should generate updateMe() with 3 overloads', () => {
        // Overload 1: with data: Partial<User> and populate object
        expect(result).toContain(
            "updateMe<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>(",
        )
        expect(result).toContain('    data: UserUpdateInput,')
        expect(result).toContain(
            '    params: { populate: TPopulate } & QueryParams<User, UserFilters, TPopulate, TFields>,',
        )

        // Overload 2: with populate '*' or true
        expect(result).toContain(
            "  ): Promise<SelectFields<GetPopulated<User, '*'>, User, TFields>>",
        )

        // Overload 3: general case
        expect(result).toContain(
            "    params?: QueryParams<User, UserFilters, UserPopulateParam | (keyof UserPopulateParam & string)[] | '*' | boolean, TFields>,",
        )

        // Implementation signature
        expect(result).toContain(
            'async updateMe(data: UserUpdateInput, params?: any, nextOptions?: any): Promise<any>',
        )
        expect(result).toContain("method: 'PUT'")
        expect(result).toContain('body: JSON.stringify(data)')
    })

    it('should generate callback method with provider and search params', () => {
        expect(result).toContain('async callback(')
        expect(result).toContain('provider: string,')
        expect(result).toContain('search?: string,')
        expect(result).toContain('nextOptions?: NextOptions')
        expect(result).toContain('): Promise<AuthResponse>')
        expect(result).toContain('OAuth callback')
        expect(result).toContain('GET /auth/:provider/callback')
    })

    it('should generate clearToken method with a deprecated logout alias', () => {
        expect(result).toContain('async clearToken(): Promise<void>')
        expect(result).toContain('this.config.token = undefined')
        // logout stays as a thin @deprecated delegate
        const logoutIdx = result.indexOf('async logout(): Promise<void>')
        expect(logoutIdx).toBeGreaterThan(-1)
        expect(result.slice(0, logoutIdx)).toContain('@deprecated')
        expect(result.slice(logoutIdx)).toContain('return this.clearToken()')
    })

    it('should generate forgotPassword method', () => {
        expect(result).toContain('async forgotPassword(')
        expect(result).toContain('data: ForgotPasswordData')
        expect(result).toContain('Promise<ForgotPasswordResponse>')
        expect(result).toContain('POST /auth/forgot-password')
        expect(result).toContain('body: JSON.stringify(data)')
    })

    it('should generate resetPassword method', () => {
        expect(result).toContain('async resetPassword(')
        expect(result).toContain('data: ResetPasswordData')
        expect(result).toContain('Promise<AuthResponse>')
        expect(result).toContain('POST /auth/reset-password')
    })

    it('should generate changePassword method', () => {
        expect(result).toContain('async changePassword(')
        expect(result).toContain('data: ChangePasswordData')
        expect(result).toContain('Promise<AuthResponse>')
        expect(result).toContain('POST /auth/change-password')
    })

    it('should generate confirmEmail method', () => {
        expect(result).toContain(
            'async confirmEmail(confirmationToken: string, nextOptions?: NextOptions): Promise<EmailConfirmationResponse>',
        )
        expect(result).toContain('GET /auth/email-confirmation')
    })

    it('should generate sendEmailConfirmation method', () => {
        expect(result).toContain(
            'async sendEmailConfirmation(email: string): Promise<SendEmailConfirmationResponse>',
        )
        expect(result).toContain('POST /auth/send-email-confirmation')
        expect(result).toContain('body: JSON.stringify({ email })')
    })
})

describe('generateAuthApiClass - dynamic (with routes)', () => {
    const authRoutes: ParsedRoute[] = [
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

    const userRoutes: ParsedRoute[] = [
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
        {
            method: 'GET',
            path: '/users/count',
            handler: 'user.count',
            controller: 'user',
            action: 'count',
            params: [],
        },
    ]

    const result = generator.generateAuthApiClass(authRoutes, userRoutes)

    it('should generate dynamic AuthAPI from actual routes', () => {
        expect(result).toContain('class AuthAPI extends BaseAPI {')
        expect(result).toContain('generated from actual routes')
        expect(result).toContain('constructor(config: StrapiClientConfig)')
        expect(result).toContain('super(config)')
    })

    it('should generate login method (renamed from auth.callback for POST /auth/local)', () => {
        expect(result).toContain('async login(')
        expect(result).toContain('data: LoginCredentials')
        expect(result).toContain('Promise<AuthResponse>')
        expect(result).toContain("method: 'POST'")
    })

    it('should generate register method', () => {
        expect(result).toContain('async register(')
        expect(result).toContain('data: RegisterData')
        expect(result).toContain('Promise<AuthResponse>')
    })

    it('dynamic me() should have 3 overloads with TFields + SelectFields', () => {
        // Overload 1: with populate object
        expect(result).toContain(
            "me<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>(",
        )
        expect(result).toContain(
            '    params: { populate: TPopulate } & QueryParams<User, UserFilters, TPopulate, TFields>,',
        )
        expect(result).toContain(
            '  ): Promise<SelectFields<GetPopulated<User, TPopulate>, User, TFields>>',
        )

        // Overload 2: with populate '*' or true
        expect(result).toContain(
            "    params: { populate: '*' | true } & QueryParams<User, UserFilters, '*' | true, TFields>,",
        )

        // Overload 3: general case
        expect(result).toContain(
            '  ): Promise<SelectFields<User, User, TFields>>',
        )

        // Implementation
        expect(result).toContain(
            'async me(params?: any, nextOptions?: any): Promise<any>',
        )
    })

    it('dynamic updateMe() should have 3 overloads with TFields + SelectFields', () => {
        // Overload 1: with data and populate object
        expect(result).toContain(
            "updateMe<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>(",
        )
        expect(result).toContain('    data: UserUpdateInput,')

        // Implementation
        expect(result).toContain(
            'async updateMe(data: UserUpdateInput, params?: any, nextOptions?: any): Promise<any>',
        )
        expect(result).toContain("method: 'PUT'")
        expect(result).toContain('body: JSON.stringify(data)')
    })

    it('should generate callback method with provider param for OAuth', () => {
        expect(result).toContain('async callback(')
        expect(result).toContain('provider: string,')
        expect(result).toContain('search?: string,')
        expect(result).toContain('Promise<AuthResponse>')
        expect(result).toContain('OAuth callback with query string support')
    })

    it('should generate count method from user routes', () => {
        expect(result).toContain('async count(')
        expect(result).toContain('GET /users/count')
        expect(result).toContain('Handler: user.count')
    })

    it('should NOT generate find/findOne/create/update/delete from user routes', () => {
        const userCrudRoutes: ParsedRoute[] = [
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
            {
                method: 'GET',
                path: '/users/count',
                handler: 'user.count',
                controller: 'user',
                action: 'count',
                params: [],
            },
            {
                method: 'GET',
                path: '/users',
                handler: 'user.find',
                controller: 'user',
                action: 'find',
                params: [],
            },
            {
                method: 'GET',
                path: '/users/:id',
                handler: 'user.findOne',
                controller: 'user',
                action: 'findOne',
                params: ['id'],
            },
            {
                method: 'POST',
                path: '/users',
                handler: 'user.create',
                controller: 'user',
                action: 'create',
                params: [],
            },
            {
                method: 'PUT',
                path: '/users/:id',
                handler: 'user.update',
                controller: 'user',
                action: 'update',
                params: ['id'],
            },
            {
                method: 'DELETE',
                path: '/users/:id',
                handler: 'user.delete',
                controller: 'user',
                action: 'delete',
                params: ['id'],
            },
        ]

        const resultWithCrud = generator.generateAuthApiClass(
            authRoutes,
            userCrudRoutes,
        )

        // Special routes should be present
        expect(resultWithCrud).toContain('async me(')
        expect(resultWithCrud).toContain('async updateMe(')
        expect(resultWithCrud).toContain('async count(')

        // Standard CRUD routes should NOT be present in AuthAPI
        expect(resultWithCrud).not.toMatch(/async find\(/)
        expect(resultWithCrud).not.toMatch(/async findOne\(/)
        expect(resultWithCrud).not.toMatch(/async create\(/)
        expect(resultWithCrud).not.toMatch(/async update\(/)
        expect(resultWithCrud).not.toMatch(/async delete\(/)
    })
})

describe('generateAuthApiClass - dynamic with full plugin:: handler format', () => {
    const authRoutes: ParsedRoute[] = [
        {
            method: 'POST',
            path: '/auth/local',
            handler: 'plugin::users-permissions.auth.callback',
            controller: 'auth',
            action: 'callback',
            params: [],
        },
        {
            method: 'POST',
            path: '/auth/local/register',
            handler: 'plugin::users-permissions.auth.register',
            controller: 'auth',
            action: 'register',
            params: [],
        },
        {
            method: 'GET',
            path: '/auth/:provider/callback',
            handler: 'plugin::users-permissions.auth.callback',
            controller: 'auth',
            action: 'callback',
            params: ['provider'],
        },
    ]

    const userRoutes: ParsedRoute[] = [
        {
            method: 'GET',
            path: '/users/me',
            handler: 'plugin::users-permissions.user.me',
            controller: 'user',
            action: 'me',
            params: [],
        },
    ]

    const result = generator.generateAuthApiClass(authRoutes, userRoutes)

    it('should rename POST /auth/local callback to login even with full handler', () => {
        expect(result).toContain('async login(')
        expect(result).toContain('data: LoginCredentials')
        expect(result).toContain('Promise<AuthResponse>')
    })

    it('should generate OAuth callback method with full handler', () => {
        expect(result).toContain('async callback(')
        expect(result).toContain('provider: string')
    })

    it('should generate register method with full handler', () => {
        expect(result).toContain('async register(')
        expect(result).toContain('data: RegisterData')
    })

    it('should generate me method with full handler', () => {
        expect(result).toContain('async me(')
    })
})

describe('generateAuthApiClass — logout dedup (route vs client-side helper)', () => {
    const userRoutes: ParsedRoute[] = [
        {
            method: 'GET',
            path: '/users/me',
            handler: 'plugin::users-permissions.user.me',
            controller: 'user',
            action: 'me',
            params: [],
        },
    ]

    it('emits exactly one logout when a route already provides it (clearToken still present)', () => {
        const authRoutes: ParsedRoute[] = [
            {
                method: 'POST',
                path: '/auth/logout',
                handler: 'plugin::users-permissions.auth.logout',
                controller: 'auth',
                action: 'logout',
                params: [],
            },
        ]
        const result = generator.generateAuthApiClass(authRoutes, userRoutes)
        expect((result.match(/async logout\(/g) || []).length).toBe(1)
        expect((result.match(/async clearToken\(/g) || []).length).toBe(1)
    })

    it('still emits the deprecated logout alias when no route provides logout', () => {
        const authRoutes: ParsedRoute[] = [
            {
                method: 'POST',
                path: '/auth/forgot-password',
                handler: 'auth.forgotPassword',
                controller: 'auth',
                action: 'forgotPassword',
                params: [],
            },
        ]
        const result = generator.generateAuthApiClass(authRoutes, userRoutes)
        expect((result.match(/async logout\(/g) || []).length).toBe(1)
        expect(result).toContain('@deprecated')
        expect(result).toContain('return this.clearToken()')
    })
})

describe('generateAuthTypes — refresh mode', () => {
    it('adds optional refreshToken to AuthResponse and EmailConfirmationResponse', () => {
        const result = generator.generateAuthTypes('refresh')
        const authResponse = result.slice(
            result.indexOf('export interface AuthResponse {'),
            result.indexOf('export interface ForgotPasswordData {'),
        )
        expect(authResponse).toContain('refreshToken?: string')
        const emailConfirmation = result.slice(
            result.indexOf('export interface EmailConfirmationResponse {'),
            result.indexOf('export interface ForgotPasswordResponse {'),
        )
        expect(emailConfirmation).toContain('refreshToken?: string')
    })

    it('legacy mode does not mention refreshToken', () => {
        expect(generator.generateAuthTypes()).not.toContain('refreshToken')
    })
})

describe('generateAuthApiClass — refresh mode', () => {
    const result = generator.generateAuthApiClass([], [], 'refresh')

    it('emits typed refresh(): Promise<boolean> delegating to the shared single-flight', () => {
        expect(result).toContain('async refresh(): Promise<boolean> {')
        expect(result).toContain('return this._refreshSession()')
    })

    it('emits a real logout posting to /api/auth/logout and clearing local state', () => {
        expect(result).toContain('async logout(): Promise<void> {')
        expect(result).toContain('/api/auth/logout')
        expect(result).toContain('await this.clearToken()')
        expect(result).not.toContain('@deprecated Use `clearToken()`')
    })

    it('filters discovered refresh/logout routes so the typed versions win', () => {
        const authRoutes: ParsedRoute[] = [
            {
                method: 'POST',
                path: '/auth/refresh',
                handler: 'plugin::users-permissions.auth.refresh',
                controller: 'auth',
                action: 'refresh',
                params: [],
            },
            {
                method: 'POST',
                path: '/auth/logout',
                handler: 'plugin::users-permissions.auth.logout',
                controller: 'auth',
                action: 'logout',
                params: [],
            },
        ]
        const generated = generator.generateAuthApiClass(
            authRoutes,
            [],
            'refresh',
        )
        expect((generated.match(/async refresh\(/g) || []).length).toBe(1)
        expect((generated.match(/async logout\(/g) || []).length).toBe(1)
        expect(generated).toContain('async refresh(): Promise<boolean> {')
        // the generic any-typed route method must not survive
        expect(generated).not.toContain('async refresh(data?: any')
    })

    it('login captures the session tokens', () => {
        expect(result).toContain(
            'return this._captureSession(await this.request<AuthResponse>(',
        )
    })

    it('legacy mode emits no refresh() and keeps the deprecated logout alias', () => {
        const legacy = generator.generateAuthApiClass()
        expect(legacy).not.toContain('async refresh(')
        expect(legacy).toContain('@deprecated Use `clearToken()`')
    })
})

describe('generateAuthApiClass — refresh mode clearToken dedup', () => {
    it('filters a discovered clearToken route so the client-side helper wins', () => {
        const authRoutes: ParsedRoute[] = [
            {
                method: 'POST',
                path: '/auth/clear-token',
                handler: 'plugin::users-permissions.auth.clearToken',
                controller: 'auth',
                action: 'clearToken',
                params: [],
            },
        ]
        const generated = generator.generateAuthApiClass(
            authRoutes,
            [],
            'refresh',
        )
        expect((generated.match(/async clearToken\(/g) || []).length).toBe(1)
    })
})

describe('generateAuthApiClass — session management route typing', () => {
    const sessionRoutes: ParsedRoute[] = [
        {
            method: 'GET',
            path: '/auth/sessions',
            handler: 'plugin::users-permissions.auth.getSessions',
            controller: 'auth',
            action: 'getSessions',
            params: [],
        },
        {
            method: 'DELETE',
            path: '/auth/sessions/:sessionId',
            handler: 'plugin::users-permissions.auth.revokeSession',
            controller: 'auth',
            action: 'revokeSession',
            params: ['sessionId'],
        },
    ]

    it('emits the session entry/response types in both modes', () => {
        for (const mode of [undefined, 'refresh'] as const) {
            const types = generator.generateAuthTypes(mode)
            expect(types).toContain('export interface AuthSessionEntry {')
            expect(types).toContain('  current: boolean')
            expect(types).toContain('  lastActiveAt?: string')
            expect(types).toContain('export interface AuthSessionsResponse {')
            expect(types).toContain('  data: AuthSessionEntry[]')
            expect(types).toContain('export interface RevokeSessionResponse {')
        }
    })

    it('types getSessions and revokeSession instead of any (refresh mode)', () => {
        const out = generator.generateAuthApiClass(sessionRoutes, [], 'refresh')
        expect(out).toContain(
            'async getSessions(nextOptions?: NextOptions): Promise<AuthSessionsResponse>',
        )
        expect(out).toContain(
            'async revokeSession(sessionId: string, nextOptions?: NextOptions): Promise<RevokeSessionResponse>',
        )
        expect(out).not.toContain(
            'getSessions(nextOptions?: NextOptions): Promise<any>',
        )
    })

    it('types them identically in legacy mode (routes exist there too, answering 404)', () => {
        const out = generator.generateAuthApiClass(sessionRoutes, [])
        expect(out).toContain('Promise<AuthSessionsResponse>')
        expect(out).toContain('Promise<RevokeSessionResponse>')
    })
})
