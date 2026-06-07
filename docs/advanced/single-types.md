# Single Types

Single Types in Strapi represent unique, one-off entries rather than collections. Common examples include a homepage, site-wide settings, a navigation structure, or a footer. `strapi-typed-client` generates a simplified API surface for Single Types that reflects their singular nature.

## How Single Types Differ from Collection Types

In Strapi, a Collection Type has many entries (like blog posts or products), while a Single Type has exactly one entry (like a homepage or global settings). The generated client reflects this distinction:

| Method      | Collection Type |        Single Type         |
| ----------- | :-------------: | :------------------------: |
| `find()`    | Returns a list  |  Returns the single entry  |
| `findOne()` |       Yes       |             No             |
| `create()`  |       Yes       |             No             |
| `update()`  |       Yes       | Yes (no documentId needed) |
| `delete()`  |       Yes       | Yes (no documentId needed) |

A Single Type API only exposes `find()`, `update()`, and `delete()` — there is no `findOne()` (since there is only one entry) and no `create()` (the entry is created automatically by Strapi).

## Generated Client API

For a Single Type called `Landing`, the generated client provides:

```typescript
// The client exposes a simplified API for single types
const strapi = new StrapiClient({ baseURL: 'http://localhost:1337' })

// Fetch the single entry
const landing = await strapi.landing.find()

// Fetch with populate
const landing = await strapi.landing.find({
    populate: {
        hero: true,
        seo: true,
    },
})

// Update the single entry (no documentId required)
await strapi.landing.update({
    title: 'Updated Landing Title',
})

// Delete the single entry
await strapi.landing.delete()
```

::: info
The `find()` method on a Single Type resolves to a single object, not an array. Strapi's `GET /api/landing` returns `{ data: { ... } }` over the wire; the client unwraps the envelope, so `find()` gives you the object directly.
:::

## Response Shape

A Single Type `find()` resolves to the entry object directly — the client unwraps Strapi's `{ data }` envelope:

```typescript
const result = await strapi.landing.find()

// result is the entry object, not an array
console.log(result.title)
console.log(result.documentId)
```

Compare this with a Collection Type:

```typescript
// Collection type — find() returns an array
const posts = await strapi.posts.find()
console.log(posts[0].title)

// Single type — find() returns a single object
const landing = await strapi.landing.find()
console.log(landing.title)
```

## Populate

Populate works the same way as with Collection Types. You can populate relations, components, media fields, and dynamic zones:

```typescript
// Boolean populate for a specific field
const landing = await strapi.landing.find({
    populate: {
        hero: true,
    },
})

// Deep populate for nested relations
const landing = await strapi.landing.find({
    populate: {
        hero: {
            populate: {
                backgroundImage: true,
            },
        },
        features: {
            populate: {
                icon: true,
            },
        },
        seo: true,
    },
})
```

## Field Selection

You can select specific fields to reduce the response payload:

```typescript
const landing = await strapi.landing.find({
    fields: ['title', 'description'],
})
```

## Updating a Single Type

Since there is only one entry, you do not need to provide a `documentId`:

```typescript
await strapi.landing.update({
    title: 'New Title',
    description: 'Updated description for the landing page.',
})
```

::: tip
You only need to include the fields you want to change. Strapi performs a partial update, leaving other fields unchanged.
:::

## Next.js Integration

Single Types work well with Next.js caching, especially for pages that change infrequently:

```typescript
// Cache the landing page for 1 hour with ISR
const landing = await strapi.landing.find(
    { populate: { hero: true, features: true } },
    { revalidate: 3600, tags: ['landing'] },
)

// Force fresh data (no cache)
const landing = await strapi.landing.find(
    { populate: { hero: true } },
    { cache: 'no-store' },
)
```

## Full Example

A complete example fetching and rendering a landing page in Next.js:

```typescript
import { StrapiClient } from '@/strapi'

const strapi = new StrapiClient({
    baseURL: process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337',
    token: process.env.STRAPI_TOKEN,
})

export default async function LandingPage() {
  const landing = await strapi.landing.find({
    populate: {
      hero: {
        populate: {
          backgroundImage: true,
        },
      },
      features: {
        populate: {
          icon: true,
        },
      },
      seo: true,
    },
  });

  return (
    <main>
      <h1>{landing.title}</h1>
      {landing.hero && (
        <section>
          <h2>{landing.hero.heading}</h2>
          <p>{landing.hero.subheading}</p>
        </section>
      )}
      <section>
        {landing.features?.map((feature, i) => (
          <div key={i}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
```
