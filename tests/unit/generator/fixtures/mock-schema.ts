import type {
    ParsedSchema,
    ContentType,
    Component,
} from '../../../../src/schema-types.js'

/**
 * Rich, representative schema used by both the unit tests and the type-clean
 * guarantee test. Exercises a broad set of shapes: components (plain, with
 * media, with a relation), repeatable components, dynamic zones, single vs
 * multiple media, single types, and relations of several cardinalities.
 */

export const mockComponents: Component[] = [
    {
        name: 'ProjectConfig',
        cleanName: 'ProjectConfig',
        category: 'project',
        uid: 'project.project-config',
        attributes: [
            { name: 'key', type: { kind: 'string' }, required: true },
            { name: 'value', type: { kind: 'string' }, required: true },
        ],
        relations: [],
        media: [],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'LandingHero',
        cleanName: 'LandingHero',
        category: 'landing',
        uid: 'landing.hero',
        attributes: [
            { name: 'title', type: { kind: 'string' }, required: true },
        ],
        relations: [],
        media: [{ name: 'image', multiple: false, required: true }],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'LandingFeature',
        cleanName: 'LandingFeature',
        category: 'landing',
        uid: 'landing.feature',
        attributes: [
            { name: 'label', type: { kind: 'string' }, required: true },
        ],
        relations: [
            {
                name: 'item',
                relationType: 'manyToOne',
                target: 'api::item.item',
                targetType: 'Item',
                required: false,
            },
        ],
        media: [],
        components: [],
        dynamicZones: [],
    },
]

export const mockContentTypes: ContentType[] = [
    {
        name: 'ApiCategoryCategory',
        cleanName: 'Category',
        collectionName: 'categories',
        singularName: 'category',
        pluralName: 'categories',
        kind: 'collection',
        attributes: [
            { name: 'name', type: { kind: 'string' }, required: true },
        ],
        relations: [],
        media: [],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'ApiItemItem',
        cleanName: 'Item',
        collectionName: 'items',
        singularName: 'item',
        pluralName: 'items',
        kind: 'collection',
        attributes: [
            { name: 'title', type: { kind: 'string' }, required: true },
            { name: 'price', type: { kind: 'integer' }, required: false },
        ],
        relations: [
            {
                name: 'category',
                relationType: 'manyToOne',
                target: 'api::category.category',
                targetType: 'Category',
                required: false,
            },
        ],
        media: [{ name: 'image', multiple: false, required: false }],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'ApiProjectProject',
        cleanName: 'Project',
        collectionName: 'projects',
        singularName: 'project',
        pluralName: 'projects',
        kind: 'collection',
        attributes: [
            { name: 'title', type: { kind: 'string' }, required: true },
        ],
        relations: [
            {
                name: 'items',
                relationType: 'oneToMany',
                target: 'api::item.item',
                targetType: 'Item',
                required: false,
            },
            {
                name: 'owner',
                relationType: 'manyToOne',
                target: 'plugin::users-permissions.user',
                targetType: 'User',
                required: false,
            },
        ],
        media: [{ name: 'images', multiple: true, required: false }],
        components: [
            {
                name: 'config',
                component: 'project.config',
                componentType: 'ProjectConfig',
                repeatable: true,
                required: false,
            },
        ],
        dynamicZones: [
            {
                name: 'sections',
                components: ['landing.hero', 'landing.feature'],
                componentTypes: ['LandingHero', 'LandingFeature'],
                required: false,
            },
        ],
    },
    {
        name: 'PluginUsersPermissionsUser',
        cleanName: 'User',
        collectionName: 'up_users',
        singularName: 'user',
        pluralName: 'users',
        kind: 'collection',
        attributes: [
            { name: 'email', type: { kind: 'string' }, required: true },
            { name: 'username', type: { kind: 'string' }, required: true },
        ],
        relations: [
            {
                name: 'projects',
                relationType: 'oneToMany',
                target: 'api::project.project',
                targetType: 'Project',
                required: false,
            },
        ],
        media: [],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'ApiHomepageHomepage',
        cleanName: 'Homepage',
        collectionName: 'homepages',
        singularName: 'homepage',
        pluralName: 'homepages',
        kind: 'single',
        attributes: [
            { name: 'heading', type: { kind: 'string' }, required: true },
        ],
        relations: [],
        media: [{ name: 'banner', multiple: false, required: false }],
        components: [],
        dynamicZones: [],
    },
]

export const mockSchema: ParsedSchema = {
    contentTypes: mockContentTypes,
    components: mockComponents,
}
