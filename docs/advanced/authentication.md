# Authentication

`strapi-typed-client` supports Bearer token authentication for both the runtime client and the CLI code generator. This page covers all the ways to configure authentication.

## Client Authentication

### Token via Constructor

The most common approach is to pass the API token when creating the client:

```typescript
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    token: 'your-strapi-api-token',
})
```

The token is sent as a `Bearer` token in the `Authorization` header with every request.

### Setting Token Dynamically

You can set or update the token after the client has been created using the `setToken` method:

```typescript
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
})

// Set token later (e.g., after user login)
strapi.setToken('your-strapi-api-token')

// Now all subsequent requests include the token
const data = await strapi.posts.find()
```

This is useful in scenarios where the token is not available at initialization time, such as after a user authenticates.

## Session Auth (Refresh Tokens, Strapi 5.43+)

Strapi 5.43 introduced a session-based JWT mode for users-permissions: a short-lived access JWT (~10 minutes) plus a rotating refresh token. Enable it on the backend:

```typescript
// config/plugins.ts
export default {
    'users-permissions': {
        config: {
            jwtManagement: 'refresh',
        },
    },
}
```

`strapi-typed-client` detects this mode automatically at generation time — the plugin reads `jwtManagement` from the backend config and bakes the resulting mode into the generated client as the exported `AUTH_MODE` constant. Toggling the mode on the backend changes the schema hash, so the next `generate` (or Next.js dev/build) picks it up. No client configuration is required.

### What the client does in refresh mode

- **Access token in memory.** Auth responses that carry a `jwt` (`login`, `register`, OAuth `callback`, `resetPassword`, `changePassword`, `confirmEmail`) store it on the client instance automatically. It is sent as `Authorization: Bearer` on every request and never touches `localStorage`.
- **Transparent refresh on 401.** When a request fails with 401, the client performs `POST /api/auth/refresh` and retries the original request once. Concurrent 401s share a single in-flight refresh (single-flight). If the refresh fails, the session is dropped and the original 401 propagates — your `onError` hook fires as usual. The flow only touches requests it authorized itself: those sent with its own session token, or anonymous ones (the page-load bootstrap case).
- **Dead-session latch.** Once the server definitively rejects a refresh (4xx) — or after `logout()`/`clearToken()` — the automatic refresh goes quiet instead of re-hitting the backend on every subsequent 401. A successful `login()` or an explicit `auth.refresh()` lifts the latch (call `refresh()` to resume a session started in another tab). Transient failures (5xx, network errors) never latch and never drop the tokens.
- **Browser-only.** The entire session flow — token capture, Bearer injection, automatic refresh — is inert in Node. There is no cookie jar for a cookie-based refresh, and silently storing tokens on a client instance that may be shared across requests (e.g. a module-level singleton in Next.js) would leak one user's session into another's requests. Server-side code should keep using long-lived API tokens via `token` (or explicit `setToken`).
- **Plays fair with `onRequest`.** If your hook sets the `Authorization` header, it owns auth for that request — the session flow will not refresh or retry it. The hook also runs for the flow's own `POST /api/auth/refresh`, so infrastructure headers (tenant ids, proxy keys) reach it; the flow never attaches `Authorization` to its refresh request itself.
- **Typed session methods.** `auth.refresh(): Promise<boolean>` and `auth.logout(): Promise<void>` are generated with full types.

### Setup

The refresh token lives in an httpOnly cookie (`strapi_up_refresh`) by default, so the client must send credentials:

```typescript
const strapi = new StrapiClient({
    baseURL: process.env.NEXT_PUBLIC_STRAPI_URL!,
    credentials: 'include',
})
```

Bootstrap the session once on app load — after a page reload the in-memory access token is gone, but the cookie can mint a new one:

```typescript
const isLoggedIn = await strapi.auth.refresh()
// true  → session restored, requests are authenticated
// false → no live session, show the login screen
```

The rest is transparent:

```typescript
await strapi.auth.login({ identifier: 'user@example.com', password: '...' })
await strapi.articles.find() // Bearer attached; auto-refreshed when expired
await strapi.auth.logout() // POST /api/auth/logout + clears local tokens
```

### Non-httpOnly setups

With `sessions.httpOnly: false` on the backend, refresh tokens are returned in the response body instead of a cookie. The client handles this too: `AuthResponse.refreshToken` is captured in memory and sent in the refresh request body. No extra configuration is needed (and `credentials` is not required for this variant).

### Overriding the detected mode

`StrapiClientConfig.authMode` overrides the baked-in default per instance:

```typescript
// A refresh-mode client that should behave like a legacy one (e.g. a
// server-side script using a long-lived API token):
const strapi = new StrapiClient({
    baseURL: '...',
    token: process.env.STRAPI_TOKEN,
    authMode: 'legacy',
})
```

::: info
Legacy backends are entirely unaffected: a client generated against a backend without `jwtManagement: 'refresh'` sends the same requests and headers as before — no refresh calls, no behavior change.
:::

### Using Environment Variables

A recommended pattern is to read the token from an environment variable:

```typescript
const strapi = new StrapiClient({
    baseURL: process.env.NEXT_PUBLIC_STRAPI_URL!,
    token: process.env.STRAPI_TOKEN,
})
```

::: tip
In Next.js, environment variables without the `NEXT_PUBLIC_` prefix are only available on the server side. Since API tokens should remain secret, use `STRAPI_TOKEN` (without the prefix) and only create the client in server components or API routes.
:::

Example `.env.local` file:

```bash
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=your-strapi-api-token-here
```

## Creating API Tokens in Strapi

To generate an API token in the Strapi admin panel:

1. Navigate to **Settings** in the left sidebar.
2. Under **Global Settings**, click **API Tokens**.
3. Click **Create new API Token**.
4. Configure the token:
    - **Name**: A descriptive name (e.g., "Frontend Read-Only").
    - **Token type**: Choose `Read-only`, `Full access`, or `Custom`.
    - **Token duration**: Set an expiration or choose unlimited.
5. Click **Save** and copy the generated token.

::: warning
The token is only displayed once after creation. Store it securely in your environment variables or a secrets manager. If you lose it, you will need to regenerate a new token.
:::

### Token Types

| Type        | Permissions                         | Use Case                      |
| ----------- | ----------------------------------- | ----------------------------- |
| Read-only   | `find` and `findOne` on all content | Public frontend, SSG/ISR      |
| Full access | All CRUD operations on all content  | Admin dashboards, server-side |
| Custom      | Fine-grained per-content-type       | Specific use cases            |

## CLI Authentication

### Plugin `requireAuth` Option

The `strapi-typed-client` plugin can be configured to require authentication for its schema endpoint. When enabled, the CLI must provide a valid token to fetch the schema.

In your Strapi project's `config/plugins.ts`:

```typescript
// config/plugins.ts
export default {
    'strapi-typed-client': {
        enabled: true,
        config: {
            requireAuth: true, // Require Bearer token for schema endpoint
        },
    },
}
```

By default, `requireAuth` is `false` in development and `true` in production (`NODE_ENV === 'production'`). In development, the schema endpoint is publicly accessible for convenience.

### Passing a Token to the CLI

When the plugin has `requireAuth: true`, pass the token using the `--token` flag:

```bash
npx strapi-types generate --token YOUR_API_TOKEN
```

Or using an environment variable:

```bash
STRAPI_TOKEN=your-token npx strapi-types generate
```

::: info
The CLI uses the same Bearer token mechanism as the runtime client. Any API token with at least read access will work for schema fetching.
:::

### Full CLI Example

```bash
# Without auth (requireAuth: false, the default)
npx strapi-types generate --url http://localhost:1337

# With auth (requireAuth: true)
npx strapi-types generate --url http://localhost:1337 --token your-api-token

# Using environment variable
STRAPI_TOKEN=your-api-token npx strapi-types generate --url http://localhost:1337
```

## Security Recommendations

### Development

During local development, `requireAuth` defaults to `false` so you can regenerate types without managing tokens:

```typescript
// config/plugins.ts
export default {
    'strapi-typed-client': {
        enabled: true,
        config: {
            requireAuth: false,
        },
    },
}
```

### Production

In production, `requireAuth` defaults to `true` automatically. You can also set it explicitly:

```typescript
// config/plugins.ts
export default {
    'strapi-typed-client': {
        enabled: true,
        config: {
            requireAuth: true,
        },
    },
}
```

::: warning
The schema endpoint exposes the complete structure of your content types, including field names, relation targets, and component structures. In production environments, enable `requireAuth` to prevent this information from being publicly accessible.
:::

### CI/CD Pipelines

When generating types in a CI/CD pipeline, store the token as a secret and pass it to the CLI:

```yaml
# GitHub Actions example
- name: Generate Strapi types
  run: npx strapi-types generate --url ${{ secrets.STRAPI_URL }} --token ${{ secrets.STRAPI_TOKEN }}
```

## Authentication Flow Summary

```
┌─────────────────────────────────────────────────┐
│                   Strapi Server                  │
│                                                  │
│  config/plugins.ts                               │
│  ┌─────────────────────────────────────────┐     │
│  │ requireAuth: true/false                 │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  GET /api/strapi-typed-client/schema             │
│  ← Authorization: Bearer <token>                 │
│                                                  │
│  GET /api/strapi-typed-client/schema-hash        │
│  ← Authorization: Bearer <token>                 │
│                                                  │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────────┐
        │            │                │
   CLI Generate   StrapiClient    CI/CD Pipeline
   --token flag   { token: '...' }  env secret
```
