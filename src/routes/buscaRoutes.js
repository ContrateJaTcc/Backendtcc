import express from 'express'
import * as buscaController from '../controllers/buscaController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

/* Alertas de busca do freelancer */
const router = express.Router()

router.use(auth, exigirPapel('freelancer'))

router.get('/', buscaController.listarBuscas)
router.post('/', buscaController.criarBusca)
router.delete('/:id', buscaController.removerBusca)

export default router
