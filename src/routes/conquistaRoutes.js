import express from 'express'
import * as conquistaController from '../controllers/conquistaController.js'
import auth from '../middleware/auth.js'
import { album } from '../controllers/reinoController.js'

/* Conquistas secretas */
const router = express.Router()

router.get('/', auth, conquistaController.listarConquistas)
/* Álbum: todas as insígnias e conquistas, com quantos por cento das pessoas já têm cada uma */
router.get('/album', auth, album)
router.post('/:codigo', auth, conquistaController.desbloquear)

export default router
