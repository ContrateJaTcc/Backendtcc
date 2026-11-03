import express from 'express'
import * as extras from '../controllers/extrasController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

/* Notificações no celular, denúncias e primeiros passos */
export const pushRoutes = express.Router()
pushRoutes.get('/chave', extras.chavePush)
pushRoutes.post('/inscricao', auth, extras.inscreverPush)
pushRoutes.delete('/inscricao', auth, extras.desinscreverPush)

export const denunciaRoutes = express.Router()
denunciaRoutes.post('/', auth, exigirPapel('freelancer', 'contratante'), extras.denunciar)

export const passoRoutes = express.Router()
passoRoutes.get('/', auth, exigirPapel('freelancer'), extras.listarPassos)
passoRoutes.post('/:codigo/resgatar', auth, exigirPapel('freelancer'), extras.resgatarPasso)
