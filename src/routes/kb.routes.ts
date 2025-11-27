import { Router } from 'express';
import kbController, { upload } from '../controllers/kb.controller';

const router = Router();

router.post('/:agentId/upload', upload.single('file'), kbController.upload.bind(kbController));
router.get('/:agentId', kbController.list.bind(kbController));
router.post('/:id/build-embeddings', kbController.buildEmbeddings.bind(kbController));
router.post('/:agentId/search', kbController.search.bind(kbController));
router.delete('/:id', kbController.delete.bind(kbController));

export default router;
