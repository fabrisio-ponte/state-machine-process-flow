export const checks = {
  always: () => true,
  hasFact: ({ facts, name }) => (
    typeof name === "string"
    && Object.prototype.hasOwnProperty.call(facts, name)
    && facts[name] !== undefined
    && facts[name] !== null
  ),
  equals: ({ facts, name, value }) => (
    Object.prototype.hasOwnProperty.call(facts, name)
    && facts[name] === value
  )
};

export default checks;
