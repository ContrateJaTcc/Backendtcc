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
/* Antes de alguém responder: corrigir a pergunta ou apagar o pedido */
router.put('/:id', auth, exigirPapel('contratante'), orcamento.editarPedido)
router.delete('/:id', auth, exigirPapel('contratante'), orcamento.apagarPedido)

export default router
