import express from 'express'
import * as authController from '../controllers/authController.js'
import auth from '../middleware/auth.js'
import { limitarTentativas } from '../middleware/seguranca.js'

const router = express.Router()

/* Tentativas */
const limiteLogin = limitarTentativas({ maximo: 10 })
const limiteEmail = limitarTentativas({ maximo: 5 })

router.get('/', authController.test)
router.post('/register', limiteLogin, authController.register)
router.post('/login', limiteLogin, authController.login)
router.post('/google', limiteLogin, authController.loginGoogle)
router.post('/codigo', limiteLogin, authController.confirmarCodigo)
/* Confirmar o e-mail do cadastro (código de 6 números) */
router.post('/confirmar-email', limiteLogin, authController.confirmarEmail)
router.post('/confirmar-email/reenviar', limiteEmail, authController.reenviarConfirmacao)
router.post('/esqueci-senha', limiteEmail, authController.esqueciSenha)
router.post('/redefinir-senha', limiteLogin, authController.redefinirSenha)
router.get('/seguranca', auth, authController.situacaoSeguranca)
router.post('/2fa/codigo', auth, limiteEmail, authController.pedirCodigo2fa)
router.put('/2fa', auth, limiteLogin, authController.salvar2fa)
router.get('/sessoes', auth, authController.listarSessoes)
router.delete('/sessoes/:id', auth, authController.encerrarSessao)
router.post('/sessoes/encerrar-outras', auth, authController.encerrarOutras)
router.post('/sair', auth, authController.sair)
router.get('/perfil', auth, (req, res) => {
    res.json({
        mensagem: "Você está autenticado yiipiies",
        usuario: req.usuario
    })
})

export default router
