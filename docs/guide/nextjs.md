# Next.js Integration

`strapi-typed-client` provides first-class Next.js support with automatic type generation during development, one-time generation during builds, and built-in cache options that map directly to Next.js fetch behavior.

## withStrapiTypes Wrapper

Wrap your Next.js config with `withStrapiTypes` to enable automatic schema watching and type generation:

```ts
// next.config.ts
import { withStrapiTypes } from 'strapi-typed-client/next'

const nextConfig = {
    // your existing Next.js config
}

export default withStrapiTypes({
    strapiUrl: process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337',
    token: process.env.STRAPI_TOKEN,
})(nextConfig)
```

### Behavior

| Mode         | What Happens                                                                   |
| ------------ | ------------------------------------------------------------------------------ |
| `next dev`   | Connects to Strapi via SSE and regenerates types instantly when schema changes |
| `next build` | Runs a one-time generation before the build starts                             |

### Options

| Option      | Description                                                                                         | Default                                     |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `strapiUrl` | Strapi server URL                                                                                   | `STRAPI_URL` env or `http://localhost:1337` |
| `token`     | API token                                                                                           | `STRAPI_TOKEN` env                          |
| `silent`    | Suppress generation logs                                                                            | `false`                                     |
| `format`    | `js` (compiled, default) or `ts` (raw `.ts` emitted into your source tree for monorepos)            | `js`                                        |
| `output`    | Output directory. Required when `format: 'ts'` — must point at your source tree, not `node_modules` | Package dir under `node_modules`            |

### Source-tree output for monorepos

In monorepos where the shared types package compiles its own sources, emit raw `.ts` into the source tree instead of the default `node_modules` dist:

```ts
export default withStrapiTypes({
    strapiUrl: process.env.STRAPI_URL ?? 'http://localhost:1337',
    token: process.env.STRAPI_TOKEN,
    format: 'ts',
    output: './src/strapi',
})(nextConfig)
```

Then import from `@/strapi` (the `create-next-app` default `@/*` → `./src/*` path alias maps it to your output dir):

```ts
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient({
    baseURL: process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337',
    token: process.env.STRAPI_TOKEN,
})
```

Your `tsconfig.json` needs `moduleResolution: "bundler"` (the Next.js default) so the extensionless local imports inside the generated client resolve.

::: tip
This replaces the need to run `strapi-types watch` or `strapi-types generate` manually. The wrapper handles everything.
:::

## Cache Options

The `StrapiClient` methods accept an optional second parameter for Next.js cache configuration:

```ts
interface NextOptions {
    revalidate?: number | false
    tags?: string[]
    cache?: RequestCache
    headers?: Record<string, string | undefined>
}
```

These options are passed directly to the `fetch` call through the `next` option that Next.js recognizes.

### ISR with Revalidate

Use `revalidate` for Incremental Static Regeneration. The data is cached and revalidated at the specified interval (in seconds):

```ts
const articles = await strapi.articles.find(
    {
        filters: { status: { $eq: 'published' } },
        sort: ['publishedAt:desc'],
    },
    {
        revalidate: 3600, // revalidate every hour
    },
)
```

### Cache Tags

Tag your requests so you can revalidate them on demand using Next.js `revalidateTag()`:

```ts
const articles = await strapi.articles.find(
    { populate: { category: true } },
    {
        tags: ['articles'],
        revalidate: 3600,
    },
)
```

Then in a Server Action or Route Handler:

```ts
import { revalidateTag } from 'next/cache'

export async function refreshArticles() {
    'use server'
    revalidateTag('articles')
}
```

### No Cache

For data that must always be fresh, disable caching entirely:

```ts
const liveData = await strapi.articles.find({}, { cache: 'no-store' })
```

### Static Cache (Default)

By default, Next.js caches fetch requests in the App Router. If you do not pass any cache options, the default Next.js caching behavior applies:

```ts
// Cached by default in Next.js App Router
const articles = await strapi.articles.find()
```

## How It Works

Next.js patches the global `fetch` function at runtime to add caching, deduplication, and revalidation. Since `StrapiClient` uses the global `fetch` by default, it automatically benefits from all Next.js optimizations:

1. **Request deduplication** — identical fetch calls in the same render pass are deduplicated
2. **Static caching** — responses are cached at build time for static pages
3. **ISR** — cached data is revalidated in the background at the specified interval
4. **Tag-based revalidation** — invalidate specific cached responses on demand

The cache options you pass as the second parameter are forwarded to fetch like this:

```ts
fetch(url, {
    next: {
        revalidate: options.revalidate,
        tags: options.tags,
    },
    cache: options.cache,
})
```

::: info
This integration is completely optional. If you are not using Next.js, the second parameter is simply ignored and the client works with any standard `fetch` implementation.
:::

## Server Components Example

In a Next.js App Router Server Component:

```tsx
// app/articles/page.tsx
import { StrapiClient } from 'strapi-typed-client'

const strapi = new StrapiClient({
    baseURL: process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337',
    token: process.env.STRAPI_TOKEN,
})

export default async function ArticlesPage() {
    const articles = await strapi.articles.find(
        {
            filters: { status: { $eq: 'published' } },
            sort: ['publishedAt:desc'],
            populate: { category: true, coverImage: true },
        },
        { revalidate: 60, tags: ['articles'] },
    )

    return (
        <ul>
            {articles.map(article => (
                <li key={article.documentId}>
                    <h2>{article.title}</h2>
                    <span>{article.category.name}</span>
                </li>
            ))}
        </ul>
    )
}
```

## Server Actions Example

Use the client in Server Actions for mutations:

```tsx
// app/articles/actions.ts
'use server'

import { StrapiClient } from 'strapi-typed-client'
import { revalidateTag } from 'next/cache'

const strapi = new StrapiClient({
    baseURL: process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337',
    token: process.env.STRAPI_TOKEN,
})

export async function createArticle(formData: FormData) {
    const result = await strapi.articles.create({
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        category: Number(formData.get('categoryId')),
    })

    revalidateTag('articles')
    return result
}

export async function deleteArticle(documentId: string) {
    await strapi.articles.delete(documentId)
    revalidateTag('articles')
}
```

::: warning
When using `StrapiClient` in Server Actions, make sure to only instantiate it on the server side. Do not expose your API token to the client bundle.
:::
