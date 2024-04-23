import { BaseEvent } from "../types/BaseEvent";
import { EventHandler } from "../types/EventHandler";
import { GlobalProjection } from "../types/GlobalProjection";
import { EventStoreResult } from "../types/LittleEsEvent";
import { NamedProjection } from "../types/NamedProjection";
import { PersistanceHandler } from "../types/PersistanceHandler";
import { PersistedProjection } from "../types/PersistedAggregate";

import { hydrateProjectionFromSnapshot, SafeArray, snapshotProjection } from "./util";

/**
 * Configuration options for the Projections.
 * 
 * @param projectionName - The name of the projection.
 * @param defaultProjection - A default/empty instance of the projection, used before any events are applied.
 * @param commandHandler - A function that takes a command and the current state of the aggregate and returns a result of processing, it can return some new events.
 * @param eventHandler - A function that takes an event and the current state of the projection and returns the new state.
 * @param persistanceHandler - A way to retrieve events.
 * @param snapshot - Snapshots could be considered similar to caching of state. It is best to leave snapshots out until you have a stable model that doesn't change often. 
 * **frequency**: Defines how often per num./events a snapshot should be made. **schemaVersion**: The version of the projection that the snapshot was taken at, useful for invalidating snapshots after model changes.
 */
export type ProjectionOptions<TPROJECTION, TEVENT extends BaseEvent> = {
    readonly projectionName: string,
    readonly defaultProjection: TPROJECTION,
    readonly eventHandler: EventHandler<TPROJECTION, TEVENT>,
    readonly persistanceHandler: PersistanceHandler<TPROJECTION, TEVENT>,
    readonly snapshot?: { readonly frequency: number, readonly schemaVersion: number },
}

/**
 * Creates a named projection, this is an alternate view of state that can be identified.
 * 
 * eg. - in a shoe shop, if your Aggregate is a Shoe, your projection could be Sport shoes.
 *
 * @param ProjectionOptions - Configuration of the projection
 * @returns A `NamedProjection` object.
 * ---
*
 * ### Example
 * ```ts
 * import { createNamedProjection } from 'little-es'
*
 * const productCategories = createNamedProjection<ProductCategory, ProductEvent>({}
 *      projectionName: "productCategory",
 *      defaultProjection: { name: string, products: Product[] },
 *      eventHandler: (agg, ev) => eventHandlers[ev.type](agg, ev as any),
 *      persistanceHandler: mockPersistanceHandler
 *   })
 *
 * // Fetch state
 * const getCategories = await productCategories.get('shoes')
 * console.log(getFromStorage);
 * // -> {success: true, data: {name: 'shoes', products: [...]}}
 * ```
 *
*/
export function createNamedProjection<TPROJECTION, TEVENT extends BaseEvent>(
    opt: ProjectionOptions<TPROJECTION, TEVENT>,
): NamedProjection<TPROJECTION> {

    return {
        get: getNamedProjectionWorkflow(
            opt.persistanceHandler.getProjection(opt.projectionName),
            hydrateProjectionFromSnapshot(opt.defaultProjection, opt.eventHandler, opt.snapshot?.schemaVersion),
            snapshotProjection(opt.persistanceHandler, opt.snapshot)
        ),
    }
}

/**
 * Creates a global projection, this is an alternate view of state that is global and singular.
 * These are useful for creating operational reports, but unlike aggregates, and named projections, they should not be used to store specific user's data.
 * 
 * eg. - in a shoe shop, you might create a projection LowStockProducts.
 *
 * @param ProjectionOptions - Configuration of the projection
 * @returns A `GlobalProjection` object.
 * ---
*
 * ### Example
 * ```ts
 * import { createGlobalProjection } from 'little-es'
*
 * const lowStock = createGlobalProjection<LowStockProducts, ProductEvent>(
 *      projectionName: "lowStockProducts",
 *      defaultProjection: { name: string, products: Product },
 *      eventHandler: (agg, ev) => eventHandlers[ev.type](agg, ev as any),
 *      persistanceHandler: mockPersistanceHandler
 *   )
 *
 * // Fetch state
 * const getLowStockProducts = await lowStock.get('shoes')
 * console.log(getLowStockProducts);
 * // -> {success: true, data: {products: [...]}}
 * ```
 *
*/
export function createGlobalProjection<TPROJECTION, TEVENT extends BaseEvent>(
    opt: ProjectionOptions<TPROJECTION, TEVENT>,
): GlobalProjection<TPROJECTION> {

    return {
        get: getGlobalProjectionWorkflow(
            opt.persistanceHandler.getProjection(opt.projectionName),
            hydrateProjectionFromSnapshot(opt.defaultProjection, opt.eventHandler, opt.snapshot?.schemaVersion),
            snapshotProjection(opt.persistanceHandler, opt.snapshot),
            opt.projectionName
        ),
    }
}

const getNamedProjectionWorkflow = <TPROJECTION, TEVENT extends BaseEvent>(
    retrieveAggregateEvents: (id?: string) => Promise<EventStoreResult<PersistedProjection<TPROJECTION, TEVENT>>>,
    hydrateProjection: (state: PersistedProjection<TPROJECTION, TEVENT>) => TPROJECTION,
    snapshotProjection: (projectionName: string, state: TPROJECTION, latestEventId: string, lastSnapshotEventId: string) => Promise<EventStoreResult<null>>,
) =>
    async (id: string): Promise<EventStoreResult<TPROJECTION>> => {
        const existingEventsResult = await retrieveAggregateEvents(id);
        if (!existingEventsResult.success) return existingEventsResult;

        const projection = hydrateProjection(existingEventsResult.data);

        if (SafeArray(existingEventsResult.data.events)) {
            await snapshotProjection(
                id,
                projection,
                existingEventsResult.data.events.slice(-1)[0].id,
                existingEventsResult.data.snapshot?.lastConsideredEvent ?? "1_a"
            )
        };

        return { success: true, data: projection };
    }

const getGlobalProjectionWorkflow = <TPROJECTION, TEVENT extends BaseEvent>(
    retrieveAggregateEvents: (id?: string) => Promise<EventStoreResult<PersistedProjection<TPROJECTION, TEVENT>>>,
    hydrateProjection: (state: PersistedProjection<TPROJECTION, TEVENT>) => TPROJECTION,
    snapshotProjection: (projectionName: string, state: TPROJECTION, latestEventId: string, lastSnapshotEventId: string) => Promise<EventStoreResult<null>>,
    projectionName: string
) =>
    async (): Promise<EventStoreResult<TPROJECTION>> => {
        const existingEventsResult = await retrieveAggregateEvents();
        if (!existingEventsResult.success) return existingEventsResult;

        const projection = hydrateProjection(existingEventsResult.data);

        if (SafeArray(existingEventsResult.data.events)) {
            await snapshotProjection(
                projectionName,
                projection,
                existingEventsResult.data.events.slice(-1)[0].id,
                existingEventsResult.data.snapshot?.lastConsideredEvent ?? "1_a"
            )
        };

        return { success: true, data: projection };
    }
