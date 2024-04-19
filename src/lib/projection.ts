import { BaseEvent } from "../@types/BaseEvent";
import { EventHandler } from "../@types/EventHandler";
import { GlobalProjection } from "../@types/GlobalProjection";
import { EventStoreResult } from "../@types/LittleEsEvent";
import { NamedProjection } from "../@types/NamedProjection";
import { PersistanceHandler } from "../@types/PersistanceHandler";
import { PersistedAggregate } from "../@types/PersistedAggregate";

import { hydrateProjectionFromSnapshot, SafeArray, snapshotProjection } from "./util";

export type ProjectionOptions<TPROJECTION, TEVENT extends BaseEvent> = {
    readonly projectionName: string,
    readonly defaultProjection: TPROJECTION,
    readonly eventHandler: EventHandler<TPROJECTION, TEVENT>,
    readonly persistanceHandler: PersistanceHandler<TPROJECTION, TEVENT>,
    readonly snapshotInfo?: { readonly frequency: number, readonly aggregateVersion: number },
}

/**
 * Creates an Aggregate, this is a starting point of all
 * of your event sourcing.
 *
 * @param serviceName - The name of the service, used for the source field in the cloud events.
 * @param defaultAggregate - A default/empty instance of the aggregate, used before any events are applied.
 * @param commandHandler - A function that takes a command and the current state of the aggregate and returns a result of processing, it can return some new events.
 * @param eventHandler - A function that takes an event and the current state of the aggregate and returns the new state of the aggregate.
 * @param persistanceHandler - A way to store and retrieve events.
 * @param snapshotFrequency How often should a snapshot of the aggregate be taken? **Defaults to 0** for easier development experience. Increasing the value is highly recommended for production.
 * @returns An `Aggregate` object.
 * ---
*
 * ### Example
 * ```ts
 * import { createAggregate } from 'little-es'
*
 * const productAggregate = createAggregate<Product, ProductCommand, ProductEvent>(
 *      "little-es-tests",
 *      { name: "", price: 0, id: '0', listed: false },
 *      async (agg, cmd) => commandHandlers[cmd.type](agg, cmd as any),
 *      (agg, ev) => eventHandlers[ev.type](agg, ev as any),
 *      mockPersistanceHandler
 *   )
 *
 * const newProduct = await productAggregate.push('1', { type: 'addProduct', name: 'test', id: '1' })
 * console.log(newProduct);
 * // -> {name: 'shoe', price: 100, stock: 0}
 * ```
 *
*/
export function createNamedProjection<TPROJECTION, TEVENT extends BaseEvent>(
    opt: ProjectionOptions<TPROJECTION, TEVENT>,
): NamedProjection<TPROJECTION> {

    return {
        get: getNamedProjectionWorkflow(
            opt.persistanceHandler.get,
            hydrateProjectionFromSnapshot(opt.defaultProjection, opt.eventHandler, opt.snapshotInfo?.aggregateVersion),
            snapshotProjection(opt.persistanceHandler, opt.snapshotInfo)
        ),
    }
}

export function createGlobalProjection<TPROJECTION, TEVENT extends BaseEvent>(
    opt: ProjectionOptions<TPROJECTION, TEVENT>,
): GlobalProjection<TPROJECTION> {

    return {
        get: getGlobalProjectionWorkflow(
            opt.persistanceHandler.getAllEvents(opt.projectionName),
            hydrateProjectionFromSnapshot(opt.defaultProjection, opt.eventHandler, opt.snapshotInfo?.aggregateVersion),
            snapshotProjection(opt.persistanceHandler, opt.snapshotInfo),
            opt.projectionName
        ),
    }
}

const getNamedProjectionWorkflow = <TPROJECTION, TEVENT extends BaseEvent>(
    retrieveAggregateEvents: PersistanceHandler<TPROJECTION, TEVENT>['get'],
    hydrateProjection: (state: PersistedAggregate<TPROJECTION, TEVENT>) => TPROJECTION,
    snapshotProjection: (id: string, state: TPROJECTION, eventSequence: { readonly last: number; readonly current: number; }) => Promise<EventStoreResult<null>>,
) =>
    async (id: string): Promise<EventStoreResult<TPROJECTION>> => {
        const existingEventsResult = await retrieveAggregateEvents(id);
        if (!existingEventsResult.success) return existingEventsResult;

        const projection = hydrateProjection(existingEventsResult.data);

        await snapshotProjection(
            id,
            projection,
            {
                last: existingEventsResult.data.snapshot?.eventSequence ?? 1,
                current: SafeArray(existingEventsResult.data.events) ? parseInt(existingEventsResult.data.events.slice(-1)[0].id) : (existingEventsResult.data.snapshot?.eventSequence ?? 1)
            }
        );

        return { success: true, data: projection };
    }

const getGlobalProjectionWorkflow = <TPROJECTION, TEVENT extends BaseEvent>(
    retrieveAggregateEvents: () => Promise<EventStoreResult<PersistedAggregate<TPROJECTION, TEVENT>>>,
    hydrateProjection: (state: PersistedAggregate<TPROJECTION, TEVENT>) => TPROJECTION,
    snapshotProjection: (id: string, state: TPROJECTION, eventSequence: { readonly last: number; readonly current: number; }) => Promise<EventStoreResult<null>>,
    projectionName: string
) =>
    async (): Promise<EventStoreResult<TPROJECTION>> => {
        const existingEventsResult = await retrieveAggregateEvents();
        if (!existingEventsResult.success) return existingEventsResult;

        const projection = hydrateProjection(existingEventsResult.data);

        await snapshotProjection(
            projectionName,
            projection,
            {
                last: existingEventsResult.data.snapshot?.eventSequence ?? 1,
                current: SafeArray(existingEventsResult.data.events) ? parseInt(existingEventsResult.data.events.slice(-1)[0].id) : (existingEventsResult.data.snapshot?.eventSequence ?? 1)
            }
        );

        return { success: true, data: projection };
    }