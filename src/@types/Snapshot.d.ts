
/**
 * Snapshot contains the current state of the aggregate, an **eventSequence** at which it was created and an aggregate id.
 * 
 * - *eventSequence* is used to determine which events have been considered when creating state.
 * - *aggregateVersion* is used to determine which version of the aggregate is being processed.
 */
export type Snapshot<TAGGREGATE> = {
    readonly id: string;
    readonly eventSequence: number;
    readonly state: TAGGREGATE;
    readonly aggregateVersion: number;
};
