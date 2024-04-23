import { BaseEvent } from "./BaseEvent";
import { LittleEsEvent } from "./LittleEsEvent";
import { Snapshot } from "./Snapshot";


/**
 * Mostly for internal functioning, it returns the latest state snapshot, if any, and the events that happened after the snapshot.
 */
export type PersistedProjection<TPROJECTION, TEVENT extends BaseEvent> = {
    readonly id: string;
    readonly snapshot?: Snapshot<TPROJECTION>;
    readonly events: readonly LittleEsEvent<TEVENT>[];
};
