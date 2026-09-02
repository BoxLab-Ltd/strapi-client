# API Reference

Complete reference for the `StrapiClient` class and all its methods.

## StrapiClient

### Constructor

```ts
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient(config: StrapiClientConfig)
```

**StrapiClientConfig:**

| Property         | Type                    | Required | Description                                                                                                                                                             |
| ---------------- | ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseURL`        | `string`                | Yes      | Strapi server URL (e.g., `http://localhost:1337`)                                                                                                                       |
| `token`          | `string`                | No       | Bearer token for authenticated requests                                                                                                                                 |
| `fetch`          | `typeof fetch`          | No       | Custom fetch function (defaults to `globalThis.fetch`)                                                                                                                  |
| `debug`          | `boolean`               | No       | Log all requests to console                                                                                                                                             |
| `credentials`    | `RequestCredentials`    | No       | Credentials mode for fetch (`include`, `same-origin`, `omit`)                                                                                                           |
| `authMode`       | `'legacy' \| 'refresh'` | No       | Override the users-permissions JWT mode baked in at generation time (`AUTH_MODE`). See [Session Auth](/advanced/authentication#session-auth-refresh-tokens-strapi-5-43) |
| `timeout`        | `number`                | No       | Request timeout in milliseconds. Aborts request if exceeded                                                                                                             |
| `validateSchema` | `boolean`               | No       | Check schema hash on init and warn if types are outdated                                                                                                                |

```ts
// Minimal configuration
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
})

// Full configuration
const strapi = new StrapiClient({
    baseURL: 'https://api.example.com',
    token: 'your-api-token',
    debug: process.env.NODE_ENV === 'development',
    credentials: 'include',
    validateSchema: process.env.NODE_ENV === 'development',
})

// With custom fetch (e.g., for Node.js or testing)
import fetch from 'node-fetch'

const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    fetch: fetch as any,
})
```

### setToken

Updates the Bearer token used for all subsequent requests.

```ts
strapi.setToken(token: string): void
```

```ts
// Set token after login
const { jwt } = await strapi.auth.login({
    identifier: 'user@example.com',
    password: 'password',
})
strapi.setToken(jwt)
```

### validateSchema

Checks whether the locally generated types match the remote Strapi schema.

```ts
strapi.validateSchema(): Promise<{
  valid: boolean
  localHash: string
  remoteHash?: string
  error?: string
}>
```

```ts
const result = await strapi.validateSchema()
if (!result.valid) {
    console.warn('Types are outdated! Run: npx strapi-types generate')
}
```

::: tip
When `validateSchema: true` is set in the config, this check runs automatically on client construction and logs a warning if the schema has drifted.
:::

## Collection API

Each collection type gets a property on the `StrapiClient` instance. For example, if your Strapi project has an `Article` content type, you access it as `strapi.articles`.

### find

Fetches a list of entries.

```ts
find(params?, nextOptions?): Promise<T[]>
```

**Parameters:**

| Parameter     | Type          | Description                                                    |
| ------------- | ------------- | -------------------------------------------------------------- |
| `params`      | `QueryParams` | Query parameters (filters, sort, pagination, populate, fields) |
| `nextOptions` | `NextOptions` | Next.js cache options                                          |

**Returns:** `Promise<T[]>` where `T` is the base type (or populated type if `populate` is specified).

```ts
// Basic find — returns Article[]
const articles = await strapi.articles.find()

// With filters
const published = await strapi.articles.find({
    filters: { status: { $eq: 'published' } },
})

// With sort and pagination
const recent = await strapi.articles.find({
    sort: ['createdAt:desc'],
    pagination: { page: 1, pageSize: 10 },
})

// With populate — return type automatically includes relations
const withCategory = await strapi.articles.find({
    populate: { category: true, cover: true },
})
// withCategory[0].category  <-- typed as Category | null
// withCategory[0].cover     <-- typed as MediaFile

// Populate all relations
const full = await strapi.articles.find({
    populate: '*',
})

// With field selection
const titles = await strapi.articles.find({
    fields: ['title', 'slug'],
})

// With Next.js cache options
const cached = await strapi.articles.find(
    { filters: { status: 'published' } },
    { revalidate: 3600, tags: ['articles'] },
)
```

### findWithMeta

Same as `find` but returns the full Strapi response including pagination metadata.

```ts
findWithMeta(params?, nextOptions?): Promise<StrapiResponse<T[]>>
```

**Returns:** `Promise<StrapiResponse<T[]>>` with the response shape:

```ts
interface StrapiResponse<T> {
    data: T
    meta?: {
        pagination?: {
            page: number
            pageSize: number
            pageCount: number
            total: number
        }
    }
}
```

```ts
const response = await strapi.articles.findWithMeta({
    pagination: { page: 1, pageSize: 10 },
})

console.log(response.data) // Article[]
console.log(response.meta.pagination) // { page: 1, pageSize: 10, pageCount: 5, total: 47 }
```

### findOne

Fetches a single entry by its document ID.

```ts
findOne(documentId, params?, nextOptions?): Promise<T | null>
```

**Parameters:**

| Parameter     | Type          | Description                         |
| ------------- | ------------- | ----------------------------------- |
| `documentId`  | `string`      | The Strapi document ID              |
| `params`      | `QueryParams` | Query parameters (populate, fields) |
| `nextOptions` | `NextOptions` | Next.js cache options               |

**Returns:** `Promise<T | null>`

```ts
// Basic findOne
const article = await strapi.articles.findOne('abc123')

// With populate
const article = await strapi.articles.findOne('abc123', {
    populate: {
        category: true,
        cover: { fields: ['url', 'alternativeText'] },
        tags: { sort: ['name:asc'], limit: 5 },
    },
})

// With Next.js options
const article = await strapi.articles.findOne(
    'abc123',
    { populate: { category: true } },
    { revalidate: 60, tags: ['article-abc123'] },
)
```

### create

Creates a new entry.

```ts
create(data, nextOptions?): Promise<T>
```

**Parameters:**

| Parameter     | Type                 | Description                                               |
| ------------- | -------------------- | --------------------------------------------------------- |
| `data`        | `TInput \| FormData` | The entry data (typed input or FormData for file uploads) |
| `nextOptions` | `NextOptions`        | Next.js cache options                                     |

**Returns:** `Promise<T>` -- the created entry.

```ts
// Create with typed input
const article = await strapi.articles.create({
    title: 'New Article',
    slug: 'new-article',
    body: 'Article content here.',
    status: 'draft',
    category: 5, // relation by ID
    cover: 12, // media by ID
    tags: [1, 2, 3], // many relation by IDs
})

// Create with FormData (for file uploads in the same request)
const formData = new FormData()
formData.append('data', JSON.stringify({ title: 'With File' }))
formData.append('files.cover', fileBlob, 'cover.jpg')

const article = await strapi.articles.create(formData)
```

### update

Updates an existing entry by its document ID.

```ts
update(documentId, data, nextOptions?): Promise<T>
```

**Parameters:**

| Parameter     | Type                 | Description            |
| ------------- | -------------------- | ---------------------- |
| `documentId`  | `string`             | The Strapi document ID |
| `data`        | `TInput \| FormData` | Partial entry data     |
| `nextOptions` | `NextOptions`        | Next.js cache options  |

**Returns:** `Promise<T>` -- the updated entry.

```ts
// Partial update — only specified fields are changed
const updated = await strapi.articles.update('abc123', {
    title: 'Updated Title',
    status: 'published',
})

// Clear a field by setting it to null
const cleared = await strapi.articles.update('abc123', {
    cover: null,
    body: null,
})
```

### delete

Deletes an entry by its document ID.

```ts
delete(documentId, nextOptions?): Promise<T | null>
```

**Parameters:**

| Parameter     | Type          | Description            |
| ------------- | ------------- | ---------------------- |
| `documentId`  | `string`      | The Strapi document ID |
| `nextOptions` | `NextOptions` | Next.js cache options  |

**Returns:** `Promise<T | null>` -- the deleted entry, or null.

```ts
const deleted = await strapi.articles.delete('abc123')
```

## Single Type API

Single types (e.g., a Homepage or Global Settings content type) expose a reduced API since there is only one entry.

### find

Fetches the single type entry.

```ts
find(params?, nextOptions?): Promise<T>
```

```ts
// Fetch the homepage single type
const homepage = await strapi.homepage.find()

// With populate
const homepage = await strapi.homepage.find({
    populate: { hero: true, seo: true },
})
```

### update

Updates the single type entry. No `documentId` is needed.

```ts
update(data, nextOptions?): Promise<T>
```

```ts
const updated = await strapi.homepage.update({
    heroTitle: 'Welcome to our site',
})
```

::: info
Single types do not have `findOne`, `create`, or `delete` methods. Use `find` to read and `update` to modify.
:::

## Authentication API

The authentication API is available at `strapi.auth` and provides methods for the Strapi Users & Permissions plugin.

::: tip
The exact methods available on `strapi.auth` depend on your Strapi project's auth and user controller routes. Common methods like `login`, `register`, `me`, and `forgotPassword` are generated automatically when the corresponding routes exist.
:::

::: warning Renamed in v2
`strapi.authentication` is now `strapi.auth`, and the client-side `logout()` helper is now `clearToken()`. The old names remain as `@deprecated` aliases and will be removed in a future major.
:::

### Session methods (refresh mode)

When the backend runs users-permissions with `jwtManagement: 'refresh'` (Strapi 5.43+), the generated client additionally exposes:

```ts
// Rotate the refresh token and obtain a new access token.
// Call once on app startup to bootstrap the session.
auth.refresh(): Promise<boolean>

// Revoke the server-side session, then clear the in-memory tokens.
auth.logout(): Promise<void>
```

When the backend exposes the session management routes, they are generated fully typed as well:

```ts
// List the user's active sessions. Entries are sanitized server-side —
// no tokens or internal ids.
auth.getSessions(): Promise<AuthSessionsResponse>
// → { data: AuthSessionEntry[] }
//   AuthSessionEntry: { id, deviceId?, deviceName?, current, loginAt?, lastActiveAt? }

// Revoke one session by its id (404 if unknown or another user's).
auth.revokeSession(sessionId: string): Promise<RevokeSessionResponse>
// → { data: {} }
```

Access tokens from `login`/`register`/etc. are stored in memory automatically, and requests that fail with 401 — or with 403 when sent anonymously, which is how Strapi answers a protected route hit with no credentials (the page-reload bootstrap case) — are retried once after a transparent single-flight refresh. See [Authentication → Session Auth](/advanced/authentication#session-auth-refresh-tokens-strapi-5-43) for the full flow.

## QueryParams

The `QueryParams` interface is used by `find`, `findWithMeta`, and `findOne`.

```ts
interface QueryParams<TEntity, TFilters, TPopulate, TFields> {
    filters?: TFilters
    sort?: SortOption | SortOption[]
    pagination?: {
        page?: number
        pageSize?: number
        limit?: number
        start?: number
    }
    populate?: TPopulate
    fields?: TFields[]
    locale?: string
    status?: 'draft' | 'published'
}
```

### filters

Type-safe filter object. Each content type gets its own `Filters` type.

```ts
await strapi.articles.find({
    filters: {
        title: { $contains: 'typescript' },
        views: { $gte: 100 },
        status: { $eq: 'published' },
        $or: [
            { category: { id: { $eq: 1 } } },
            { category: { id: { $eq: 2 } } },
        ],
    },
})
```

**Available filter operators:**

| Operator       | Types        | Description                          |
| -------------- | ------------ | ------------------------------------ |
| `$eq`          | all          | Equal                                |
| `$eqi`         | string       | Equal (case-insensitive)             |
| `$ne`          | all          | Not equal                            |
| `$lt`, `$lte`  | number, date | Less than / less than or equal       |
| `$gt`, `$gte`  | number, date | Greater than / greater than or equal |
| `$in`          | all          | Included in array                    |
| `$notIn`       | all          | Not included in array                |
| `$contains`    | string       | Contains substring                   |
| `$notContains` | string       | Does not contain substring           |
| `$containsi`   | string       | Contains (case-insensitive)          |
| `$startsWith`  | string       | Starts with                          |
| `$endsWith`    | string       | Ends with                            |
| `$between`     | number, date | Between two values                   |
| `$null`        | all          | Is null                              |
| `$notNull`     | all          | Is not null                          |
| `$and`         | logical      | All conditions must match            |
| `$or`          | logical      | At least one condition must match    |
| `$not`         | logical      | Negation                             |

### sort

Sort by one or more fields. Append `:asc` or `:desc` for direction.

```ts
await strapi.articles.find({
    sort: ['createdAt:desc'],
})

await strapi.articles.find({
    sort: ['status:asc', 'createdAt:desc'],
})
```

### pagination

Two pagination styles are supported:

```ts
// Page-based pagination
await strapi.articles.find({
    pagination: { page: 2, pageSize: 25 },
})

// Offset-based pagination
await strapi.articles.find({
    pagination: { start: 50, limit: 25 },
})
```

### populate

See [Populate & Type Inference](/guide/populate) for a detailed guide. Quick summary:

```ts
// Populate specific relations
{ populate: { category: true, cover: true } }

// Populate all relations (1 level deep)
{ populate: '*' }

// Nested populate with options
{ populate: {
  category: {
    fields: ['name', 'slug'],
    populate: { icon: true }
  }
}}
```

### fields

Select specific fields to return. Reduces payload size.

```ts
await strapi.articles.find({
    fields: ['title', 'slug', 'createdAt'],
})
```

### locale

Filter by locale for content types with the Strapi i18n plugin enabled.

```ts
// Fetch content in a specific locale
await strapi.articles.find({
    locale: 'en',
})

// Combine with populate to get localizations
await strapi.articles.find({
    locale: 'en',
    populate: {
        localizations: { fields: ['locale', 'slug'] },
    },
})
```

::: info
The `locale` parameter is available on all content types. Strapi ignores it for content types without i18n enabled.
:::

To discover which codes your project accepts, read them from Strapi itself with [`client.i18n.locales()`](/reference/i18n).

### status

Filter by publication status. Useful for preview/editor flows where you need to access draft content.

```ts
// Fetch only draft entries
await strapi.articles.find({
    status: 'draft',
})

// Fetch only published entries (default Strapi behavior)
await strapi.articles.find({
    status: 'published',
})
```

::: info
See the [Strapi documentation on status](https://docs.strapi.io/cms/api/rest/status) for more details. By default, Strapi returns only published entries when `status` is omitted.
:::

## NextOptions

Optional second parameter on all API methods for Next.js cache control.

```ts
interface NextOptions {
    revalidate?: number | false
    tags?: string[]
    cache?: RequestCache
    headers?: Record<string, string | undefined>
}
```

| Property     | Type                                  | Description                                                     |
| ------------ | ------------------------------------- | --------------------------------------------------------------- |
| `revalidate` | `number \| false`                     | ISR revalidation period in seconds, or `false` to disable       |
| `tags`       | `string[]`                            | Cache tags for on-demand revalidation via `revalidateTag()`     |
| `cache`      | `RequestCache`                        | Standard fetch cache mode (`'no-store'`, `'force-cache'`, etc.) |
| `headers`    | `Record<string, string \| undefined>` | Custom HTTP headers to merge into the request                   |

```ts
// ISR: revalidate every hour
await strapi.articles.find({}, { revalidate: 3600 })

// Tag-based revalidation
await strapi.articles.find({}, { tags: ['articles'] })

// No caching
await strapi.articles.find({}, { cache: 'no-store' })

// Custom headers (e.g. pass Referer for server-side requests)
await strapi.articles.find({}, { headers: { Referer: 'https://myapp.com' } })

// Combine options
await strapi.articles.find(
    { filters: { status: 'published' } },
    { revalidate: 300, tags: ['articles', 'published'] },
)
```

::: info
`NextOptions` are passed through to the underlying `fetch` call as `{ next: { revalidate, tags }, cache }`. Custom `headers` are merged with the default headers (Content-Type, Authorization). These options work in any environment, not just Next.js.
:::

## StrapiResponse

The response wrapper returned by `findWithMeta`.

```ts
interface StrapiResponse<T> {
    data: T
    meta?: {
        pagination?: {
            page: number
            pageSize: number
            pageCount: number
            total: number
        }
    }
}
```

## StrapiError

Custom error class thrown on non-OK HTTP responses.

```ts
class StrapiError extends Error {
    /** Clean user-friendly message from Strapi backend */
    userMessage: string
    /** HTTP status code */
    status: number
    /** HTTP status text */
    statusText: string
    /**
     * Strapi-side error name (e.g. "ValidationError", "PolicyError").
     * Use as discriminator with `isStrapiErrorOf` for typed `details`.
     */
    errorName: StrapiErrorName
    /** Narrow via `isStrapiErrorOf` for typed access. */
    details?: unknown
}
```

::: warning Note on `Error.name`
`Error.name` is left as `"StrapiError"` so Sentry/sourcemap contracts are unchanged — the Strapi-side name lives on the new `errorName` field. Use `errorName` (not `name`) for narrowing.
:::

The error message also includes a contextual hint for common HTTP status codes:

| Status | Hint                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| 401    | Check that your API token is valid and passed to StrapiClient config.                |
| 403    | Your token may lack permissions for this endpoint. Check Strapi roles & permissions. |
| 404    | This endpoint may not exist. Verify the content type is created in Strapi.           |
| 500    | Internal Strapi error. Check Strapi server logs for details.                         |

### Known error names

`errorName` is typed as a literal union of Strapi v5's documented error names plus a `string` fallback for plugin or future-version errors:

| `errorName`            | Default status | `details` shape                         |
| ---------------------- | -------------- | --------------------------------------- |
| `ValidationError`      | 400            | `{ errors: StrapiValidationIssue[] }`   |
| `BadRequestError`      | 400            | `Record<string, unknown>`               |
| `PaginationError`      | 400            | `Record<string, unknown>`               |
| `UnauthorizedError`    | 401            | `undefined`                             |
| `ForbiddenError`       | 403            | `undefined`                             |
| `PolicyError`          | 403            | `{ policy?: string; message?: string }` |
| `NotFoundError`        | 404            | `undefined`                             |
| `ConflictError`        | 409            | `Record<string, unknown>`               |
| `PayloadTooLargeError` | 413            | `undefined`                             |
| `RateLimitError`       | 429            | `Record<string, unknown>`               |
| `ApplicationError`     | 500            | `Record<string, unknown>`               |

### Narrowing errors with `isStrapiErrorOf`

Because `details` is typed as `unknown` on the class, narrow it via the `isStrapiErrorOf` type guard:

```ts
import { isStrapiErrorOf } from '@/strapi'

try {
    await strapi.articles.create({ title: '' })
} catch (err) {
    if (isStrapiErrorOf(err, 'ValidationError')) {
        // err.details is `{ errors: StrapiValidationIssue[] } | undefined` —
        // Strapi can omit details even on a ValidationError, so use
        // optional access or a fallback.
        for (const issue of err.details?.errors ?? []) {
            console.log(issue.path.join('.'), issue.message)
        }
    }

    if (isStrapiErrorOf(err, 'PolicyError')) {
        console.warn(err.details?.policy)
    }

    if (isStrapiErrorOf(err, 'ForbiddenError')) {
        // 403 — token lacks permission. err.details is always undefined.
        redirectToLogin()
    }
}
```

For "any Strapi error" without a specific name, use `isStrapiError`:

```ts
import { isStrapiError } from '@/strapi'

try {
    /* ... */
} catch (err) {
    if (isStrapiError(err)) {
        if (err.status === 401) redirectToLogin()
    }
}
```

### `StrapiValidationIssue`

Each entry in `details.errors` for a `ValidationError`:

```ts
export interface StrapiValidationIssue {
    /** Field path to the offending value, e.g. ["author", "email"]. */
    path: string[]
    message: string
    /** The Yup validator name, e.g. "required". */
    name: string
}
```

This is a stable export — perfect for mapping backend validation back to form fields:

```ts
const fieldErrors: Record<string, string> = {}
if (isStrapiErrorOf(err, 'ValidationError')) {
    for (const issue of err.details?.errors ?? []) {
        fieldErrors[issue.path.join('.')] = issue.message
    }
}
```

### Migration from `details: any`

Earlier versions exposed `details` as `any`. The new `unknown` type is stricter — direct property access stops compiling without narrowing:

```ts
// Before — compiled but unsafe:
err.details.errors[0].path

// After — must narrow:
if (isStrapiErrorOf(err, 'ValidationError')) {
    err.details.errors[0].path
}
```

Runtime behavior is unchanged.

## StrapiConnectionError

Error thrown when the client cannot reach the Strapi server at all (network failures, DNS errors, timeouts).

```ts
class StrapiConnectionError extends Error {
    /** The URL that was being requested */
    url: string
    /** The original error that caused the connection failure */
    cause?: Error
}
```

The error message is specific to the failure type:

| Cause                | Message                                                            |
| -------------------- | ------------------------------------------------------------------ |
| Server not running   | `Could not connect to Strapi at {baseURL}. Is the server running?` |
| DNS resolution error | `Could not resolve host. Check your baseURL: {baseURL}`            |
| Request timeout      | `Request timed out after {timeout}ms. URL: {url}`                  |
| Other network error  | `Network error: {message}. Check your baseURL: {baseURL}`          |

```ts
import { StrapiConnectionError } from '@/strapi'

try {
    await strapi.articles.find()
} catch (error) {
    if (error instanceof StrapiConnectionError) {
        console.log(error.message) // "Could not connect to Strapi at http://localhost:1337. Is the server running?"
        console.log(error.url) // the full request URL
        console.log(error.cause) // original fetch error
    }
}
```
