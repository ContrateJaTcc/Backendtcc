import express from 'express'
import * as mensagemController from '../controllers/mensagemController.js'
import auth from '../middleware/auth.js'
import { limitarTentativas } from '../middleware/seguranca.js'

/* Chat: até 40 mensagens por minuto por pessoa (mais que isso é robô ou spam) */
const limiteChat = limitarTentativas({ maximo: 40, janelaMs: 60_000, porConta: true, mensagem: 'Muitas mensagens em pouco tempo.' })

const router = express.Router()

router.get('/', auth, mensagemController.listarConversas)
router.post('/', auth, limiteChat, mensagemController.enviarMensagem)
/* Tempo real: segura a resposta até chegar mensagem nova */
router.get('/novas', auth, mensagemController.aguardarMensagens)
router.get('/contatos', auth, mensagemController.listarContatos)
router.get('/arquivo/:msgId', auth, mensagemController.baixarArquivo)
router.post('/proposta', auth, limiteChat, mensagemController.enviarProposta)
router.put('/proposta/:msgId', auth, mensagemController.responderProposta)
router.post('/reuniao', auth, limiteChat, mensagemController.marcarReuniao)
router.put('/reuniao/:msgId', auth, mensagemController.responderReuniao)
router.post('/digitando', auth, mensagemController.avisarDigitando)
router.get('/:servId/:outroId/estado', auth, mensagemController.estadoConversa)
router.get('/:servId/:outroId', auth, mensagemController.listarMensagens)

export default router
