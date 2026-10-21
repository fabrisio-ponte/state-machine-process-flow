export function createMongoFactBuilder({ queries, clientKey = "mongo" } = {}) {
  if (!Array.isArray(queries)) {
    throw new TypeError("MongoDB fact builder requires a queries array");
  }

  return async (context) => {
    const database = context.dataSources?.[clientKey];
    if (!database) {
      throw new TypeError(`Missing MongoDB data source "${clientKey}"`);
    }

    const facts = {};
    for (const definition of queries) {
      const {
        name,
        collection: collectionName,
        filter = () => ({}),
        options = {},
        result = "one"
      } = definition;
      if (!name || !collectionName) {
        throw new TypeError("Each MongoDB fact query requires a name and collection");
      }
      if (result !== "one" && result !== "many") {
        throw new TypeError(`Unsupported MongoDB result mode: ${result}`);
      }

      const collection = typeof database.collection === "function"
        ? database.collection(collectionName)
        : database[collectionName];
      if (!collection) {
        throw new TypeError(`MongoDB collection "${collectionName}" is unavailable`);
      }

      const queryFilter = typeof filter === "function" ? await filter(context) : filter;
      if (result === "one") {
        if (typeof collection.findOne !== "function") {
          throw new TypeError(`MongoDB collection "${collectionName}" must provide findOne`);
        }
        facts[name] = await collection.findOne(queryFilter, options);
      } else {
        if (typeof collection.find !== "function") {
          throw new TypeError(`MongoDB collection "${collectionName}" must provide find`);
        }
        const cursor = collection.find(queryFilter, options);
        if (typeof cursor.toArray !== "function") {
          throw new TypeError(`MongoDB query for "${collectionName}" must return a cursor`);
        }
        facts[name] = await cursor.toArray();
      }
    }
    return facts;
  };
}

export default createMongoFactBuilder;
