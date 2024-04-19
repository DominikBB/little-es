import { BaseEvent } from "./BaseEvent";
import { EventStoreResult, LittleEsEvent } from "./LittleEsEvent";

/**
 * TODO: Support publishing flow of events
 * **PublishingHandler** is the event publishing layer of Little ES.
 *
 * You should full-fill this type to create a custom event publishing function, or you can use the existing ones.
 * 
 * ### Suggested behavior
 * The following behavior is suggested for a PublishingHandler:
 * - ✅ use an outbox pattern to ensure event delivery, and deduplication.
 * - ✅ ensure **at most once** delivery to the destination
 * - ✅ ensure that the whole contents of the event are published to comply with CloudEvents spec., and any tracing or custom data is forwarded if it exists
 */
export type PublishingHandler<TAGGREGATE, TEVENT extends BaseEvent> = (state: TAGGREGATE, event: readonly LittleEsEvent<TEVENT>[]) => Promise<EventStoreResult<null>>;
