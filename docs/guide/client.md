# StrapiClient Usage

The generated `StrapiClient` class provides typed methods for every collection in your Strapi instance. This page covers how to create a client, perform CRUD operations, handle authentication, and deal with errors.

## Creating a Client

```ts
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
})
```

### With Authentication

```ts
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    token: 'your-bearer-token',
})
```

### With a Custom Fetch Function

The client uses the global `fetch` by default. You can provide a custom implementation for environments where global fetch is not available or when you need special behavior:

```ts
import nodeFetch from 'node-fetch'

const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    fetch: nodeFetch as any,
})
```

## Collection API Methods

Every collection type in your Strapi schema gets its own property on the client with the following methods:

| Method                         | Description                         |
| ------------------------------ | ----------------------------------- |
| `find(params?)`                | Fetch a list of entries             |
| `findOne(documentId, params?)` | Fetch a single entry by document ID |
| `create(data)`                 | Create a new entry                  |
| `update(documentId, data)`     | Update an existing entry            |
| `delete(documentId)`           | Delete an entry                     |

## CRUD Operations

### find()

Retrieve a list of entries with optional filtering, sorting, pagination, and population:

```ts
// All articles
const result = await strapi.articles.find()

// With parameters
const result = await strapi.articles.find({
    filters: { published: { $eq: true } },
    sort: ['createdAt:desc'],
    pagination: { page: 1, pageSize: 25 },
    populate: { category: true },
})

// result is Article[]
// use findWithMeta() if you need pagination metadata
```

### findOne()

Retrieve a single entry by its document ID:

```ts
const result = await strapi.articles.findOne('abc123')

// With populate
const result = await strapi.articles.findOne('abc123', {
    populate: { category: true, author: true },
})

// result is Article | null
```

### create()

Create a new entry. The data parameter uses the generated input type with all writable fields:

```ts
const result = await strapi.articles.create({
    title: 'My New Article',
    content: 'Article body text...',
    category: 1, // relation as ID
})

// result is Article
```

### update()

Update an existing entry. All fields are optional for partial updates:

```ts
const result = await strapi.articles.update('abc123', {
    title: 'Updated Title',
})

// result is Article
```

### delete()

Delete an entry by its document ID:

```ts
const result = await strapi.articles.delete('abc123')
```

## Response Format

Strapi wraps responses in a `{ data, meta }` envelope over the wire, but the client **unwraps it for you** — each method resolves directly to the data:

```ts
find() // Article[]
findOne() // Article | null
create() // Article
update() // Article
delete() // Article | null
```

When you need pagination metadata, use `findWithMeta()`, which returns the full envelope:

```ts
const { data, meta } = await strapi.articles.findWithMeta()
// data: Article[]
// meta.pagination: { page, pageSize, pageCount, total }
```

## Authentication

### Setting a Token at Creation

```ts
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    token: 'your-api-token',
})
```

### Updating the Token at Runtime

Use `setToken()` to change the authorization token after the client has been created. This is useful for login flows:

```ts
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
})

// After user logs in
strapi.setToken(jwt)

// All subsequent requests include the Authorization header
const profile = await strapi.users.findOne(userId)
```

::: tip
The token is sent as a `Bearer` token in the `Authorization` header on every request.
:::

## Error Handling

The client throws two types of errors:

- **`StrapiError`** — the server responded with a non-OK HTTP status (400, 401, 404, 500, etc.)
- **`StrapiConnectionError`** — the request never reached the server (network down, DNS failure, timeout)

```ts
import { StrapiError, StrapiConnectionError } from '@/strapi'

try {
    const result = await strapi.articles.findOne('nonexistent-id')
} catch (error) {
    if (error instanceof StrapiConnectionError) {
        // Network-level failure — server unreachable, DNS error, timeout
        console.error('Cannot reach Strapi:', error.message)
    } else if (error instanceof StrapiError) {
        // Server responded with an error
        console.error(`HTTP ${error.status}:`, error.userMessage)
    }
}
```

Error messages include contextual hints for common HTTP codes (401, 403, 404, 500), so even raw `error.message` is informative.

### Request Timeout

Set the `timeout` option (in milliseconds) to abort requests that take too long:

```ts
const strapi = new StrapiClient({
    baseURL: 'http://localhost:1337',
    timeout: 5000, // 5 seconds
})
```

When a request exceeds the timeout, a `StrapiConnectionError` is thrown with the message `Request timed out after 5000ms`.

### Common Pattern

A helper that standardizes error handling across your application:

```ts
async function safeFind<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn()
    } catch (error) {
        console.error('Strapi request failed:', error)
        return null
    }
}

const articles = await safeFind(() => strapi.articles.find())
```

::: warning
Always handle errors in production code. Network failures, authentication issues, and validation errors from Strapi will all result in thrown exceptions.
:::

## Single Types

Single types (like a homepage or global settings) are accessed the same way as collections, but you typically only use `find()` and `update()`:

```ts
// Fetch the homepage single type
const homepage = await strapi.homepage.find({
    populate: { hero: true, seo: true },
})

// Update it (single types take no documentId)
await strapi.homepage.update({ title: 'Welcome' })
```
