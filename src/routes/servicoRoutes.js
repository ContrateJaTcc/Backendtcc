import express from 'express'
import * as servicoController from '../controllers/servicoController.js'
import * as candidaturaController from '../controllers/candidaturaController.js'
import { finalizarServico, entregarServico } from '../controllers/avaliacaoController.js'
import * as etapaController from '../controllers/etapaController.js'
import * as salvoController from '../controllers/salvoController.js'
import * as contratacao from '../controllers/contratacaoController.js'
import { precosSugeridos } from '../controllers/contaController.js'
import auth from '../middleware/auth.js'
import { exigirPapel } from '../middleware/papel.js'
import { limitarTentativas } from '../middleware/seguranca.js'
import * as pausa from '../controllers/pausaController.js'
import * as trabalho from '../controllers/trabalhoController.js'

/* Candidaturas: 20 a cada 10 minutos; projetos novos: 15 por hora (por pessoa) */
const limiteCandidatura = limitarTentativas({ maximo: 20, janelaMs: 10 * 60_000, porConta: true, mensagem: 'Muitas candidaturas seguidas.' })
const limiteProjeto = limitarTentativas({ maximo: 15, janelaMs: 60 * 60_000, porConta: true, mensagem: 'Muitos projetos criados em pouco tempo.' })

const router = express.Router()

const freelancer = exigirPapel('freelancer')
const contratante = exigirPapel('contratante')

router.get('/abertos', auth, freelancer, candidaturaController.listarServicosAbertos)
/* Trabalho de amostra: tarefa pequena para testar um freelancer antes do projeto grande */
router.post('/amostra', auth, contratante, limiteProjeto, trabalho.pedirAmostra)
router.get('/meus', auth, contratante, servicoController.listarMeusServicos)
router.get('/salvos', auth, freelancer, salvoController.listarSalvos)
router.get('/precos', auth, contratante, precosSugeridos)

router.get('/:id/outros', auth, servicoController.listarOutrosServicos)
router.get('/:id/parecidos', auth, servicoController.listarParecidos)
router.post('/:id/salvar', auth, freelancer, salvoController.salvar)
router.delete('/:id/salvar', auth, freelancer, salvoController.remover)

router.post('/:id/candidaturas', auth, freelancer, limiteCandidatura, candidaturaController.candidatarSe)
router.delete('/:id/candidaturas', auth, freelancer, candidaturaController.cancelarCandidatura)

router.put('/:id/entregar', auth, freelancer, entregarServico)
router.put('/:id/finalizar', auth, contratante, finalizarServico)

/* Depois da contratação: termo de acordo, garantia, ajustes e disputa */
router.get('/:id/acordo', auth, contratacao.verAcordo)
router.put('/:id/acordo', auth, contratacao.aceitarAcordo)
router.post('/:id/garantia', auth, contratante, contratacao.depositarGarantia)
router.put('/:id/ajustes', auth, contratante, contratacao.pedirAjustes)
router.post('/:id/disputa', auth, contratacao.abrirDisputa)
router.post('/:id/bonus', auth, contratante, contratacao.darBonus)
router.get('/:id/recibo', auth, contratacao.verRecibo)

/* Pausar o prazo: uma parte pede, a outra aceita; qualquer uma retoma */
router.post('/:id/pausa', auth, pausa.pedirPausa)
router.put('/:id/pausa', auth, pausa.responderPausa)

/* Horas trabalhadas (projetos por hora): o freelancer registra, o contratante aprova */
router.get('/:id/horas', auth, trabalho.listarHoras)
router.post('/:id/horas', auth, freelancer, trabalho.registrarHoras)
router.put('/:id/horas/:horId', auth, trabalho.decidirHoras)
/* Critérios de aceite: o contratante define, o freelancer marca, o contratante aprova */
router.get('/:id/criterios', auth, trabalho.listarCriterios)
router.post('/:id/criterios', auth, contratante, trabalho.criarCriterio)
router.put('/:id/criterios/:criId', auth, trabalho.mudarCriterio)
/* Versões da entrega e projeto recorrente */
router.get('/:id/versoes', auth, trabalho.listarVersoes)
router.put('/:id/repetir', auth, contratante, trabalho.configurarRepeticao)
router.post('/:id/repetir-agora', auth, contratante, limiteProjeto, trabalho.repetirAgora)

/* Etapas: o contratante cria e remove, o freelancer contratado marca como feita */
router.get('/:id/etapas', auth, etapaController.listarEtapas)
router.post('/:id/etapas', auth, contratante, etapaController.criarEtapa)
router.delete('/:id/etapas/:etaId', auth, contratante, etapaController.removerEtapa)
router.put('/:id/etapas/:etaId', auth, freelancer, etapaController.concluirEtapa)
router.post('/:id/etapas/:etaId/aprovar', auth, contratante, etapaController.aprovarEtapa)
router.get('/:id', auth, servicoController.buscarServicoPorId)
router.put('/:id', auth, contratante, servicoController.atualizarServico)
router.post('/', auth, contratante, limiteProjeto, servicoController.criarServico)

export default router
