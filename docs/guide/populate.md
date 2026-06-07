# Populate & Type Inference

One of the most powerful features of `strapi-typed-client` is automatic type inference based on your `populate` parameter. The TypeScript return type changes depending on which relations you populate.

## Without Populate

When you call `find()` or `findOne()` without a populate parameter, relations are returned as minimal reference objects:

```ts
const result = await strapi.articles.find()

// result[0] has:
// {
//   id: number
//   documentId: string
//   title: string
//   content: string
//   category: { id: number; documentId: string } | null
//   tags: { id: number; documentId: string }[]
//   createdAt: string
//   updatedAt: string
// }
```

Relations only include `id` and `documentId` by default. To get the full related object, you need to populate.

## With Populate

### Boolean Populate

Pass `true` for any relation to include its full data:

```ts
const result = await strapi.articles.find({
    populate: {
        category: true,
    },
})

// Now category is fully typed:
// result[0].category is:
// {
//   id: number
//   documentId: string
//   name: string
//   slug: string
//   ...
// } | null
```

TypeScript knows the exact shape of the populated relation. You get full autocomplete on `category.name`, `category.slug`, etc.

### Nested Populate

Populate relations of relations by passing a nested object:

```ts
const result = await strapi.articles.find({
    populate: {
        category: {
            populate: {
                parentCategory: true,
            },
        },
    },
})

// result[0].category.parentCategory is now fully typed
```

You can nest as deeply as your schema requires:

```ts
const result = await strapi.articles.find({
    populate: {
        author: {
            populate: {
                avatar: true,
                organization: {
                    populate: {
                        logo: true,
                    },
                },
            },
        },
    },
})
```

## How Type Inference Works

The generated types include conditional type definitions that map populate parameters to return types. When you write:

```ts
const result = await strapi.articles.find({
    populate: { category: true },
})
```

TypeScript evaluates the populate parameter at compile time and produces a return type where `category` is the full `Category` interface instead of just `{ id: number; documentId: string }`.

::: info
This means you get compile-time errors if you try to access a field on an unpopulated relation:

```ts
const result = await strapi.articles.find()

// Type error: Property 'name' does not exist
result[0].category.name // [!code error]
```

:::

## Payload Types

For advanced use cases, you can use the generated payload types directly to describe the shape of a response with specific populate options:

```ts
import type { ArticleGetPayload } from '@/strapi'

type ArticleWithCategory = ArticleGetPayload<{
    populate: {
        category: true
    }
}>

// Use it as a function parameter type
function renderArticle(article: ArticleWithCategory) {
    console.log(article.title)
    console.log(article.category.name) // fully typed
}
```

This is especially useful when you need to pass fetched data between functions and want to preserve the populated type information.

::: warning Use `as const` when extracting populate to a variable
If you define your populate object outside the method call, you **must** use `as const`. Without it, TypeScript widens `true` to `boolean` and `GetPayload` cannot infer the populated fields:

```ts
// ❌ Type inference broken — `true` widens to `boolean`
const populate = { category: true, tags: true }
type Result = ArticleGetPayload<{ populate: typeof populate }>
// Result has no populated fields

// ✅ Correct — `as const` preserves literal types
const populate = { category: true, tags: true } as const
type Result = ArticleGetPayload<{ populate: typeof populate }>
// Result includes full Category and Tag[] fields
```

This also applies when passing populate to client methods via a variable:

```ts
const POPULATE = { category: true, author: true } as const

// Type inference works correctly
const result = await strapi.articles.find({ populate: POPULATE })
result[0].category.name // ✅ fully typed
```

When you pass the object inline, `as const` is not needed — TypeScript infers literal types automatically.
:::

## Populating Media

Media fields work the same way:

```ts
const result = await strapi.articles.find({
    populate: {
        coverImage: true,
    },
})

// result[0].coverImage is:
// {
//   id: number
//   name: string
//   url: string
//   width: number | null
//   height: number | null
//   formats: Record<string, any> | null
//   ...
// } | null
```

## Populating Components

Components that are part of a content type can also be populated:

```ts
const result = await strapi.articles.find({
    populate: {
        seo: true, // component field
    },
})

// result[0].seo is the full component type
// { metaTitle: string, metaDescription: string, ... }
```

::: tip
Populate only what you need. Each populated relation adds to the response size and query time. The type system helps you here — you only get typed access to fields you explicitly populate.
:::
