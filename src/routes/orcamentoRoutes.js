import express from 'express'
import * as orcamento from '../controllers/orcamentoController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'
import { limitarTentativas } from '../middleware/seguranca.js'

const router = express.Router()

/* Pedido de orçamento rápido: até 10 pedidos por hora por contratante */
const limitePedido = limitarTentativas({ maximo: 10, janelaMs: 60 * 60_000, porConta: true, mensagem: 'Muitos pedidos de orçamento seguidos.' })

router.get('/', auth, exigirPapel('freelancer', 'contratante'), orcamento.listarPedidos)
router.post('/', auth, exigirPapel('contratante'), limitePedido, orcamento.criarPedido)
router.put('/:id/resposta', auth, exigirPapel('freelancer'), orcamento.responderPedido)
router.put('/:id/fechar', auth, exigirPapel('contratante'), orcamento.fecharPedido)

export default router
