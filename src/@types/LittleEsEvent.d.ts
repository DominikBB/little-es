import { BaseEvent } from "./BaseEvent";
import { CloudEventV1 } from "./CloudEventV1";
import { LittleEsEventMetadata } from "./LittleEsEventMetadata";

/**
 * **LittleEsEvent** is what little-es stores, and publishes, its made up of the users event, and all CloudEvent V1 specification requirements.
 *
 * Little ES will create this type out of users BaseEvent and use it for
 * the processing and persistance. Event handlers have access to this event.
 */

export type LittleEsEvent<TEVENTDEFINITION extends BaseEvent> =
    CloudEventV1 &
    LittleEsEventMetadata &
    TEVENTDEFINITION;

export type EventStoreResult<T> = {
    readonly success: true;
    readonly data: T;
} | {
    readonly success: false;
    readonly at: "Many" | "Persistance" | "Command" | "Projection" | "Publishing";
    readonly error: string;
};
