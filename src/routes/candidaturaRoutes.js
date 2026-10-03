import express from 'express'
import * as candidaturaController from '../controllers/candidaturaController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/minhas', auth, candidaturaController.listarMinhasCandidaturas)
router.get('/recebidas', auth, candidaturaController.listarCandidaturasRecebidas)
router.put('/:id', auth, candidaturaController.responderCandidatura)

export default router
