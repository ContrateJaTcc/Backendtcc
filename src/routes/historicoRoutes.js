import express from 'express'
import * as mensagemController from '../controllers/mensagemController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/', auth, mensagemController.listarHistorico)

export default router
