import express from 'express'
import * as authController from '../controllers/authController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.get('/', authController.test)
router.post('/register', authController.register)
router.post('/login', authController.login)
router.get('/perfil', auth, (req, res) => {
    res.json({
        mensagem: "Você está autenticado yiipiies",
        usuario: req.usuario
    })
})

export default router