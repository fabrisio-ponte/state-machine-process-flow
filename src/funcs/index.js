import defaultChecks from "./store.js";

export class PreconditionError extends Error {
  constructor(failures) {
    super(`Workflow preconditions failed: ${failures.map(({ name }) => name).join(", ")}`);
    this.name = "PreconditionError";
    this.failures = failures;
  }
}

export async function runPreconditions(preconditions = [], facts = {}, checks = defaultChecks) {
  const failures = [];

  for (const precondition of preconditions) {
    const { name, args = {} } = typeof precondition === "string"
      ? { name: precondition, args: {} }
      : precondition;
    const check = checks[name];
    if (typeof check !== "function") {
      throw new TypeError(`Unknown workflow precondition: ${name}`);
    }
    if (!await check({ facts, ...args })) {
      failures.push({ name, args });
    }
  }

  if (failures.length > 0) {
    throw new PreconditionError(failures);
  }
}

export default runPreconditions;
