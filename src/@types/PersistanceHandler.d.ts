import { BaseEvent } from "./BaseEvent";
import { EventStoreResult, LittleEsEvent } from "./LittleEsEvent";
import { PersistedAggregate } from "./PersistedAggregate";
import { Snapshot } from "./Snapshot";

/**
 * **PersistanceHandler** is the data storage and persistance layer for Little ES.
 *
 * You should full-fill this type to create a custom event store, or you can use the existing ones.
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
    readonly get: (id: string) => Promise<EventStoreResult<PersistedAggregate<TAGGREGATE, TEVENT>>>;
    readonly getAllEvents: (projectionName: string) => () => Promise<EventStoreResult<PersistedAggregate<TAGGREGATE, TEVENT>>>;
    readonly snapshot: (snapshot: Snapshot<TAGGREGATE>) => Promise<EventStoreResult<null>>;
};
