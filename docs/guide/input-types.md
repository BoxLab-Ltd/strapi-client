# Input Types

`strapi-typed-client` generates separate input types for create and update operations. These types reflect what Strapi expects when writing data, which differs from what it returns when reading.

## Base Type vs Input Type

When you read data from Strapi, you get the full entity with all computed and populated fields:

```ts
// Reading — base type (Article)
{
  id: number
  documentId: string
  title: string
  content: string
  category: { id: number; documentId: string } | null
  tags: { id: number; documentId: string }[]
  coverImage: { id: number; url: string; ... } | null
  createdAt: string
  updatedAt: string
}
```

When you write data (create or update), you use the input type where relations and media are referenced by ID:

```ts
// Writing — input type (ArticleInput)
{
  title: string
  content: string
  category: number | null         // single relation as ID
  tags: number[]                  // many relation as ID array
  coverImage: number | null       // media as ID
}
```

## Relations as IDs

In input types, relations are represented as numeric IDs instead of objects:

| Relation Type | Input Type       |
| ------------- | ---------------- |
| One-to-one    | `number \| null` |
| Many-to-one   | `number \| null` |
| One-to-many   | `number[]`       |
| Many-to-many  | `number[]`       |

```ts
await strapi.articles.create({
    title: 'New Article',
    category: 5, // link to category with id 5
    tags: [1, 3, 7], // link to tags with ids 1, 3, 7
})
```

## Media as ID

Media fields accept a numeric ID referencing an already-uploaded file in the Strapi media library:

```ts
await strapi.articles.create({
    title: 'New Article',
    coverImage: 12, // media library file with id 12
})
```

::: info
File uploads are handled separately through Strapi's upload API. The input type only accepts the ID of an existing media entry.
:::

## Components as Objects

Component fields in input types accept plain objects matching the component's input shape:

```ts
await strapi.articles.create({
    title: 'New Article',
    seo: {
        metaTitle: 'Article about TypeScript',
        metaDescription: 'A deep dive into type safety.',
        keywords: 'typescript, strapi, types',
    },
})
```

Repeatable components accept an array of objects:

```ts
await strapi.articles.create({
    title: 'New Article',
    sections: [
        { heading: 'Introduction', body: '...' },
        { heading: 'Conclusion', body: '...' },
    ],
})
```

## Partial Updates

For `update()`, all fields in the input type are optional. This allows partial updates where you only send the fields that changed:

```ts
// Only update the title — all other fields remain unchanged
await strapi.articles.update('abc123', {
    title: 'Updated Title',
})

// Clear a relation by setting it to null
await strapi.articles.update('abc123', {
    category: null,
})

// Replace all tags
await strapi.articles.update('abc123', {
    tags: [2, 4, 6],
})
```

## Nullable Fields

Fields that are not required in your Strapi schema accept `null` in the input type:

```ts
await strapi.articles.create({
    title: 'Article', // required — cannot be null
    subtitle: null, // optional — can be null
    category: null, // relation — can be null
    coverImage: null, // media — can be null
})
```

## Full Create Example

Here is a complete example creating an article with all field types:

```ts
const result = await strapi.articles.create({
    // Scalar fields
    title: 'Getting Started with Strapi v5',
    slug: 'getting-started-strapi-v5',
    content: 'Full article content here...',
    views: 0,
    featured: true,
    publishedAt: '2025-01-15T10:00:00.000Z',

    // Relations (as IDs)
    category: 3,
    tags: [1, 5, 12],
    author: 7,

    // Media (as ID)
    coverImage: 42,

    // Component
    seo: {
        metaTitle: 'Getting Started with Strapi v5',
        metaDescription: 'Learn how to use Strapi v5 with TypeScript.',
    },

    // Repeatable component
    sections: [
        { heading: 'Introduction', body: 'Welcome...' },
        { heading: 'Setup', body: 'First, install...' },
    ],
})
```

::: tip
The generated input types give you full autocomplete, so you do not need to memorize field names or types. Your editor will show you exactly what fields are available and what types they expect.
:::

## Validation Constraints

Constraints declared in your Strapi schema (`min`, `max`, `minLength`, `maxLength`, `regex`, `default`) are surfaced as JSDoc tags on both the base type and the input type. Your editor shows them on hover and in autocomplete, so the rules live next to the field:

```ts
export interface ArticleInput {
    /**
     * @minLength 3
     * @maxLength 120
     */
    title?: string | null
    /** @pattern ^[a-z0-9-]+$ */
    slug?: string | null
    /**
     * @minimum 0
     * @maximum 100
     */
    discount?: number | null
    /** @default "draft" */
    status?: 'draft' | 'published' | null
}
```

The tags follow the [ts-to-zod](https://github.com/fabien0102/ts-to-zod) / TypeDoc convention, so downstream tooling can read them too:

| Strapi schema | JSDoc tag    |
| ------------- | ------------ |
| `min`         | `@minimum`   |
| `max`         | `@maximum`   |
| `minLength`   | `@minLength` |
| `maxLength`   | `@maxLength` |
| `regex`       | `@pattern`   |
| `default`     | `@default`   |

::: info
These tags are informational — they document the schema in your editor and for tooling. The client does not enforce them at runtime yet; generated runtime validators (Zod) are planned in a later phase.
:::

## Default Values

For every content type and component that declares schema defaults, a `*Defaults` constant is generated. Each holds only the fields that have a `default` in the schema, typed `as const satisfies Partial<*Input>`:

```ts
export const ArticleDefaults = {
    status: 'draft',
    featured: false,
    views: 0,
} as const satisfies Partial<ArticleInput>
```

Use it as a single source of truth for form seeds — the same defaults the server would apply:

```ts
import { ArticleDefaults } from './strapi/types'

// Seed a create form straight from the schema
const [form, setForm] = useState({ ...ArticleDefaults })

await strapi.articles.create({ ...ArticleDefaults, title: 'New Article' })
```

Entities without any schema defaults get no constant — there is nothing to default.

For components used in a **dynamic zone**, an additional `*DzDefaults` constant carries the `__component` discriminator, ready to push as a new block:

```ts
import { HeroSectionDzDefaults } from './strapi/types'

// HeroSectionDzDefaults === { __component: 'sections.hero', ...defaults }
setBlocks(prev => [...prev, { ...HeroSectionDzDefaults }])
```
