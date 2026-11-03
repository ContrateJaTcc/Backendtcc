import db from '../config/knex.js'
import { temColuna, temTabela, registrarAcao } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { etapasDosProjetos } from './etapaController.js'
import { concluirProjeto } from './avaliacaoController.js'
import {
    carteiraPronta, saldoDe, movimentar, garantirSaldoInicial, estornarGarantia, liberadoEmEtapas,
    CREDITO_FICTICIO, SALDO_MAXIMO
} from '../services/carteira.js'
import crypto from 'crypto'

/*
 * Depois da contratação: termo de acordo, pagamento simulado com garantia, pedido de ajustes
 * na entrega e disputas (com a fila da administração).
 */

const LIMITE_REVISOES = 3
const LIMITE_NOTA = 500

const MOTIVOS_DISPUTA = {
    nao_entregou: 'O trabalho não foi entregue',
    entrega_incompleta: 'A entrega veio incompleta',
    nao_aprova: 'O contratante não aprova a entrega',
    pagamento: 'Problema com o pagamento',
    comunicacao: 'A outra pessoa sumiu',
    outro: 'Outro motivo'
}

async function notificar(usu_id, titulo, texto, url) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: texto })
        await enviarPush(usu_id, { titulo, texto, url })
    } catch (erro) {
        console.error(erro)
    }
}

const reais = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

/* Projeto + quem é o dono e quem foi contratado; null se a pessoa não participa */
async function participacao(serv_id, usu_id) {
    const s = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
        .where('servico.serv_id', serv_id)
        .select('servico.*', 'tipo_servico.tipo_nome as categoria', 'contratante.usu_id as dono')
        .first()

    if (!s) return null

    const aceita = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('candidatura.serv_id', serv_id)
        .where('candidatura.cand_status', 'aceita')
        .select('freelancer.usu_id')
        .orderBy('candidatura.cand_id')
        .first()

    const freelancer = aceita?.usu_id ?? null
    const papel = s.dono === usu_id ? 'contratante' : freelancer === usu_id ? 'freelancer' : null

    return papel ? { s, freelancer, papel } : null
}

/* ---------- Termo de acordo ---------- */

async function dadosDoAcordo(p) {
    const pessoas = await db('usuario')
        .whereIn('usu_id', [p.s.dono, p.freelancer].filter(Boolean))
        .select('usu_id', 'usu_nome', 'usu_email', 'usu_cid', 'usu_est')
    const porId = new Map(pessoas.map((u) => [u.usu_id, u]))
    const pessoa = (id) => {
        const u = porId.get(id)
        return u ? { usu_id: u.usu_id, nome: u.usu_nome, email: u.usu_email, cidade: u.usu_cid, estado: u.usu_est } : null
    }
    const comAcordo = await temColuna('servico', 'serv_acordo_cont_em')
    const etapas = (await etapasDosProjetos([p.s.serv_id]))[p.s.serv_id] ?? []

    return {
        disponivel: comAcordo,
        projeto: {
            serv_id: p.s.serv_id,
            serv_titulo: p.s.serv_titulo,
            serv_desc: p.s.serv_desc,
            categoria: p.s.categoria,
            serv_valor: Number(p.s.serv_valor),
            serv_tipo_valor: p.s.serv_tipo_valor,
            serv_qtd_dias: p.s.serv_qtd_dias,
            serv_local: p.s.serv_local,
            serv_cidade: p.s.serv_cidade,
            serv_estado: p.s.serv_estado,
            serv_habilidades: p.s.serv_habilidades,
            serv_forma_pagamento: p.s.serv_forma_pagamento,
            serv_status: p.s.serv_status,
            serv_contratado_em: p.s.serv_contratado_em ?? null,
            serv_garantia_valor: p.s.serv_garantia_valor === undefined || p.s.serv_garantia_valor === null ? null : Number(p.s.serv_garantia_valor)
        },
        contratante: pessoa(p.s.dono),
        freelancer: pessoa(p.freelancer),
        etapas,
        aceites: {
            contratante: p.s.serv_acordo_cont_em ?? null,
            freelancer: p.s.serv_acordo_free_em ?? null
        },
        meu_papel: p.papel
    }
}

export const verAcordo = async (req, res) => {
    try {
        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || !p.freelancer) return res.status(404).json({ erro: 'Acordo não encontrado.' })

        return res.json(await dadosDoAcordo(p))
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o acordo.' })
    }
}

export const aceitarAcordo = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_acordo_cont_em'))) {
            return res.status(503).json({ erro: 'O termo de acordo ainda está sendo preparado. Tente mais tarde.' })
        }

        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || !p.freelancer) return res.status(404).json({ erro: 'Acordo não encontrado.' })
        if (p.s.serv_status !== 'em_andamento') return res.status(400).json({ erro: 'Só dá para aceitar o acordo de projetos em andamento.' })

        const coluna = p.papel === 'contratante' ? 'serv_acordo_cont_em' : 'serv_acordo_free_em'
        if (p.s[coluna]) return res.status(400).json({ erro: 'Você já concordou com este acordo.' })

        await db('servico').where('serv_id', p.s.serv_id).update({ [coluna]: db.fn.now() })

        const outro = p.papel === 'contratante' ? p.freelancer : p.s.dono
        const outroPapel = p.papel === 'contratante' ? 'freelancer' : 'contratante'
        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        await notificar(outro, 'Acordo assinado', `${eu?.usu_nome ?? 'A outra pessoa'} concordou com o acordo de "${p.s.serv_titulo}".`, `/${outroPapel}/acordo/${p.s.serv_id}`)

        const atualizado = await participacao(p.s.serv_id, req.usuario.id)
        return res.json({ mensagem: 'Pronto! Você concordou com o acordo.', ...(await dadosDoAcordo(atualizado)) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao registrar o aceite.' })
    }
}

/* ---------- Carteira e garantia (simulação) ---------- */

export const verCarteira = async (req, res) => {
    try {
        if (!(await carteiraPronta())) return res.json({ disponivel: false, saldo: 0, garantido: 0, movimentos: [] })

        await garantirSaldoInicial(req.usuario.id, req.usuario.tipo)

        const movimentos = await db('carteira_mov')
            .leftJoin('servico', 'carteira_mov.serv_id', 'servico.serv_id')
            .where('carteira_mov.usu_id', req.usuario.id)
            .select('carteira_mov.mov_id', 'carteira_mov.serv_id', 'carteira_mov.mov_tipo', 'carteira_mov.mov_valor', 'carteira_mov.mov_desc', 'carteira_mov.mov_data', 'servico.serv_titulo')
            .orderBy('carteira_mov.mov_id', 'desc')
            .limit(100)

        /* Quanto está guardado agora nos projetos (do lado de quem pagou ou de quem vai receber) */
        const coluna = req.usuario.tipo === 'contratante' ? 'contratante.usu_id' : 'freelancer.usu_id'
        const guardados = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .leftJoin('candidatura', function () {
                this.on('candidatura.serv_id', 'servico.serv_id').andOn('candidatura.cand_status', db.raw('?', ['aceita']))
            })
            .leftJoin('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .where(coluna, req.usuario.id)
            .whereNotNull('servico.serv_garantia_em')
            .whereNull('servico.serv_garantia_liberada_em')
            .whereNull('servico.serv_garantia_estornada_em')
            .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_garantia_valor')

        /* Etapas já pagas saíram da garantia: mostra só o que ainda está guardado */
        const restantes = await Promise.all(
            guardados.map(async (g) => ({ serv_id: g.serv_id, serv_titulo: g.serv_titulo, valor: Math.max(0, Number(g.serv_garantia_valor) - (await liberadoEmEtapas(db, g.serv_id))) }))
        )

        return res.json({
            disponivel: true,
            saldo: await saldoDe(req.usuario.id),
            garantido: restantes.reduce((t, g) => t + g.valor, 0),
            guardados: restantes,
            movimentos: movimentos.map((m) => ({ ...m, mov_valor: Number(m.mov_valor) }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a carteira.' })
    }
}

export const adicionarCredito = async (req, res) => {
    try {
        if (!(await carteiraPronta())) return res.status(503).json({ erro: 'A carteira ainda está sendo preparada. Tente mais tarde.' })
        if (req.usuario.tipo !== 'contratante') return res.status(403).json({ erro: 'Só contratantes adicionam saldo.' })

        await garantirSaldoInicial(req.usuario.id, req.usuario.tipo)
        const saldo = await saldoDe(req.usuario.id)
        if (saldo + CREDITO_FICTICIO > SALDO_MAXIMO) {
            return res.status(400).json({ erro: `Na simulação o saldo vai até ${reais(SALDO_MAXIMO)}.` })
        }

        await movimentar(db, { usu_id: req.usuario.id, tipo: 'credito', valor: CREDITO_FICTICIO, desc: 'Saldo fictício adicionado' })
        return res.json({ mensagem: `${reais(CREDITO_FICTICIO)} fictícios adicionados.`, saldo: await saldoDe(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao adicionar saldo.' })
    }
}

/* O contratante guarda o pagamento na garantia; só sai quando o projeto for finalizado */
export const depositarGarantia = async (req, res) => {
    try {
        if (!(await carteiraPronta())) return res.status(503).json({ erro: 'A carteira ainda está sendo preparada. Tente mais tarde.' })

        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || p.papel !== 'contratante') return res.status(404).json({ erro: 'Projeto não encontrado.' })
        if (p.s.serv_status !== 'em_andamento' || !p.freelancer) return res.status(400).json({ erro: 'Só dá para guardar o pagamento de projetos em andamento.' })
        if (p.s.serv_garantia_em) return res.status(400).json({ erro: 'O pagamento deste projeto já está guardado.' })

        const valor = Math.round(Number(req.body.valor ?? p.s.serv_valor) * 100) / 100
        if (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000) return res.status(400).json({ erro: 'Valor inválido.' })

        await garantirSaldoInicial(req.usuario.id, req.usuario.tipo)

        const ok = await db.transaction(async (trx) => {
            const saldo = await saldoDe(req.usuario.id, trx)
            if (saldo < valor) return false
            const alteradas = await trx('servico').where('serv_id', p.s.serv_id).whereNull('serv_garantia_em').update({ serv_garantia_em: db.fn.now(), serv_garantia_valor: valor })
            if (alteradas === 0) return false
            await movimentar(trx, { usu_id: req.usuario.id, serv_id: p.s.serv_id, tipo: 'garantia', valor: -valor, desc: `Garantia de "${p.s.serv_titulo}"` })
            return true
        })

        if (!ok) return res.status(400).json({ erro: 'Saldo fictício insuficiente. Adicione saldo na sua carteira.' })

        await notificar(p.freelancer, 'Pagamento guardado', `O pagamento de ${reais(valor)} de "${p.s.serv_titulo}" está guardado na garantia. Ele cai na sua carteira quando o projeto for finalizado.`, '/freelancer/carteira')

        return res.json({ mensagem: `${reais(valor)} guardados na garantia. O freelancer recebe quando você finalizar o projeto.`, saldo: await saldoDe(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao guardar o pagamento.' })
    }
}

/* ---------- Pedir ajustes na entrega ---------- */

export const pedirAjustes = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_revisoes'))) return res.status(503).json({ erro: 'Os ajustes ainda estão sendo preparados. Tente mais tarde.' })

        const nota = String(req.body.nota ?? '').trim()
        if (nota.length < 5) return res.status(400).json({ erro: 'Conte o que precisa ser ajustado (pelo menos 5 letras).' })
        if (nota.length > LIMITE_NOTA) return res.status(400).json({ erro: `O pedido pode ter até ${LIMITE_NOTA} letras.` })

        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || p.papel !== 'contratante') return res.status(404).json({ erro: 'Projeto não encontrado.' })
        if (p.s.serv_status !== 'em_andamento' || !p.s.serv_entregue_em) return res.status(400).json({ erro: 'Só dá para pedir ajustes depois que o freelancer entregar.' })
        if (p.s.serv_revisoes >= LIMITE_REVISOES) return res.status(400).json({ erro: `Este projeto já teve ${LIMITE_REVISOES} pedidos de ajuste. Converse pelo chat ou abra uma disputa.` })

        await db('servico').where('serv_id', p.s.serv_id).update({
            serv_entregue_em: null,
            serv_revisoes: p.s.serv_revisoes + 1,
            serv_revisao_nota: nota
        })

        await notificar(p.freelancer, 'Ajustes pedidos', `O contratante pediu ajustes em "${p.s.serv_titulo}": ${nota.slice(0, 140)}`, '/freelancer/entregues')

        const restam = LIMITE_REVISOES - p.s.serv_revisoes - 1
        return res.json({ mensagem: `Pedido enviado. ${restam === 0 ? 'Este foi o último ajuste.' : `Ainda ${restam === 1 ? 'resta 1 pedido' : `restam ${restam} pedidos`} de ajuste.`}` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pedir ajustes.' })
    }
}

/* ---------- Disputas ---------- */

export const abrirDisputa = async (req, res) => {
    try {
        if (!(await temTabela('disputa'))) return res.status(503).json({ erro: 'A mediação ainda está sendo preparada. Tente mais tarde.' })

        const motivo = String(req.body.motivo ?? '')
        const detalhe = String(req.body.detalhe ?? '').trim()
        if (!MOTIVOS_DISPUTA[motivo]) return res.status(400).json({ erro: 'Escolha o motivo da disputa.' })
        if (detalhe.length < 10) return res.status(400).json({ erro: 'Explique o que aconteceu (pelo menos 10 letras).' })
        if (detalhe.length > 1000) return res.status(400).json({ erro: 'A explicação pode ter até 1000 letras.' })

        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || !p.freelancer) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        if (p.s.serv_status !== 'em_andamento') return res.status(400).json({ erro: 'Só dá para abrir disputa em projetos em andamento.' })

        const aberta = await db('disputa').where({ serv_id: p.s.serv_id, dis_status: 'aberta' }).first()
        if (aberta) return res.status(400).json({ erro: 'Já existe uma disputa aberta para este projeto. A administração vai analisar.' })

        await db('disputa').insert({ serv_id: p.s.serv_id, usu_id: req.usuario.id, dis_motivo: motivo, dis_detalhe: detalhe })

        const outro = p.papel === 'contratante' ? p.freelancer : p.s.dono
        const outroPapel = p.papel === 'contratante' ? 'freelancer' : 'contratante'
        await notificar(outro, 'Disputa aberta', `Foi aberta uma disputa em "${p.s.serv_titulo}". A administração vai analisar e avisar vocês dois.`, `/${outroPapel}/historico`)

        const admins = await db('usuario').where({ tipo_usuario: 'administrador', status_conta: 'ativa' }).select('usu_id')
        for (const a of admins) await notificar(a.usu_id, 'Nova disputa', `"${p.s.serv_titulo}" precisa de mediação.`, '/administrador')

        return res.status(201).json({ mensagem: 'Disputa aberta. A administração vai analisar e responder aos dois.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao abrir a disputa.' })
    }
}

export const listarDisputas = async (req, res) => {
    try {
        if (!(await temTabela('disputa'))) return res.json({ disputas: [] })

        const status = req.query.status === 'resolvida' ? 'resolvida' : 'aberta'
        const linhas = await db('disputa')
            .join('servico', 'disputa.serv_id', 'servico.serv_id')
            .join('usuario as autor', 'disputa.usu_id', 'autor.usu_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario as cont', 'contratante.usu_id', 'cont.usu_id')
            .where('disputa.dis_status', status)
            .select(
                'disputa.*',
                'servico.serv_titulo', 'servico.serv_valor', 'servico.serv_tipo_valor', 'servico.serv_status',
                'servico.serv_entregue_em', 'servico.serv_revisoes', 'servico.serv_garantia_valor', 'servico.serv_garantia_em',
                'servico.serv_garantia_liberada_em', 'servico.serv_garantia_estornada_em',
                'autor.usu_nome as autor_nome',
                'cont.usu_id as contratante_usu_id', 'cont.usu_nome as contratante_nome'
            )
            .orderBy('disputa.dis_id', status === 'aberta' ? 'asc' : 'desc')
            .limit(100)

        const freelancers = linhas.length
            ? await db('candidatura')
                .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
                .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
                .whereIn('candidatura.serv_id', linhas.map((l) => l.serv_id))
                .where('candidatura.cand_status', 'aceita')
                .select('candidatura.serv_id', 'usuario.usu_id', 'usuario.usu_nome')
            : []
        const freePorProjeto = new Map(freelancers.map((f) => [f.serv_id, f]))

        return res.json({
            disputas: linhas.map((l) => ({
                ...l,
                motivo_texto: MOTIVOS_DISPUTA[l.dis_motivo] ?? l.dis_motivo,
                serv_valor: Number(l.serv_valor),
                serv_garantia_valor: l.serv_garantia_valor === null ? null : Number(l.serv_garantia_valor),
                freelancer_usu_id: freePorProjeto.get(l.serv_id)?.usu_id ?? null,
                freelancer_nome: freePorProjeto.get(l.serv_id)?.usu_nome ?? null
            }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao listar as disputas.' })
    }
}

/*
 * Decisão da administração:
 * - freelancer: o projeto é finalizado (XP e pagamento guardado vão para ele);
 * - contratante: o projeto é cancelado e o pagamento guardado volta;
 * - acordo: nada muda no projeto, só encerra a disputa com o recado.
 */
export const resolverDisputa = async (req, res) => {
    try {
        const decisao = String(req.body.decisao ?? '')
        const resposta = String(req.body.resposta ?? '').trim()
        if (!['freelancer', 'contratante', 'acordo'].includes(decisao)) return res.status(400).json({ erro: 'Escolha a decisão.' })
        if (resposta.length < 5) return res.status(400).json({ erro: 'Escreva um recado para os dois (pelo menos 5 letras).' })
        if (resposta.length > 500) return res.status(400).json({ erro: 'O recado pode ter até 500 letras.' })

        const d = await db('disputa').where('dis_id', req.params.id).first()
        if (!d) return res.status(404).json({ erro: 'Disputa não encontrada.' })
        if (d.dis_status !== 'aberta') return res.status(400).json({ erro: 'Esta disputa já foi resolvida.' })

        const s = await db('servico').join('contratante', 'servico.cont_id', 'contratante.cont_id').where('servico.serv_id', d.serv_id).select('servico.*', 'contratante.usu_id as dono').first()
        const free = await db('candidatura').join('freelancer', 'candidatura.free_id', 'freelancer.free_id').where({ 'candidatura.serv_id': d.serv_id, 'candidatura.cand_status': 'aceita' }).select('freelancer.usu_id').first()

        if (decisao !== 'acordo' && s.serv_status !== 'em_andamento') {
            return res.status(400).json({ erro: 'O projeto não está mais em andamento: escolha "Encerrar sem mudar o projeto".' })
        }

        let efeito = ''
        if (decisao === 'freelancer') {
            const r = await concluirProjeto(s)
            efeito = r?.pago ? ' O projeto foi finalizado e o pagamento guardado foi para o freelancer.' : ' O projeto foi finalizado.'
        } else if (decisao === 'contratante') {
            let devolvido = null
            await db.transaction(async (trx) => {
                await trx('servico').where('serv_id', s.serv_id).update({ serv_status: 'cancelado' })
                devolvido = await estornarGarantia(trx, s.serv_id, s.dono)
            })
            efeito = devolvido ? ` O projeto foi cancelado e ${reais(devolvido)} voltaram para o contratante.` : ' O projeto foi cancelado.'
        }

        await db('disputa').where('dis_id', d.dis_id).update({ dis_status: 'resolvida', dis_decisao: decisao, dis_resposta: resposta, dis_resolvida_em: db.fn.now() })

        const texto = `A disputa de "${s.serv_titulo}" foi resolvida.${efeito} Recado da administração: ${resposta}`
        await notificar(s.dono, 'Disputa resolvida', texto, '/contratante/historico')
        if (free) await notificar(free.usu_id, 'Disputa resolvida', texto, '/freelancer/historico')

        await registrarAcao(req, 'disputa_resolvida', { alvo: s.dono, detalhe: `${s.serv_titulo}: a favor de ${decisao}` })

        return res.json({ mensagem: `Disputa resolvida.${efeito}` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao resolver a disputa.' })
    }
}

/* Para o histórico: a disputa aberta de cada projeto (se houver) */
export async function disputasAbertas(servIds) {
    if (servIds.length === 0 || !(await temTabela('disputa'))) return {}
    const linhas = await db('disputa').whereIn('serv_id', servIds).where('dis_status', 'aberta').select('serv_id', 'dis_motivo', 'dis_data')
    return Object.fromEntries(linhas.map((l) => [l.serv_id, { motivo: MOTIVOS_DISPUTA[l.dis_motivo] ?? l.dis_motivo, data: l.dis_data }]))
}

/* ---------- Bônus no fim do projeto (simulação) ---------- */

const BONUS_MAXIMO = 5000
const LIMITE_RECADO_BONUS = 200

export const darBonus = async (req, res) => {
    try {
        if (!(await carteiraPronta()) || !(await temColuna('servico', 'serv_bonus_valor'))) {
            return res.status(503).json({ erro: 'O bônus ainda está sendo preparado. Tente mais tarde.' })
        }

        const valor = Math.round(Number(req.body.valor) * 100) / 100
        const recado = String(req.body.recado ?? '').trim()
        if (!Number.isFinite(valor) || valor < 1) return res.status(400).json({ erro: 'O bônus é de pelo menos R$ 1,00.' })
        if (valor > BONUS_MAXIMO) return res.status(400).json({ erro: `Na simulação o bônus vai até ${reais(BONUS_MAXIMO)}.` })
        if (recado.length > LIMITE_RECADO_BONUS) return res.status(400).json({ erro: `O recado pode ter até ${LIMITE_RECADO_BONUS} letras.` })

        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || p.papel !== 'contratante' || !p.freelancer) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        if (p.s.serv_status !== 'finalizado') return res.status(400).json({ erro: 'O bônus é dado depois que o projeto é finalizado.' })
        if (p.s.serv_bonus_em) return res.status(400).json({ erro: 'Você já deu um bônus neste projeto.' })

        await garantirSaldoInicial(req.usuario.id, req.usuario.tipo)

        const ok = await db.transaction(async (trx) => {
            if ((await saldoDe(req.usuario.id, trx)) < valor) return false
            const alteradas = await trx('servico').where('serv_id', p.s.serv_id).whereNull('serv_bonus_em').update({ serv_bonus_em: db.fn.now(), serv_bonus_valor: valor, serv_bonus_recado: recado || null })
            if (alteradas === 0) return false
            await movimentar(trx, { usu_id: req.usuario.id, serv_id: p.s.serv_id, tipo: 'bonus', valor: -valor, desc: `Bônus de "${p.s.serv_titulo}"` })
            await movimentar(trx, { usu_id: p.freelancer, serv_id: p.s.serv_id, tipo: 'bonus', valor, desc: `Bônus de "${p.s.serv_titulo}"` })
            return true
        })

        if (!ok) return res.status(400).json({ erro: 'Saldo fictício insuficiente. Adicione saldo na sua carteira.' })

        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        await notificar(
            p.freelancer,
            'Você ganhou um bônus!',
            `${eu?.usu_nome ?? 'O contratante'} mandou ${reais(valor)} de bônus por "${p.s.serv_titulo}".${recado ? ` Recado: ${recado}` : ''}`,
            '/freelancer/carteira'
        )

        return res.json({ mensagem: `Bônus de ${reais(valor)} enviado. Obrigado por reconhecer o bom trabalho!`, saldo: await saldoDe(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao enviar o bônus.' })
    }
}

/* ---------- Recibo do projeto ---------- */

/* Código curto que confere o recibo (muda se alguém trocar o número do projeto) */
export const codigoRecibo = (serv_id) =>
    crypto.createHmac('sha256', String(process.env.JWT_SECRET ?? 'contrateja')).update(`recibo:${serv_id}`).digest('hex').slice(0, 10).toUpperCase()

/* Comprovante do projeto concluído: partes, datas e tudo o que passou pela carteira fictícia */
export const verRecibo = async (req, res) => {
    try {
        const p = await participacao(Number(req.params.id), req.usuario.id)
        if (!p || !p.freelancer) return res.status(404).json({ erro: 'Recibo não encontrado.' })
        if (p.s.serv_status !== 'finalizado') return res.status(400).json({ erro: 'O recibo sai quando o projeto é finalizado.' })

        const acordo = await dadosDoAcordo(p)
        const pagamentos = (await carteiraPronta())
            ? (await db('carteira_mov')
                .where('serv_id', p.s.serv_id)
                .where('usu_id', p.freelancer)
                .where('mov_valor', '>', 0)
                .select('mov_tipo', 'mov_valor', 'mov_desc', 'mov_data')
                .orderBy('mov_id')).map((m) => ({ ...m, mov_valor: Number(m.mov_valor) }))
            : []

        return res.json({
            recibo: {
                numero: `CJ-${String(p.s.serv_id).padStart(6, '0')}`,
                codigo: codigoRecibo(p.s.serv_id),
                projeto: acordo.projeto,
                contratante: acordo.contratante,
                freelancer: acordo.freelancer,
                contratado_em: p.s.serv_contratado_em ?? null,
                entregue_em: p.s.serv_entregue_em ?? null,
                finalizado_em: p.s.serv_finalizado_em ?? null,
                etapas: acordo.etapas,
                pagamentos,
                total_pago: Math.round(pagamentos.reduce((t, m) => t + m.mov_valor, 0) * 100) / 100,
                bonus: p.s.serv_bonus_valor === undefined || p.s.serv_bonus_valor === null ? null : Number(p.s.serv_bonus_valor)
            },
            meu_papel: p.papel
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao montar o recibo.' })
    }
}
