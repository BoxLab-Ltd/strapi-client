import { describe, it, expect } from 'vitest'
import { stringifyQuery } from '../../../src/generator/templates/stringify-query.js'

// Expected outputs are frozen snapshots of `qs.stringify(obj, { encodeValuesOnly: true, skipNulls: true })`
// (qs@6.14.2). The runtime dependency on `qs` was dropped in favour of the vendored `stringifyQuery`;
// these literals pin the exact serialization contract so future edits can't silently change the output.
const fixtures: Array<[string, Record<string, unknown>, string]> = [
    [
        'flat primitives',
        { page: 1, pageSize: 25, sort: 'name' },
        'page=1&pageSize=25&sort=name',
    ],
    ['boolean', { publish: true, draft: false }, 'publish=true&draft=false'],
    [
        'nested filters',
        { filters: { name: { $eq: 'foo' }, age: { $gte: 18 } } },
        'filters[name][$eq]=foo&filters[age][$gte]=18',
    ],
    [
        'deep populate',
        {
            populate: {
                category: { fields: ['name', 'slug'] },
                image: true,
            },
        },
        'populate[category][fields][0]=name&populate[category][fields][1]=slug&populate[image]=true',
    ],
    [
        'sort array',
        { sort: ['name:asc', 'createdAt:desc'] },
        'sort[0]=name%3Aasc&sort[1]=createdAt%3Adesc',
    ],
    [
        'pagination',
        { pagination: { page: 2, pageSize: 10 } },
        'pagination[page]=2&pagination[pageSize]=10',
    ],
    [
        'logical operators',
        {
            filters: {
                $or: [{ name: { $contains: 'foo' } }, { slug: { $eq: 'bar' } }],
            },
        },
        'filters[$or][0][name][$contains]=foo&filters[$or][1][slug][$eq]=bar',
    ],
    [
        'values needing URL-encoding',
        { filters: { q: { $contains: 'hello world & more=stuff' } } },
        'filters[q][$contains]=hello%20world%20%26%20more%3Dstuff',
    ],
    [
        'unicode values',
        { filters: { title: { $eq: 'тест значение' } } },
        'filters[title][$eq]=%D1%82%D0%B5%D1%81%D1%82%20%D0%B7%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D0%B5',
    ],
    [
        'skip nulls',
        {
            filters: { name: null, slug: 'abc' },
            populate: undefined,
        },
        'filters[slug]=abc',
    ],
    [
        'Date values',
        {
            filters: {
                createdAt: { $gte: new Date('2025-01-01T00:00:00Z') },
            },
        },
        'filters[createdAt][$gte]=2025-01-01T00%3A00%3A00.000Z',
    ],
    [
        'realistic find request',
        {
            filters: {
                $and: [
                    { category: { slug: { $eq: 'news' } } },
                    { publishedAt: { $notNull: true } },
                ],
            },
            populate: {
                category: true,
                cover: { fields: ['url', 'width', 'height'] },
            },
            sort: ['publishedAt:desc'],
            pagination: { page: 1, pageSize: 10 },
        },
        'filters[$and][0][category][slug][$eq]=news&filters[$and][1][publishedAt][$notNull]=true&populate[category]=true&populate[cover][fields][0]=url&populate[cover][fields][1]=width&populate[cover][fields][2]=height&sort[0]=publishedAt%3Adesc&pagination[page]=1&pagination[pageSize]=10',
    ],
]

describe('vendored stringifyQuery', () => {
    for (const [name, input, expected] of fixtures) {
        it(`matches qs.stringify for: ${name}`, () => {
            expect(stringifyQuery(input)).toBe(expected)
        })
    }

    it('returns empty string for empty object', () => {
        expect(stringifyQuery({})).toBe('')
    })
})
