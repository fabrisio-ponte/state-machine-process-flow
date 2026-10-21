export default class StateMachineInterface {
  constructor({
    sdk,
    buildDS = async () => ({}),
    transaction,
    transform = async (result) => result,
    persist
  } = {}) {
    if (!sdk) {
      throw new TypeError("An SDK instance is required");
    }
    this.sdk = sdk;
    this.buildDS = buildDS;
    this.transaction = transaction;
    this.transform = transform;
    this.persist = persist;
  }

  async runIn(args) {
    const dataSources = await this.buildDS({
      auth: args.auth,
      request: args.request
    });
    const execute = async (transaction) => {
      const context = { ...args, dataSources, transaction };
      const result = await this.sdk.execute({
        flowId: args.flowId,
        carrierId: args.carrierId,
        payload: args.payload ?? args.request?.body ?? {},
        facts: args.facts,
        params: args.params,
        dataSources: {
          ...dataSources,
          transaction
        },
        silent: args.silent
      });
      const mapped = await this.transform(result, context);
      if (this.persist) {
        await this.persist(mapped, context);
      }
      return mapped;
    };

    return this.transaction
      ? this.transaction(execute)
      : execute(undefined);
  }

  runOut(result) {
    return {
      status: result.validation?.valid === false ? "invalid" : "ok",
      events: result.events,
      validation: result.validation
    };
  }
}
