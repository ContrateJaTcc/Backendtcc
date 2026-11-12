import express from 'express'
import * as adminController from '../controllers/adminController.js'
import * as supremoController from '../controllers/supremoController.js'
import * as extras from '../controllers/extrasController.js'
import * as contratacao from '../controllers/contratacaoController.js'
import * as moderacao from '../controllers/moderacaoController.js'
import * as painel from '../controllers/painelController.js'
import auth from '../middleware/auth.js'
import { exigirAdmin, exigirSupremo } from '../middleware/papel.js'

const router = express.Router()

/* Só administrador */
router.use(auth, exigirAdmin)

router.get('/resumo', adminController.resumo)
router.get('/metricas', adminController.metricas)
router.get('/usuarios', adminController.listarUsuarios)
router.put('/usuarios/:id/status', adminController.alterarStatus)
router.get('/servicos', adminController.listarServicos)
router.put('/servicos/:id/cancelar', adminController.cancelarServico)
router.get('/denuncias', extras.listarDenuncias)
/* Filtro de spam: projetos esperando revisão */
router.get('/moderacao', moderacao.filaModeracao)
router.put('/moderacao/:id', moderacao.decidirModeracao)
/* Monitor de erros do site e do servidor */
router.get('/erros', moderacao.listarErros)
/* Funil (onde as pessoas desistem) e saúde do servidor */
router.get('/funil', painel.funil)
router.get('/saude', painel.saude)
router.delete('/erros', moderacao.limparErros)
router.delete('/erros/:id', moderacao.limparErros)
router.put('/denuncias/:id', extras.fecharDenuncia)
router.get('/disputas', contratacao.listarDisputas)
router.put('/disputas/:id', contratacao.resolverDisputa)

/* Só o administrador supremo */
router.put('/usuarios/:id/papel', exigirSupremo, supremoController.mudarPapel)
router.post('/usuarios/:id/entrar', exigirSupremo, supremoController.entrarComo)
router.delete('/usuarios/:id', exigirSupremo, supremoController.excluirUsuario)
router.post('/avisos', exigirSupremo, supremoController.enviarAviso)
router.put('/cenario', exigirSupremo, supremoController.salvarCenario)
router.get('/registro', exigirSupremo, supremoController.listarRegistro)
/* Migrations do banco pelo servidor (sem precisar da senha do banco) */
router.get('/migracoes', exigirSupremo, supremoController.verMigracoes)
router.post('/migracoes', exigirSupremo, supremoController.rodarMigracoes)

export default router
