import type { Attribute } from '../schema-types.js'

/**
 * Build JSDoc constraint tags (ts-to-zod/TypeDoc style) from an attribute's
 * IR constraints/default. One line per tag, stable order; empty when none.
 */
export function buildConstraintDocs(attr: Attribute): string[] {
    const lines: string[] = []
    const c = attr.constraints
    if (c) {
        if (c.min !== undefined) lines.push(`@minimum ${c.min}`)
        if (c.max !== undefined) lines.push(`@maximum ${c.max}`)
        if (c.minLength !== undefined) lines.push(`@minLength ${c.minLength}`)
        if (c.maxLength !== undefined) lines.push(`@maxLength ${c.maxLength}`)
        if (c.regex !== undefined) lines.push(`@pattern ${c.regex}`)
    }
    if (attr.defaultValue !== undefined) {
        lines.push(`@default ${JSON.stringify(attr.defaultValue)}`)
    }
    return lines
}
