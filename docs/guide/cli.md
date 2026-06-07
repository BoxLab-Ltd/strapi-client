# CLI Reference

The `strapi-types` CLI fetches your Strapi schema and generates TypeScript types and a typed client.

## Commands

### `generate`

Connects to your Strapi instance, fetches the schema, and generates TypeScript output files.

```bash
npx strapi-types generate --url http://localhost:1337
```

**Options:**

| Option     | Description                                                        | Default                                 |
| ---------- | ------------------------------------------------------------------ | --------------------------------------- |
| `--url`    | Strapi server URL                                                  | `STRAPI_URL` env var                    |
| `--token`  | API token for authenticated access                                 | `STRAPI_TOKEN` env var                  |
| `--output` | Output directory for generated files                               | `node_modules/strapi-typed-client/dist` |
| `--silent` | Suppress all console output                                        | `false`                                 |
| `--force`  | Regenerate even if schema has not changed                          | `false`                                 |
| `--format` | Output format: `js` (compiled `.js` + `.d.ts`) or `ts` (raw `.ts`) | `js`                                    |

**Examples:**

```bash
# Generate into your source tree and commit it (recommended)
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi

# Quick trial — write into node_modules (ephemeral)
npx strapi-types generate --url http://localhost:1337

# With authentication
npx strapi-types generate --url http://localhost:1337 --token abc123

# Force regeneration (ignore schema hash)
npx strapi-types generate --url http://localhost:1337 --force

# Emit raw TypeScript instead of compiled .js + .d.ts
npx strapi-types generate --output ./src/strapi --format ts
```

::: warning `--output` default is ephemeral
Without `--output`, files are written into `node_modules/strapi-typed-client/dist` — convenient (you import from the bare `'strapi-typed-client'`), but a reinstall wipes them and you'll need to regenerate. For durable, reviewable types, point `--output` at your source tree and commit the result.
:::

::: tip `--format js` vs `--format ts`
`js` (default) emits compiled `.js` + `.d.ts` — runs anywhere, including plain JavaScript projects with no build step. `ts` emits raw `.ts` for bundlers and monorepos that compile their own sources (Turborepo, Nx, pnpm workspaces); it must live **outside** `node_modules`, and your `tsconfig.json` needs `moduleResolution: "bundler"` or `"nodenext"` so the `.js`-extension imports resolve to `.ts` source. Both can be committed.
:::

### `check`

Compares the schema hash baked into your generated client against the live Strapi schema, and reports whether your types are up to date. Useful in CI.

```bash
npx strapi-types check --url http://localhost:1337 --output ./src/strapi
```

It will:

1. Exit `1` with a clear message if no generated client is found (run `generate` first)
2. Warn if the generated client was produced by a different `strapi-typed-client` version than the one installed
3. Fetch the remote schema hash and compare it to the local one
4. Exit `0` when in sync, `1` when out of sync

Pass `--output` to point at the directory you generated into (defaults to `node_modules/strapi-typed-client/dist`).

### `watch`

Connects to the Strapi SSE stream and automatically regenerates types when the schema changes.

```bash
npx strapi-types watch --url http://localhost:1337
```

This is useful during development. The command runs continuously and:

1. Opens an SSE connection to `/api/strapi-typed-client/schema-watch`
2. Receives the current schema hash on connect
3. Regenerates types only when the hash differs from the local one
4. Automatically reconnects if the Strapi server restarts

::: tip
For Next.js projects, consider using the `withStrapiTypes` wrapper instead of running `watch` manually. See the [Next.js guide](/guide/nextjs).
:::

## Environment Variables

Instead of passing flags on every invocation, you can set environment variables:

| Variable       | Equivalent Flag |
| -------------- | --------------- |
| `STRAPI_URL`   | `--url`         |
| `STRAPI_TOKEN` | `--token`       |

**Example with a `.env` file:**

```bash
# .env
STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=your-api-token-here
```

```bash
# Now you can run without flags
npx strapi-types generate
```

::: warning
CLI flags take precedence over environment variables. If both are provided, the flag value is used.
:::

## Schema Hashing

The CLI uses schema hashing to avoid unnecessary regeneration. When you run `generate`:

1. The CLI fetches the schema hash from `/api/strapi-typed-client/schema-hash`
2. It compares the hash against the previously stored hash
3. If the hashes match, generation is skipped (unless `--force` is used)
4. If the hashes differ, types are regenerated and the new hash is stored

This makes it safe to run `generate` in CI or on every build without wasting time on unchanged schemas.

```bash
# First run — generates types
npx strapi-types generate --url http://localhost:1337

# Second run — skipped, schema unchanged
npx strapi-types generate --url http://localhost:1337

# Force regeneration regardless of hash
npx strapi-types generate --url http://localhost:1337 --force
```

## Usage in package.json Scripts

A typical setup in your frontend project:

```json
{
    "scripts": {
        "generate-types": "strapi-types generate",
        "check-strapi": "strapi-types check",
        "dev": "strapi-types watch & next dev",
        "build": "strapi-types generate --force && next build"
    }
}
```
