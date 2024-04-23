/* eslint-disable functional/immutable-data */
/* eslint-disable functional/prefer-readonly-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExecutionContext } from "ava"

import { BaseEvent } from "../@types/BaseEvent"
import { CommandHandlerEnum } from "../@types/CommandHandlerEnum"
import { EventHandlerEnum } from "../@types/EventHandlerEnum"
import { LittleEsEvent } from "../@types/LittleEsEvent"
import { PersistanceHandler } from "../@types/PersistanceHandler"
import { Snapshot } from "../@types/Snapshot"

import { extractEventSequenceId, validateEventId } from "./util"

export type Product = {
    readonly id: string,
    readonly name: string,
    readonly price: number,
    readonly listed: boolean
}

export type ProductCommand =
    | { readonly type: "addProduct", readonly name: string, readonly id: string }
    | { readonly type: "addListedProduct", readonly name: string, readonly id: string }
    | { readonly type: "changeProductPrice", readonly price: number, readonly id: string }

export type ProductEvent =
    | { readonly type: "productCreated", readonly data: { readonly name: string, readonly id: string } }
    | { readonly type: "productPriceChanged", readonly data: { readonly price: number } }
    | { readonly type: "productIsPubliclyAvailable", readonly data: null }

export const commandHandlers: CommandHandlerEnum<Product, ProductCommand, ProductEvent> = {
    addProduct: (product, command) =>
        Promise.resolve(product.name === ""
            ? { success: true, data: [{ type: 'productCreated', subject: command.id.toString(), data: { name: command.name, id: command.id } }] }
            : { success: false, at: "Command", error: 'product already exists' }),

    addListedProduct: (product, command) =>
        Promise.resolve(product.name === ""
            ? {
                success: true, data: [
                    { type: 'productCreated', subject: command.id.toString(), data: { name: command.name, id: command.id } },
                    { type: 'productIsPubliclyAvailable', subject: command.id.toString(), data: null }
                ]
            }
            : { success: false, at: "Command", error: 'product already exists' }),

    changeProductPrice: (_, command) =>
        Promise.resolve({ success: true, data: [{ type: 'productPriceChanged', subject: command.id.toString(), data: { price: command.price } }] })
}

export const aggregateEventHandlers: EventHandlerEnum<Product, ProductEvent> = {
    productCreated: (aggregate, event) => ({ ...aggregate, name: event.data.name, id: event.data.id }),
    productPriceChanged: (aggregate, event) => ({ ...aggregate, price: event.data.price }),
    productIsPubliclyAvailable: (aggregate, _) => ({ ...aggregate, listed: true })
}

export type ProductPriceChangesGlobalProjection = {
    readonly count: number
}

export type ProductHistoryProjection = {
    readonly list: readonly ProductEvent[]
    readonly lastChangedAt: string
}

export const mockPersistanceHandler = <TAGGREGATE, TEVENT extends BaseEvent>(c: ExecutionContext<{
    readonly events: LittleEsEvent<TEVENT>[];
    readonly snapshots: Snapshot<TAGGREGATE>[];
}>
): PersistanceHandler<TAGGREGATE, TEVENT> => ({
    save: async (events) => {
        c.context.events.push(...events)
        return { success: true, data: null }
    },
    get: async (id) => {
        const events = c.context.events.filter(event => event.subject === id)

        return Promise.resolve({ success: true, data: events })
    },
    getProjection: (projection) => async (id?: string) => {
        const searchOn = id ?? projection

        const maybePreviousSnapshot = (i?: string) => {
            if (!i) return 0
            return validateEventId(i) ? extractEventSequenceId(i) : 0
        }

        const snapshot = c.context.snapshots.find(snapshot => snapshot.name === searchOn)
        const events = c.context.events.filter(event => maybePreviousSnapshot(snapshot?.lastConsideredEvent) < parseInt(event.id))

        return Promise.resolve({ success: true, data: { id: projection, snapshot: snapshot ?? {} as Snapshot<TAGGREGATE>, events } })
    },
    snapshot: async (snapshot) => {
        c.context.snapshots.push(snapshot)
        return Promise.resolve({ success: true, data: null })
    }
})

export function projectionTestEventData(): LittleEsEvent<ProductEvent>[] {
    return [
        {
            data: { name: 'test', id: '1' },
            datacontenttype: 'json',
            id: '2_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:37:50.937Z',
            type: 'productCreated',
        },
        {
            data: { price: 200 },
            datacontenttype: 'json',
            id: '3_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:38:50.937Z',
            type: 'productPriceChanged',
        },
        {
            data: { price: 201 },
            datacontenttype: 'json',
            id: '4_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:39:50.937Z',
            type: 'productPriceChanged',
        },
        {
            data: { price: 202 },
            datacontenttype: 'json',
            id: '5_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:40:50.937Z',
            type: 'productPriceChanged',
        },
        {
            data: { price: 203 },
            datacontenttype: 'json',
            id: '6_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:41:50.937Z',
            type: 'productPriceChanged',
        },
        {
            data: { price: 204 },
            datacontenttype: 'json',
            id: '7_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:42:50.937Z',
            type: 'productPriceChanged',
        },
        {
            data: { price: 205 },
            datacontenttype: 'json',
            id: '8_1',
            littleEs: { littleEsVersion: 1, is: 'PrivateEvent' },
            source: 'little-es-tests',
            specversion: '1.0',
            subject: '1',
            time: '2024-04-19T13:43:50.937Z',
            type: 'productPriceChanged',
        },
    ]
}