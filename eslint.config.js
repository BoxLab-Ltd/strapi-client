import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['dist/', 'node_modules/', 'src/input/'],
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        // The Strapi plugin (admin UI + server services) interfaces with
        // Strapi's loosely-typed runtime (app/strapi instances, raw schema
        // objects, fetch JSON), where `any` is often unavoidable. Keep it a
        // warning at that boundary while the codegen core stays `error`.
        files: ['src/plugin/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
)
