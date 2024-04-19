import { BaseEvent } from "../@types/BaseEvent";
import { EventHandler } from "../@types/EventHandler";
import { EventStoreResult, LittleEsEvent } from "../@types/LittleEsEvent";
import { PersistanceHandler } from "../@types/PersistanceHandler";
import { PersistedAggregate } from "../@types/PersistedAggregate";

export const SafeArray = (arr: readonly unknown[]) => arr?.length;

export type IsEmptyObject<Obj extends Record<PropertyKey, unknown>> = readonly [keyof Obj] extends readonly [never] ? true : false;

export function isEmpty<Obj extends Record<PropertyKey, unknown>>(obj: Obj): IsEmptyObject<Obj>;
export function isEmpty<Obj extends Record<PropertyKey, unknown>>(obj: Obj) {
    return Object.keys(obj).length === 0;
}

export const hydrateProjectionFromSnapshot = <TPROJECTION, TEVENT extends BaseEvent>(
    defaultProjection: TPROJECTION,
    eventHandler: EventHandler<TPROJECTION, TEVENT>,
    currentAggregateVersion?: number
) =>
    (state: PersistedAggregate<TPROJECTION, TEVENT>) =>
        state.events.reduce(
            (agg, e) => eventHandler(agg, e),
            (state.snapshot && hasValidSnapshot(state, currentAggregateVersion)
                ? state.snapshot.state
                : defaultProjection))

export const hydrateProjectionFromState = <TPROJECTION, TEVENT extends BaseEvent>(
    defaultProjection: TPROJECTION,
    eventHandler: EventHandler<TPROJECTION, TEVENT>,
) =>
    (events: readonly LittleEsEvent<TEVENT>[], state?: TPROJECTION) =>
        events.reduce(
            (agg, e) => eventHandler(agg, e),
            (state && !isEmpty(state) ? state : defaultProjection))

export const snapshotProjection = <TPROJECTION, TEVENT extends BaseEvent>(persistanceHandler: PersistanceHandler<TPROJECTION, TEVENT>, snapshotInfo?: { readonly frequency: number, readonly aggregateVersion: number }) =>
    async (id: string, state: TPROJECTION, eventSequence: { readonly last: number, readonly current: number }): Promise<EventStoreResult<null>> =>
        snapshotInfo && eventSequence.current - eventSequence.last >= snapshotInfo.frequency
            ? persistanceHandler.snapshot({ id: id, eventSequence: eventSequence.current, state: state, aggregateVersion: snapshotInfo.aggregateVersion })
            : Promise.resolve({ success: true, data: null }
            );

const hasValidSnapshot = <TPROJECTION, TEVENT extends BaseEvent>(state: PersistedAggregate<TPROJECTION, TEVENT>, currentAggregateVersion: number | undefined) =>
    state.snapshot && currentAggregateVersion && !isEmpty(state.snapshot) && state.snapshot.aggregateVersion === currentAggregateVersion;