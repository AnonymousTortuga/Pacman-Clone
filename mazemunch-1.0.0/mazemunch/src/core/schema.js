// A small JSON Schema checker covering the keywords our data schemas use:
// type, required, properties, items, minItems, maxItems, minimum, maximum,
// pattern, enum and local $ref. No dependencies, runs in Node and browsers.

export function validateSchema(value, schema, root = schema, path = '$') {
  const errors = [];
  check(value, schema, root, path, errors);
  return errors;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref supported: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => node[key], root);
}

function check(v, s, root, path, errors) {
  if (s.$ref) s = resolveRef(s.$ref, root);

  if (s.type) {
    const t = typeOf(v);
    const ok = s.type === t || (s.type === 'number' && t === 'integer');
    if (!ok) {
      errors.push(`${path}: expected ${s.type}, got ${t}`);
      return;
    }
  }
  if (s.enum && !s.enum.includes(v)) errors.push(`${path}: must be one of ${s.enum.join(', ')}`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) errors.push(`${path}: must be >= ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) errors.push(`${path}: must be <= ${s.maximum}`);
  }
  if (typeof v === 'string' && s.pattern && !new RegExp(s.pattern).test(v)) {
    errors.push(`${path}: does not match ${s.pattern}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errors.push(`${path}: needs at least ${s.minItems} items`);
    if (s.maxItems !== undefined && v.length > s.maxItems) errors.push(`${path}: allows at most ${s.maxItems} items`);
    if (s.items) v.forEach((item, i) => check(item, s.items, root, `${path}[${i}]`, errors));
  }
  if (typeOf(v) === 'object') {
    for (const key of s.required || []) {
      if (!(key in v)) errors.push(`${path}: missing "${key}"`);
    }
    for (const [key, sub] of Object.entries(s.properties || {})) {
      if (key in v) check(v[key], sub, root, `${path}.${key}`, errors);
    }
  }
}
