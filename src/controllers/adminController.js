import db from '../config/knex.js'
import { ehSupremo } from '../config/supremo.js'
import { registrarAcao } from '../services/registro.js'
import { enviarPush } from '../services/push.js'

const STATUS_CONTA = ['ativa', 'suspensa', 'banida']

/* Notificação */
async function notificar(usu_id, titulo, descricao) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: descricao })
        await enviarPush(usu_id, { titulo, texto: descricao })
    } catch (erro) {
        console.error(erro)
    }
}

/* Contagem */
async function contarPor(tabela, coluna) {
    const linhas = await db(tabela).select(coluna).count('* as total').groupBy(coluna)

    return Object.fromEntries(linhas.map((l) => [l[coluna], Number(l.total)]))
}

/* Resumo */
export const resumo = async (req, res) => {
    try {
        const [usuarios, contas, servicos, candidaturas, [{ avaliacoes }]] = await Promise.all([
            contarPor('usuario', 'tipo_usuario'),
            contarPor('usuario', 'status_conta'),
            contarPor('servico', 'serv_status'),
            contarPor('candidatura', 'cand_status'),
            db('avaliacao').count('* as avaliacoes')
        ])

        return res.json({ usuarios, contas, servicos, candidaturas, avaliacoes: Number(avaliacoes) })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar o resumo.' })
    }
}

/* Usuários */
export const listarUsuarios = async (req, res) => {
    try {
        const busca = String(req.query.busca ?? '').trim()

        const usuarios = await db('usuario')
            .modify((q) => {
                if (busca) {
                    q.where((sub) => {
                        sub.where('usu_nome', 'like', `%${busca}%`)
                            .orWhere('usu_email', 'like', `%${busca}%`)
                    })
                }

                if (req.query.tipo) q.where('tipo_usuario', req.query.tipo)
            })
            .select(
                'usu_id',
                'usu_nome',
                'usu_email',
                'usu_cid',
                'usu_est',
                'usu_foto',
                'tipo_usuario',
                'status_conta',
                'data_criacao'
            )
            .orderBy('usu_id', 'desc')
            .limit(200)

        /* O painel esconde as ações em cima do supremo */
        return res.json({ usuarios: usuarios.map((u) => ({ ...u, usu_supremo: ehSupremo(u) })) })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao listar usuários.' })
    }
}

/* Status da conta */
export const alterarStatus = async (req, res) => {
    try {
        const usu_id = Number(req.params.id)
        const { status } = req.body

        if (!STATUS_CONTA.includes(status)) {
            return res.status(400).json({ erro: 'Status inválido.' })
        }

        if (usu_id === req.usuario.id) {
            return res.status(400).json({ erro: 'Você não pode alterar a própria conta.' })
        }

        const alvo = await db('usuario').select('usu_id', 'usu_email', 'tipo_usuario').where('usu_id', usu_id).first()

        if (!alvo) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' })
        }

        /* Administrador comum não mexe em outro admin; o supremo mexe em todos (e ninguém mexe no supremo) */
        if (ehSupremo(alvo) || (alvo.tipo_usuario === 'administrador' && !req.usuario.supremo)) {
            return res.status(403).json({ erro: 'Não é possível alterar outro administrador.' })
        }

        await db('usuario').where('usu_id', usu_id).update({
            status_conta: status,
            data_atualizacao: db.fn.now()
        })

        if (status === 'ativa') {
            await notificar(usu_id, 'Conta reativada', 'Sua conta foi reativada pela administração.')
        }

        await registrarAcao(req, `conta_${status}`, { alvo: usu_id })

        return res.json({ mensagem: 'Status da conta atualizado.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao alterar a conta.' })
    }
}

/* Projetos */
export const listarServicos = async (req, res) => {
    try {
        const busca = String(req.query.busca ?? '').trim()

        const servicos = await db('servico')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .modify((q) => {
                if (busca) q.where('servico.serv_titulo', 'like', `%${busca}%`)
                if (req.query.status) q.where('servico.serv_status', req.query.status)
            })
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_status',
                'servico.serv_data_criacao',
                'tipo_servico.tipo_nome as categoria',
                'usuario.usu_id as contratante_usu_id',
                'usuario.usu_nome as contratante_nome'
            )
            .orderBy('servico.serv_id', 'desc')
            .limit(200)

        return res.json({ servicos })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao listar projetos.' })
    }
}

/* Cancelar projeto */
export const cancelarServico = async (req, res) => {
    try {
        const servico = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('servico.serv_id', req.params.id)
            .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_status', 'contratante.usu_id')
            .first()

        if (!servico) {
            return res.status(404).json({ erro: 'Projeto não encontrado.' })
        }

        if (['finalizado', 'cancelado'].includes(servico.serv_status)) {
            return res.status(400).json({ erro: 'Este projeto já está encerrado.' })
        }

        await db.transaction(async (trx) => {
            await trx('servico').where('serv_id', servico.serv_id).update({ serv_status: 'cancelado' })

            await trx('candidatura')
                .where('serv_id', servico.serv_id)
                .where('cand_status', 'pendente')
                .update({ cand_status: 'recusada' })
        })

        await notificar(
            servico.usu_id,
            'Projeto removido',
            `"${servico.serv_titulo}" foi cancelado pela administração por violar os Termos de Uso.`
        )

        await registrarAcao(req, 'cancelar_projeto', { alvo: servico.usu_id, detalhe: servico.serv_titulo })

        return res.json({ mensagem: 'Projeto cancelado.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao cancelar o projeto.' })
    }
}

/*
 * Métricas para o painel: cadastros por semana (últimas 8), projetos por categoria
 * e taxa de conclusão (concluídos sobre concluídos + cancelados).
 */
const SEMANAS = 8

export const metricas = async (req, res) => {
    try {
        const inicio = new Date()
        inicio.setHours(0, 0, 0, 0)
        /* Começa na segunda-feira de 7 semanas atrás */
        inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7) - (SEMANAS - 1) * 7)

        const [cadastros, categorias, status] = await Promise.all([
            db('usuario')
                .where('data_criacao', '>=', inicio)
                .whereIn('tipo_usuario', ['freelancer', 'contratante'])
                .select('tipo_usuario', 'data_criacao'),
            db('servico')
                .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
                .whereNot('servico.serv_status', 'rascunho')
                .select('tipo_servico.tipo_nome as categoria')
                .count('* as total')
                .groupBy('tipo_servico.tipo_nome')
                .orderBy('total', 'desc'),
            contarPor('servico', 'serv_status')
        ])

        const semanas = Array.from({ length: SEMANAS }, (_, i) => {
            const de = new Date(inicio)
            de.setDate(de.getDate() + i * 7)
            return { inicio: de.toISOString().slice(0, 10), freelancer: 0, contratante: 0 }
        })

        for (const u of cadastros) {
            const i = Math.floor((new Date(u.data_criacao) - inicio) / (7 * 86_400_000))
            if (semanas[i]) semanas[i][u.tipo_usuario] += 1
        }

        const concluidos = status.finalizado ?? 0
        const cancelados = status.cancelado ?? 0

        return res.json({
            semanas,
            categorias: categorias.map((c) => ({ categoria: c.categoria, total: Number(c.total) })),
            conclusao: {
                concluidos,
                cancelados,
                emAndamento: status.em_andamento ?? 0,
                taxa: concluidos + cancelados > 0 ? Math.round((concluidos / (concluidos + cancelados)) * 100) : null
            }
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as métricas.' })
    }
}
