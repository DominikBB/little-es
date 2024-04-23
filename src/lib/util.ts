import { BaseEvent } from "../types/BaseEvent";
import { EventHandler } from "../types/EventHandler";
import { EventStoreResult, LittleEsEvent } from "../types/LittleEsEvent";
import { PersistanceHandler } from "../types/PersistanceHandler";
import { PersistedProjection } from "../types/PersistedAggregate";

export const SafeArray = (arr: readonly unknown[]) => arr?.length;

export type IsEmptyObject<Obj extends Record<PropertyKey, unknown>> = readonly [keyof Obj] extends readonly [never] ? true : false;

export function isEmpty<Obj extends Record<PropertyKey, unknown>>(obj: Obj): IsEmptyObject<Obj>;
export function isEmpty<Obj extends Record<PropertyKey, unknown>>(obj: Obj) {
    return Object.keys(obj).length === 0;
}

export const hydrateProjectionFromSnapshot = <TPROJECTION, TEVENT extends BaseEvent>(
    defaultProjection: TPROJECTION,
    eventHandler: EventHandler<TPROJECTION, TEVENT>,
    currentSchemaVersion?: number
) =>
    (state: PersistedProjection<TPROJECTION, TEVENT>) =>
        state.events.reduce(
            (agg, e) => eventHandler(agg, e),
            (state.snapshot && hasValidSnapshot(state, currentSchemaVersion)
                ? state.snapshot.state
                : defaultProjection))

export const hydrateAggregate = <TPROJECTION, TEVENT extends BaseEvent>(
    defaultProjection: TPROJECTION,
    eventHandler: EventHandler<TPROJECTION, TEVENT>,
) =>
    (events: readonly LittleEsEvent<TEVENT>[], state?: TPROJECTION) =>
        events.reduce(
            (agg, e) => eventHandler(agg, e),
            (state && !isEmpty(state) ? state : defaultProjection))

export const snapshotProjection = <TPROJECTION, TEVENT extends BaseEvent>(persistanceHandler: PersistanceHandler<TPROJECTION, TEVENT>, config?: { readonly frequency: number, readonly schemaVersion: number }) =>
    async (projectionName: string, state: TPROJECTION, latestEventId: string, lastSnapshotEventId: string): Promise<EventStoreResult<null>> =>
        config
            && validateEventId(latestEventId)
            && validateEventId(lastSnapshotEventId)
            && extractEventSequenceId(latestEventId) - extractEventSequenceId(lastSnapshotEventId) >= config.frequency
            ? persistanceHandler.snapshot({ name: projectionName, lastConsideredEvent: latestEventId, state: state, schemaVersion: config.schemaVersion })
            : Promise.resolve({ success: true, data: null }
            );

const hasValidSnapshot = <TPROJECTION, TEVENT extends BaseEvent>(state: PersistedProjection<TPROJECTION, TEVENT>, currentSchemaVersion: number | undefined) =>
    state.snapshot && currentSchemaVersion && !isEmpty(state.snapshot) && state.snapshot.schemaVersion === currentSchemaVersion;

export const validateEventId = (id: string) => id.split(ID_SEPARATOR).length >= 2 && parseInt(id.split(ID_SEPARATOR)[0]) > 0;
export const extractEventSequenceId = (id: string) => parseInt(id.split(ID_SEPARATOR)[0]);

export const ID_SEPARATOR = "_";