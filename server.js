import 'dotenv/config'
import app from './src/app.js'
import { iniciarAgendador } from './src/services/agendador.js'
import { instalarMonitor } from './src/services/monitor.js'

/* Monitor de erros: o que cair no console.error aparece na aba Erros do painel admin */
instalarMonitor()

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} ^^`)
    /* Na Vercel o processo não fica ligado: lá as tarefas saem pelo Vercel Cron (rotas /tarefas) */
    if (!process.env.VERCEL) iniciarAgendador()
})

export default app
