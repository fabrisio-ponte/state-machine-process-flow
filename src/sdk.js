import { readFile } from "node:fs/promises";
import path from "node:path";
import StateMachineEngine from "./engine.js";
import ParamsValidator from "./params.js";
import runPreconditions from "./funcs/index.js";

export default class StateMachineSDK {
  constructor({
    scenarioDir = path.resolve("scenarios"),
    engine = new StateMachineEngine(),
    validator = new ParamsValidator(),
    checks,
    factBuilders = []
  } = {}) {
    this.scenarioDir = scenarioDir;
    this.engine = engine;
    this.validator = validator;
    this.checks = checks;
    this.factBuilders = factBuilders;
  }

  async use(flowId, carrierId) {
    if (typeof flowId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(flowId)) {
      throw new TypeError("flowId must contain only letters, numbers, underscores, or hyphens");
    }

    const scenarioPath = path.join(this.scenarioDir, `${flowId}.json`);
    const contents = await readFile(scenarioPath, "utf8");
    const scenario = JSON.parse(contents);

    if (carrierId && scenario.carriers?.[carrierId]) {
      return {
        ...scenario,
        ...scenario.carriers[carrierId],
        carriers: scenario.carriers
      };
    }
    return scenario;
  }

  async execute({
    flowId,
    carrierId,
    payload = {},
    facts = {},
    params = {},
    dataSources = {},
    silent = false
  }) {
    const scenario = await this.use(flowId, carrierId);

    const validation = this.validator.validate(
      payload,
      scenario.schema,
      { silent }
    );
    if (!validation.valid) {
      return { events: [], validation };
    }

    let hydratedFacts = {
      ...facts,
      payload,
      ...dataSources.facts
    };
    for (const builder of this.factBuilders) {
      const additionalFacts = await builder({
        payload,
        facts: hydratedFacts,
        params,
        dataSources
      });
      if (!additionalFacts || typeof additionalFacts !== "object" || Array.isArray(additionalFacts)) {
        throw new TypeError("Fact builders must return an object");
      }
      hydratedFacts = { ...hydratedFacts, ...additionalFacts };
    }

    await runPreconditions(
      scenario.preconditions,
      hydratedFacts,
      this.checks
    );

    const events = await this.engine.run({
      facts: hydratedFacts,
      params: { carrierId, flowId, ...params },
      scenarios: scenario
    });
    return { events, validation };
  }
}
