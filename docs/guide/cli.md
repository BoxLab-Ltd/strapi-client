# CLI Reference

The `strapi-types` CLI fetches your Strapi schema and generates TypeScript types and a typed client.

## Commands

### `init`

Sets up the committed-codegen workflow in your project: validates your choices and adds `strapi:generate` / `strapi:check` scripts to `package.json`.

```bash
npx strapi-types init
```

Run it from your project root (where `package.json` lives). In an interactive terminal it asks for the Strapi URL, output directory, and format — pass flags to skip individual questions, or `--yes` (or `--silent`) to accept the defaults. In CI and other non-interactive shells it never prompts and falls back to the defaults.

**Options:**

| Option     | Description                                                                                                                                                                          | Default        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `--url`    | Strapi URL to bake into the scripts. Only an explicitly passed (or typed) URL is written — with `STRAPI_URL` or the default, scripts omit `--url` so the environment stays in charge | omitted        |
| `--output` | Output directory for generated files (your source tree, committed)                                                                                                                   | `./src/strapi` |
| `--format` | `js` (compiled `.js` + `.d.ts`) or `ts` (raw `.ts`)                                                                                                                                  | `js`           |
| `--yes`    | Accept defaults for anything not passed; never prompt                                                                                                                                | `false`        |
| `--force`  | Overwrite conflicting `strapi:*` scripts (other keys are never touched)                                                                                                              | `false`        |
| `--silent` | Suppress output messages; implies `--yes` (never prompts)                                                                                                                            | `false`        |

What it writes:

```json
{
    "scripts": {
        "strapi:generate": "strapi-types generate --output ./src/strapi",
        "strapi:check": "strapi-types check --output ./src/strapi"
    }
}
```

The command is idempotent — re-running it with the same answers changes nothing, and your `package.json` indentation, line endings, and trailing newline are preserved (minified files are reformatted with 2-space indentation). If a `strapi:*` script already exists with a different value, `init` leaves it untouched, prints both versions, and exits `1`; re-run with `--force` to overwrite.

### `generate`

Connects to your Strapi instance, fetches the schema, and generates TypeScript output files.

```bash
npx strapi-types generate --url http://localhost:1337
```

**Options:**

| Option           | Description                                                                                | Default                                          |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `--url`          | Strapi server URL                                                                          | `STRAPI_URL` env or `http://localhost:1337`      |
| `--token`        | API token for authenticated access                                                         | `STRAPI_TOKEN` env var                           |
| `--output`       | Output directory for generated files                                                       | required (your source tree, e.g. `./src/strapi`) |
| `--silent`       | Suppress all console output                                                                | `false`                                          |
| `--force`        | Regenerate even if schema has not changed                                                  | `false`                                          |
| `--format`       | Output format: `js` (compiled `.js` + `.d.ts`) or `ts` (raw `.ts`)                         | `js`                                             |
| `--no-typecheck` | Write output even if it fails type-checking (escape hatch for strict-only false positives) | type-checking on                                 |

**Examples:**

```bash
# Generate into your source tree and commit it
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi

# With authentication
npx strapi-types generate --url http://localhost:1337 --token abc123 --output ./src/strapi

# Force regeneration (ignore schema hash)
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi --force

# Emit raw TypeScript instead of compiled .js + .d.ts
npx strapi-types generate --output ./src/strapi --format ts
```

::: warning `--output` is required
`--output` must point at a directory in your source tree (e.g. `./src/strapi`). Generate the client there and commit the result so your types are durable and reviewable. You then import from that directory (e.g. `'@/strapi'`).
:::

::: tip `--format js` vs `--format ts`
`js` (default) emits compiled `.js` + `.d.ts` — runs anywhere, including plain JavaScript projects with no build step. `ts` emits raw `.ts` for bundlers and monorepos that compile their own sources (Turborepo, Nx, pnpm workspaces); your `tsconfig.json` needs `moduleResolution: "bundler"` or `"nodenext"` so the `.js`-extension imports resolve to `.ts` source. Both are written into your source tree and committed.
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

Pass `--output` to point at the directory you generated into. It is required.

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
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi

# Second run — skipped, schema unchanged
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi

# Force regeneration regardless of hash
npx strapi-types generate --url http://localhost:1337 --output ./src/strapi --force
```

## Usage in package.json Scripts

`strapi-types init` sets this up for you:

```json
{
    "scripts": {
        "strapi:generate": "strapi-types generate --output ./src/strapi",
        "strapi:check": "strapi-types check --output ./src/strapi"
    }
}
```

Run `npm run strapi:generate` after schema changes, and `npm run strapi:check` in CI to catch drift.

::: tip
Earlier versions of this page suggested `generate-types` / `check-strapi` script names — `init` writes the namespaced pair instead, so remove the old entries if you followed that recipe. For Next.js projects, prefer the [`withStrapiTypes` wrapper](/guide/nextjs) for dev/build regeneration; `strapi:check` remains useful in CI either way.
:::
