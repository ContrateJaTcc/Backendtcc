
import express from 'express'
import * as usuarioController from '../controllers/usuarioController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/eu', auth, usuarioController.buscarMeuPerfil)
router.get('/eu/areas', auth, usuarioController.listarMinhasAreas)
router.put('/eu/areas', auth, usuarioController.salvarMinhasAreas)

router.get('/', usuarioController.listarUsuarios)
router.get('/:id', auth, usuarioController.buscarUsuario)
router.put('/:id', auth, usuarioController.atualizarUsuario)
router.delete('/:id', auth, usuarioController.deletarUsuario)

export default router
