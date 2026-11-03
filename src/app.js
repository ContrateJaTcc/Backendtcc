import express from 'express'
import cors from 'cors'

import authRoutes from './routes/authRoutes.js'
import usuarioRoutes from './routes/usuarioRoutes.js'
import servicoRoutes from './routes/servicoRoutes.js'
import tipoServicoRoutes from './routes/tipoServicoRoutes.js'
import candidaturaRoutes from './routes/candidaturaRoutes.js'
import mensagemRoutes from './routes/mensagemRoutes.js'
import historicoRoutes from './routes/historicoRoutes.js'
import portfolioRoutes from './routes/portfolioRoutes.js'
import perfilRoutes from './routes/perfilRoutes.js'
import avaliacaoRoutes from './routes/avaliacaoRoutes.js'
import notificacaoRoutes from './routes/notificacaoRoutes.js'
import insigniasRoutes from './routes/insigniasRoutes.js'
import conviteRoutes from './routes/conviteRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import configRoutes from './routes/configRoutes.js'
import missaoRoutes from './routes/missaoRoutes.js'
import rankingRoutes from './routes/rankingRoutes.js'
import publicoRoutes from './routes/publicoRoutes.js'
import buscaRoutes from './routes/buscaRoutes.js'
import conquistaRoutes from './routes/conquistaRoutes.js'
import carteiraRoutes from './routes/carteiraRoutes.js'
import lojaRoutes from './routes/lojaRoutes.js'
import eventoRoutes from './routes/eventoRoutes.js'
import tarefaRoutes from './routes/tarefaRoutes.js'
import guildaRoutes from './routes/guildaRoutes.js'
import testeRoutes from './routes/testeRoutes.js'
import docsRoutes from './routes/docsRoutes.js'
import comunidadeRoutes from './routes/comunidadeRoutes.js'
import orcamentoRoutes from './routes/orcamentoRoutes.js'
import { denunciaRoutes, passoRoutes, pushRoutes } from './routes/extrasRoutes.js'
import { cabecalhosSeguranca } from './middleware/seguranca.js'

const app = express()

/* Origens */
const origens = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : true

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(cabecalhosSeguranca)
app.use(cors({ origin: origens }))
/* Mensagens podem levar um PDF; o resto continua com o limite pequeno */
app.use('/mensagens', express.json({ limit: '3mb' }))
app.use(express.json({ limit: '300kb' }))

app.use('/auth', authRoutes)
app.use('/usuarios', usuarioRoutes)
app.use('/servicos', servicoRoutes)
app.use('/tipos-servico', tipoServicoRoutes)
app.use('/candidaturas', candidaturaRoutes)
app.use('/mensagens', mensagemRoutes)
app.use('/historico', historicoRoutes)
app.use('/portfolio', portfolioRoutes)
app.use('/perfil', perfilRoutes)
app.use('/avaliacoes', avaliacaoRoutes)
app.use('/notificacoes', notificacaoRoutes)
app.use('/insignias', insigniasRoutes)
app.use('/convites', conviteRoutes)
app.use('/admin', adminRoutes)
app.use('/config', configRoutes)
app.use('/missoes', missaoRoutes)
app.use('/ranking', rankingRoutes)
app.use('/publico', publicoRoutes)
app.use('/push', pushRoutes)
app.use('/denuncias', denunciaRoutes)
app.use('/passos', passoRoutes)
app.use('/buscas', buscaRoutes)
app.use('/conquistas', conquistaRoutes)
app.use('/carteira', carteiraRoutes)
app.use('/loja', lojaRoutes)
app.use('/eventos', eventoRoutes)
app.use('/tarefas', tarefaRoutes)
app.use('/guildas', guildaRoutes)
app.use('/testes', testeRoutes)
app.use('/docs', docsRoutes)
app.use('/comunidade', comunidadeRoutes)
app.use('/orcamentos', orcamentoRoutes)

export default app
