import express from 'express'
import * as missaoController from '../controllers/missaoController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()

/* Missões da semana (freelancer) */
router.get('/', auth, exigirPapel('freelancer'), missaoController.listarMissoes)
router.post('/:codigo/resgatar', auth, exigirPapel('freelancer'), missaoController.resgatarMissao)

export default router
