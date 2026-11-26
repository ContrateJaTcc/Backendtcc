import express from 'express'
import * as avaliacaoController from '../controllers/avaliacaoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/pendentes', auth, avaliacaoController.listarPendentes)
/* As que eu fiz: dá para corrigir ou apagar enquanto estão às cegas */
router.get('/enviadas', auth, avaliacaoController.listarEnviadas)
router.post('/', auth, avaliacaoController.criarAvaliacao)
router.put('/:id', auth, avaliacaoController.editarAvaliacao)
router.delete('/:id', auth, avaliacaoController.apagarAvaliacao)

export default router
