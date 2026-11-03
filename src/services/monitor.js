import crypto from 'crypto'
import db from '../config/knex.js'
import { temTabela } from './registro.js'

/*
 * Monitor de erros: os erros do site (enviados pelo navegador) e os do servidor (tudo que passa por console.error)
 * ficam agrupados na tabela erro_registro. A mesma mensagem no mesmo lugar só soma na contagem.
 * Nunca derruba nada: se a tabela não existe ou o insert falha, segue a vida.
 */

/* Tira números de id, e-mails e tokens da mensagem, para agrupar "Projeto 12 não achado" com "Projeto 13 não achado" */
const limpar = (texto) =>
    String(texto ?? '')
        .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
        .replace(/\b(eyJ|Bearer\s)[\w.-]+/g, '<token>')
        .replace(/\b\d{2,}\b/g, '<n>')
        .slice(0, 500)

export async function registrarErro({ origem, mensagem, local = null }) {
    try {
        if (!(await temTabela('erro_registro'))) return
        const msg = limpar(mensagem) || 'Erro sem mensagem'
        const onde = local ? limpar(local).slice(0, 300) : null
        const err_chave = crypto.createHash('sha256').update(`${origem}|${msg}|${onde ?? ''}`).digest('hex')
        const alteradas = await db('erro_registro').where('err_chave', err_chave).update({ err_total: db.raw('err_total + 1'), err_ultima: db.fn.now() })
        if (!alteradas) {
            await db('erro_registro')
                .insert({ err_chave, err_origem: origem, err_mensagem: msg, err_local: onde })
                .onConflict('err_chave')
                .merge({ err_ultima: db.fn.now() })
        }
    } catch {
        /* O monitor nunca vira um erro novo */
    }
}

/* Primeira linha do stack que é do nosso código (src/...) */
function localDoErro(erro) {
    const linha = String(erro?.stack ?? '').split('\n').find((l) => l.includes('/src/') || l.includes('\\src\\'))
    return linha ? linha.trim().replace(/^at\s+/, '').replace(/.*[/\\]src[/\\]/, 'src/') : null
}

let instalado = false

/* Liga o monitor no console.error do servidor (os controllers já mandam todo erro para lá) */
export function instalarMonitor() {
    if (instalado) return
    instalado = true
    const original = console.error.bind(console)
    console.error = (...args) => {
        original(...args)
        const erro = args.find((a) => a instanceof Error)
        if (erro) registrarErro({ origem: 'servidor', mensagem: `${erro.name}: ${erro.message}`, local: localDoErro(erro) })
    }
    process.on('unhandledRejection', (motivo) => console.error(motivo instanceof Error ? motivo : new Error(String(motivo))))
}
