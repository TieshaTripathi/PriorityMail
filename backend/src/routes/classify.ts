import { Router } from 'express';
import { classifyEmailLegacy } from '../services/priorityEngine.js';

export const classifyRouter = Router();

// Existing /api/classify route — preserved for backward compatibility.
classifyRouter.post('/', (req, res) => {
  const { email, rules } = req.body as { email?: unknown; rules?: unknown };
  if (!email || !rules) return res.status(400).json({ error: 'email and rules required' });
  return res.json(classifyEmailLegacy(email as Parameters<typeof classifyEmailLegacy>[0], rules as Parameters<typeof classifyEmailLegacy>[1]));
});
