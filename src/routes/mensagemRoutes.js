import express from 'express'
import * as mensagemController from '../controllers/mensagemController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/', auth, mensagemController.listarConversas)
router.post('/', auth, mensagemController.enviarMensagem)
router.get('/contatos', auth, mensagemController.listarContatos)
router.get('/:servId/:outroId', auth, mensagemController.listarMensagens)

export default router
