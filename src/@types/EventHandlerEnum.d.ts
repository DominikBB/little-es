import { BaseEvent } from "./BaseEvent";
import { LittleEsEvent } from "./LittleEsEvent";

/**
 * **EventHandlerEnum** like the *CommandHandlerEnum* is a helper that provides a fully typed interface for creating an object containing handlers for all events.
 *
 * ### Example (es module)
 * ```js
 *  const eventHandlers = {
 *     "ProductCreated": (event, product) => {...product, product.name = event.data.name},
 *     "ProductPriceChanged": (event, product) => {...product, product.price = event.data.price},
 *  }
 * ```
 */
export type EventHandlerEnum<TAGGREGATE, TEVENT extends BaseEvent> = {
    readonly [E in TEVENT['type']]: (aggregate: TAGGREGATE, event: LittleEsEvent<Extract<TEVENT, { readonly type: E; }>>) => TAGGREGATE;
};
