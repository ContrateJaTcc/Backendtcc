import express from 'express'
import * as portfolioController from '../controllers/portfolioController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/* Ordem das rotas */
router.get('/meu', auth, portfolioController.listarMeuPortfolio)
router.get('/freelancer/:usuId', auth, portfolioController.listarPorFreelancer)

router.post('/', auth, portfolioController.criarItem)
router.post('/de-projeto/:servId', auth, portfolioController.criarDeProjeto)
router.put('/:id', auth, portfolioController.atualizarItem)
router.delete('/:id', auth, portfolioController.deletarItem)

export default router
