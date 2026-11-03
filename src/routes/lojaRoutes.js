import express from 'express'
import * as loja from '../controllers/lojaController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()
const freelancer = exigirPapel('freelancer')

/* Loja de cosméticos (gasta XP, então é dos freelancers) */
router.get('/', auth, freelancer, loja.verLoja)
router.get('/tema', auth, loja.meuTema)
router.put('/equipar', auth, freelancer, loja.equipar)
router.post('/:codigo/comprar', auth, freelancer, loja.comprar)

export default router
