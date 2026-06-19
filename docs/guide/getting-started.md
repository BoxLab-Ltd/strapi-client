# Getting Started

This guide walks you through installing `strapi-typed-client`, registering the Strapi plugin, generating types, and making your first typed API call.

## Requirements

- **Strapi v5** (Strapi v4 is not supported)
- **Node.js >= 22**

## Installation

Install the package in both your Strapi backend and your frontend project:

::: code-group

```bash [npm]
npm install strapi-typed-client
```

```bash [yarn]
yarn add strapi-typed-client
```

```bash [pnpm]
pnpm add strapi-typed-client
```

:::

## Register the Strapi Plugin

The package includes a Strapi plugin that exposes your schema via a REST endpoint. Since the `strapi` field in `package.json` declares it as a plugin, Strapi auto-discovers it — no manual `import` or `resolve` needed.

Enable it in your Strapi project's `config/plugins.ts`:

```ts
// config/plugins.ts
export default {
    'strapi-typed-client': {
        enabled: true,
        config: {
            requireAuth: false, // default: false in dev, true in production
        },
    },
}
```

After adding the config, **restart your Strapi server**.

::: warning
When `requireAuth` is not set, the plugin defaults to requiring auth in production (`NODE_ENV === 'production'`) and not requiring it in development. Set it explicitly if you need a specific behavior.
:::

### Plugin Endpoints

Once the plugin is active, two endpoints become available:

| Endpoint                                   | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `GET /api/strapi-typed-client/schema`      | Returns the full content-type schema as JSON + hash      |
| `GET /api/strapi-typed-client/schema-hash` | Returns only the schema hash (used for change detection) |

::: tip
These endpoints are used by the CLI to fetch your schema. You do not need to call them manually.
:::

### Creating an API Token

If you enable `requireAuth: true` (or deploy to production where it's enabled by default), you need an API token. To create one:

1. Open the Strapi admin panel.
2. Go to **Settings** → **Global Settings** → **API Tokens**.
3. Click **Create new API Token**.
4. Set a **Name** (e.g., "Types Generator"), choose **Token type** — `Read-only` is sufficient for schema fetching.
5. Click **Save** and copy the token immediately — it is shown only once.

Pass the token to the CLI:

```bash
npx strapi-types generate --url http://localhost:1337 --token YOUR_TOKEN
```

Or via environment variable:

```bash
STRAPI_TOKEN=your-token npx strapi-types generate
```

See [Authentication](/advanced/authentication) for more details.

## Generate Types

With Strapi running, generate the types and a typed client into your project, and commit the result:

```bash
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi
```

This writes three files into `./src/strapi`:

| File       | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `types.*`  | TypeScript interfaces for all content types and components     |
| `client.*` | A typed `StrapiClient` class with methods for every collection |
| `index.*`  | Re-exports everything from types and client                    |

Add a path alias once so you can import them from anywhere in your app:

```json
// tsconfig.json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

```ts
import { StrapiClient } from '@/strapi'
```

Committing the generated code keeps it through reinstalls and surfaces schema changes as reviewable diffs. The client is self-contained, so your app gains no runtime dependency on `strapi-typed-client`.

`--format` defaults to compiled `.js` + `.d.ts` (no build step required). Pass `--format ts` to emit raw `.ts` for bundlers and monorepos that compile their own sources. Either way, `--output` is required and must point at your source tree.

::: warning Regenerate after upgrading
The generated client records the `strapi-typed-client` version that produced it. After upgrading the package, run `generate` again so committed types pick up generator fixes — `strapi-types check` warns when they drift.
:::

## Quick Usage

Once types are generated, create a client and start making typed API calls:

```ts
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
})

// Fully typed — autocomplete for filters, sort, populate
const articles = await strapi.articles.find({
    filters: { title: { $contains: 'hello' } },
    sort: ['createdAt:desc'],
    pagination: { page: 1, pageSize: 10 },
})

console.log(articles) // Article[]
```

::: info Import paths in these docs
Examples import from `@/strapi` — the directory you generated into.
:::

::: info
The client uses the global `fetch` by default. In Next.js, this means you automatically get all of Next.js's fetch optimizations (caching, deduplication, revalidation). See the [Next.js integration guide](/guide/nextjs) for details.
:::

## Next Steps

- [CLI Commands Reference](/guide/cli) — all CLI options and environment variables
- [Client Usage](/guide/client) — CRUD operations, auth, error handling
- [Populate & Type Inference](/guide/populate) — nested populate with automatic type narrowing
- [Next.js Integration](/guide/nextjs) — auto-generation, cache options, ISR
