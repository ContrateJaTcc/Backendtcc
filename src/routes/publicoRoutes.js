import express from 'express'
import * as publicoController from '../controllers/publicoController.js'
import { receberErroSite } from '../controllers/moderacaoController.js'
import { numeros } from '../controllers/painelController.js'
import { limitarTentativas } from '../middleware/seguranca.js'

/* Erros do site: até 30 por minuto por aparelho (um erro em loop não enche o banco) */
const limiteErros = limitarTentativas({ maximo: 30, janelaMs: 60_000, mensagem: 'Erros demais.' })

const router = express.Router()

/* Home pública: sem login; as leituras o navegador pode guardar por 5 minutos */
const guardar5min = (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=300')
    next()
}

router.get('/depoimentos', guardar5min, publicoController.depoimentos)
router.post('/contato', publicoController.contato)
router.get('/freelancer/:usuId', guardar5min, publicoController.perfilFreelancer)
router.get('/certificado/:servId', guardar5min, publicoController.certificado)
router.get('/mural', guardar5min, publicoController.mural)
/* Modo TV: números da plataforma (o navegador guarda por 1 minuto) */
router.get('/numeros', (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=60')
    next()
}, numeros)
router.post('/erros', limiteErros, receberErroSite)

export default router
