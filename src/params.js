import Ajv from "ajv";

export class ParameterValidationError extends Error {
  constructor(errors) {
    super("Request parameters failed schema validation");
    this.name = "ParameterValidationError";
    this.errors = errors;
  }
}

export default class ParamsValidator {
  constructor({ extensions = [] } = {}) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    for (const extension of extensions) {
      extension(this.ajv);
    }
  }

  validate(payload, schema, { silent = false } = {}) {
    if (!schema) {
      return { valid: true, errors: [] };
    }

    const validateSchema = this.ajv.compile(schema);
    const valid = validateSchema(payload);
    const errors = valid ? [] : (validateSchema.errors ?? []).map((error) => ({
      path: error.instancePath,
      keyword: error.keyword,
      message: error.message,
      params: error.params
    }));

    if (!valid && !silent) {
      throw new ParameterValidationError(errors);
    }

    return { valid, errors };
  }
}
