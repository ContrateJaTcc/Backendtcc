import express from 'express'
import * as missaoController from '../controllers/missaoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/* Ranking dos freelancers (qualquer conta logada vê) */
router.get('/', auth, missaoController.ranking)
/* Os 3 primeiros do mês passado (ganham a moldura da temporada) */
router.get('/campeoes', auth, missaoController.campeoes)

export default router
