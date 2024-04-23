import { BaseEvent } from "./BaseEvent";
import { Command } from "./Command";
import { EventStoreResult } from "./LittleEsEvent";


/**
 * **CommandHandlerEnum** is a helper type that allows you to create a fully typed object
 * that contains handlers for all commands.
 * 
 * ### Example
 * ```ts
 *  const commandHandlers = {
 *     "CreateProduct": (command, product) => productDoesntExist(product)
 *          ? {success: true, data: [createProductEvent(command)]}
 *          : {success: false, at: "Command", error: "Product already exists"},
 *     "ChangeProductPrice": (command, product) => changeProductPriceHandler(command, product),
 *  }
 * ```
 */
export type CommandHandlerEnum<TAGGREGATE, TCOMMANDS extends Command, TEVENT extends BaseEvent> = {
    readonly [E in TCOMMANDS['type']]: (aggregate: TAGGREGATE, command: Extract<TCOMMANDS, { readonly type: E; }>) => Promise<EventStoreResult<readonly TEVENT[]>>;
};
