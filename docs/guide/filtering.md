# Filtering, Sorting & Pagination

The `find()` method accepts a params object with `filters`, `sort`, `pagination`, and `fields` options. All filter types are generated per-entity, giving you full autocomplete and type safety.

## Filters

### Comparison Operators

| Operator      | Description           | Example                                          |
| ------------- | --------------------- | ------------------------------------------------ |
| `$eq`         | Equal                 | `{ title: { $eq: 'Hello' } }`                    |
| `$ne`         | Not equal             | `{ status: { $ne: 'draft' } }`                   |
| `$in`         | In array              | `{ status: { $in: ['published', 'archived'] } }` |
| `$lt`         | Less than             | `{ price: { $lt: 100 } }`                        |
| `$lte`        | Less than or equal    | `{ price: { $lte: 100 } }`                       |
| `$gt`         | Greater than          | `{ price: { $gt: 0 } }`                          |
| `$gte`        | Greater than or equal | `{ price: { $gte: 10 } }`                        |
| `$contains`   | Contains substring    | `{ title: { $contains: 'strapi' } }`             |
| `$startsWith` | Starts with           | `{ slug: { $startsWith: 'blog-' } }`             |
| `$endsWith`   | Ends with             | `{ email: { $endsWith: '@company.com' } }`       |
| `$null`       | Is null               | `{ deletedAt: { $null: true } }`                 |
| `$notNull`    | Is not null           | `{ publishedAt: { $notNull: true } }`            |

**Example:**

```ts
const result = await strapi.articles.find({
    filters: {
        title: { $contains: 'typescript' },
        views: { $gte: 100 },
        status: { $eq: 'published' },
    },
})
```

### Logical Operators

Combine multiple conditions with `$and`, `$or`, and `$not`:

```ts
// $or — match any condition
const result = await strapi.articles.find({
    filters: {
        $or: [
            { title: { $contains: 'strapi' } },
            { title: { $contains: 'nextjs' } },
        ],
    },
})

// $and — match all conditions (implicit when listing multiple fields)
const result = await strapi.articles.find({
    filters: {
        $and: [{ status: { $eq: 'published' } }, { views: { $gt: 50 } }],
    },
})

// $not — negate a condition
const result = await strapi.articles.find({
    filters: {
        $not: {
            status: { $eq: 'draft' },
        },
    },
})
```

### Nested Field Filtering

Filter on fields of related entities:

```ts
const result = await strapi.articles.find({
    filters: {
        category: {
            slug: { $eq: 'technology' },
        },
        author: {
            name: { $contains: 'John' },
        },
    },
})
```

::: tip
Nested filters work on relations without needing to populate them. Strapi resolves the join on the server side.
:::

### Component Filtering

Component fields are filtered the same way, through their nested attributes. Each component gets its own generated filter type, so nesting is typed all the way down:

```ts
const result = await strapi.events.find({
    filters: {
        target: {
            startDateTime: { $gte: '2026-01-01' },
        },
    },
})
```

Repeatable components use the same shape as single ones — Strapi matches the record when any element satisfies the condition:

```ts
const result = await strapi.projects.find({
    filters: {
        config: { key: { $eq: 'featured' } },
    },
})
```

::: warning
Dynamic zones cannot be filtered. Strapi does not support filtering on polymorphic structures (dynamic zones and media fields), so no filter key is generated for them — attempting one is a type error rather than a request that silently returns the wrong rows.
:::

### Timestamp Filtering

Every document carries `createdAt`, `updatedAt`, and `publishedAt`, all filterable with the date operators:

```ts
const result = await strapi.articles.find({
    filters: {
        publishedAt: { $notNull: true },
        createdAt: { $gte: '2026-01-01' },
    },
})
```

## Sorting

Pass an array of sort strings in the format `field:direction`:

```ts
const result = await strapi.articles.find({
    sort: ['createdAt:desc'],
})

// Multiple sort fields
const result = await strapi.articles.find({
    sort: ['featured:desc', 'title:asc'],
})
```

Valid directions are `asc` (ascending) and `desc` (descending). If no direction is specified, `asc` is used by default.

## Pagination

Control the page number and page size:

```ts
const result = await strapi.articles.find({
    pagination: {
        page: 1,
        pageSize: 10,
    },
})

// Pagination metadata is in the response
console.log(result.meta.pagination)
// {
//   page: 1,
//   pageSize: 10,
//   pageCount: 5,
//   total: 42,
// }
```

::: warning
The default page size in Strapi is 25. The maximum page size is 100 unless configured otherwise in your Strapi settings.
:::

## Fields Selection

Select only specific fields to reduce response size:

```ts
const result = await strapi.articles.find({
    fields: ['title', 'slug', 'createdAt'],
})

// Only the selected fields are returned
```

## Combining Parameters

All parameters can be used together:

```ts
const result = await strapi.articles.find({
    filters: {
        status: { $eq: 'published' },
        category: {
            slug: { $in: ['tech', 'science'] },
        },
    },
    sort: ['publishedAt:desc'],
    pagination: {
        page: 1,
        pageSize: 12,
    },
    populate: {
        category: true,
        author: true,
    },
    fields: ['title', 'slug', 'excerpt', 'publishedAt'],
})
```

## Entity-Specific Filter Types

The generated types include filter type definitions for each entity. This means you get autocomplete for field names and type checking for filter values:

```ts
// TypeScript will error if you filter on a non-existent field
const result = await strapi.articles.find({
    filters: {
        nonExistentField: { $eq: 'value' }, // [!code error]
    },
})

// TypeScript will error if the value type doesn't match the field
const result = await strapi.articles.find({
    filters: {
        views: { $eq: 'not a number' }, // [!code error]
    },
})
```

::: info
Filter types are generated based on your Strapi schema. When your schema changes and you regenerate types, the filter types update automatically.
:::
