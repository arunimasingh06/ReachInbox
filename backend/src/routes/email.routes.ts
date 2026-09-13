import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  searchEmails,
  cancelScheduledEmail,
  scheduleEmailSchema,
} from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/schedule', validateBody(scheduleEmailSchema), scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/search', searchEmails);
router.delete('/:id', cancelScheduledEmail);

export default router;
