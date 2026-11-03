import { avisarQuemEsperava } from './relacaoController.js'
import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { disponibilidadeDe } from '../services/aparencia.js'
import { montarResumo } from '../services/resumoSemanal.js'
import { avaliacaoVisivel } from '../services/gamificacao.js'

/*
 * Coisas da própria conta: disponibilidade, sequência de dias, e-mail semanal,
 * "baixar meus dados" (LGPD), painel de ganhos e a sugestão de preço ao criar projeto.
 */

const FUSO_BRASIL = -3 * 60 * 60_000
const DIA = 86_400_000
const hojeBrasil = (agora = Date.now()) => new Date(agora + FUSO_BRASIL).toISOString().slice(0, 10)
const STATUS_DISPONIBILIDADE = ['disponivel', 'ocupado', 'ferias']

/* ---------- Disponibilidade ---------- */

export const salvarDisponibilidade = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'freelancer') return res.status(403).json({ erro: 'Só freelancers mostram disponibilidade.' })
        if (!(await temColuna('usuario', 'usu_disponibilidade'))) return res.status(503).json({ erro: 'Isso ainda está sendo preparado. Tente mais tarde.' })

        const status = String(req.body.status ?? '')
        if (!STATUS_DISPONIBILIDADE.includes(status)) return res.status(400).json({ erro: 'Escolha disponível, ocupado ou de férias.' })

        let ate = null
        if (status !== 'disponivel' && req.body.ate) {
            ate = String(req.body.ate).slice(0, 10)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(ate) || Number.isNaN(new Date(ate).getTime())) return res.status(400).json({ erro: 'Data inválida.' })
            if (ate < hojeBrasil()) return res.status(400).json({ erro: 'A data de volta não pode estar no passado.' })
        }

        await db('usuario').where('usu_id', req.usuario.id).update({ usu_disponibilidade: status, usu_disponivel_ate: ate })
        /* "Me avise quando estiver livre": quem pediu fica sabendo */
        if (status === 'disponivel') await avisarQuemEsperava(req.usuario.id)

        const mensagem = status === 'disponivel' ? 'Você aparece como disponível.' : status === 'ocupado' ? 'Você aparece como ocupado.' : 'Boas férias! Você aparece como de férias.'
        return res.json({ mensagem, disponibilidade: disponibilidadeDe({ usu_disponibilidade: status, usu_disponivel_ate: ate }) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar a disponibilidade.' })
    }
}

/* ---------- Sequência de dias ---------- */

/*
 * Conta os dias seguidos com visita. Perder um dia só não zera (a chama fica "fraca"),
 * mas o dia perdido não conta; dois dias seguidos sem entrar apagam a chama.
 */
export function calcularSequencia(dias, hoje = hojeBrasil()) {
    const feitos = new Set(dias)
    let atual = 0
    let falhasSeguidas = 0
    let cursor = new Date(`${hoje}T12:00:00Z`).getTime()
    let perdeuOntem = false

    /* Hoje ainda pode entrar: não conta como falha */
    if (!feitos.has(hoje)) cursor -= DIA

    for (let i = 0; i < 400; i++) {
        const d = new Date(cursor).toISOString().slice(0, 10)
        if (feitos.has(d)) {
            atual += 1
            falhasSeguidas = 0
        } else {
            falhasSeguidas += 1
            if (i === 0) perdeuOntem = true
            if (falhasSeguidas >= 2) break
        }
        cursor -= DIA
    }

    const ultimos7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - (6 - i) * DIA).toISOString().slice(0, 10)
        return { dia: d, feito: feitos.has(d) }
    })

    return { dias: atual, hoje: feitos.has(hoje), em_risco: perdeuOntem && !feitos.has(hoje), ultimos7 }
}

export const marcarAtividade = async (req, res) => {
    try {
        if (!(await temTabela('atividade_dia'))) return res.json({ disponivel: false, dias: 0, hoje: false, ultimos7: [] })

        const hoje = hojeBrasil()
        await db('atividade_dia').insert({ usu_id: req.usuario.id, dia: hoje }).onConflict(['usu_id', 'dia']).ignore()

        const linhas = await db('atividade_dia')
            .where('usu_id', req.usuario.id)
            .where('dia', '>=', new Date(Date.now() - 400 * DIA))
            .pluck('dia')
        const dias = linhas.map((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)))

        return res.json({ disponivel: true, ...calcularSequencia(dias, hoje) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao contar a sequência.' })
    }
}

/* ---------- Resumo por e-mail ---------- */

export const salvarResumoEmail = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_resumo_email'))) return res.status(503).json({ erro: 'Isso ainda está sendo preparado. Tente mais tarde.' })
        const ativo = Boolean(req.body.ativo)
        await db('usuario').where('usu_id', req.usuario.id).update({ usu_resumo_email: ativo })
        return res.json({ mensagem: ativo ? 'Você vai receber o resumo toda segunda-feira.' : 'Pronto, sem resumo por e-mail.', ativo })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar a preferência.' })
    }
}

export const previaResumo = async (req, res) => {
    try {
        const u = await db('usuario').where('usu_id', req.usuario.id).select('usu_id', 'usu_nome', 'tipo_usuario').first()
        const resumo = await montarResumo(u)
        return res.json({ resumo })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao montar o resumo.' })
    }
}

/* ---------- Baixar meus dados (LGPD) ---------- */

const semSegredos = ({ usu_senha: _s, ...u }) => u

export const baixarDados = async (req, res) => {
    try {
        const id = req.usuario.id
        const usuario = await db('usuario').where('usu_id', id).first()
        if (!usuario) return res.status(404).json({ erro: 'Conta não encontrada.' })

        const free = await db('freelancer').where('usu_id', id).first()
        const cont = await db('contratante').where('usu_id', id).first()
        const se = async (tabela, consulta) => ((await temTabela(tabela)) ? consulta() : [])

        const dados = {
            gerado_em: new Date().toISOString(),
            aviso: 'Estes são todos os dados que o ContrateJá guarda sobre a sua conta (LGPD, art. 18).',
            conta: semSegredos(usuario),
            freelancer: free ?? null,
            areas: free
                ? await db('freelancer_tipo_servico').join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id').where('free_id', free.free_id).pluck('tipo_nome')
                : [],
            projetos_publicados: cont ? await db('servico').where('cont_id', cont.cont_id) : [],
            candidaturas: free ? await db('candidatura').where('free_id', free.free_id) : [],
            portfolio: free ? await db('portfolio').where('free_id', free.free_id) : [],
            mensagens: (await db('mensagem').where((q) => q.where('usu_remetente', id).orWhere('usu_destinatario', id)).orderBy('msg_id'))
                .map(({ msg_arquivo: _a, msg_imagem, ...m }) => ({ ...m, msg_imagem: msg_imagem ? '(imagem enviada)' : null })),
            avaliacoes_feitas: await db('avaliacao').where('usu_avaliador', id),
            /* As que ainda estão às cegas (o outro lado não avaliou e não passaram 7 dias) ficam de fora */
            avaliacoes_recebidas: await db('avaliacao').where('usu_avaliado', id).whereRaw(avaliacaoVisivel()),
            notificacoes: await db('notificacao').where('usu_id', id).orderBy('not_id', 'desc').limit(500),
            carteira: await se('carteira_mov', () => db('carteira_mov').where('usu_id', id).orderBy('mov_id')),
            sessoes: await se('sessao', () => db('sessao').where('usu_id', id).select('ses_agente', 'ses_ip', 'ses_criada', 'ses_ultimo_uso', 'ses_revogada')),
            alertas_de_busca: await se('busca_salva', () => db('busca_salva').where('usu_id', id)),
            projetos_salvos: await se('servico_salvo', () => db('servico_salvo').where('usu_id', id)),
            denuncias_feitas: await se('denuncia', () => db('denuncia').where('usu_id', id)),
            disputas_abertas: await se('disputa', () => db('disputa').where('usu_id', id)),
            conquistas: await se('conquista_secreta', () => db('conquista_secreta').where('usu_id', id)),
            cosmeticos: await se('cosmetico_compra', () => db('cosmetico_compra').where('usu_id', id)),
            eventos: await se('evento_coleta', () => db('evento_coleta').where('usu_id', id)),
            dias_ativos: await se('atividade_dia', () => db('atividade_dia').where('usu_id', id).pluck('dia')),
            freelancers_favoritos: await se('freelancer_favorito', () => db('freelancer_favorito').where('usu_id', id)),
            testes_de_habilidade: await se('teste_habilidade', () => db('teste_habilidade').where('usu_id', id)),
            guilda: await se('guilda_membro', () => db('guilda_membro').join('guilda', 'guilda_membro.gui_id', 'guilda.gui_id').where('guilda_membro.usu_id', id).select('guilda.gui_nome', 'guilda_membro.gme_papel', 'guilda_membro.gme_entrou').first()),
            visitas_ao_perfil_por_dia: await se('perfil_visita', () => db('perfil_visita').where('usu_id', id).groupBy('vis_dia').select('vis_dia', db.raw('COUNT(*) as total')).orderBy('vis_dia'))
        }

        res.setHeader('Content-Disposition', `attachment; filename="meus-dados-contrateja.json"`)
        return res.json(dados)
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao juntar os seus dados.' })
    }
}

/* ---------- Painel de ganhos (freelancer) ---------- */

const MESES = 6

export const ganhos = async (req, res) => {
    try {
        const free = await db('freelancer').where('usu_id', req.usuario.id).select('free_id').first()
        if (!free) return res.status(403).json({ erro: 'O painel de ganhos é só para freelancers.' })

        const comGarantia = await temColuna('servico', 'serv_garantia_valor')
        const comData = await temColuna('servico', 'serv_finalizado_em')

        const projetos = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .where('candidatura.free_id', free.free_id)
            .where('candidatura.cand_status', 'aceita')
            .where('servico.serv_status', 'finalizado')
            .select(
                'servico.serv_id', 'servico.serv_titulo', 'servico.serv_valor', 'servico.serv_tipo_valor', 'servico.serv_data_atualizacao',
                'tipo_servico.tipo_nome as categoria',
                ...(comData ? ['servico.serv_finalizado_em'] : []),
                ...(comGarantia ? ['servico.serv_garantia_valor', 'servico.serv_garantia_liberada_em'] : [])
            )

        const candidaturas = await db('candidatura').where('free_id', free.free_id).select('cand_status')
        const conta = (st) => candidaturas.filter((c) => c.cand_status === st).length

        /* Valor do projeto: o que passou pela garantia; sem garantia, o valor fixo combinado (projeto por hora sem garantia não entra) */
        const valorDe = (p) => (p.serv_garantia_liberada_em ? Number(p.serv_garantia_valor) : p.serv_tipo_valor === 'fixo' ? Number(p.serv_valor) : null)
        const quando = (p) => new Date(p.serv_finalizado_em ?? p.serv_data_atualizacao)

        const agora = new Date(Date.now() + FUSO_BRASIL)
        const meses = Array.from({ length: MESES }, (_, i) => {
            const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (MESES - 1 - i), 1))
            return { mes: d.toISOString().slice(0, 7), total: 0, projetos: 0 }
        })
        const porCategoria = new Map()
        let total = 0
        let contados = 0
        let semValor = 0

        for (const p of projetos) {
            const v = valorDe(p)
            if (v === null) {
                semValor += 1
                continue
            }
            total += v
            contados += 1
            const mes = new Date(quando(p).getTime() + FUSO_BRASIL).toISOString().slice(0, 7)
            const m = meses.find((x) => x.mes === mes)
            if (m) {
                m.total += v
                m.projetos += 1
            }
            const c = porCategoria.get(p.categoria) ?? { categoria: p.categoria, total: 0, projetos: 0 }
            c.total += v
            c.projetos += 1
            porCategoria.set(p.categoria, c)
        }

        const categorias = [...porCategoria.values()].sort((a, b) => b.total - a.total)
        const respondidas = conta('aceita') + conta('recusada')

        return res.json({
            meses: meses.map((m) => ({ ...m, total: Math.round(m.total * 100) / 100 })),
            total: Math.round(total * 100) / 100,
            projetos: contados,
            sem_valor: semValor,
            media_por_projeto: contados ? Math.round((total / contados) * 100) / 100 : null,
            candidaturas: { aceitas: conta('aceita'), recusadas: conta('recusada'), pendentes: conta('pendente') },
            taxa_aceite: respondidas ? Math.round((conta('aceita') / respondidas) * 100) : null,
            categorias
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os ganhos.' })
    }
}

/* ---------- Sugestão de preço ao criar projeto ---------- */

const percentil = (ordenados, p) => {
    if (ordenados.length === 0) return null
    const pos = (ordenados.length - 1) * p
    const base = Math.floor(pos)
    const resto = pos - base
    return ordenados[base + 1] !== undefined ? ordenados[base] + resto * (ordenados[base + 1] - ordenados[base]) : ordenados[base]
}

/* Faixa do meio (25% a 75%) dos projetos parecidos; com menos de 3 exemplos não sugere nada */
export const precosSugeridos = async (req, res) => {
    try {
        const tipo_id = Number(req.query.tipo_id)
        const tipo_valor = req.query.tipo_valor === 'hora' ? 'hora' : 'fixo'
        if (!Number.isInteger(tipo_id) || tipo_id <= 0) return res.status(400).json({ erro: 'Escolha a categoria.' })

        const valores = (await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('servico.tipo_id', tipo_id)
            .where('servico.serv_tipo_valor', tipo_valor)
            .whereIn('servico.serv_status', ['aberto', 'em_andamento', 'finalizado'])
            .where('usuario.status_conta', 'ativa')
            .pluck('servico.serv_valor'))
            .map(Number)
            .filter((v) => v > 0)
            .sort((a, b) => a - b)

        if (valores.length < 3) return res.json({ sugestao: null, total: valores.length })

        const redondo = (v) => (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v))
        return res.json({
            sugestao: { min: redondo(percentil(valores, 0.25)), max: redondo(percentil(valores, 0.75)), mediana: redondo(percentil(valores, 0.5)), tipo_valor },
            total: valores.length
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao calcular a sugestão de preço.' })
    }
}
