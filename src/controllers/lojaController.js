import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { LOJA, COLUNA_EQUIPADO, campeoesDoMesPassado } from '../services/aparencia.js'
import { eventoAtual, EVENTOS } from '../services/eventos.js'
import { concederXp } from '../services/gamificacao.js'
import { enviarPush } from '../services/push.js'

/*
 * Loja de cosméticos (freelancer gasta XP em molduras, cores de nome e cenários) e
 * eventos sazonais (itens escondidos pelas páginas durante Halloween, Natal etc.).
 * Gastar XP não baixa o nível: o nível vem do XP total, a loja usa o que sobra.
 */

const lojaPronta = async () => (await temTabela('cosmetico_compra')) && (await temColuna('usuario', 'usu_moldura'))

async function situacaoLoja(usu_id) {
    const free = await db('freelancer').where('usu_id', usu_id).select('free_xp').first()
    const u = await db('usuario').where('usu_id', usu_id).select('usu_moldura', 'usu_cor_nome', 'usu_tema_cenario').first()
    const compras = await db('cosmetico_compra').where('usu_id', usu_id).select('cos_codigo', 'cos_preco')
    const gasto = compras.reduce((t, c) => t + c.cos_preco, 0)
    const meus = new Set(compras.map((c) => c.cos_codigo))
    const campeao = (await campeoesDoMesPassado()).find((c) => c.usu_id === usu_id) ?? null

    return {
        disponivel: true,
        xp_total: free?.free_xp ?? 0,
        xp_gasto: gasto,
        xp_livre: Math.max(0, (free?.free_xp ?? 0) - gasto),
        equipado: { moldura: u?.usu_moldura ?? null, cor: u?.usu_cor_nome ?? null, tema: u?.usu_tema_cenario ?? null },
        campeao: campeao ? { posicao: campeao.posicao } : null,
        itens: Object.entries(LOJA).map(([codigo, item]) => ({ codigo, ...item, comprado: meus.has(codigo) }))
    }
}

export const verLoja = async (req, res) => {
    try {
        if (!(await lojaPronta())) return res.json({ disponivel: false, itens: [], xp_livre: 0, equipado: {} })
        return res.json(await situacaoLoja(req.usuario.id))
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao abrir a loja.' })
    }
}

export const comprar = async (req, res) => {
    try {
        if (!(await lojaPronta())) return res.status(503).json({ erro: 'A loja ainda está sendo preparada. Tente mais tarde.' })

        const codigo = String(req.params.codigo)
        const item = LOJA[codigo]
        if (!item) return res.status(404).json({ erro: 'Item não encontrado.' })

        const atual = await situacaoLoja(req.usuario.id)
        if (atual.itens.find((i) => i.codigo === codigo)?.comprado) return res.status(400).json({ erro: 'Você já tem este item.' })
        if (atual.xp_livre < item.preco) return res.status(400).json({ erro: `Faltam ${item.preco - atual.xp_livre} XP para este item.` })

        await db('cosmetico_compra').insert({ usu_id: req.usuario.id, cos_codigo: codigo, cos_preco: item.preco })
        /* Já sai equipado */
        await db('usuario').where('usu_id', req.usuario.id).update({ [COLUNA_EQUIPADO[item.tipo]]: codigo })

        return res.json({ mensagem: `${item.nome} é seu! Já está equipado.`, ...(await situacaoLoja(req.usuario.id)) })
    } catch (erro) {
        if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já tem este item.' })
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao comprar o item.' })
    }
}

export const equipar = async (req, res) => {
    try {
        if (!(await lojaPronta())) return res.status(503).json({ erro: 'A loja ainda está sendo preparada. Tente mais tarde.' })

        const tipo = String(req.body.tipo ?? '')
        const codigo = req.body.codigo ? String(req.body.codigo) : null
        if (!COLUNA_EQUIPADO[tipo]) return res.status(400).json({ erro: 'Tipo de item inválido.' })

        if (codigo) {
            if (LOJA[codigo]?.tipo !== tipo) return res.status(400).json({ erro: 'Item inválido.' })
            const meu = await db('cosmetico_compra').where({ usu_id: req.usuario.id, cos_codigo: codigo }).first()
            if (!meu) return res.status(400).json({ erro: 'Compre o item antes de usar.' })
        }

        await db('usuario').where('usu_id', req.usuario.id).update({ [COLUNA_EQUIPADO[tipo]]: codigo })
        return res.json({ mensagem: codigo ? `${LOJA[codigo].nome} equipado.` : 'Item tirado.', ...(await situacaoLoja(req.usuario.id)) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao equipar o item.' })
    }
}

/* Só o que muda o próprio cenário (o site pede ao entrar) */
export const meuTema = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_tema_cenario'))) return res.json({ tema: null })
        const u = await db('usuario').where('usu_id', req.usuario.id).select('usu_tema_cenario').first()
        return res.json({ tema: u?.usu_tema_cenario ?? null })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o cenário.' })
    }
}

/* ---------- Eventos sazonais ---------- */

/* Um item a cada 10 segundos no máximo (para ninguém achar tudo com um script) */
const INTERVALO_COLETA = 10_000
const ultimaColeta = new Map()

async function situacaoEvento(usu_id) {
    const evento = eventoAtual()
    const pronto = await temTabela('evento_coleta')

    /* Insígnias de eventos de outros anos e de outros eventos */
    const historico = pronto
        ? await db('evento_coleta').where('usu_id', usu_id).whereNotNull('evc_completo_em').select('evt_codigo', 'evt_ano', 'evc_completo_em').orderBy('evc_completo_em', 'desc')
        : []
    const insignias = historico.map((h) => ({ codigo: h.evt_codigo, ano: h.evt_ano, nome: EVENTOS[h.evt_codigo]?.insignia ?? h.evt_codigo, data: h.evc_completo_em }))

    if (!evento) return { evento: null, insignias, disponivel: pronto }

    const linha = pronto ? await db('evento_coleta').where({ usu_id, evt_codigo: evento.codigo, evt_ano: evento.ano }).first() : null

    return {
        disponivel: pronto,
        evento: { ...evento, achados: linha?.evc_qtd ?? 0, completo: Boolean(linha?.evc_completo_em), resgatado: Boolean(linha?.evc_resgatado) },
        insignias
    }
}

export const verEvento = async (req, res) => {
    try {
        return res.json(await situacaoEvento(req.usuario.id))
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o evento.' })
    }
}

export const coletar = async (req, res) => {
    try {
        const evento = eventoAtual()
        if (!evento) return res.status(400).json({ erro: 'Nenhum evento acontecendo agora.' })
        if (!(await temTabela('evento_coleta'))) return res.status(503).json({ erro: 'O evento ainda está sendo preparado. Tente mais tarde.' })

        const agora = Date.now()
        if (agora - (ultimaColeta.get(req.usuario.id) ?? 0) < INTERVALO_COLETA) {
            return res.status(429).json({ erro: `Calma! Espere um pouquinho para pegar outro ${evento.item}.` })
        }
        ultimaColeta.set(req.usuario.id, agora)

        const chave = { usu_id: req.usuario.id, evt_codigo: evento.codigo, evt_ano: evento.ano }
        await db('evento_coleta').insert({ ...chave, evc_qtd: 0 }).onConflict(['usu_id', 'evt_codigo', 'evt_ano']).ignore()
        const linha = await db('evento_coleta').where(chave).first()

        if (linha.evc_qtd >= evento.meta) return res.json({ mensagem: `Você já achou todos os ${evento.itens}!`, ...(await situacaoEvento(req.usuario.id)) })

        const qtd = linha.evc_qtd + 1
        const completou = qtd >= evento.meta
        await db('evento_coleta').where(chave).update({ evc_qtd: qtd, ...(completou ? { evc_completo_em: db.fn.now() } : {}) })

        if (completou) {
            const texto = `Você achou todos os ${evento.itens} e ganhou a insígnia "${evento.insignia}"!`
            await db('notificacao').insert({ usu_id: req.usuario.id, not_titulo: `Evento de ${evento.nome}`, not_desc: texto })
            await enviarPush(req.usuario.id, { titulo: `Evento de ${evento.nome}`, texto })
        }

        return res.json({
            mensagem: completou ? `Insígnia "${evento.insignia}" desbloqueada!` : `${qtd} de ${evento.meta} ${evento.itens}!`,
            completou,
            ...(await situacaoEvento(req.usuario.id))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pegar o item.' })
    }
}

/* Missão especial do evento: quem completou resgata o XP (freelancer) uma vez */
export const resgatarEvento = async (req, res) => {
    try {
        const evento = eventoAtual()
        if (!evento) return res.status(400).json({ erro: 'Nenhum evento acontecendo agora.' })
        if (req.usuario.tipo !== 'freelancer') return res.status(403).json({ erro: 'O XP do evento é para freelancers.' })

        const chave = { usu_id: req.usuario.id, evt_codigo: evento.codigo, evt_ano: evento.ano }
        const linha = await db('evento_coleta').where(chave).first()
        if (!linha?.evc_completo_em) return res.status(400).json({ erro: `Ache todos os ${evento.itens} primeiro.` })
        if (linha.evc_resgatado) return res.status(400).json({ erro: 'Você já resgatou o XP deste evento.' })

        const free = await db('freelancer').where('usu_id', req.usuario.id).select('free_id').first()
        await db.transaction(async (trx) => {
            const alteradas = await trx('evento_coleta').where(chave).where('evc_resgatado', false).update({ evc_resgatado: true })
            if (alteradas && free) await concederXp(trx, free.free_id, evento.xp, `evento_${evento.codigo}`)
        })

        return res.json({ mensagem: `Missão de ${evento.nome} cumprida! +${evento.xp} XP`, xp: evento.xp, ...(await situacaoEvento(req.usuario.id)) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao resgatar o evento.' })
    }
}
