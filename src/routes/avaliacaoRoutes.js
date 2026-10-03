import express from 'express'
import * as avaliacaoController from '../controllers/avaliacaoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/pendentes', auth, avaliacaoController.listarPendentes)
router.post('/', auth, avaliacaoController.criarAvaliacao)

export default router
