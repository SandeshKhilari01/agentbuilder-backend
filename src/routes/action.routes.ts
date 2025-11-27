import { Router } from 'express';
import actionController from '../controllers/action.controller';

const router = Router();

router.post('/', actionController.create.bind(actionController));
router.get('/', actionController.list.bind(actionController));
router.get('/:id', actionController.get.bind(actionController));
router.put('/:id', actionController.update.bind(actionController));
router.delete('/:id', actionController.delete.bind(actionController));
router.post('/:id/test', actionController.test.bind(actionController));
router.post('/:id/execute', actionController.execute.bind(actionController));
router.get('/:id/test-cases', actionController.getTestCases.bind(actionController));
router.delete('/test-cases/:testCaseId', actionController.deleteTestCase.bind(actionController));

export default router;
