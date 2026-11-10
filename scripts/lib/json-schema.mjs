const supportedKeywords = new Set([
  "$schema", "$id", "title", "description", "type", "enum", "const", "required",
  "properties", "additionalProperties", "items", "minLength", "maxLength", "pattern",
  "minimum", "maximum", "minItems", "maxItems", "uniqueItems", "minProperties",
  "maxProperties",
]);

function typeMatches(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    if (type === "integer") return typeof value === "number" && Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === type;
  });
}

function equalJson(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((item, index) => equalJson(item, right[index]));
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && equalJson(left[key], right[key]));
}

export function assertSupportedSchema(schema, schemaPath = "$schema") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`${schemaPath} must be a JSON Schema object.`);
  }
  for (const [keyword, value] of Object.entries(schema)) {
    if (!supportedKeywords.has(keyword)) throw new Error(`${schemaPath} uses unsupported JSON Schema keyword ${keyword}.`);
    if (keyword === "properties") {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${schemaPath}.properties must be an object.`);
      for (const [property, child] of Object.entries(value)) assertSupportedSchema(child, `${schemaPath}.properties.${property}`);
    } else if (keyword === "items") {
      assertSupportedSchema(value, `${schemaPath}.items`);
    } else if (keyword === "additionalProperties" && typeof value === "object") {
      assertSupportedSchema(value, `${schemaPath}.additionalProperties`);
    }
  }
}

/** Validates the Draft 2020-12 structural keywords used by the repository's schemas. */
export function validateJsonSchema(value, schema, path = "$", errors = []) {
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path} must be ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}.`);
    return errors;
  }

  if (schema.const !== undefined && !equalJson(value, schema.const)) errors.push(`${path} must equal ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.some((item) => equalJson(value, item))) errors.push(`${path} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}.`);

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} must have at least ${schema.minLength} characters.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} must have at most ${schema.maxLength} characters.`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${path} does not match ${schema.pattern}.`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} must contain at least ${schema.minItems} items.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} must contain at most ${schema.maxItems} items.`);
    if (schema.uniqueItems && value.some((item, index) => value.slice(0, index).some((prior) => equalJson(item, prior)))) {
      errors.push(`${path} must contain unique items.`);
    }
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items, `${path}[${index}]`, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const required = schema.required ?? [];
    for (const key of required) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required.`);
    const properties = schema.properties ?? {};
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) validateJsonSchema(item, properties[key], `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed.`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validateJsonSchema(item, schema.additionalProperties, `${path}.${key}`, errors);
      }
    }
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push(`${path} must contain at least ${schema.minProperties} properties.`);
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) errors.push(`${path} must contain at most ${schema.maxProperties} properties.`);
  }
  return errors;
}
