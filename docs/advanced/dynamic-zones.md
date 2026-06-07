# Dynamic Zones

Dynamic Zones are one of Strapi's most powerful features, allowing content editors to compose pages from a set of predefined components. `strapi-typed-client` fully supports Dynamic Zones with generated union types, enabling type-safe access to heterogeneous content blocks.

## Generated Types

Component interfaces describe the component shape itself — they intentionally **do not** include `__component`. The discriminator belongs to the place where the component is used, not the component definition. For every component that appears in at least one Dynamic Zone, the generator emits an extra `*Dz` alias that adds the `__component` literal. Dynamic Zone fields are typed as a union of those `*Dz` aliases.

For example, given a `Landing` content type with a `content` Dynamic Zone that allows `HeroBlock`, `TextBlock`, and `GalleryBlock` components:

```typescript
// Generated output in types.ts

export interface HeroBlock {
    id: number
    heading: string
    subheading: string | null
}

export interface TextBlock {
    id: number
    body: string
    alignment: 'left' | 'center' | 'right'
}

export interface GalleryBlock {
    id: number
    title: string | null
}

export type HeroBlockDz = HeroBlock & { __component: 'landing.hero-block' }
export type TextBlockDz = TextBlock & { __component: 'landing.text-block' }
export type GalleryBlockDz = GalleryBlock & {
    __component: 'landing.gallery-block'
}

export interface Landing {
    id: number
    documentId: string
    title: string
    createdAt: string
    updatedAt: string
}
```

Populatable fields — media, relations, nested components — live in `LandingGetPayload` rather than the base `Landing`, so the `content` field appears on populated payloads:

```typescript
type LandingWithContent = LandingGetPayload<{ populate: { content: true } }>
// LandingWithContent['content'] is (HeroBlockDz | TextBlockDz | GalleryBlockDz)[]
```

::: tip Why two interfaces per component?
The same component can be used both inside a Dynamic Zone and as a regular `type: "component"` attribute. Strapi only accepts `__component` in Dynamic Zones — for regular component attributes the discriminator is invalid and triggers a 400 on write. Keeping it on a separate `*Dz` alias lets the generator give both contexts the right input/output shapes.
:::

## Loading Dynamic Zone Content

Dynamic Zone fields are **not populated by default** in Strapi responses. You must explicitly populate them to receive the component data:

```typescript
const landing = await strapi.landing.find({
    populate: {
        content: true,
    },
})
```

For nested relations within Dynamic Zone components, use the `on` discriminator to specify per-component populate options:

```typescript
const landing = await strapi.landing.find({
    populate: {
        content: {
            on: {
                'landing.hero-block': {
                    populate: { backgroundImage: true },
                },
                'landing.gallery-block': {
                    populate: { images: true },
                },
            },
        },
    },
})
```

The return type is fully inferred — populated relations within each component will include the full type instead of just `{ id, documentId }`.

You can also combine `on` with `fields` to select specific fields per component:

```typescript
const landing = await strapi.landing.find({
    populate: {
        content: {
            on: {
                'landing.hero-block': {
                    fields: ['heading', 'subheading'],
                    populate: { backgroundImage: true },
                },
                'landing.text-block': {
                    fields: ['body'],
                },
            },
        },
    },
})
```

::: warning
Without populating the Dynamic Zone field, it will be `null` in the response even if the entry has blocks configured in Strapi.
:::

## Type Narrowing

Since each component carries a `__component` string literal, you can use it as a discriminant to narrow the union type.

### Using the `__component` field

The most reliable approach is to check the `__component` field directly:

```typescript
const landing = await strapi.landing.find({
    populate: { content: true },
})

if (landing.content) {
    for (const block of landing.content) {
        switch (block.__component) {
            case 'landing.hero-block':
                // TypeScript knows `block` is HeroBlock here
                console.log(block.heading, block.subheading)
                break

            case 'landing.text-block':
                // TypeScript knows `block` is TextBlock here
                console.log(block.body, block.alignment)
                break

            case 'landing.gallery-block':
                // TypeScript knows `block` is GalleryBlock here
                console.log(block.title, block.images.length)
                break
        }
    }
}
```

### Using property checks

You can also narrow using `in` checks on unique properties, though this is less precise:

```typescript
if ('heading' in block) {
    // block is narrowed to HeroBlock (if `heading` is unique to it)
    console.log(block.heading)
}
```

::: tip
Prefer `__component` checks over property checks. The `__component` field is always present and guaranteed to be unique, whereas property names may overlap across components.
:::

### Type guard helpers

For reusable narrowing logic, create type guard functions. Use the `*Dz` alias as the predicate target so the discriminator is preserved through filtering:

```typescript
type LandingBlock = LandingGetPayload<{
    populate: { content: true }
}>['content'][number]

function isHeroBlock(block: LandingBlock): block is HeroBlockDz {
    return block.__component === 'landing.hero-block'
}

function isTextBlock(block: LandingBlock): block is TextBlockDz {
    return block.__component === 'landing.text-block'
}

// Usage
const heroes = landing.content?.filter(isHeroBlock) ?? []
// heroes is typed as HeroBlockDz[]
```

## Rendering Dynamic Zones in React

A common pattern for rendering Dynamic Zones in a frontend framework:

```tsx
import type { LandingGetPayload } from '@/strapi'

type LandingBlocks = LandingGetPayload<{
    populate: { content: true }
}>['content']

const componentMap: Record<string, React.FC<any>> = {
    'landing.hero-block': HeroSection,
    'landing.text-block': TextSection,
    'landing.gallery-block': GallerySection,
}

function DynamicZone({ blocks }: { blocks: LandingBlocks }) {
    if (!blocks) return null

    return (
        <>
            {blocks.map((block, index) => {
                const Component = componentMap[block.__component]
                if (!Component) return null
                return <Component key={index} {...block} />
            })}
        </>
    )
}
```

## Input Types for Dynamic Zones

The generator emits `*DzInput` aliases for every component used in a Dynamic Zone. A Dynamic Zone input field is typed as `(BlockADzInput | BlockBDzInput | ...)[]` — each element requires `__component` so Strapi can route the block to the right component type:

```typescript
await strapi.landings.create({
    title: 'New Landing Page',
    content: [
        {
            __component: 'landing.hero-block',
            heading: 'Welcome',
            subheading: 'Get started today',
        },
        {
            __component: 'landing.text-block',
            body: 'This is the introduction paragraph.',
            alignment: 'center',
        },
    ],
})
```

::: warning Dynamic Zone vs regular component attributes
`__component` is required **only** for Dynamic Zone payloads. For a regular `type: "component"` attribute (single or repeatable), Strapi already knows the component type from the schema and will reject `__component` in the payload with a 400. The generator reflects this: `*Input` for a regular component field does not include `__component`, while `*DzInput` for a Dynamic Zone block does.
:::

When updating, you replace the entire Dynamic Zone array. Strapi does not support partial updates to individual blocks within a Dynamic Zone:

```typescript
await strapi.landings.update(documentId, {
    content: [
        {
            __component: 'landing.hero-block',
            heading: 'Updated Heading',
            subheading: null,
        },
        // Only these blocks will exist after the update
    ],
})
```

## Nullable Behavior

- A Dynamic Zone field is `null` when it has no blocks or has not been populated.
- An empty Dynamic Zone (all blocks removed) returns as an empty array `[]`.
- Individual component fields within the zone follow their own nullability rules based on the Strapi schema.
