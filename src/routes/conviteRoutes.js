import express from 'express'
import * as conviteController from '../controllers/conviteController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()

const freelancer = exigirPapel('freelancer')
const contratante = exigirPapel('contratante')

router.get('/recebidos', auth, freelancer, conviteController.listarRecebidos)
router.get('/enviados', auth, contratante, conviteController.listarEnviados)
router.post('/', auth, contratante, conviteController.criarConvite)
router.put('/:id', auth, freelancer, conviteController.responderConvite)

export default router
