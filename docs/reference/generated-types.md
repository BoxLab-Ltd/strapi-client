# Generated Types

This page explains the structure of the TypeScript files produced by the `strapi-types generate` command and the type categories they contain.

## Output Files

Generated files are written to the directory you pass with the required `--output` flag — a directory in your source tree that you commit, e.g. `./src/strapi`. The default `--format js` emits compiled `.js` + `.d.ts`; `--format ts` emits raw `.ts` instead.

| File          | Description                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `types.d.ts`  | All TypeScript interfaces: base types, input types, payload types, components, filters, populate params |
| `client.js`   | The `StrapiClient` class with typed methods for every content type (also exports `SCHEMA_HASH`)         |
| `client.d.ts` | Type declarations for the client                                                                        |
| `index.js`    | Re-exports everything from `types` and `client`                                                         |
| `index.d.ts`  | Type declarations for the index                                                                         |

```
src/strapi/
  types.d.ts        # Type definitions
  client.js         # Runtime client code + SCHEMA_HASH constant
  client.d.ts       # Client type declarations
  index.js          # Re-export barrel
  index.d.ts        # Index type declarations
```

## Type Categories

The generator produces three categories of types for each content type, plus supporting utility types.

### 1. Base Types

Base types represent the shape of data **returned by Strapi** for read operations (without populate). They contain only scalar fields and the standard base fields.

```ts
export interface Article {
    readonly __typename?: 'Article'
    id: number
    documentId: string
    createdAt: string
    updatedAt: string
    title: string
    slug: string
    body: string | null
    publishDate: string | null
    views: number
    status: 'draft' | 'published' | 'archived'
}
```

Key characteristics:

- Includes `id`, `documentId`, `createdAt`, `updatedAt` on every type.
- Scalar fields only -- relations, media, components, and dynamic zones are **not** present.
- Non-required fields have `| null`.
- Enumerations become union literal types.
- A readonly `__typename` field provides nominal typing to distinguish structurally similar interfaces.

### 2. Input Types

Input types are used for `create` and `update` operations. Every field is optional to support partial updates.

```ts
export interface ArticleInput {
    title?: string | null
    slug?: string | null
    body?: string | null
    publishDate?: string | null
    views?: number | null
    status?: 'draft' | 'published' | 'archived' | null
    category?: number | null // relation -> ID
    cover?: number | null // media -> ID
    gallery?: number[] | null // multiple media -> ID array
    tags?: number[] | null // many relation -> ID array
    seo?: SeoComponentInput | null // component -> nested input object
    blocks?: (HeroInput | CtaInput)[] | null // dynamic zone -> union input array
}
```

Key characteristics:

- All fields are optional (`?:`).
- Relations accept numeric IDs (not full objects).
- Media fields accept numeric IDs.
- Components use their corresponding `*Input` type.
- Dynamic zones use a union of `*Input` types.

### 3. Payload Types (GetPayload)

Payload types use TypeScript generics to resolve the return type based on your `populate` parameter. This is what enables type-safe populate inference.

```ts
export type ArticleGetPayload<P extends { populate?: any } = {}> = Article &
    (P extends { populate: infer Pop }
        ? Pop extends '*' | true
            ? {
                  category?: Category | null
                  cover?: MediaFile
                  tags?: Tag[]
                  blocks?: (Hero | Cta)[]
              }
            : Pop extends readonly (infer _)[]
              ? {
                    category?: 'category' extends Pop[number]
                        ? Category | null
                        : never
                    cover?: 'cover' extends Pop[number] ? MediaFile : never
                    // ...
                }
              : {
                    category?: 'category' extends keyof Pop
                        ? /* nested resolve */ Category | null
                        : never
                    // ...
                }
        : {})
```

The payload type handles three populate styles:

| Populate Style | Example                                                    | Behavior                              |
| -------------- | ---------------------------------------------------------- | ------------------------------------- |
| Wildcard       | `populate: '*'` or `populate: true`                        | All populatable fields included       |
| Array          | `populate: ['category', 'cover']`                          | Only named fields included            |
| Object         | `populate: { category: true, cover: { fields: ['url'] } }` | Per-field control with nested options |

::: tip
You rarely need to use `GetPayload` directly. The `StrapiClient` methods automatically infer the correct return type from your `populate` parameter.
:::

## Component Types

Components are generated as separate interfaces, mirroring their Strapi structure.

```ts
export interface SeoComponent {
    id: number
    metaTitle: string
    metaDescription: string | null
    shareImage: MediaFile | null
}

export interface SeoComponentInput {
    id?: number
    metaTitle?: string | null
    metaDescription?: string | null
    shareImage?: number | null
}
```

Component types follow the same base/input split as content types. The `id` field is included (components have IDs in Strapi) but `documentId` is not (components are not standalone documents).

## PopulateParam Types

For each content type and component that has populatable fields, a `PopulateParam` type is generated. This provides autocomplete and type safety for the `populate` parameter.

```ts
export type ArticlePopulateParam = {
    category?:
        | true
        | {
              fields?: (keyof Category & string)[]
              populate?:
                  | CategoryPopulateParam
                  | (keyof CategoryPopulateParam & string)[]
                  | '*'
              filters?: CategoryFilters
              sort?: SortValue<Category> | SortValue<Category>[]
              limit?: number
              start?: number
          }
    cover?: true | { fields?: (keyof MediaFile & string)[] }
    tags?:
        | true
        | {
              fields?: (keyof Tag & string)[]
              filters?: TagFilters
              sort?: SortValue<Tag> | SortValue<Tag>[]
              limit?: number
              start?: number
          }
    blocks?:
        | true
        | {
              on?: {
                  'shared.hero'?: true | { fields?: (keyof Hero & string)[] }
                  'shared.cta'?: true | { fields?: (keyof Cta & string)[] }
              }
          }
}
```

Populate params support:

- `true` for simple population.
- Object syntax with `fields`, `filters`, `sort`, `limit`, `start` for fine-grained control.
- Nested `populate` for deep population chains.
- Dynamic zone `on` syntax for component-specific options.

## Filter Types

Each content type gets a typed filter interface:

```ts
export interface ArticleFilters extends LogicalOperators<ArticleFilters> {
    id?: number | IdFilterOperators
    documentId?: string | StringFilterOperators
    createdAt?: string | DateFilterOperators
    updatedAt?: string | DateFilterOperators
    publishedAt?: string | DateFilterOperators
    title?: string | StringFilterOperators
    views?: number | NumberFilterOperators
    status?: ('draft' | 'published' | 'archived') | StringFilterOperators
    category?: {
        id?: number | IdFilterOperators
        documentId?: string | StringFilterOperators
        [key: string]: any
    }
    seo?: SharedSeoFilters
}
```

Every component also gets its own filter interface, referenced by the entities that use it. Component filters carry a numeric `id` but no `documentId` or timestamps, and they nest recursively:

```ts
export interface SharedSeoFilters extends LogicalOperators<SharedSeoFilters> {
    id?: number | IdFilterOperators
    metaTitle?: string | StringFilterOperators
    openGraph?: SharedOpenGraphFilters
}
```

Dynamic zone fields get no filter key — Strapi cannot filter polymorphic structures, so the type reflects what the REST API actually accepts.

Filter utility types are also generated:

| Type                     | Used For                                |
| ------------------------ | --------------------------------------- |
| `StringFilterOperators`  | `$eq`, `$contains`, `$startsWith`, etc. |
| `NumberFilterOperators`  | `$eq`, `$lt`, `$gt`, `$between`, etc.   |
| `BooleanFilterOperators` | `$eq`, `$ne`, `$null`                   |
| `DateFilterOperators`    | `$eq`, `$lt`, `$gt`, `$between`, etc.   |
| `IdFilterOperators`      | `$eq`, `$ne`, `$in`, `$notIn`           |
| `LogicalOperators<T>`    | `$and`, `$or`, `$not`                   |

## Internal Utility Types

The following types are generated for internal use by the client and payload resolution. You generally do not need to reference them directly:

| Type                                  | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `_EntityField<T>`                     | Extracts field names excluding `__typename`          |
| `_SortValue<T>`                       | Sort string like `'title'` or `'title:desc'`         |
| `_ApplyFields<TFull, TBase, TEntry>`  | Narrows type based on `fields` selection in populate |
| `Equal<X, Y>`                         | Exact type equality check                            |
| `GetPopulated<TBase, TPopulate>`      | Maps base type to its `GetPayload` variant           |
| `SelectFields<TFull, TBase, TFields>` | Picks specific fields from the type                  |

## TypeMap Generation

The generated `StrapiClient` uses an internal `GetPopulated` conditional type that maps each base type to its `GetPayload` variant. This is what enables the client methods to automatically return the correct type based on the `populate` parameter you pass:

```ts
type GetPopulated<TBase, TPopulate> =
    Equal<TBase, Article> extends true
        ? ArticleGetPayload<{ populate: TPopulate }>
        : Equal<TBase, Category> extends true
          ? CategoryGetPayload<{ populate: TPopulate }>
          : // ... one branch per content type
            TBase
```

::: info
The `Equal` type uses exact equality instead of `extends` to prevent TypeScript structural typing from incorrectly matching similar types.
:::
