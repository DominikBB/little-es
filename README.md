# little-es

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/dominikbb/little-es/npm-publish.yml)
[![GitHub](https://img.shields.io/github/license/honojs/hono)](https://github.com/dominikbb/little-es/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/little-es)](https://www.npmjs.com/package/little-es)
[![Bundle Size](https://img.shields.io/bundlephobia/min/little-es)](https://bundlephobia.com/result?p=little-es)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/little-es)](https://bundlephobia.com/result?p=little-es)
[![npm type definitions](https://img.shields.io/npm/types/little-es)](https://www.npmjs.com/package/little-es)
[![GitHub commit activity](https://img.shields.io/github/commit-activity/m/dominikbb/little-es)](https://github.com/dominikbb/little-es/pulse)
[![GitHub last commit](https://img.shields.io/github/last-commit/dominikbb/little-es)](https://github.com/dominikbb/little-es/commits/main)

An event sourcing library for JS/TS.

Crafted to stay **light, support edge runtime's, be 0 dependency, easily extensible**.

⚠️ `little-es` is in early stages of development and future releases **will have breaking changes, features can be added or removed.**

```bash
npm i little-es
```

Example use in a generic API router:

```ts
router.use('/*', (c, next) => {
  const articleConfig = {
    serviceName: 'my-blog-app',
    defaultAggregate: defaultArticle,
    commandHandler: articleCommandHandler,
    eventHandler: articleEventHandler,
    persistanceHandler: persistanceHandler,
  };

  c.articleAggregate = createAggregate<Article, Commands, Events>(
    articleConfig
  );

  await next();
});

router.get('/comment/:id', (c) => {
  return c.articleAggregate.get(c.req.params.get('id'));
  // Gets the state of the article with id, and returns a result object
  // -> {success: true, data:Article}
  // -> {success: false, at:'..', error:'Not found'}
});
router.post('/comment/:id', (c) => {
  return c.articleAggregate.push({ type: 'createArticle', article: c.body });
  // Creates an article with some id and returns a result object
  // -> {success: true, data:Article}
});
```

What's in the box:

- Command handling interfaces
- Event persistance interfaces
- Event publishing interfaces
- Projection handling
- Snapshot support
- Aggregate & projection versioning
- Based on CloudEvents specification
- Nice error handling
- **COMING SOON** - Ready made persistance and publishing layers

# Page contents

- [Why event sourcing?](#why-event-sourcing)
- [Getting started](#getting-started)
  - [The aggregate](#the-aggregate)
  - [The commands](#the-commands)
  - [The events](#the-events)
  - [The handlers](#the-handlers)
  - [Putting it all together](#putting-it-together)
  - [Usage examples](#usage-examples)
- [Advanced usage](#advanced-usage)
  - [Creating a named projection](#creating-a-named-projection)
  - [Creating a global projection](#creating-a-global-projection)
  - [Improving performance with snapshots](#improving-performance-with-snapshots)
  - Publishing events
  - [Persistance handler interface](#persistance-handler-interface)
- Design tips
- FAQ
  - CloudEvents spec
  - Integrating with web frameworks

# Why event sourcing?

I like event sourcing for a number of reasons, and some include:

- Ability to describe system behavior in an intuitive way
- Flexibility to extract useful information from events even when this information was not planned for in the data model
- Simplicity of operation, data schema changes and migrations are trivially simple
- Auditing, reporting and monitoring are simple due to append only data storage

# Getting started

The basic structure of an event sourcing system consists of an aggregate (a model), which is the core data structure of a service. This aggregate evolves its state through commands, which produce events. To set up little-es, we define all of those models, and then describe their behavior.

Below is an example of modeling a todo app.

### The aggregate

First we define the core todo aggregate.

```ts
type Todo = {
  username: string;
  todo: {
    content: string;
    done: boolean;
  }[];
};
```

### The commands

Next come the commands that modify the aggregate.

```ts
type Commands =
|{ type: 'createTodo', text: string, username: string };
|{ type: 'completeTodo' };
```

### The events

Now we can also define the events. Keep in mind the difference in naming between commands and events. Commands communicate the intent of an action, if the action succeeds, it can result in an event. Events communicate facts of the past, they have already happened. Bear in mind that the commands and events don't need to share the same data or data structures, but in this simple example they do.

```ts
type Events =
|{ type: 'todoCreated', text: string };
|{ type: 'todoCompleted' };
```

### The handlers

Finally, we need to describe the behavior of a todo, command handler will ensure that the actions are allowed and handle any necessary business logic.

> Note that little-es provides a simple `...HandlerEnum` helper for creating fully typed command and event handlers, however, they are optional and you can choose how to handle command and event function matching.

```ts
import { CommandHandlerEnum } from "../@types/CommandHandlerEnum"

const todoCommandHandler: CommandHandlerEnum<Todo, Commands, Events> = {
    createTodo: async (todo, command) => todo.text !== command.text
        ? { success: true, data: [{ type: 'todoCreated', subject: command.username, data: command }] }
        : { success: false, at: "Command", error: 'todo already exists' },
    completeTodo: async (todo, command) => !todo.done
        ? { success: true, data: [{ type: 'todoCompleted', subject: command.username, data: null }]},
        : { success: false, at: "Command", error: 'todo already completed' }
};

```

Note that your command handling logic is responsible for ensuring that invalid state cannot happen, a todo cannot be completed twice. Because of this responsibility, events can be fully trusted to be valid.

The event handler is mainly a data mapping layer telling little-es how to map each event to the Aggregate.

```ts
import { EventHandlerEnum } from "../@types/EventHandlerEnum"

const todoEventHandler: EventHandlerEnum<Todo, Events> = {
    todoCreated: (todos, event) => ({
        username: event.subject,
        todo: [{text: event.data.text, done: false}] }),
    todoCompleted: (todos, event) => ({
        ...todos,
        todo: todos.todo.map(t => t.text === event.data.text ? {todo: t.text, done: true}) })
};
```

Notice how we described the behavior of a todo note, in the real world, this would be more complex. But the great thing about event sourcing is that the combination of above code completes the whole system and we don't really need to write any other business logic.

### Putting it together

Now we can set up the actual little-es aggregate, to do so, we need to provide a configuration.

> When creating APIs, its a good idea to place this configuration inside a middleware.

The core addition to our code is the persistance handler, this is a group of functions little-es will call to store and retrieve events. Its a simple abstraction layer over the database of your choice. Ready mande handlers will be ready soon in a separate repository.

```ts
import { createAggregate } from './aggregate';

const todoConfig = {
  serviceName: 'my-todo-app',
  defaultAggregate: { text: '', username: '', done: false },
  commandHandler: async (agg, cmd) =>
    todoCommandHandler[cmd.type](agg, cmd as any),
  eventHandler: (agg, ev) => todoEventHandler[ev.type](agg, ev as any),
  persistanceHandler: mockPersistanceHandler(t),
};

const todo = createAggregate<Todo, Commands, Events>(todoConfig);
```

You can now try adding todo notes to the aggregate:

```ts
// Process a command
const result = await todo.push('user1', {
  type: 'createTodo',
  text: 'do something',
  username: 'user1',
});
console.log(result);
// -> {success: true, data: {username: 'user1', todo: [{text: 'do something', done: false}]}}
```

```ts
// Fetch state
const result = await todo.get('user1');
console.log(result);
// -> {success: true, data: {username: 'user1', todo: [{text: 'do something', done: false}]}}
```

# Advanced usage

Once you get the hang of the basics, you can extend your apps and really see the benefits of event sourcing.

## Creating a named projection

You will often need to produce different views of your data, sometimes using an identifier different then the one used by your main aggregate.

Projections do not handle commands or produce events, they can only consume existing events.

Imagine an e-commerce shop, where products are stored and identified by an SKU. Now the e-commerce shop needs to provide a view of products that fall into a category. We can create a `NamedProjection` for categories, and process product events as we see fit.

```ts
type productCategoryHandler = {
    productCategorySet: (category, ev) => ({
        ...category,
        products: [...category.products, ev.data.sku]}),
    productRemoved: (category, ev) => ({
        ...category,
        products: category.products.filter(p => p.sku !== ev.data.sku)}),
    // Handle other relevant commands
}

 const productCategories = createNamedProjection<ProductCategory, ProductEvent>({}
      projectionName: "productCategory",
      defaultProjection: { name: string, products: string[] },
      eventHandler: (agg, ev) => productCategoryHandler[ev.type](agg, ev as any),
      persistanceHandler: mockPersistanceHandler
   })

// Fetch state
const result = await productCategories.get('shoes');
console.log(result);
// -> {success: true, data: {category: 'shoes', products[...]}}
```

> As long as you provide the same persistance handler to both the projection and the aggregate, they will both be created from the same events.

## Creating a global projection

Sometimes auditing, monitoring, operational and other requirements will require some special views of data.

`GlobalProjection` provides another way to model data views from events. However, this kind of projection does not process a specific identifier, it will always process all events in the system.

> Make sure not to include PII in global projections. Also avoid making these projections public in a multi-tenant app.

Building on the e-commerce example, we can check which of our products are low in stock.

```ts
import { createGlobalProjection } from 'little-es'

const lowStock = createGlobalProjection<LowStockProducts, ProductEvent>(
     projectionName: "lowStockProducts",
     defaultProjection: { name: string, products: Product },
     eventHandler: (agg, ev) => ev.type === "productInventoryLow"
        ? (lowStockProducts: [...lowStockProducts, ev.subject])
        : agg,
     persistanceHandler: mockPersistanceHandler
  )

// Fetch state
const getLowStockProducts = await lowStock.get('shoes')
console.log(getLowStockProducts);
// -> {success: true, data: {products: [...]}}
```

## Improving performance with snapshots

Snapshots capture the current state of your aggregate and projections, and will then be used as a performance optimization when reading state. Instead of having the aggregate apply all events that happened, it can start with a latest snapshot and apply events that happened after it.

Keep in mind that snapshots are a bit like caching, and can become hard to manage as your data schema changes. `little-es` helps invalidate snapshots using versioning, however snapshots can still be considered as a bit of an anti-pattern in event sourcing.

Snapshots are supported by Aggregate and all projections. You can add a snapshot information to configuration to enable them.

```ts
import { createGlobalProjection } from 'little-es'

const lowStock = createGlobalProjection<LowStockProducts, ProductEvent>(
     projectionName: "...",
     defaultProjection: ...,
     eventHandler: ...,
     persistanceHandler: ...,
     snapshotInformation: {frequency: 5, aggregateVersion: 1}
  )
```

The above code will enable snapshots at a frequency of >5 events, and will tag the snapshot as version 1.

- **Aggregate snapshots** are created **at command processing** time (when running .push())
- **Projection snapshots** are created **at event handling** time (when running .get())

**⚠️ Projection snapshots are unstable and should not be used**

### On frequency

Frequency does not guarantee that a snapshot exists exactly every 5 events because snapshots are created in different manner depending on a type of object aggregate/projection, and your handling implementation.

For example, in an aggregate, _commands can produce more then 1 event but a snapshot is evaluated only after the command_ is handled.

In a _projection, the snapshot is evaluated only after reading the state_, meaning that any amount of time/events can pass between the last snapshot and the moment your system calls .get()

### Versions

Versions should be moved up when you change the data schema of your aggregate/projection. This will cause `little-es` to ignore snapshots with the older version.

## Publishing events

**TODO**

## Persistance handler interface

To create a persistance handler, you need to fullfil the below type:

```ts
export type PersistanceHandler<TAGGREGATE, TEVENT extends BaseEvent> = {
  readonly save: (
    events: readonly LittleEsEvent<TEVENT>[]
  ) => Promise<EventStoreResult<null>>;
  readonly get: (
    id: string
  ) => Promise<EventStoreResult<PersistedAggregate<TAGGREGATE, TEVENT>>>;
  readonly getAllEvents: (
    projectionName: string
  ) => () => Promise<EventStoreResult<PersistedAggregate<TAGGREGATE, TEVENT>>>;
  readonly snapshot: (
    snapshot: Snapshot<TAGGREGATE>
  ) => Promise<EventStoreResult<null>>;
};
```

- **save** should just persist an array of events
- **get** should get the latest snapshot (if exists), and the events newer then the snapshot. It should also only get events and snapshot where event.subject and snapshot.id are the same as the parameter id
- **getAllEvents** should still filter out snapshots based on the id and parameter, but not filter out events in any way.
- **snapshot** should just persist a snapshot object

### Identifiers

You should treat the `event.subject` as the main identifier of the object that produced the event (the aggregate identifier), while the `event.id` represents a sequential number of the event for that subject.

## Publishing handler interface

**TODO**

# Design tips

**TODO**

# FAQ

**TODO**
