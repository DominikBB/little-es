import { BaseEvent } from "./BaseEvent";
import { Command } from "./Command";
import { EventStoreResult } from "./LittleEsEvent";

/**
 * **CommandHandler** is the business logic layer of Little ES.
 *
 * It will run once, and can contain side effects, it also produces state changes (events).
 *
 * ### Notes
 * - Validation of the command data should always be carried out
 * - Ensure that you are not processing duplicate commands, little-es cannot always make sure of that depending on your system specifics 
 * 
 * ### Example
 * ```js
 * const productCommandHandler = (command, aggregate) => {
 *  const commandHandlers = {
 *     "CreateProduct": (command, product) => productDoesntExist(product)
 *          ? {success: true, data: [createProductEvent(command)]}
 *          : {success: false, at: "Command", error: "Product already exists"},
 *     "ChangeProductPrice": (command, product) => changeProductPriceHandler(command, product),
 *  }
 *
 *  return commandHandlers[command.type];
 * }
 * ```
 */
export type CommandHandler<TAGGREGATE, TCOMMANDS extends Command, TEVENT extends BaseEvent> = (aggregate: TAGGREGATE, command: TCOMMANDS) => Promise<EventStoreResult<readonly TEVENT[]>>;
