import { Router } from 'express';
import integrationController from '../controllers/integration.controller';

const router = Router();

router.post('/', integrationController.create.bind(integrationController));
router.get('/', integrationController.list.bind(integrationController));
router.get('/:id', integrationController.get.bind(integrationController));
router.put('/:id', integrationController.update.bind(integrationController));
router.delete('/:id', integrationController.delete.bind(integrationController));
router.post('/:id/test', integrationController.test.bind(integrationController));

export default router;
