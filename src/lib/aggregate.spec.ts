/* eslint-disable functional/immutable-data */
/* eslint-disable functional/prefer-readonly-type */

import { TestInterface } from 'ava';
import anyTest from 'ava';

import { Aggregate } from '../@types/Aggregate';
import { LittleEsEvent } from '../@types/LittleEsEvent';
import { Snapshot } from '../@types/Snapshot';

import { createAggregate } from './aggregate';
import { aggregateEventHandlers, commandHandlers, mockPersistanceHandler, Product, ProductCommand, ProductEvent } from './testdata.spec';

const test = anyTest as TestInterface<{
    events: LittleEsEvent<ProductEvent>[],
    snapshots: Snapshot<Product>[],
    published: LittleEsEvent<ProductEvent & { topic: string }>[]
    sut: Aggregate<Product, ProductCommand>,
}>;

test.beforeEach(t => {
    t.context.events = []
    t.context.snapshots = []
    t.context.published = []

    t.context.sut = createAggregate<Product, ProductCommand, ProductEvent>({
        serviceName: "little-es-tests",
        defaultAggregate: { name: "", price: 0, id: '0', listed: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        commandHandler: async (agg, cmd) => commandHandlers[cmd.type](agg, cmd as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventHandler: (agg, ev) => aggregateEventHandlers[ev.type](agg, ev as any),
        persistanceHandler: mockPersistanceHandler(t),
        snapshotInformation: { frequency: 4, aggregateVersion: 1 },
        publishingHandler: async (_, event) => {
            t.context.published.push({ ...event, topic: "test" } as unknown as LittleEsEvent<ProductEvent & { topic: string }>);
            return { success: true, data: null }
        }
    })
});

test('it will handle commands and produce correct state', async (t) => {
    const result = await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })

    t.is(result.success, true);
    if (result.success) {
        t.is(result.data.id, '1')
        t.is(result.data.name, 'test')
    } else {
        t.fail()
    }
});

test('it will get an aggregate with correct state', async (t) => {
    await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 123, id: '1' })
    const result = await t.context.sut.get('1')

    t.is(result.success, true);
    if (result.success) {
        t.is(result.data.id, '1')
        t.is(result.data.name, 'test')
        t.is(result.data.price, 123)
    } else {
        t.fail()
    }
});

test('it will handle commands and produce multiple events', async (t) => {
    const result = await t.context.sut.push('1', { type: 'addListedProduct', name: 'test', id: '1' })

    t.true(result.success);
    if (result.success) {
        t.true(result.data.listed)
        t.is(t.context.events.length, 2)
    } else {
        t.fail()
    }
});

test('it will handle bad commands and produce correct command error result', async (t) => {
    const addedEvent = await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })
    if (!addedEvent.success) { t.fail(addedEvent.error) }

    const result = await t.context.sut.push('1', { type: 'addProduct', name: 'test2', id: '1' })

    t.is(t.context.events.length, 1)

    t.is(result.success, false);
    if (!result.success) {
        t.is(result.at, 'Command')
    } else {
        t.fail()
    }
});

test('it will hydrate from snapshot and events and produce correct state', async (t) => {
    t.context.snapshots.push({ id: '1', state: { name: 'test', price: 0, id: '1', listed: false }, eventSequence: 1, aggregateVersion: 1 })

    const result = await t.context.sut.get('1')

    t.is(result.success, true);
    if (result.success) {
        t.is(result.data.name, 'test')
        t.is(result.data.id, '1')
    } else {
        t.fail()
    }
});

test("it will produce a correct sequential id for events", async (t) => {
    await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 123, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 223, id: '1' })

    // t.log(...t.context.events)
    t.is(t.context.events.length, 3)
    t.is(t.context.events[2].id, "4")
});

test("it will create a snapshot at specified interval", async (t) => {
    await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 223, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 224, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 225, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 126, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 227, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 228, id: '1' })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 229, id: '1' })

    t.log(t.context.snapshots)
    t.log(t.context.events)
    t.is(t.context.snapshots.length, 2)
});

test("it will ignore snapshots of an old version of the aggregate", async (t) => {
    await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })
    t.context.snapshots.push({ id: '1', state: { name: 'tested', price: 0, id: '1', listed: false }, eventSequence: 1, aggregateVersion: 1 })
    await t.context.sut.push('1', { type: 'changeProductPrice', price: 225, id: '1' })

    const newAggregateVersion = t.context.sut = createAggregate<Product, ProductCommand, ProductEvent>({
        serviceName: "little-es-tests",
        defaultAggregate: { name: "", price: 0, id: '0', listed: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        commandHandler: async (agg, cmd) => commandHandlers[cmd.type](agg, cmd as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventHandler: (agg, ev) => aggregateEventHandlers[ev.type](agg, ev as any),
        persistanceHandler: mockPersistanceHandler(t),
        snapshotInformation: { frequency: 4, aggregateVersion: 2 }
    })

    const result = await newAggregateVersion.get('1');

    t.is(result.success, true);
    if (result.success) {
        t.is(result.data.name, 'test')
    } else {
        t.fail()
    }
});

test("it will publish an event through a publishing handler", async (t) => {
    await t.context.sut.push('1', { type: 'addProduct', name: 'test', id: '1' })

    t.is(t.context.published.length, 1)
});