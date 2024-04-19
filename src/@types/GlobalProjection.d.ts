/**
 * **GlobalProjection** is a global projection which is unique to the whole system.
 *
 * Its useful for creating data views for reporting and management *eg. out of stock products*.
 *
 */

import { EventStoreResult } from "./LittleEsEvent";

export type GlobalProjection<TPROJECTION> = {
    readonly get: () => Promise<EventStoreResult<TPROJECTION>>;
};
