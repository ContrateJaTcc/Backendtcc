import express from 'express'
import * as contratacao from '../controllers/contratacaoController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()

/* Carteira fictícia (simulação de pagamento com garantia) */
router.get('/', auth, exigirPapel('freelancer', 'contratante'), contratacao.verCarteira)
router.post('/credito', auth, exigirPapel('contratante'), contratacao.adicionarCredito)

export default router
