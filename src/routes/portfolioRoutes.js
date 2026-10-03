import express from 'express'
import * as portfolioController from '../controllers/portfolioController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/*
 * Ordem importa: "/meu" e "/freelancer/:usuId" precisam vir antes de "/:id",
 * senao o Express trataria "meu" como se fosse um id de item.
 */
router.get('/meu', auth, portfolioController.listarMeuPortfolio)
router.get('/freelancer/:usuId', auth, portfolioController.listarPorFreelancer)

router.post('/', auth, portfolioController.criarItem)
router.put('/:id', auth, portfolioController.atualizarItem)
router.delete('/:id', auth, portfolioController.deletarItem)

export default router
