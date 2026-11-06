import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'

/*
 * Agenda do mês, Retrospectiva do ano e Marcos comemorativos.
 * Tudo sai dos dados que já existem (projetos, reuniões, etapas, carteira, avaliações): nada novo é guardado.
 */

const DIA = 86_400_000

/* Projetos em que a pessoa trabalha: os dela (contratante) ou onde foi contratada (freelancer) */
function projetosDaPessoa(usuario) {
    const q = db('servico').join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
    if (usuario.tipo === 'contratante') {
        return q.join('contratante', 'servico.cont_id', 'contratante.cont_id').where('contratante.usu_id', usuario.id)
    }
    return q
        .join('candidatura', 'candidatura.serv_id', 'servico.serv_id')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('freelancer.usu_id', usuario.id)
        .where('candidatura.cand_status', 'aceita')
}

/*
 * Data de entrega: contratação + dias combinados (os dias de pausa já entram em serv_qtd_dias ao retomar).
 * Projetos contratados antes de existir serv_contratado_em usam o início combinado ou a última atualização.
 */
export const prazoDoProjeto = (s) => {
    const inicio = s.serv_contratado_em ?? s.serv_data_inicio ?? s.serv_data_atualizacao ?? s.serv_data_criacao
    return inicio && s.serv_qtd_dias ? new Date(new Date(inicio).getTime() + s.serv_qtd_dias * DIA) : null
}

export const agenda = async (req, res) => {
    try {
        const eventos = []
        const papel = req.usuario.tipo
        const comPausa = await temColuna('servico', 'serv_pausado_em')
        const comContratacao = await temColuna('servico', 'serv_contratado_em')

        {
            const andamento = await projetosDaPessoa(req.usuario)
                .where('servico.serv_status', 'em_andamento')
                .select(
                    'servico.serv_id', 'servico.serv_titulo', 'servico.serv_qtd_dias',
                    'servico.serv_data_inicio', 'servico.serv_data_criacao', 'servico.serv_data_atualizacao',
                    ...(comContratacao ? ['servico.serv_contratado_em', 'servico.serv_entregue_em'] : []),
                    ...(comPausa ? ['servico.serv_pausado_em'] : [])
                )

            for (const s of andamento) {
                const prazo = prazoDoProjeto(s)
                if (!prazo) continue
                eventos.push({
                    tipo: s.serv_pausado_em ? 'pausa' : 'prazo',
                    data: prazo,
                    titulo: s.serv_pausado_em ? `Prazo pausado: ${s.serv_titulo}` : s.serv_entregue_em ? `Entregue, esperando aprovação: ${s.serv_titulo}` : `Entrega de ${s.serv_titulo}`,
                    serv_id: s.serv_id
                })
            }
        }

        /* Contratante: quando as inscrições dos projetos abertos encerram */
        if (papel === 'contratante' && (await temColuna('servico', 'serv_candidaturas_ate'))) {
            const abertos = await projetosDaPessoa(req.usuario)
                .where('servico.serv_status', 'aberto')
                .whereNotNull('servico.serv_candidaturas_ate')
                .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_candidaturas_ate')
            for (const s of abertos) eventos.push({ tipo: 'inscricoes', data: s.serv_candidaturas_ate, titulo: `Inscrições encerram: ${s.serv_titulo}`, serv_id: s.serv_id })
        }

        /* Reuniões aceitas ou esperando resposta */
        if (await temColuna('mensagem', 'msg_reuniao_em')) {
            const reunioes = await db('mensagem')
                .join('servico', 'mensagem.serv_id', 'servico.serv_id')
                .whereNotNull('mensagem.msg_reuniao_em')
                .whereIn('mensagem.msg_reuniao_status', ['pendente', 'aceita'])
                .where((q) => q.where('mensagem.usu_remetente', req.usuario.id).orWhere('mensagem.usu_destinatario', req.usuario.id))
                .select('mensagem.msg_id', 'mensagem.msg_reuniao_em', 'mensagem.msg_reuniao_status', 'mensagem.msg_reuniao_link', 'servico.serv_id', 'servico.serv_titulo')
            for (const r of reunioes) {
                eventos.push({
                    tipo: 'reuniao',
                    data: r.msg_reuniao_em,
                    titulo: `${r.msg_reuniao_status === 'pendente' ? 'Reunião (esperando resposta)' : 'Reunião'}: ${r.serv_titulo}`,
                    serv_id: r.serv_id,
                    link: r.msg_reuniao_link ?? null
                })
            }
        }

        /* Etapas entregues nos últimos 90 dias */
        if (await temTabela('servico_etapa')) {
            const etapas = await projetosDaPessoa(req.usuario)
                .join('servico_etapa', 'servico_etapa.serv_id', 'servico.serv_id')
                .whereNotNull('servico_etapa.eta_concluida_em')
                .where('servico_etapa.eta_concluida_em', '>=', new Date(Date.now() - 90 * DIA))
                .select('servico.serv_id', 'servico.serv_titulo', 'servico_etapa.eta_titulo', 'servico_etapa.eta_concluida_em')
            for (const e of etapas) eventos.push({ tipo: 'etapa', data: e.eta_concluida_em, titulo: `Etapa entregue: ${e.eta_titulo} (${e.serv_titulo})`, serv_id: e.serv_id })
        }

        eventos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
        return res.json({ eventos })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a agenda.' })
    }
}

/* ---------- Retrospectiva do ano ---------- */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const retrospectiva = async (req, res) => {
    try {
        const ano = Number(req.query.ano) || new Date().getFullYear()
        if (ano < 2020 || ano > new Date().getFullYear()) return res.status(400).json({ erro: 'Ano inválido.' })

        const inicio = new Date(ano, 0, 1)
        const fim = new Date(ano + 1, 0, 1)
        const freelancer = req.usuario.tipo === 'freelancer'
        const colunaFim = (await temColuna('servico', 'serv_finalizado_em')) ? 'servico.serv_finalizado_em' : 'servico.serv_data_atualizacao'

        const concluidos = await projetosDaPessoa(req.usuario)
            .where('servico.serv_status', 'finalizado')
            .whereBetween(colunaFim, [inicio, fim])
            .select('servico.serv_id', 'servico.serv_titulo', 'tipo_servico.tipo_nome')

        /* Área mais frequente */
        const porArea = new Map()
        for (const p of concluidos) porArea.set(p.tipo_nome, (porArea.get(p.tipo_nome) ?? 0) + 1)
        const area = [...porArea.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

        /* Dinheiro: o que caiu (freelancer) ou o que foi pago (contratante) */
        let dinheiro = 0
        if (await temTabela('carteira_mov')) {
            const movs = await db('carteira_mov')
                .where('usu_id', req.usuario.id)
                .whereBetween('mov_data', [inicio, fim])
                .whereIn('mov_tipo', freelancer ? ['recebido', 'etapa', 'bonus'] : ['garantia', 'bonus', 'estorno'])
                .select('mov_tipo', 'mov_valor')
            for (const m of movs) {
                const v = Number(m.mov_valor)
                dinheiro += freelancer ? Math.max(0, v) : m.mov_tipo === 'estorno' ? -Math.abs(v) : Math.abs(v)
            }
        }

        const [notas] = await db('avaliacao')
            .where('usu_avaliado', req.usuario.id)
            .whereBetween('aval_data', [inicio, fim])
            .select(db.raw('COUNT(*) as total'), db.raw('AVG(aval_nota) as media'), db.raw('MAX(aval_nota) as melhor'))

        /* Mês com mais mensagens enviadas */
        const porMes = await db('mensagem')
            .where('usu_remetente', req.usuario.id)
            .whereBetween('msg_data', [inicio, fim])
            .select(db.raw('MONTH(msg_data) as mes'), db.raw('COUNT(*) as total'))
            .groupByRaw('MONTH(msg_data)')
        const mensagens = porMes.reduce((s, m) => s + Number(m.total), 0)
        const mesForte = porMes.sort((a, b) => Number(b.total) - Number(a.total))[0]

        const parceiros = new Set(
            (await db('mensagem')
                .where('usu_remetente', req.usuario.id)
                .whereBetween('msg_data', [inicio, fim])
                .distinct('usu_destinatario')).map((m) => m.usu_destinatario)
        ).size

        /* Freelancer: XP do ano e a insígnia mais rara conquistada nele */
        let xp = null
        let insigniaRara = null
        if (freelancer) {
            const f = await db('freelancer').where('usu_id', req.usuario.id).select('free_id').first()
            if (f && (await temTabela('xp_evento'))) {
                const [{ soma }] = await db('xp_evento').where('free_id', f.free_id).whereBetween('xpe_data', [inicio, fim]).sum('xpe_xp as soma')
                xp = Number(soma) || 0
            }
            if (f) {
                const doAno = await db('freelancer_insignia')
                    .join('insignia', 'freelancer_insignia.ins_id', 'insignia.ins_id')
                    .where('freelancer_insignia.free_id', f.free_id)
                    .whereBetween('freelancer_insignia.freeins_data', [inicio, fim])
                    .select('insignia.ins_id', 'insignia.ins_nome', 'insignia.ins_desc')
                if (doAno.length) {
                    const donos = await db('freelancer_insignia').whereIn('ins_id', doAno.map((i) => i.ins_id)).select('ins_id').count('* as total').groupBy('ins_id')
                    const total = new Map(donos.map((d) => [d.ins_id, Number(d.total)]))
                    const rara = doAno.sort((a, b) => (total.get(a.ins_id) ?? 0) - (total.get(b.ins_id) ?? 0))[0]
                    insigniaRara = { nome: rara.ins_nome, descricao: rara.ins_desc, donos: total.get(rara.ins_id) ?? 1 }
                }
            }
        }

        return res.json({
            ano,
            papel: req.usuario.tipo,
            projetos: concluidos.length,
            area_favorita: area,
            dinheiro: Math.round(dinheiro * 100) / 100,
            avaliacoes: Number(notas?.total) || 0,
            media: notas?.media ? Math.round(Number(notas.media) * 10) / 10 : null,
            melhor_nota: notas?.melhor ? Number(notas.melhor) : null,
            mensagens,
            mes_mais_ativo: mesForte ? MESES[Number(mesForte.mes) - 1] : null,
            parceiros,
            xp,
            insignia_rara: insigniaRara
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao montar a retrospectiva.' })
    }
}

/* ---------- Marcos comemorativos ---------- */

const MARCOS_PROJETOS = [1, 10, 25, 50]

export const marcos = async (req, res) => {
    try {
        const conta = await db('usuario').where('usu_id', req.usuario.id).select('data_criacao').first()
        const lista = []
        const criada = conta?.data_criacao ? new Date(conta.data_criacao) : null

        for (const anos of [1, 2, 3]) {
            const quando = criada ? new Date(criada.getFullYear() + anos, criada.getMonth(), criada.getDate()) : null
            lista.push({
                codigo: `conta_${anos}`,
                titulo: anos === 1 ? '1 ano de castelo' : `${anos} anos de castelo`,
                descricao: `${anos === 1 ? 'Um ano' : `${anos} anos`} desde que você chegou ao ContrateJá.`,
                data: quando && quando.getTime() <= Date.now() ? quando : null
            })
        }

        const colunaFim = (await temColuna('servico', 'serv_finalizado_em')) ? 'servico.serv_finalizado_em' : 'servico.serv_data_atualizacao'
        const concluidos = await projetosDaPessoa(req.usuario)
            .where('servico.serv_status', 'finalizado')
            .orderBy(colunaFim)
            .select(`${colunaFim} as quando`)

        for (const n of MARCOS_PROJETOS) {
            lista.push({
                codigo: `projeto_${n}`,
                titulo: n === 1 ? 'Primeiro projeto' : `${n}º projeto`,
                descricao: n === 1 ? 'O primeiro projeto concluído a gente nunca esquece.' : `${n} projetos concluídos no ContrateJá.`,
                data: concluidos[n - 1]?.quando ?? null
            })
        }

        const cinco = await db('avaliacao').where({ usu_avaliado: req.usuario.id, aval_nota: 5 }).orderBy('aval_data').select('aval_data').first()
        lista.push({ codigo: 'nota_5', titulo: 'Primeira nota 5', descricao: 'Alguém deu 5 estrelas para o seu trabalho.', data: cinco?.aval_data ?? null })

        return res.json({
            desde: criada,
            projetos: concluidos.length,
            marcos: lista.map((m) => ({ ...m, conquistado: Boolean(m.data) }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os marcos.' })
    }
}
