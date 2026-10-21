import { Engine } from "json-rules-engine";

export default class StateMachineEngine {
  constructor() {
    this.engine = null;
  }

  _addFacts(facts = {}, params = {}, engine = this.engine) {
    if (!engine) {
      throw new Error("Cannot add facts before an engine run has started");
    }
    for (const [name, value] of Object.entries({ ...params, ...facts })) {
      engine.addFact(name, value);
    }
  }

  _addRuleDefs(scenarios = {}, engine = this.engine) {
    if (!engine) {
      throw new Error("Cannot add rules before an engine run has started");
    }
    const rules = Array.isArray(scenarios) ? scenarios : scenarios.rules;
    if (!Array.isArray(rules)) {
      throw new TypeError("Scenario must contain a rules array");
    }

    for (const definition of rules) {
      if (!definition?.conditions || !definition?.event?.type) {
        throw new TypeError("Each rule must define conditions and event.type");
      }
      engine.addRule(definition);
    }
  }

  async _go(engine = this.engine) {
    if (!engine) {
      throw new Error("Cannot execute before an engine run has started");
    }
    const result = await engine.run();
    return result.events;
  }

  _removeAll() {
    this.engine = null;
  }

  async run({ facts = {}, params = {}, scenarios }) {
    const engine = new Engine([], { allowUndefinedFacts: false });
    try {
      this._addFacts(facts, params, engine);
      this._addRuleDefs(scenarios, engine);
      return await this._go(engine);
    } finally {
      this._removeAll();
    }
  }
}
