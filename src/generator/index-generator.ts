export class IndexGenerator {
    generate(): string {
        return `/* eslint-disable */
// Auto-generated index file
// Do not edit manually

export * from './types.js'
export * from './client.js'
`
    }
}
