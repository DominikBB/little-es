/* eslint-disable functional/immutable-data */
/* eslint-disable functional/prefer-readonly-type */
import anyTest, { TestFn } from 'ava';

import { LittleEsEvent } from '../types/LittleEsEvent';
import { NamedProjection } from '../types/NamedProjection';
import { Snapshot } from '../types/Snapshot';

import { createNamedProjection } from './projection';
import { mockPersistanceHandler, ProductEvent, ProductHistoryProjection, projectionTestEventData } from './testdata.spec';

const namedProjectionTests = anyTest as TestFn<{
    events: LittleEsEvent<ProductEvent>[],
    snapshots: Snapshot<ProductHistoryProjection>[],
    sut: NamedProjection<ProductHistoryProjection>
}>;

namedProjectionTests.beforeEach(t => {
    t.context.events = []
    t.context.snapshots = []

    t.context.sut = createNamedProjection<ProductHistoryProjection, ProductEvent>({
        projectionName: "ProductHistoryProjection",
        defaultProjection: { list: [] as readonly ProductEvent[], lastChangedAt: "" },
        eventHandler: (agg, ev) => ({ list: [...agg.list, ev], lastChangedAt: ev.time }),
        persistanceHandler: mockPersistanceHandler(t),
        snapshot: { frequency: 4, schemaVersion: 1 }
    })

    t.context.events = projectionTestEventData()
});

namedProjectionTests("it can create a named projection out of events", async (t) => {
    const result = await t.context.sut.get('1')

    t.log(result)
    t.is(result.success, true);
    if (result.success) {
        t.is(result.data.list.length, projectionTestEventData().length)
        t.is(result.data.lastChangedAt, projectionTestEventData().slice(-1)[0].time)
    } else {
        t.fail()
    }
})

namedProjectionTests("it can create a named projection out of snapshots and events", async (t) => {
    const snapshotAtSequence = 5
    t.context.snapshots.push({
        name: '1',
        lastConsideredEvent: projectionTestEventData()[snapshotAtSequence].id,
        state: {
            list: [],
            lastChangedAt: projectionTestEventData()[snapshotAtSequence].time
        },
        schemaVersion: 1
    })

    const result = await t.context.sut.get('1')

    t.is(result.success, true);
    if (result.success) {
        t.log("Number of snapshots stored", t.context.snapshots.length)
        t.log("Number of events in the projected list: ", result.data.list.length)
        t.is(result.data.lastChangedAt, projectionTestEventData().slice(-1)[0].time)
        t.is(result.data.list.length, 1)
    } else {
        t.fail()
    }
})

namedProjectionTests("it can snapshot a named projection out of events", async (t) => {
    // with 7 stored events, 0 snapshots, the next get() call should produce a snapshot
    await t.context.sut.get('1')

    const result = await t.context.sut.get('1')

    t.log(t.context.snapshots)
    t.is(result.success, true);
    t.is(t.context.snapshots.length, 1);
})