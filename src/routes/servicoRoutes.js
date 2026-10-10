import express from 'express'
import * as servicoController from '../controllers/servicoController.js'
import * as candidaturaController from '../controllers/candidaturaController.js'
import { finalizarServico } from '../controllers/avaliacaoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/*
 * Ordem importa: rotas com caminho fixo vem antes das com :id, senao o
 * Express trata "abertos" e "meus" como se fossem um id.
 */
router.get('/abertos', auth, candidaturaController.listarServicosAbertos)
router.get('/meus', auth, servicoController.listarMeusServicos)

router.get('/:id/outros', auth, servicoController.listarOutrosServicos)
router.post('/:id/candidaturas', auth, candidaturaController.candidatarSe)
router.delete('/:id/candidaturas',auth,candidaturaController.cancelarCandidatura)
router.put('/:id/finalizar', auth, finalizarServico)
router.get('/:id', auth, servicoController.buscarServicoPorId)
router.put('/:id', auth, servicoController.atualizarServico)
router.post('/', auth, servicoController.criarServico)

export default router
