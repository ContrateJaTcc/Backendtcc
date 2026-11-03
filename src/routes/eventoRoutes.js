import express from 'express'
import * as loja from '../controllers/lojaController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/* Eventos sazonais: itens escondidos pelas páginas */
router.get('/', auth, loja.verEvento)
router.post('/coletar', auth, loja.coletar)
router.post('/resgatar', auth, loja.resgatarEvento)

export default router
