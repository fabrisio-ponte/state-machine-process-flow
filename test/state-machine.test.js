import test from "node:test";
import assert from "node:assert/strict";
import StateMachineSDK from "../src/sdk.js";
import ParamsValidator, { ParameterValidationError } from "../src/params.js";
import StateMachineEngine from "../src/engine.js";
import StateMachineInterface from "../src/interface.js";
import { createPostgresFactBuilder } from "../src/funcs/builders/datastore/postgres.js";
import { createMongoFactBuilder } from "../src/funcs/builders/datastore/mongo.js";

test("runs the matching scenario rule and returns its event", async () => {
  const sdk = new StateMachineSDK();
  const result = await sdk.execute({
    flowId: "example-flow",
    payload: { claim: { status: "submitted", amount: 400 } }
  });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, "TRANSITION_STATE");
  assert.equal(result.events[0].params.to, "approved");
});

test("rejects invalid payloads and supports silent validation", async () => {
  const sdk = new StateMachineSDK();

  await assert.rejects(
    sdk.execute({ flowId: "example-flow", payload: {} }),
    ParameterValidationError
  );

  const result = await sdk.execute({
    flowId: "example-flow",
    payload: {},
    silent: true
  });
  assert.deepEqual(result.events, []);
  assert.equal(result.validation.valid, false);
});

test("does not retain rules or facts after execution", async () => {
  const engine = new StateMachineEngine();
  await engine.run({
    facts: { value: 1 },
    scenarios: {
      rules: [{
        conditions: {
          all: [{ fact: "value", operator: "equal", value: 1 }]
        },
        event: { type: "MATCH" }
      }]
    }
  });

  assert.equal(engine.engine, null);
});

test("isolates facts and rules across concurrent executions", async () => {
  const engine = new StateMachineEngine();
  const run = (value) => engine.run({
    facts: { value },
    scenarios: {
      rules: [{
        conditions: {
          all: [{ fact: "value", operator: "equal", value }]
        },
        event: { type: `MATCH_${value}` }
      }]
    }
  });

  const results = await Promise.all([run(1), run(2)]);
  assert.deepEqual(results.map(([event]) => event.type), ["MATCH_1", "MATCH_2"]);
  assert.equal(engine.engine, null);
});

test("runs mapping and persistence within the injected transaction", async () => {
  const calls = [];
  const workflow = new StateMachineInterface({
    sdk: {
      execute: async () => ({ events: [{ type: "MATCH" }], validation: { valid: true } })
    },
    buildDS: async () => ({ store: true }),
    transaction: async (callback) => callback("transaction"),
    transform: async (result, context) => {
      calls.push(["transform", context.transaction]);
      return result.events;
    },
    persist: async (mapped, context) => {
      calls.push(["persist", mapped[0].type, context.transaction]);
    }
  });

  const result = await workflow.runIn({ flowId: "example-flow" });
  assert.deepEqual(result, [{ type: "MATCH" }]);
  assert.deepEqual(calls, [
    ["transform", "transaction"],
    ["persist", "MATCH", "transaction"]
  ]);
  assert.equal(workflow.runOut({
    events: [],
    validation: { valid: false, errors: [{ message: "invalid" }] }
  }).status, "invalid");
});

test("hydrates facts through the PostgreSQL and MongoDB builders", async () => {
  const postgres = createPostgresFactBuilder({
    queries: [{
      name: "claimRecord",
      sql: "select * from claims where id = $1",
      values: ({ payload }) => [payload.claimId],
      result: "one"
    }]
  });
  const mongo = createMongoFactBuilder({
    queries: [{
      name: "policy",
      collection: "policies",
      filter: ({ facts }) => ({ claimId: facts.claimRecord.id }),
      result: "one"
    }]
  });
  const context = {
    payload: { claimId: "claim-1" },
    facts: { claimRecord: { id: "claim-1" } },
    params: {},
    dataSources: {
      postgres: {
        query: async (_sql, values) => {
          assert.deepEqual(values, ["claim-1"]);
          return { rows: [{ id: "claim-1" }] };
        }
      },
      mongo: {
        collection: () => ({
          findOne: async (filter) => ({ ...filter, number: "policy-1" })
        })
      }
    }
  };

  assert.deepEqual(await postgres(context), { claimRecord: { id: "claim-1" } });
  assert.deepEqual(await mongo(context), {
    policy: { claimId: "claim-1", number: "policy-1" }
  });
});
