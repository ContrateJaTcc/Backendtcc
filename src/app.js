import express from 'express'
import authRoutes from './routes/authRoutes.js'
import usuarioRoutes from './routes/usuarioRoutes.js'

const app = express()

app.use(express.json())

app.use('/auth', authRoutes)
app.use('/usuarios', usuarioRoutes)

export default app