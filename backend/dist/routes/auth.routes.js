import { Router } from 'express';
import { googleLogin, getCurrentUser, googleAuthSchema } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
const router = Router();
router.post('/google', validateBody(googleAuthSchema), googleLogin);
router.get('/me', requireAuth, getCurrentUser);
export default router;
