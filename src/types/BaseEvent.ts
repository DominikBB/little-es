/**
 * **BaseEvent** is the bare minimum that the user needs to declare for each event.
 *
 * Users can define this type further by extending it with their own data, and
 * defaults.
 * 
 * - **type** should be used as a discriminator of the events *eg. ProductCreated*. Events are named in the **past tense** as they represent the results of past events.
 * - **subject** is your aggregate, usually you can just use your identifier *eg. Product SKU*
 * - **data** should represent the state the event describes. Keep the events **as small as possible**, they should not represent the whole state, only the changes in the state.
 * 
 * # Example
 * You should define your event type as a union that extends BaseEvent
 * ```ts
 * type ProductEvent =
 *   | { readonly type: "productCreated", subject: string, data: { readonly sku: string } }
 *   | { readonly type: "productPriceChanged", subject: string, data: { readonly price: number } }
 *   | { readonly type: "productIsPubliclyAvailable", subject: string, data: null }
 * ```
 */
export type BaseEvent = {
    readonly type: string;
    readonly data: unknown;
};

//TODO Move subject to cloudEvent or something, and have it auto-filled as aggregate / projection id