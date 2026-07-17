# strapi-typed-client

[![npm version](https://img.shields.io/npm/v/strapi-typed-client.svg)](https://www.npmjs.com/package/strapi-typed-client) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/BoxLab-Ltd/strapi-typed-client) [![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/BoxLab-Ltd/strapi-typed-client)](https://gitmcp.io/BoxLab-Ltd/strapi-typed-client)

Automatic TypeScript type generation and a fully typed API client for **Strapi v5**. Install a Strapi plugin, run a single CLI command, and get clean TypeScript interfaces plus a ready-to-use fetch client with full autocomplete.

**[Documentation](https://boxlab-ltd.github.io/strapi-typed-client/)**

## Quick Start

### 1. Install

```bash
npm install strapi-typed-client
```

### 2. Enable the Strapi plugin

```typescript
// config/plugins.ts
export default {
    'strapi-typed-client': {
        enabled: true,
    },
}
```

### 3. Generate types

Scaffold the workflow (adds `strapi:generate` / `strapi:check` scripts to your `package.json`), then generate into your source tree and commit the result:

```bash
npx strapi-types init
npm run strapi:generate
```

Or run the generator directly:

```bash
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi
```

Committed types survive reinstalls and show up as reviewable diffs.

### 4. Use

```typescript
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
})

const articles = await strapi.articles.find({
    filters: { title: { $contains: 'hello' } },
    populate: { category: true, cover: true },
})

articles[0].category.name // fully typed
```

## Features

- Clean, flat TypeScript interfaces from your Strapi schema
- Typed API client — `find`, `findOne`, `create`, `update`, `delete`
- Built-in upload plugin support — `client.upload.upload/find/findOne/destroy`
- Typed errors with `isStrapiErrorOf` for discriminated narrowing
- Session auth (Strapi 5.43+ `jwtManagement: 'refresh'`) — auto-detected, with transparent token refresh
- Automatic type inference for `populate` — no manual casting
- Nested populate with unlimited depth
- Separate Input types for create/update (relations as IDs)
- DynamicZone support with union types
- Components and nested components
- Entity-specific filter types
- Next.js integration (`withStrapiTypes`, cache, revalidate, tags)
- Schema hashing — skips regeneration when nothing changed
- Framework-agnostic — works with any TypeScript project

## Session auth (Strapi 5.43+)

When your backend runs users-permissions with `jwtManagement: 'refresh'` (short-lived access JWT + rotating refresh token in an httpOnly cookie), the generator detects it automatically and bakes the session flow into the client — no config needed:

```typescript
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    credentials: 'include', // let the refresh cookie travel
})

await strapi.auth.login({ identifier, password }) // access token kept in memory
await strapi.auth.refresh() // bootstrap the session on page load
await strapi.articles.find() // expired token? refreshed & retried transparently
await strapi.auth.logout() // revoke the session server-side
```

On a 401 — or a 403 from an anonymous request, which is what Strapi actually answers when a protected route is hit with no credentials (the page-reload bootstrap case) — the client performs a single-flight `POST /api/auth/refresh` and retries the request once; a dead session surfaces the original error. The flow is browser-only (server-side code keeps using API tokens) and steps aside whenever you manage the `Authorization` header yourself. Legacy backends are untouched — the generated client behaves exactly as before. See [Authentication](https://boxlab-ltd.github.io/strapi-typed-client/advanced/authentication) for details.

## Requirements

- **Strapi v5**
- **Node.js >= 22**

## Documentation

Full documentation is available at **[boxlab-ltd.github.io/strapi-typed-client](https://boxlab-ltd.github.io/strapi-typed-client/)**:

- [Getting Started](https://boxlab-ltd.github.io/strapi-typed-client/guide/getting-started) — installation, plugin setup, first generation
- [CLI Commands](https://boxlab-ltd.github.io/strapi-typed-client/guide/cli) — generate, check, watch
- [Client Usage](https://boxlab-ltd.github.io/strapi-typed-client/guide/client) — CRUD operations, error handling
- [Populate](https://boxlab-ltd.github.io/strapi-typed-client/guide/populate) — type inference, nested populate
- [Filtering & Sorting](https://boxlab-ltd.github.io/strapi-typed-client/guide/filtering) — filters, pagination, field selection
- [Next.js Integration](https://boxlab-ltd.github.io/strapi-typed-client/guide/nextjs) — auto-generation, cache options
- [Plugin Config](https://boxlab-ltd.github.io/strapi-typed-client/advanced/plugin-config) — requireAuth, endpoints, schema hashing
- [API Reference](https://boxlab-ltd.github.io/strapi-typed-client/reference/api) — full StrapiClient API

## Use with AI tools

The docs are published in agent-friendly formats so AI coding assistants answer questions about this library accurately:

- **llms.txt** — [`/llms.txt`](https://boxlab-ltd.github.io/strapi-typed-client/llms.txt) and [`/llms-full.txt`](https://boxlab-ltd.github.io/strapi-typed-client/llms-full.txt). Add the docs root `https://boxlab-ltd.github.io/strapi-typed-client/` to Cursor (`@Docs`), Continue (`@docs`), or any tool that indexes docs by URL.
- **context7** — indexed at [`/boxlab-ltd/strapi-typed-client`](https://context7.com/boxlab-ltd/strapi-typed-client); the docs site also embeds the context7 chat widget.
- **GitMCP** — point any MCP-capable agent at `https://gitmcp.io/BoxLab-Ltd/strapi-typed-client`:

    ```json
    {
        "mcpServers": {
            "strapi-typed-client": {
                "url": "https://gitmcp.io/BoxLab-Ltd/strapi-typed-client"
            }
        }
    }
    ```

- **DeepWiki** — browse or query the auto-generated wiki at [deepwiki.com/BoxLab-Ltd/strapi-typed-client](https://deepwiki.com/BoxLab-Ltd/strapi-typed-client), or connect its MCP at `https://mcp.deepwiki.com/mcp`.

## Issues & Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/BoxLab-Ltd/strapi-typed-client/issues) on GitHub.

Pull requests are welcome — please open an issue first to discuss what you'd like to change.

## License

MIT
