import express from 'express'
import * as guildaController from '../controllers/guildaController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()

const freelancer = exigirPapel('freelancer')

/* Guildas de freelancers (até 6 por guilda, uma guilda por pessoa) */
router.get('/', auth, freelancer, guildaController.listar)
router.post('/', auth, freelancer, guildaController.criar)
router.post('/sair', auth, freelancer, guildaController.sair)
router.put('/:id', auth, freelancer, guildaController.editar)
router.post('/:id/entrar', auth, freelancer, guildaController.entrar)
router.delete('/:id/membros/:usuId', auth, freelancer, guildaController.removerMembro)
/* A liderança dissolve a guilda */
router.delete('/:id', auth, freelancer, guildaController.dissolver)

export default router
