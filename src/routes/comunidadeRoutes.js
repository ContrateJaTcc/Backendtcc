import express from 'express'
import * as comunidade from '../controllers/comunidadeController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'

const router = express.Router()

/* Chefão do mês (todo o castelo junto) e o prêmio de quem ajudou */
router.get('/chefao', auth, comunidade.verChefao)
router.post('/chefao/resgatar', auth, exigirPapel('freelancer'), comunidade.resgatarChefao)
/* Desafio da semana: freelancers mandam, todo mundo logado vota */
router.get('/desafio', auth, comunidade.verDesafio)
router.post('/desafio', auth, exigirPapel('freelancer'), comunidade.enviarDesafio)
router.post('/desafio/:envId/voto', auth, comunidade.votarDesafio)
/* Árvore de habilidades (a minha ou a de um freelancer) */
router.get('/arvore', auth, exigirPapel('freelancer'), comunidade.verArvore)
router.get('/arvore/:usuId', auth, comunidade.verArvore)
/* Missões do mês de uma guilda */
router.get('/guildas/:id/missoes', auth, comunidade.verMissoesGuilda)

export default router
