import express from 'express'
import cors from 'cors'
import authRoutes from './routes/authRoutes.js'
import usuarioRoutes from './routes/usuarioRoutes.js'
import servicoRoutes from './routes/servicoRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/usuarios', usuarioRoutes)
app.use('/servicos', servicoRoutes)

export default app