import express from 'express'
import * as usuarioController from '../controllers/usuarioController.js'

const router = express.Router()

router.get('/', usuarioController.listarUsuarios)
router.get('/:id', usuarioController.buscarUsuario)
router.post('/', usuarioController.criarUsuario)
router.put('/:id', usuarioController.atualizarUsuario)
router.delete('/:id', usuarioController.deletarUsuario)

export default router