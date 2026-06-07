# strapi-typed-client

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

Generate into your source tree and commit the result:

```bash
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi
```

Committed types survive reinstalls and show up as reviewable diffs. (Omit `--output` for a quick trial that writes into `node_modules` instead — ephemeral, wiped on reinstall.)

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
- Automatic type inference for `populate` — no manual casting
- Nested populate with unlimited depth
- Separate Input types for create/update (relations as IDs)
- DynamicZone support with union types
- Components and nested components
- Entity-specific filter types
- Next.js integration (`withStrapiTypes`, cache, revalidate, tags)
- Schema hashing — skips regeneration when nothing changed
- Framework-agnostic — works with any TypeScript project

## Requirements

- **Strapi v5**
- **Node.js >= 18**

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

## Issues & Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/BoxLab-Ltd/strapi-typed-client/issues) on GitHub.

Pull requests are welcome — please open an issue first to discuss what you'd like to change.

## License

MIT
