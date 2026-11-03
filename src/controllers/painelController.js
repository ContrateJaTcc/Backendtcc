import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { emailConfigurado } from '../services/email.js'
import { pushConfigurado } from '../services/push.js'

/* Painel admin (funil e saúde do servidor) e os números públicos do Modo TV */

/* ---------- Funil ---------- */

/*
 * De quantos se cadastram, quantos chegam a cada passo. Freelancer: perfil completo, candidatou, contratado, concluiu.
 * Contratante: publicou, contratou, concluiu. ?dias=30 olha só quem entrou nos últimos dias (padrão: todo mundo).
 */
export const funil = async (req, res) => {
    try {
        const dias = Math.min(365, Math.max(0, Number(req.query.dias) || 0))
        const desde = dias ? new Date(Date.now() - dias * 86_400_000) : null
        const recorte = (q, coluna = 'usuario.data_criacao') => {
            if (desde) q.where(coluna, '>=', desde)
        }
        const conta = async (q) => Number((await q.countDistinct('usuario.usu_id as total').first())?.total ?? 0)
        const base = (tipo) => db('usuario').where('usuario.tipo_usuario', tipo).whereNot('usuario.status_conta', 'banida').modify(recorte)

        const freelancer = [
            { passo: 'Cadastrou', total: await conta(base('freelancer')) },
            { passo: 'Completou o perfil', total: await conta(base('freelancer').whereNotNull('usuario.usu_foto').whereNotNull('usuario.usu_desc').whereNot('usuario.usu_desc', '')) },
            { passo: 'Se candidatou', total: await conta(base('freelancer').join('freelancer', 'freelancer.usu_id', 'usuario.usu_id').join('candidatura', 'candidatura.free_id', 'freelancer.free_id')) },
            { passo: 'Foi contratado', total: await conta(base('freelancer').join('freelancer', 'freelancer.usu_id', 'usuario.usu_id').join('candidatura', 'candidatura.free_id', 'freelancer.free_id').where('candidatura.cand_status', 'aceita')) },
            {
                passo: 'Concluiu um projeto',
                total: await conta(base('freelancer').join('freelancer', 'freelancer.usu_id', 'usuario.usu_id').join('candidatura', 'candidatura.free_id', 'freelancer.free_id').join('servico', 'servico.serv_id', 'candidatura.serv_id').where({ 'candidatura.cand_status': 'aceita', 'servico.serv_status': 'finalizado' }))
            }
        ]
        const doContratante = () => base('contratante').join('contratante', 'contratante.usu_id', 'usuario.usu_id').join('servico', 'servico.cont_id', 'contratante.cont_id')
        const contratante = [
            { passo: 'Cadastrou', total: await conta(base('contratante')) },
            { passo: 'Publicou um projeto', total: await conta(doContratante().whereNot('servico.serv_status', 'rascunho')) },
            { passo: 'Contratou alguém', total: await conta(doContratante().whereIn('servico.serv_status', ['em_andamento', 'finalizado'])) },
            { passo: 'Concluiu um projeto', total: await conta(doContratante().where('servico.serv_status', 'finalizado')) }
        ]
        const comTaxa = (lista) => lista.map((p, i) => ({ ...p, do_anterior: i === 0 || !lista[i - 1].total ? null : Math.round((p.total / lista[i - 1].total) * 100) }))
        return res.json({ dias: dias || null, freelancer: comTaxa(freelancer), contratante: comTaxa(contratante) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao montar o funil.' })
    }
}

/* ---------- Saúde do servidor ---------- */

/* As tarefas automáticas anotam quando rodaram (services/agendador.js) */
export async function marcarTarefa(nome) {
    try {
        if (!(await temTabela('config_site'))) return
        await db('config_site').insert({ cfg_chave: `tarefa:${nome}`, cfg_valor: new Date().toISOString() }).onConflict('cfg_chave').merge({ cfg_valor: new Date().toISOString(), cfg_atualizado_em: db.fn.now() })
    } catch {
        /* Nunca derruba a tarefa */
    }
}

export const saude = async (req, res) => {
    const inicio = Date.now()
    let banco = { ok: false, ms: null, erro: null }
    try {
        await db.raw('SELECT 1')
        banco = { ok: true, ms: Date.now() - inicio, erro: null }
    } catch (erro) {
        banco = { ok: false, ms: null, erro: String(erro?.code ?? erro?.message ?? 'falhou').slice(0, 80) }
    }

    let migracoes = null
    try {
        const [concluidas] = await db.raw('SELECT COUNT(*) AS total FROM knex_migrations')
        migracoes = Number(concluidas?.[0]?.total ?? concluidas?.total ?? 0) || null
    } catch {
        migracoes = null
    }

    let tarefas = {}
    try {
        if (banco.ok && (await temTabela('config_site'))) {
            const linhas = await db('config_site').where('cfg_chave', 'like', 'tarefa:%').select('cfg_chave', 'cfg_valor')
            tarefas = Object.fromEntries(linhas.map((l) => [l.cfg_chave.replace('tarefa:', ''), l.cfg_valor]))
        }
    } catch {
        tarefas = {}
    }

    const erros24h = banco.ok && (await temTabela('erro_registro'))
        ? Number((await db('erro_registro').where('err_ultima', '>=', new Date(Date.now() - 86_400_000)).sum('err_total as total').first())?.total ?? 0)
        : null

    const memoria = process.memoryUsage()
    return res.json({
        banco,
        email: emailConfigurado,
        push: pushConfigurado,
        migracoes,
        tarefas,
        erros_24h: erros24h,
        ultima_migracao_ok: await temColuna('usuario', 'usu_email_confirmado'),
        servidor: {
            no_ar_desde: new Date(Date.now() - process.uptime() * 1000).toISOString(),
            memoria_mb: Math.round(memoria.rss / 1024 / 1024),
            node: process.version,
            vercel: Boolean(process.env.VERCEL)
        },
        verificado_em: new Date().toISOString()
    })
}

/* ---------- Modo TV: números públicos da plataforma ---------- */

export const numeros = async (req, res) => {
    try {
        const conta = async (q) => Number((await q.count('* as total').first())?.total ?? 0)
        const [freelancers, contratantes, abertos, concluidos, avaliacoes] = await Promise.all([
            conta(db('usuario').where({ tipo_usuario: 'freelancer', status_conta: 'ativa' })),
            conta(db('usuario').where({ tipo_usuario: 'contratante', status_conta: 'ativa' })),
            conta(db('servico').where('serv_status', 'aberto')),
            conta(db('servico').where('serv_status', 'finalizado')),
            conta(db('avaliacao'))
        ])
        const online = (await temColuna('usuario', 'usu_visto_em'))
            ? await conta(db('usuario').where('usu_visto_em', '>=', new Date(Date.now() - 5 * 60_000)))
            : null
        const [{ media }] = await db('avaliacao').avg('aval_nota as media')
        return res.json({
            freelancers,
            contratantes,
            projetos_abertos: abertos,
            projetos_concluidos: concluidos,
            avaliacoes,
            nota_media: media ? Math.round(Number(media) * 10) / 10 : null,
            online,
            atualizado_em: new Date().toISOString()
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os números.' })
    }
}
