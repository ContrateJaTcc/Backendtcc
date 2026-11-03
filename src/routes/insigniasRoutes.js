import { Router } from 'express';
import {
    consultarInsignia,
    consultarInsigniaPorUsuario
} from '../controllers/insigniasController.js';

const router = Router();

router.get('/usuario/:usu_id', consultarInsigniaPorUsuario);
router.get('/:free_id', consultarInsignia);

export default router;