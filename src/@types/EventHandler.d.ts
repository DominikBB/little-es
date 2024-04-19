import { BaseEvent } from "./BaseEvent";
import { LittleEsEvent } from "./LittleEsEvent";

/**
 * **EventHandler** is the event handling layer of Little ES.
 *
 * Used to hydrate the aggregate or projections. It will run on every aggregate retrieval, and should not contain side effects or processing logic.
 * The handler should be fairly simple as it really only maps event data to state.
 *
 * ### Example (es module)
 * ```js
 * const productEventHandler = (event, aggregate) => {
 *  const eventHandlers = {
 *     "ProductCreated": (event, product) => {...product, product.name = event.data.name},
 *     "ProductPriceChanged": (event, product) => {...product, product.price = event.data.price},
 *  }
 *
 *  return eventHandlers[event.type];
 * }
 * ```
 */
export type EventHandler<TAGGREGATE, TEVENT extends BaseEvent> = (aggregate: TAGGREGATE, event: LittleEsEvent<TEVENT>) => TAGGREGATE;
