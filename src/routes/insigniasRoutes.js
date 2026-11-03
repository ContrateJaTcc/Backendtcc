import { Router } from 'express';
import { consultarInsignia } from '../controllers/insigniasController.js';

const router = Router();

router.get('/:free_id', consultarInsignia);

export default router;
