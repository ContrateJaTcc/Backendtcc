import express from 'express'
import { listarAtivas } from '../controllers/categoriaController.js'

const router = express.Router()

/* Categorias ativas (a administração gerencia em /admin/categorias) */
router.get('/', listarAtivas)

export default router
