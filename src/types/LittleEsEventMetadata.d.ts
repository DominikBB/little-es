/**
 * **LittleEsEventMetadata** contains Little ES specific data used for processing events.
 */
export type LittleEsEventMetadata = {
    readonly source: string;
    readonly id: string;
    readonly littleEs: {
        // readonly aggregateVersion: number;
        // readonly eventVersion: number;
        readonly littleEsVersion: number;
        readonly is: "PrivateEvent" | "PublicEvent" | "NamedProjection" | "GlobalProjection" | "AggregateSnapshot";
    };
};
