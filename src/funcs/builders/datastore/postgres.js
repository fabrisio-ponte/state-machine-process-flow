export function createPostgresFactBuilder({ queries, clientKey = "postgres" } = {}) {
  if (!Array.isArray(queries)) {
    throw new TypeError("PostgreSQL fact builder requires a queries array");
  }

  return async (context) => {
    const client = context.dataSources?.[clientKey];
    if (typeof client?.query !== "function") {
      throw new TypeError(`Data source "${clientKey}" must provide query(sql, values)`);
    }

    const facts = {};
    for (const definition of queries) {
      const { name, sql, values = () => [], result = "many" } = definition;
      if (!name || typeof sql !== "string" || !sql.trim()) {
        throw new TypeError("Each PostgreSQL fact query requires a name and SQL string");
      }
      if (result !== "many" && result !== "one") {
        throw new TypeError(`Unsupported PostgreSQL result mode: ${result}`);
      }

      const parameters = typeof values === "function" ? await values(context) : values;
      const queryResult = await client.query(sql, parameters);
      facts[name] = result === "one"
        ? (queryResult.rows[0] ?? null)
        : queryResult.rows;
    }
    return facts;
  };
}

export default createPostgresFactBuilder;
