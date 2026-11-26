import express from 'express'
import * as notificacaoController from '../controllers/notificacaoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/', auth, notificacaoController.listarNotificacoes)
router.put('/lidas', auth, notificacaoController.marcarTodasLidas)
/* Limpar o sino: apaga as lidas (?todas=1 apaga todas) */
router.delete('/', auth, notificacaoController.limpar)
/* Uma notificação: lida/não lida e apagar */
router.put('/:id', auth, notificacaoController.marcarUma)
router.delete('/:id', auth, notificacaoController.apagarUma)

export default router
