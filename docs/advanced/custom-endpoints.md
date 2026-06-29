# Custom Endpoints

`strapi-typed-client` generates typed methods for your custom Strapi controllers and routes — not just standard CRUD. You describe each endpoint's request and response once, in the controller, and the generated client exposes a fully typed method for it.

## Mental model

There are three pieces, and it helps to keep them straight:

1. **You write** an `export interface Endpoints` in your controller, declaring the `body` and `response` of each custom action.
2. **The plugin scrapes** that interface (and your route files) at generation time and emits, per controller, an `export namespace <Controller>API { ... }` block of `*Request` / `*Response` types plus a typed method on the client.
3. **You call** the generated method — `strapi.articles.publish(...)` — and get autocomplete and a typed return.

::: warning `Endpoints` is yours, not the generator's
Nothing named `Endpoints` appears in the generated output. It's a declaration the plugin reads from your source; the output is the `<Controller>API` namespace and the client method. Renaming or deleting `Endpoints` only changes what the generator can see.
:::

The plugin reads three things from your project:

- **Routes** — `src/api/*/routes/*.ts` for each endpoint's method, path, and handler.
- **The `Endpoints` interface** — request/response types per action.
- **Extra exported types** — any other `export type` / `export interface` in the controller, hoisted into the namespace.

## Defining a typed endpoint

### 1. Declare the route

```typescript
// src/api/article/routes/custom-routes.ts
export default {
    routes: [
        {
            method: 'POST',
            path: '/articles/:id/publish',
            handler: 'article.publish',
        },
        {
            method: 'GET',
            path: '/articles/trending',
            handler: 'article.trending',
        },
    ],
}
```

The handler's action segment (`publish`, `trending`) is the key you'll use in `Endpoints`. Short, `api::`, and `plugin::` handler forms are all supported:

```typescript
handler: 'article.publish' // short
handler: 'api::article.article.publish' // full UID
handler: 'plugin::my-plugin.controller.action' // plugin
```

### 2. Declare types via the `Endpoints` interface

Each key must match a handler action. Only `body` and `response` are read (see [Field reference](#field-reference)):

```typescript
// src/api/article/controllers/article.ts
import { factories } from '@strapi/strapi'

export interface Endpoints {
    publish: {
        body: { scheduledAt?: string; notifySubscribers: boolean }
        response: { data: { publishedAt: string; url: string } }
    }
    trending: {
        response: { data: { id: number; title: string; views: number }[] }
    }
}

export default factories.createCoreController(
    'api::article.article',
    ({ strapi }) => ({
        async publish(ctx) {
            // ...business logic
            ctx.body = { data: { publishedAt: '...', url: '...' } }
        },
        async trending(ctx) {
            ctx.body = { data: [{ id: 1, title: '...', views: 1500 }] }
        },
    }),
)
```

### 3. What gets generated

For a `checkout` controller with a `buyPlan` action, the generator emits a namespace and a typed method:

```typescript
export namespace CheckoutAPI {
    export type BuyPlanRequest = { planId: string; coupon?: string }
    export type BuyPlanResponse = { url: string }
}

// on the client:
async buyPlan(data?: CheckoutAPI.BuyPlanRequest | FormData): Promise<CheckoutAPI.BuyPlanResponse>
```

## Consuming from the client

Call the method off the matching collection (or standalone) API. Path params come first, the body last; the return is the **unwrapped** response:

```typescript
const result = await strapi.articles.publish('article-id', {
    notifySubscribers: true,
})
result.publishedAt // string
result.url // string

const trending = await strapi.articles.trending()
trending[0].title // string
```

The namespace types are exported too, so you can reference them directly:

```typescript
import type { CheckoutAPI } from '@/strapi'

function buildCheckout(): CheckoutAPI.BuyPlanRequest {
    return { planId: 'pro' }
}
```

## Field reference

Each action in `Endpoints` is read for exactly two fields:

| Field      | Effect                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| `body`     | Request body type. Becomes the `data?` argument on POST/PUT/PATCH methods.          |
| `response` | Response type. A single top-level `{ data: ... }` wrapper is unwrapped (see below). |

::: warning `params` and `query` are not wired up
You may see `params` / `query` in older examples, but the generator **parses and then discards them** — they have no effect on the generated method today. Path parameters come from the route (`:id`), and query strings are not typed. Don't rely on declaring them.
:::

## Response unwrapping

Strapi controllers usually return `{ data: ... }`. The generator strips a **single top-level `data` wrapper** so the method returns the inner type directly:

```typescript
response: { data: { url: string } }   // method returns { url: string }
response: { url: string }             // returned as-is (no wrapper to strip)
response: void                        // method returns void
```

Only one top-level `{ data: ... }` is unwrapped; nested `data` keys and non-`data` shapes pass through unchanged.

## Method signatures

- **Path parameters** become positional `string` arguments, in path order. `/teams/:teamId/members/:memberId` → `getMember(teamId: string, memberId: string)`.
- **POST / PUT / PATCH** get a trailing `data?: <Body> | FormData` argument.
- **GET / DELETE** take no body argument.
- The return is always `Promise<<Response>>`, unwrapped.
- Without an `Endpoints` entry the method is still generated, but input and output fall back to `any`.

## Reserved CRUD action names

If a content-type controller action is named `find`, `findOne`, `findWithMeta`, `create`, `update`, or `delete`, generating a method with that exact name would clash with the typed base CRUD method. The generator **mangles** it to `<action><ContentType>`:

```typescript
// a `create` action on the article controller →
await strapi.articles.createArticle(data)
// the typed base method stays available:
await strapi.articles.create({ title: 'x' })
```

Standalone APIs (next section) extend a base with no CRUD surface, so their methods are never mangled.

## Referencing named types & the `unknown` fallback

Inside `body` / `response` you can reference: generated content-type and component names, `MediaFile`, the sibling `*Request` / `*Response` types, TypeScript built-ins, and any `export type` / `export interface` declared in the **same** controller (see [Extra exported types](#extra-exported-types)).

Anything else — most commonly a type `import`ed from another file — can't be resolved from the schema, so it **degrades to `unknown`** and the generator leaves a discoverable note in the committed output:

```typescript
// NOTE: GenerationView could not be resolved from the schema and fall back to `unknown` (custom-endpoint types referencing controller-local types).
export type GetXResponse = { item: Item; widget: unknown }
```

To fix it, inline the shape in the `Endpoints` declaration or re-declare it as an `export`ed type in the same controller.

## Extra exported types

Any standalone `export type` / `export interface` in a controller (other than `Endpoints`) is hoisted into the namespace, so your endpoint types can reference it:

```typescript
// src/api/search/controllers/search.ts
export type SearchResultType = 'article' | 'page' | 'product'

export interface SearchHit {
    id: number
    title: string
    type: SearchResultType
    score: number
}

export interface Endpoints {
    query: {
        body: { term: string; filters?: { type?: SearchResultType } }
        response: { data: SearchHit[] }
    }
}
```

generates:

```typescript
export namespace SearchAPI {
    export type SearchResultType = 'article' | 'page' | 'product'
    export interface SearchHit {
        id: number
        title: string
        type: SearchResultType
        score: number
    }
    export type QueryRequest = {
        term: string
        filters?: { type?: SearchResultType }
    }
    export type QueryResponse = SearchHit[]
}
```

## Standalone APIs (no content type)

A controller whose name matches a content type's `singularName` attaches its methods to that collection. Otherwise it becomes a standalone `strapi.<controller>` class:

```typescript
// src/api/contact/routes/custom-routes.ts → strapi.contact.submit(...)
await strapi.contact.submit({
    name: 'Jane',
    email: 'jane@example.com',
    message: 'Hi',
})
```

## FormData & file uploads

Custom methods accept either JSON or `FormData`, which is what you want for uploads:

```typescript
const formData = new FormData()
formData.append('file', csvFile)
await strapi.imports.upload(formData)
```

## Authoring constraints

The plugin scrapes `body` / `response` with a regex + balanced-brace scanner — **not** the TypeScript compiler. Keep declarations in a shape it can read:

- Use an **inline object literal** (`{ ... }`) or a **single simple token** (`void`, a type name) for `body` / `response`.
- Each `Endpoints` key must **equal the handler's action name**.
- Avoid splitting a type across constructs the scanner can truncate (e.g. a `body` assembled from external generics).

::: tip
This describes the current regex-based parser. A future release moves to a TypeScript-AST parser, which will widen what resolves and shrink the `unknown` fallback — your `Endpoints` declarations won't need to change.
:::

For the generate / watch / commit workflow, see the [CLI reference](/guide/cli).
