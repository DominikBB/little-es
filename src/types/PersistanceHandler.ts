import { BaseEvent } from "./BaseEvent";
import { EventStoreResult, LittleEsEvent } from "./LittleEsEvent";
import { PersistedProjection } from "./PersistedAggregate";
import { Snapshot } from "./Snapshot";

/**
 * **PersistanceHandler** is the data storage and persistance layer for Little ES.
 *
 * You should full-fill this type to create a custom event store, or you can use the existing ones.
 * 
 * ### get(subject) vs getProjection()
 * - **get(subject)** is used to retrieve the current state of an aggregate based on its identification (subject).
 * - **getProjection(projectionName)** is used to retrieve all events for a projection, when an id is supplied, it should be used to filter down a specific projection, otherwise the projection is unique only by its name. 
 * 
 * ### Behavior expectations
 * The following behavior is expected from the PersistanceHandlers:
 * - ✅ ensure that they can **store and retrieve** events based on an **event subject field**
 * - ✅ can **store an aggregate object and retrieve** it based on its **string ID**
 * - ✅ when there is an aggregate snapshot, it **should return the latest snapshot**, and **only the events that happened after the snapshot** as determined by the sequential *event id* field.
 * - ❌ should **not implement** any custom **event handling logic**
 */
export type PersistanceHandler<TAGGREGATE, TEVENT extends BaseEvent> = {
    readonly save: (events: readonly LittleEsEvent<TEVENT>[]) => Promise<EventStoreResult<null>>;
    readonly get: (subject: string) => Promise<EventStoreResult<readonly LittleEsEvent<TEVENT>[]>>;
    readonly getProjection: (projectionName: string) => (id?: string) => Promise<EventStoreResult<PersistedProjection<TAGGREGATE, TEVENT>>>;
    readonly snapshot: (snapshot: Snapshot<TAGGREGATE>) => Promise<EventStoreResult<null>>;
};
