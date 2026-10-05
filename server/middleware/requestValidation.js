const UNSAFE_KEY = /(^\$|\.|__proto__|prototype|constructor)/i;
const MAX_DEPTH = 10;
const MAX_NODES = 2500;
const MAX_STRING_LENGTH = 20000;

const validateTree = (value, depth, state) => {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) return false;
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH;
  if (value === null || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEY.test(key) || !validateTree(child, depth + 1, state)) return false;
  }
  return true;
};

export const validateRequestEnvelope = (req, res, next) => {
  const valid = validateTree(req.query || {}, 0, { nodes: 0 })
    && validateTree(req.params || {}, 0, { nodes: 0 })
    && validateTree(req.body || {}, 0, { nodes: 0 });
  if (!valid) return res.status(400).json({ error: 'Request contains an invalid or unsafe value.', code: 'INVALID_REQUEST' });
  next();
};
