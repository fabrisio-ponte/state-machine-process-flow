# state-machine

A stateless, event-driven workflow engine for evaluating JSON-defined scenarios.
Each request validates its payload, hydrates optional datastore facts, evaluates
preconditions and rules, then exposes transformation and persistence hooks.

## Request lifecycle

1. `StateMachineInterface.runIn()` builds request-scoped data sources.
2. `StateMachineSDK.execute()` loads a flow and validates its payload.
3. Registered fact builders add database-dependent facts.
4. Named preconditions gate evaluation.
5. `StateMachineEngine` evaluates scenario rules and emits matching events.
6. The interface transforms and optionally persists results inside an injected
   transaction, then `runOut()` wraps the response.

Data-source clients, secret retrieval, database queries, transformations, and
persistence are injected by the host service. The core package does not create
connections or store credentials.

Request-scoped fact builders can use the included PostgreSQL and MongoDB
adapters in `src/funcs/builders/datastore/`. The PostgreSQL builder uses
parameterized `query(sql, values)` calls; the MongoDB builder accepts a native
database handle or a collection registry. Both return named facts for the
scenario rule engine.

## Install and test

Requires Node.js 20 or newer.

```sh
npm install
npm test
```

## Example

```js
import StateMachineSDK from "./src/sdk.js";
import StateMachineInterface from "./src/interface.js";

const sdk = new StateMachineSDK({
  factBuilders: [
    async ({ payload, dataSources }) => ({
      existingClaim: await dataSources.claims.findById(payload.claim.id)
    })
  ]
});

const workflow = new StateMachineInterface({
  sdk,
  buildDS: async ({ auth }) => createRequestDataSources(auth),
  transaction: (callback) => sequelize.transaction(callback),
  transform: async (result) => mapWorkflowEvents(result.events),
  persist: async (mapped, { dataSources, transaction }) => {
    await dataSources.work.save(mapped, { transaction });
  }
});

const result = await workflow.runIn({
  flowId: "example-flow",
  payload: { claim: { status: "submitted", amount: 400 } }
});
const response = workflow.runOut(result);
```

Rules use [`json-rules-engine`](https://github.com/CacheControl/json-rules-engine)
conditions and operators. A sample flow is in
[`scenarios/example-flow.json`](./scenarios/example-flow.json). Carrier-specific
scenario overrides can be provided under a top-level `carriers` object; the
selected carrier's `schema`, `preconditions`, and `rules` replace the base
values.
