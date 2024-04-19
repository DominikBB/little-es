import { Aggregate } from "../@types/Aggregate";
import { BaseEvent } from "../@types/BaseEvent";
import { Command } from "../@types/Command";
import { CommandHandler } from "../@types/CommandHandler";
import { EventHandler } from "../@types/EventHandler";
import { EventStoreResult, LittleEsEvent } from "../@types/LittleEsEvent";
import { PersistanceHandler } from "../@types/PersistanceHandler";
import { PersistedAggregate } from "../@types/PersistedAggregate";
import { PublishingHandler } from "../@types/PublishingHandler";

import { hydrateProjectionFromSnapshot, hydrateProjectionFromState, SafeArray, snapshotProjection } from "./util";

type AggregateOptions<TAGGREGATE, TCOMMAND extends Command, TEVENT extends BaseEvent> = {
    readonly serviceName: string,
    readonly defaultAggregate: TAGGREGATE,
    readonly commandHandler: CommandHandler<TAGGREGATE, TCOMMAND, TEVENT>,
    readonly eventHandler: EventHandler<TAGGREGATE, TEVENT>,
    readonly persistanceHandler: PersistanceHandler<TAGGREGATE, TEVENT>,
    readonly snapshotInformation?: { readonly frequency: number, readonly aggregateVersion: number },
    readonly publishingHandler?: PublishingHandler<TAGGREGATE, TEVENT>
}

/**
 * Creates an Aggregate, this is a starting point of all
 * of your event sourcing.
 *
 * @param serviceName - The name of the service, used for the source field in the cloud events.
 * @param defaultAggregate - A default/empty instance of the aggregate, used before any events are applied.
 * @param commandHandler - A function that takes a command and the current state of the aggregate and returns a result of processing, it can return some new events.
 * @param eventHandler - A function that takes an event and the current state of the aggregate and returns the new state of the aggregate.
 * @param persistanceHandler - A way to store and retrieve events.
 * @param snapshotFrequency How often should a snapshot of the aggregate be taken? **Defaults to 0** for easier development experience. Increasing the value is highly recommended for production.
 * @returns An `Aggregate` object.
 * ---
 *
 * ### Example
 * ```ts
 * import { createAggregate } from 'little-es'
 *
 * const productAggregate = createAggregate<Product, ProductCommand, ProductEvent>(
 *      "little-es-tests",
 *      { name: "", price: 0, id: '0', listed: false },
 *      async (agg, cmd) => commandHandlers[cmd.type](agg, cmd as any),
 *      (agg, ev) => eventHandlers[ev.type](agg, ev as any),
 *      mockPersistanceHandler
 *   )
 *
 * const newProduct = await productAggregate.push('1', { type: 'addProduct', name: 'test', id: '1' })
 * console.log(newProduct);
 * // -> {name: 'shoe', price: 100, stock: 0}
 * ```
 *
 */
export function createAggregate<TAGGREGATE, TCOMMAND extends Command, TEVENT extends BaseEvent>(
    opt: AggregateOptions<TAGGREGATE, TCOMMAND, TEVENT>
): Aggregate<TAGGREGATE, TCOMMAND> {

    return {
        push: handleCommandWorkflow(
            opt.persistanceHandler.get,
            hydrateProjectionFromSnapshot(opt.defaultAggregate, opt.eventHandler, opt.snapshotInformation?.aggregateVersion),
            hydrateProjectionFromState(opt.defaultAggregate, opt.eventHandler),
            opt.commandHandler,
            littleEsEventBuilder(opt.serviceName),
            opt.persistanceHandler.save,
            snapshotProjection(opt.persistanceHandler, opt.snapshotInformation),
            opt.publishingHandler ?? opt.publishingHandler
        ),
        get: getAggregateWorkflow(
            opt.persistanceHandler.get,
            hydrateProjectionFromSnapshot(opt.defaultAggregate, opt.eventHandler, opt.snapshotInformation?.aggregateVersion),
        ),
    }
}

const handleCommandWorkflow = <TAGGREGATE, TCOMMAND extends Command, TEVENT extends BaseEvent>(
    retrieveAggregateEvents: PersistanceHandler<TAGGREGATE, TEVENT>['get'],
    hydrateAggregateFromSnapshot: (state: PersistedAggregate<TAGGREGATE, TEVENT>) => TAGGREGATE,
    hydrateAggregateFromState: (events: readonly LittleEsEvent<TEVENT>[], state?: TAGGREGATE) => TAGGREGATE,
    handleCommand: CommandHandler<TAGGREGATE, TCOMMAND, TEVENT>,
    createLittleEsEvents: (events: readonly TEVENT[], sequentialId: number, aggregateId: string) => readonly LittleEsEvent<TEVENT>[],
    storeEvents: PersistanceHandler<TAGGREGATE, TEVENT>['save'],
    snapshotAggregate: (id: string, state: TAGGREGATE, eventSequence: { readonly last: number, readonly current: number }) => Promise<EventStoreResult<null>>,
    publishingHandler?: PublishingHandler<TAGGREGATE, TEVENT>
) => async (id: string, command: TCOMMAND): Promise<EventStoreResult<TAGGREGATE>> => {

    const existingEventsResult = await retrieveAggregateEvents(id);
    if (!existingEventsResult.success) return existingEventsResult;

    const lastEventSequenceId = SafeArray(existingEventsResult.data.events) ? parseInt(existingEventsResult.data.events.slice(-1)[0].id) : (existingEventsResult.data.snapshot?.eventSequence ?? 1);

    const currentAggregate = hydrateAggregateFromSnapshot(existingEventsResult.data);

    const newBaseEvents = await handleCommand(currentAggregate, command);
    if (!newBaseEvents.success) return newBaseEvents;
    if (newBaseEvents.data.length === 0) return { success: true, data: currentAggregate };

    const newEvents = createLittleEsEvents(newBaseEvents.data, lastEventSequenceId, id);

    const persist = await storeEvents(newEvents as readonly LittleEsEvent<TEVENT>[])
    if (!persist.success) return persist;

    const newAggregate = hydrateAggregateFromState([...existingEventsResult.data.events, ...newEvents], currentAggregate);

    if (publishingHandler) {
        await Promise.all([
            await snapshotAggregate(id, newAggregate, {
                last: existingEventsResult.data.snapshot?.eventSequence ?? 1,
                current: parseInt(newEvents.slice(-1)[0].id)
            }),
            await publishingHandler(newAggregate, newEvents)
        ]);
    } else {
        await snapshotAggregate(id, newAggregate, {
            last: existingEventsResult.data.snapshot?.eventSequence ?? 1,
            current: parseInt(newEvents.slice(-1)[0].id)
        });
    }

    return { success: true, data: newAggregate };
}

const getAggregateWorkflow = <TAGGREGATE, TEVENT extends BaseEvent>(
    retrieveAggregateEvents: PersistanceHandler<TAGGREGATE, TEVENT>['get'],
    hydrateAggregate: (state: PersistedAggregate<TAGGREGATE, TEVENT>) => TAGGREGATE,
) =>
    async (id: string): Promise<EventStoreResult<TAGGREGATE>> => {
        const existingEventsResult = await retrieveAggregateEvents(id);
        if (!existingEventsResult.success) return existingEventsResult;

        return { success: true, data: hydrateAggregate(existingEventsResult.data) };
    }

const littleEsEventBuilder = (serviceName: string) =>
    <TEVENT extends BaseEvent>(events: readonly TEVENT[], sequentialId: number, aggregateId: string): readonly LittleEsEvent<TEVENT>[] => {
        return events.map((e, i) => ({
            ...e,
            subject: aggregateId,
            id: (i + 1 + sequentialId).toString(),
            specversion: "1.0",
            time: new Date().toISOString(),
            datacontenttype: "json",
            source: serviceName,
            littleEs: {
                littleEsVersion: 1,
                is: "PrivateEvent",
            }
        }));
    }

