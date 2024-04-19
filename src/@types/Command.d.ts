
/**
 * **Command** defines behavior of the aggregate, it should contain your business logic and can contain side effects since it should only be ran once.
 *
 * - **type** Is an discriminator of the commands
 *
 * # Example
 * You should define your event type as a union that extends BaseEvent
 * ```ts
 * type ProductCommand =
 *     | { readonly type: "addProduct", readonly sku: string, readonly id: string }
 *     | { readonly type: "addListedProduct", readonly name: string, readonly id: string }
 *     | { readonly type: "changeProductPrice", readonly price: number, readonly id: string }
 * ```
 * 
 */
export type Command = { readonly type: string; };
