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

const app = express()

app.use(cors())
app.use(express.json())

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

export default app