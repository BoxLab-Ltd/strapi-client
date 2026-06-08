import { describe, it, expect } from 'vitest'
import { buildConstraintDocs } from '../../../src/generator/constraint-docs.js'
import type { Attribute } from '../../../src/schema-types.js'

describe('buildConstraintDocs', () => {
    it('emits @minimum/@maximum for numeric constraints', () => {
        const attr: Attribute = {
            name: 'quantity',
            type: { kind: 'integer' },
            required: false,
            constraints: { min: 0, max: 100 },
        }

        expect(buildConstraintDocs(attr)).toEqual([
            '@minimum 0',
            '@maximum 100',
        ])
    })

    it('emits @minLength/@maxLength/@pattern for string constraints', () => {
        const attr: Attribute = {
            name: 'slug',
            type: { kind: 'string' },
            required: false,
            constraints: { minLength: 3, maxLength: 50, regex: '^[a-z0-9-]+$' },
        }

        expect(buildConstraintDocs(attr)).toEqual([
            '@minLength 3',
            '@maxLength 50',
            '@pattern ^[a-z0-9-]+$',
        ])
    })

    it('emits @default with a JSON-encoded value (incl. falsy)', () => {
        const str: Attribute = {
            name: 'status',
            type: { kind: 'string' },
            required: false,
            defaultValue: 'draft',
        }
        const bool: Attribute = {
            name: 'featured',
            type: { kind: 'boolean' },
            required: false,
            defaultValue: false,
        }

        expect(buildConstraintDocs(str)).toEqual(['@default "draft"'])
        expect(buildConstraintDocs(bool)).toEqual(['@default false'])
    })

    it('returns an empty array when nothing is declared', () => {
        const attr: Attribute = {
            name: 'plain',
            type: { kind: 'string' },
            required: false,
        }

        expect(buildConstraintDocs(attr)).toEqual([])
    })
})
