import db from '../config/knex.js'
import { temColuna, temTabela } from './registro.js'

/*
 * Como cada pessoa aparece para os outros: moldura no avatar, cor do nome e disponibilidade.
 * Molduras e cores saem da loja (comprados com XP); os 3 primeiros do ranking do mês passado
 * ganham a moldura da temporada, que vale mais que a comprada.
 */

export const LOJA = {
    moldura_madeira: { tipo: 'moldura', nome: 'Moldura de madeira', descricao: 'Tábuas do portão do castelo.', preco: 60 },
    moldura_cristal: { tipo: 'moldura', nome: 'Moldura de cristal', descricao: 'Brilha como as janelas da torre.', preco: 150 },
    moldura_estrelas: { tipo: 'moldura', nome: 'Moldura estrelada', descricao: 'Um pedaço do céu noturno.', preco: 200 },
    moldura_dragao: { tipo: 'moldura', nome: 'Moldura do dragão', descricao: 'Escamas de quem guarda o tesouro.', preco: 300 },
    cor_ouro: { tipo: 'cor', nome: 'Nome dourado', descricao: 'Seu nome em ouro.', preco: 80 },
    cor_rosa: { tipo: 'cor', nome: 'Nome rosa', descricao: 'Seu nome em rosa-pôr-do-sol.', preco: 80 },
    cor_ciano: { tipo: 'cor', nome: 'Nome ciano', descricao: 'Seu nome em ciano de cristal.', preco: 80 },
    cor_lilas: { tipo: 'cor', nome: 'Nome lilás', descricao: 'Seu nome em lilás de feitiço.', preco: 80 },
    tema_outono: { tipo: 'tema', nome: 'Cenário de outono', descricao: 'Folhas caindo sobre o castelo.', preco: 120 },
    tema_cerejeira: { tipo: 'tema', nome: 'Cenário de cerejeira', descricao: 'Pétalas rosas ao vento.', preco: 120 },
    tema_vagalumes: { tipo: 'tema', nome: 'Cenário de vaga-lumes', descricao: 'Luzinhas piscando na noite.', preco: 150 },
    tema_aurora: { tipo: 'tema', nome: 'Cenário de aurora', descricao: 'Faixas de luz dançando no céu.', preco: 250 }
}

/* Coluna do usuário onde fica o que está equipado, por tipo */
export const COLUNA_EQUIPADO = { moldura: 'usu_moldura', cor: 'usu_cor_nome', tema: 'usu_tema_cenario' }

const FUSO_BRASIL = -3 * 60 * 60_000

/* Primeiro dia do mês (Brasília) com deslocamento em meses, como Date em UTC */
export function inicioDoMes(deslocamento = 0, agora = new Date()) {
    const local = new Date(agora.getTime() + FUSO_BRASIL)
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + deslocamento, 1) - FUSO_BRASIL)
}

/* Campeões do mês passado (guardados por uma hora: mudam só na virada do mês) */
let campeoesCache = { chave: '', ate: 0, lista: [] }

export async function campeoesDoMesPassado() {
    const inicio = inicioDoMes(-1)
    const fim = inicioDoMes(0)
    const chave = inicio.toISOString()

    if (campeoesCache.chave === chave && campeoesCache.ate > Date.now()) return campeoesCache.lista
    if (!(await temTabela('xp_evento'))) return []

    const linhas = await db('xp_evento')
        .join('freelancer', 'xp_evento.free_id', 'freelancer.free_id')
        .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
        .where('usuario.status_conta', 'ativa')
        .where('xp_evento.xpe_data', '>=', inicio)
        .where('xp_evento.xpe_data', '<', fim)
        .groupBy('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto')
        .select('usuario.usu_id', 'usuario.usu_nome', 'usuario.usu_foto', db.raw('SUM(xp_evento.xpe_xp) as xp'))
        .orderBy('xp', 'desc')
        .limit(3)

    const lista = linhas.map((l, i) => ({ posicao: i + 1, usu_id: l.usu_id, usu_nome: l.usu_nome, usu_foto: l.usu_foto, xp: Number(l.xp) }))
    campeoesCache = { chave, ate: Date.now() + 60 * 60_000, lista }
    return lista
}

const MOLDURA_CAMPEAO = { 1: 'campeao_ouro', 2: 'campeao_prata', 3: 'campeao_bronze' }

/* Disponibilidade: "ocupado até" uma data que já passou volta a ser disponível sozinho */
export function disponibilidadeDe(u) {
    const status = u?.usu_disponibilidade ?? 'disponivel'
    const ate = u?.usu_disponivel_ate ? new Date(u.usu_disponivel_ate).toISOString().slice(0, 10) : null
    const hoje = new Date(Date.now() + FUSO_BRASIL).toISOString().slice(0, 10)
    if (status === 'disponivel' || (ate && ate < hoje)) return { status: 'disponivel', ate: null }
    return { status, ate }
}

/* Guilda, testes de habilidade aprovados e mascote de cada pessoa (tabelas novas: podem faltar) */
async function extrasDoReino(ids) {
    const [guildas, testes, mascotes] = await Promise.all([
        (await temTabela('guilda_membro'))
            ? db('guilda_membro').join('guilda', 'guilda_membro.gui_id', 'guilda.gui_id').whereIn('guilda_membro.usu_id', ids)
                .select('guilda_membro.usu_id', 'guilda.gui_id', 'guilda.gui_nome', 'guilda.gui_brasao', 'guilda.gui_cor')
            : [],
        (await temTabela('teste_habilidade'))
            ? db('teste_habilidade').join('tipo_servico', 'teste_habilidade.tipo_id', 'tipo_servico.tipo_id').whereIn('teste_habilidade.usu_id', ids)
                .whereNotNull('teste_habilidade.tes_aprovado_em').select('teste_habilidade.usu_id', 'tipo_servico.tipo_nome')
            : [],
        (await temColuna('usuario', 'usu_mascote'))
            ? db('usuario').whereIn('usu_id', ids).whereNotNull('usu_mascote').select('usu_id', 'usu_mascote', 'usu_mascote_nome')
            : []
    ])
    const guildaDe = new Map(guildas.map((g) => [g.usu_id, { gui_id: g.gui_id, nome: g.gui_nome, brasao: g.gui_brasao, cor: g.gui_cor }]))
    const testesDe = new Map()
    for (const t of testes) testesDe.set(t.usu_id, [...(testesDe.get(t.usu_id) ?? []), t.tipo_nome])
    const mascoteDe = new Map(mascotes.map((m) => [m.usu_id, { especie: m.usu_mascote, nome: m.usu_mascote_nome }]))
    /* Sem a coluna do mascote o campo nem vai: o site esconde o cartão em vez de oferecer algo que não salva */
    const comMascote = await temColuna('usuario', 'usu_mascote')
    return (id) => ({ guilda: guildaDe.get(id) ?? null, testes: testesDe.get(id) ?? [], ...(comMascote ? { mascote: mascoteDe.get(id) ?? null } : {}) })
}

/* { usu_id: { moldura, cor_nome, disponibilidade, guilda, testes, mascote } } para uma lista de pessoas */
export async function aparenciaDe(usuIds) {
    const ids = [...new Set(usuIds.map(Number).filter(Boolean))]
    const mapa = {}
    if (ids.length === 0) return mapa

    const temCosmeticos = await temColuna('usuario', 'usu_moldura')
    const linhas = temCosmeticos
        ? await db('usuario').whereIn('usu_id', ids).select('usu_id', 'usu_moldura', 'usu_cor_nome', 'usu_disponibilidade', 'usu_disponivel_ate')
        : []
    const porId = new Map(linhas.map((l) => [l.usu_id, l]))
    const campeoes = new Map((await campeoesDoMesPassado()).map((c) => [c.usu_id, c.posicao]))
    const reino = await extrasDoReino(ids)

    for (const id of ids) {
        const l = porId.get(id)
        mapa[id] = {
            moldura: campeoes.has(id) ? MOLDURA_CAMPEAO[campeoes.get(id)] : l?.usu_moldura ?? null,
            cor_nome: l?.usu_cor_nome ?? null,
            disponibilidade: disponibilidadeDe(l),
            ...reino(id)
        }
    }

    return mapa
}

/* Atalho para uma pessoa só */
export async function aparenciaUm(usu_id) {
    return (await aparenciaDe([usu_id]))[usu_id] ?? { moldura: null, cor_nome: null, disponibilidade: { status: 'disponivel', ate: null }, guilda: null, testes: [], mascote: null }
}
