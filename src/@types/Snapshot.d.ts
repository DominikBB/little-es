
/**
 * Snapshot contains the current state of the aggregate, an **eventSequence** at which it was created and an aggregate id.
 * 
 * - *lastConsideredEvent* is used to determine which events have been considered when creating state. Its based on the event id.
 * - *schemaVersion* is used to determine which version of the projection is being processed.
 */
export type Snapshot<TPROJECTION> = {
    readonly name: string;
    readonly lastConsideredEvent: string;
    readonly state: TPROJECTION;
    readonly schemaVersion: number;
};
