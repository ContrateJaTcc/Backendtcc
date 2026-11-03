
import express from 'express'
import * as usuarioController from '../controllers/usuarioController.js'
import auth from '../middleware/auth.js'
import { exigirAdmin, exigirPapel } from '../middleware/papel.js'
import * as conta from '../controllers/contaController.js'
import * as reino from '../controllers/reinoController.js'
import * as agenda from '../controllers/agendaController.js'
import * as preferencia from '../controllers/preferenciaController.js'
import { minhaIndicacao } from '../controllers/indicacaoController.js'
import * as relacao from '../controllers/relacaoController.js'

const router = express.Router()

router.get('/eu', auth, usuarioController.buscarMeuPerfil)
router.get('/eu/areas', auth, usuarioController.listarMinhasAreas)
router.put('/eu/areas', auth, usuarioController.salvarMinhasAreas)
router.put('/eu/disponibilidade', auth, conta.salvarDisponibilidade)
router.post('/eu/atividade', auth, conta.marcarAtividade)
router.put('/eu/resumo', auth, conta.salvarResumoEmail)
router.get('/eu/resumo-previa', auth, conta.previaResumo)
router.get('/eu/dados', auth, conta.baixarDados)
router.get('/eu/ganhos', auth, exigirPapel('freelancer'), conta.ganhos)
router.put('/eu/mascote', auth, exigirPapel('freelancer'), reino.salvarMascote)
router.get('/eu/visitas', auth, exigirPapel('freelancer'), reino.minhasVisitas)
router.get('/eu/agenda', auth, exigirPapel('freelancer', 'contratante'), agenda.agenda)
router.get('/eu/retrospectiva', auth, exigirPapel('freelancer', 'contratante'), agenda.retrospectiva)
router.get('/eu/marcos', auth, exigirPapel('freelancer', 'contratante'), agenda.marcos)
router.get('/eu/avisos', auth, preferencia.verAvisos)
router.put('/eu/avisos', auth, preferencia.salvarAvisos)
router.get('/eu/privacidade', auth, preferencia.verPrivacidade)
router.put('/eu/privacidade', auth, preferencia.salvarPrivacidade)
router.get('/eu/indicacao', auth, exigirPapel('freelancer', 'contratante'), minhaIndicacao)
/* Bloqueio (qualquer conta bloqueia qualquer uma, menos a administração) */
router.get('/eu/bloqueados', auth, relacao.listarBloqueados)
router.post('/bloqueios/:usuId', auth, relacao.bloquear)
router.delete('/bloqueios/:usuId', auth, relacao.desbloquear)
/* Horários de atendimento do freelancer */
router.put('/eu/horarios', auth, exigirPapel('freelancer'), relacao.salvarHorarios)
/* Do contratante sobre um freelancer: anotação privada e "me avise quando estiver livre" */
router.get('/notas/:usuId', auth, exigirPapel('contratante'), relacao.verNota)
router.put('/notas/:usuId', auth, exigirPapel('contratante'), relacao.salvarNota)
router.get('/freelancers/:usuId/aviso-livre', auth, exigirPapel('contratante'), relacao.verAvisoDisponivel)
router.post('/freelancers/:usuId/aviso-livre', auth, exigirPapel('contratante'), relacao.pedirAvisoDisponivel)
router.delete('/freelancers/:usuId/aviso-livre', auth, exigirPapel('contratante'), relacao.cancelarAvisoDisponivel)
/* Cartas de candidatura salvas (freelancer) */
router.get('/eu/modelos', auth, exigirPapel('freelancer'), preferencia.listarModelos)
router.post('/eu/modelos', auth, exigirPapel('freelancer'), preferencia.criarModelo)
router.put('/eu/modelos/:id', auth, exigirPapel('freelancer'), preferencia.editarModelo)
router.delete('/eu/modelos/:id', auth, exigirPapel('freelancer'), preferencia.apagarModelo)
/* Freelancers que o contratante guardou */
router.get('/favoritos', auth, exigirPapel('contratante'), reino.listarFavoritos)
router.post('/favoritos/:usuId', auth, exigirPapel('contratante'), reino.favoritar)
router.delete('/favoritos/:usuId', auth, exigirPapel('contratante'), reino.desfavoritar)
router.get('/freelancers', auth, exigirPapel('contratante', 'administrador'), usuarioController.listarFreelancers)
router.get('/freelancers/comparar', auth, exigirPapel('contratante'), usuarioController.compararFreelancers)
router.get('/', auth, exigirAdmin, usuarioController.listarUsuarios)
router.get('/:id', auth, usuarioController.buscarUsuario)
router.put('/:id', auth, usuarioController.atualizarUsuario)
router.delete('/:id', auth, usuarioController.deletarUsuario)

export default router
