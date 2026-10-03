import express from 'express'
import * as notificacaoController from '../controllers/notificacaoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/', auth, notificacaoController.listarNotificacoes)
router.put('/lidas', auth, notificacaoController.marcarTodasLidas)

export default router
