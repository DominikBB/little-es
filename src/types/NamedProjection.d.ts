import { EventStoreResult } from "./LittleEsEvent";

/**
 * **NamedProjection** is a projection that can be queried by id.
 *
 * Its useful for creating data views that are not necessarily
 * using the same id as the aggregate root, but still need to be
 * identified *eg. customer's previous purchases, where a projection exists for each customer*.
 *
 */
export type NamedProjection<TPROJECTION> = {
    readonly get: (id: string) => Promise<EventStoreResult<TPROJECTION>>;
};
