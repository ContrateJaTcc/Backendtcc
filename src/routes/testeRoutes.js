import express from 'express'
import * as reino from '../controllers/reinoController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()

const freelancer = exigirPapel('freelancer')

/* Testes de habilidade: quem passa ganha o selo da área */
router.get('/', auth, freelancer, reino.listarTestes)
router.get('/:tipoId', auth, freelancer, reino.verTeste)
router.post('/:tipoId', auth, freelancer, reino.responderTeste)

export default router
