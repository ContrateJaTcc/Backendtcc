import express from 'express'
import * as perfilController from '../controllers/perfilController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/* Ordem das rotas */
router.get('/freelancer/eu', auth, perfilController.meuPerfilFreelancer)
router.get('/freelancer/:usuId', auth, perfilController.perfilFreelancer)
router.get('/contratante/eu', auth, perfilController.meuPerfilContratante)

export default router
