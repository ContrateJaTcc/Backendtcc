import express from 'express'
import * as servicoController from '../controllers/servicoController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.post('/', auth, servicoController.criarServico)

export default router