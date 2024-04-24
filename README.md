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

⚠️ `little-es` is in early stages of development and future releases are likely to **have breaking changes.**

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
- Projections handling
- Projection snapshots
- Projection versioning
- Based on CloudEvents specification
- Nice error handling
- Some persistance layers

# Page contents

- [Why event sourcing?](#why-event-sourcing)
- [Getting started](#getting-started)
  - [The aggregate](#the-aggregate)
  - [The commands](#the-commands)
  - [The events](#the-events)
  - [The handlers](#the-handlers)
  - [Ready made persistence handlers](#the-persistence-handlers)
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

### Ready made persistence handlers
| Storage backend         | Repository     | Maintained by |
|--------------|-----------|------------|
| Cloudflare D1 | [little-es-cloudflare-persistence](https://github.com/DominikBB/little-es-cloudflare-persistence)     | DominikBB        |


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

Snapshots capture the current state of your projections, and will then be used as a performance optimization when reading state. Instead of having the projection apply all events that happened each time its requested, it can start with a latest snapshot and apply events that happened after it.

Keep in mind that snapshots are a bit like caching, and can become hard to manage as your data schema changes. `little-es` helps invalidate snapshots using versioning, however snapshots can still be considered as a bit of an anti-pattern in event sourcing.

You can add a snapshot information object to configuration to enable them.

```ts
import { createGlobalProjection } from 'little-es'

const lowStock = createGlobalProjection<LowStockProducts, ProductEvent>(
     projectionName: "...",
     defaultProjection: ...,
     eventHandler: ...,
     persistanceHandler: ...,
     snapshot: {frequency: 5, schemaVersion: 1}
  )
```

The above code will enable snapshots at a frequency of >5 events, and will tag the snapshot as version 1.

### On frequency

Frequency does not guarantee that a snapshot exists exactly every 5 events because they are only created upon invoking .get() on a projection. Since any amount of time can pass between these calls, any number of events can also pass.

### Versions

Versions should be moved up when you change the data schema of your projection. This will cause `little-es` to ignore snapshots with the older version.

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
    subject: string
  ) => Promise<EventStoreResult<readonly LittleEsEvent<TEVENT>[]>>;
  readonly getProjection: (
    projectionName: string
  ) => (
    id?: string
  ) => Promise<EventStoreResult<PersistedProjection<TAGGREGATE, TEVENT>>>;
  readonly snapshot: (
    snapshot: Snapshot<TAGGREGATE>
  ) => Promise<EventStoreResult<null>>;
};
```

- **save** should just persist an array of events, events are uniquely identifiable by combination of `id`, `source` attributes. The actual event should be persisted as a whole, so that users ability to extend the `little-es` events holds true.
- **get** should get all events associated with a `subject`, this is used for hydrating an aggregate.
- **getProjection** is used to hydrate a projection. It needs to make sure to return the latest snapshot if it exists, and if it does, return the events that are newer then the snapshot along side it.
- **snapshot** should just persist a snapshot object, snapshots are uniquely identified by combination of `name`, `lastConsideredEvent`, `schemaVersion`

## Publishing handler interface

**TODO**

# Design tips

**TODO**

# FAQ

## CloudEvent specification

All events persisted and published by `little-es` are wrapped in a CloudEvent specification compliant envelope, however the user of the library is also expected to comply to a degree.

- `id` is composed by combining a sequence of the event based ono the `subject`, and the `subject`, so it will look like `id: sequenceNr_subject`. This is compliant with CloudEvent spec. as long as you make sure that the subject is a unique identifier within the context of a service.
- `source` comes from the `serviceName` config. option in the aggregate configuration.
- `type` is defined by your implementation (when you create your events extending the `BaseEvent`, which requires a `type` string)
- `subject` is your aggregate id
