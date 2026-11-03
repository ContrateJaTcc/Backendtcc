import express from 'express'
import * as supremoController from '../controllers/supremoController.js'

const router = express.Router()

/* Público: o cenário que o supremo definiu para o site inteiro */
router.get('/cenario', supremoController.verCenario)

export default router
