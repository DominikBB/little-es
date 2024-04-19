/* eslint-disable functional/immutable-data */
/* eslint-disable functional/prefer-readonly-type */
import anyTest, { TestInterface } from 'ava';

import { GlobalProjection } from '../@types/GlobalProjection';
import { LittleEsEvent } from '../@types/LittleEsEvent';
import { Snapshot } from '../@types/Snapshot';

import { createGlobalProjection } from './projection';
import { mockPersistanceHandler, ProductEvent, ProductPriceChangesGlobalProjection, projectionTestEventData } from './testdata.spec';

const globalProjectionTests = anyTest as TestInterface<{ events: LittleEsEvent<ProductEvent>[], snapshots: Snapshot<ProductPriceChangesGlobalProjection>[], sut: GlobalProjection<ProductPriceChangesGlobalProjection> }>;

globalProjectionTests.beforeEach(t => {
    t.context.events = []
    t.context.snapshots = []

    t.context.sut = createGlobalProjection<ProductPriceChangesGlobalProjection, ProductEvent>({
        projectionName: 'ProductHistoryProjection',
        defaultProjection: { count: 0 },
        eventHandler: (agg, _) => ({ count: agg.count + 1 }),
        persistanceHandler: mockPersistanceHandler(t),
        snapshotInfo: { frequency: 4, aggregateVersion: 1 }
    })

    t.context.events = projectionTestEventData()
});

globalProjectionTests("it can create a global projection out of events", async (t) => {
    const result = await t.context.sut.get()

    t.log(result)
    t.is(result.success, true);
    if (result.success) {
        t.is(result.data.count, 7)
    } else {
        t.fail()
    }
})

globalProjectionTests("it can create a global projection out of snapshots and events", async (t) => {
    const snapshotAtSequence = 5

    t.context.snapshots.push({
        id: 'ProductHistoryProjection',
        eventSequence: parseInt(projectionTestEventData()[snapshotAtSequence].id),
        state: {
            count: 1
        },
        aggregateVersion: 1
    })

    const result = await t.context.sut.get()

    t.is(result.success, true);
    if (result.success) {
        t.log(result.data)
        t.is(result.data.count, 2)
    } else {
        t.fail()
    }
})

globalProjectionTests("it can snapshot a global projection out of events", async (t) => {
    // with 7 stored events, 0 snapshots, the next get() call should produce a snapshot
    await t.context.sut.get()

    const result = await t.context.sut.get()

    t.log(t.context.snapshots)
    t.is(result.success, true);
    t.is(t.context.snapshots.length, 1);
})