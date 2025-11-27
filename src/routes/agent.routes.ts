import { Router } from 'express';
import agentController from '../controllers/agent.controller';

const router = Router();

router.post('/', agentController.create.bind(agentController));
router.get('/', agentController.list.bind(agentController));
router.get('/:id', agentController.get.bind(agentController));
router.put('/:id', agentController.update.bind(agentController));
router.delete('/:id', agentController.delete.bind(agentController));
router.post('/:id/chat', agentController.chat.bind(agentController));
router.post('/:id/actions', agentController.addAction.bind(agentController));
router.delete('/:id/actions/:actionId', agentController.removeAction.bind(agentController));

export default router;
