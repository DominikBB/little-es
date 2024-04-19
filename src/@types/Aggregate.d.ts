import { Command } from "./Command";
import { EventStoreResult } from "./LittleEsEvent";

/**
 * **Aggregate** is a data structure that describes a domain object.
 * An aggregate is identifiable by a string key of your choosing, eg. *a Product is an aggregate that can be identified by an SKU*
 * The **Aggregate** object is like a repository which will hold and process all of the aggregates of its given type.
 *
 * It has business logic within the command handling and describes the
 * logic of your application / domain.
 *
 */
export type Aggregate<TAGGREGATE, TCOMMAND extends Command> = {
    /**
     * 
     * @param id Id of the aggregate that the command needs to be handled by - eg. *product sku*, *booking number*
     * @param command The command that the aggregate needs to process
     * @returns Returns an EventStoreResult with an aggregates new state or an error
     */
    readonly push: (id: string, command: TCOMMAND) => Promise<EventStoreResult<TAGGREGATE>>;
    /**
     * 
     * @param id Id of the aggregate that you would like to retrieve state of - eg. *product sku*, *booking number*
     * @returns Returns an EventStoreResult with an aggregates new state or an error
     */
    readonly get: (id: string) => Promise<EventStoreResult<TAGGREGATE>>;
};
