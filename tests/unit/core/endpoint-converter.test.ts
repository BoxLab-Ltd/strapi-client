import { describe, it, expect } from 'vitest'
import {
    convertEndpointsToRoutes,
    convertEndpointsToCustomTypes,
} from '../../../src/core/endpoint-converter.js'
import type {
    ParsedEndpoint,
    ExtraControllerType,
} from '../../../src/shared/endpoint-types.js'

describe('convertEndpointsToRoutes', () => {
    it('should return empty result for empty endpoints', () => {
        const result = convertEndpointsToRoutes([])

        expect(result.all).toEqual([])
        expect(result.byController.size).toBe(0)
    })

    it('should convert a simple endpoint to ParsedRoute', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/checkout/buy-plan',
                handler: 'checkout.buyPlan',
                controller: 'checkout',
                action: 'buyPlan',
            },
        ]

        const result = convertEndpointsToRoutes(endpoints)

        expect(result.all).toHaveLength(1)
        expect(result.all[0]).toEqual({
            method: 'POST',
            path: '/checkout/buy-plan',
            handler: 'checkout.buyPlan',
            controller: 'checkout',
            action: 'buyPlan',
            params: [],
        })
    })

    it('should extract path parameters', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'PUT',
                path: '/items/:id/increment-run',
                handler: 'item.incrementRun',
                controller: 'item',
                action: 'incrementRun',
            },
        ]

        const result = convertEndpointsToRoutes(endpoints)

        expect(result.all[0].params).toEqual(['id'])
    })

    it('should extract multiple path parameters', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/teams/:teamId/members/:memberId',
                handler: 'team.getMember',
                controller: 'team',
                action: 'getMember',
            },
        ]

        const result = convertEndpointsToRoutes(endpoints)

        expect(result.all[0].params).toEqual(['teamId', 'memberId'])
    })

    it('should group routes by controller', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/checkout/buy-plan',
                handler: 'checkout.buyPlan',
                controller: 'checkout',
                action: 'buyPlan',
            },
            {
                method: 'POST',
                path: '/checkout/cancel',
                handler: 'checkout.cancel',
                controller: 'checkout',
                action: 'cancel',
            },
            {
                method: 'GET',
                path: '/subscription/status',
                handler: 'subscription.status',
                controller: 'subscription',
                action: 'status',
            },
        ]

        const result = convertEndpointsToRoutes(endpoints)

        expect(result.all).toHaveLength(3)
        expect(result.byController.size).toBe(2)
        expect(result.byController.get('checkout')).toHaveLength(2)
        expect(result.byController.get('subscription')).toHaveLength(1)
    })
})

describe('convertEndpointsToCustomTypes', () => {
    it('should return empty result for empty endpoints', () => {
        const result = convertEndpointsToCustomTypes([])

        expect(result.types.size).toBe(0)
        expect(result.typeDefinitions).toEqual([])
        expect(result.namespaceImports).toEqual([])
    })

    it('should return empty result for endpoints without types', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/items',
                handler: 'item.find',
                controller: 'item',
                action: 'find',
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.types.size).toBe(0)
    })

    it('should create namespace and types from endpoint with body type', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/checkout/buy-plan',
                handler: 'checkout.buyPlan',
                controller: 'checkout',
                action: 'buyPlan',
                types: {
                    body: '{ planId: string; coupon?: string }',
                },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.types.size).toBe(1)
        expect(result.types.get('checkout.buyPlan')).toEqual({
            handler: 'checkout.buyPlan',
            inputType: 'CheckoutAPI.BuyPlanRequest',
        })
        expect(result.namespaceImports).toContain('CheckoutAPI')
        expect(result.typeDefinitions).toHaveLength(1)
        expect(result.typeDefinitions[0]).toContain(
            'export namespace CheckoutAPI',
        )
        expect(result.typeDefinitions[0]).toContain('BuyPlanRequest')
    })

    it('should create types from endpoint with response type', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/subscription/status',
                handler: 'subscription.status',
                controller: 'subscription',
                action: 'status',
                types: {
                    response: '{ active: boolean; plan: string }',
                },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.types.get('subscription.status')).toEqual({
            handler: 'subscription.status',
            outputType: 'SubscriptionAPI.StatusResponse',
        })
    })

    it('should create both input and output types from endpoint with body and response', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/checkout/buy-plan',
                handler: 'checkout.buyPlan',
                controller: 'checkout',
                action: 'buyPlan',
                types: {
                    body: '{ planId: string }',
                    response: '{ url: string }',
                },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        const types = result.types.get('checkout.buyPlan')
        expect(types?.inputType).toBe('CheckoutAPI.BuyPlanRequest')
        expect(types?.outputType).toBe('CheckoutAPI.BuyPlanResponse')
    })

    it('should group multiple endpoints of same controller in one namespace', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/checkout/buy-plan',
                handler: 'checkout.buyPlan',
                controller: 'checkout',
                action: 'buyPlan',
                types: { body: '{ planId: string }' },
            },
            {
                method: 'POST',
                path: '/checkout/cancel',
                handler: 'checkout.cancel',
                controller: 'checkout',
                action: 'cancel',
                types: { body: '{ reason?: string }' },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.namespaceImports).toEqual(['CheckoutAPI'])
        expect(result.typeDefinitions).toHaveLength(1)
        expect(result.typeDefinitions[0]).toContain('BuyPlanRequest')
        expect(result.typeDefinitions[0]).toContain('CancelRequest')
    })

    it('should handle kebab-case controller names', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/team-invitation/create',
                handler: 'team-invitation.create',
                controller: 'team-invitation',
                action: 'create',
                types: { body: '{ email: string }' },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.namespaceImports).toContain('TeamInvitationAPI')
        expect(result.types.get('team-invitation.create')?.inputType).toBe(
            'TeamInvitationAPI.CreateRequest',
        )
    })

    it('should preserve AI abbreviation in namespace name', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/ai-studio/config',
                handler: 'ai-studio.getConfig',
                controller: 'ai-studio',
                action: 'getConfig',
                types: { response: '{ styles: string[] }' },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.namespaceImports).toContain('AIStudioAPI')
    })

    it('should unwrap { data: ... } wrapper from response types', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'POST',
                path: '/checkout/buy-plan',
                handler: 'checkout.buyPlan',
                controller: 'checkout',
                action: 'buyPlan',
                types: {
                    response: '{ data: { url: string } }',
                },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        // The { data: ... } wrapper should be removed
        expect(result.typeDefinitions[0]).toContain('{ url: string }')
        expect(result.typeDefinitions[0]).not.toContain('data:')
    })

    it('should not unwrap response without data wrapper', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/status',
                handler: 'status.get',
                controller: 'status',
                action: 'get',
                types: {
                    response: '{ active: boolean; plan: string }',
                },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.typeDefinitions[0]).toContain(
            '{ active: boolean; plan: string }',
        )
    })

    it('should unwrap nested data wrapper with complex types', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/team-members',
                handler: 'team-member.getTeam',
                controller: 'team-member',
                action: 'getTeam',
                types: {
                    response:
                        '{ data: { members: Array<{ id: number }>, maxSeats: number } }',
                },
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints)

        expect(result.typeDefinitions[0]).toContain(
            'members: Array<{ id: number }>',
        )
        expect(result.typeDefinitions[0]).toContain('maxSeats: number')
    })

    it('should include extraTypes in the corresponding namespace', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/ai-studio/config',
                handler: 'ai-studio.getConfig',
                controller: 'ai-studio',
                action: 'getConfig',
                types: { response: '{ styles: string[] }' },
            },
        ]

        const extraTypes: ExtraControllerType[] = [
            {
                controller: 'ai-studio',
                typeName: 'SSEEvent',
                typeDefinition:
                    "| { type: 'connected' } | { type: 'progress'; generationId: string }",
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints, extraTypes)

        expect(result.namespaceImports).toContain('AIStudioAPI')
        expect(result.typeDefinitions).toHaveLength(1)
        // Should contain SSEEvent
        expect(result.typeDefinitions[0]).toContain('export type SSEEvent')
        expect(result.typeDefinitions[0]).toContain("type: 'connected'")
        // Should also contain endpoint types
        expect(result.typeDefinitions[0]).toContain('GetConfigResponse')
    })

    it('should create namespace for extraTypes even without endpoints', () => {
        const endpoints: ParsedEndpoint[] = []

        const extraTypes: ExtraControllerType[] = [
            {
                controller: 'ai-studio',
                typeName: 'SSEEvent',
                typeDefinition: '{ type: string }',
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints, extraTypes)

        expect(result.namespaceImports).toContain('AIStudioAPI')
        expect(result.typeDefinitions).toHaveLength(1)
        expect(result.typeDefinitions[0]).toContain(
            'export namespace AIStudioAPI',
        )
        expect(result.typeDefinitions[0]).toContain(
            'export type SSEEvent = { type: string }',
        )
    })

    it('should handle multiple extraTypes for different controllers', () => {
        const endpoints: ParsedEndpoint[] = []

        const extraTypes: ExtraControllerType[] = [
            {
                controller: 'ai-studio',
                typeName: 'SSEEvent',
                typeDefinition: '{ type: string }',
            },
            {
                controller: 'checkout',
                typeName: 'PaymentStatus',
                typeDefinition: "'pending' | 'completed' | 'failed'",
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints, extraTypes)

        expect(result.namespaceImports).toContain('AIStudioAPI')
        expect(result.namespaceImports).toContain('CheckoutAPI')
        expect(result.typeDefinitions).toHaveLength(2)
    })

    it('should handle extraTypes without any endpoints (undefined extraTypes)', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/items',
                handler: 'item.find',
                controller: 'item',
                action: 'find',
            },
        ]

        const result = convertEndpointsToCustomTypes(endpoints, undefined)

        expect(result.types.size).toBe(0)
        expect(result.typeDefinitions).toEqual([])
    })

    it('degrades unresolved named types to `unknown` and preserves known ones', () => {
        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/items/x',
                handler: 'item.getX',
                controller: 'item',
                action: 'getX',
                types: { response: '{ item: Item; widget: GenerationView }' },
            },
        ]

        const result = convertEndpointsToCustomTypes(
            endpoints,
            undefined,
            new Set(['Item']),
        )
        const def = result.typeDefinitions.join('\n')

        expect(def).toContain('item: Item') // known type preserved
        expect(def).toContain('widget: unknown') // unknown type degraded
        expect(def).not.toMatch(/widget:\s*GenerationView/)
        expect(def).toContain('could not be resolved') // discoverable note
    })
})
