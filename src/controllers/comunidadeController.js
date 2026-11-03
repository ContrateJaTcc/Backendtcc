import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { concederXp, avaliacaoVisivel } from '../services/gamificacao.js'
import { enviarPush } from '../services/push.js'
import { liberarConquista } from './conquistaController.js'
import { nomeCurto } from './publicoController.js'

/* Jogo coletivo: chefão do mês, desafio da semana, árvore de habilidades e missões da guilda */

const DIA = 86_400_000
const FUSO_BRASIL = -3 * 60 * 60_000
const semMigracao = (res) => res.status(503).json({ erro: 'Esta opção ainda não está disponível no servidor (falta rodar as migrações).' })

/* Mês e semana pelo horário de Brasília */
function agoraBrasil(agora = new Date()) {
    return new Date(agora.getTime() + FUSO_BRASIL)
}

export function chaveMes(agora = new Date()) {
    const l = agoraBrasil(agora)
    return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}`
}

function limitesDoMes(agora = new Date()) {
    const l = agoraBrasil(agora)
    const inicio = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - FUSO_BRASIL)
    const fim = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 1) - FUSO_BRASIL)
    return { inicio, fim }
}

/* Semana ISO: "2026-W43" (segunda a domingo) */
export function chaveSemana(agora = new Date()) {
    const l = agoraBrasil(agora)
    const d = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()))
    const dia = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dia)
    const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const semana = Math.ceil(((d.getTime() - inicioAno.getTime()) / DIA + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`
}

/* Domingo 23h59 da semana atual (Brasília) */
function fimDaSemana(agora = new Date()) {
    const l = agoraBrasil(agora)
    const dia = l.getUTCDay() || 7
    return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + (7 - dia) + 1) - FUSO_BRASIL - 60_000)
}

/* ---------- Chefão do mês ---------- */

export const CHEFOES = ['Dragão de Brasa', 'Grifo de Gelo', 'Serpente das Brumas', 'Golem de Pedra', 'Fênix Sombria', 'Kraken do Fosso']
export const VIDA_CHEFAO = 30
export const XP_CHEFAO = 80
/* Cada projeto concluído tira 3 de vida; cada nota 5 recebida, mais 1 */
const DANO_PROJETO = 3
const DANO_NOTA5 = 1

export async function estadoDoChefao(usu_id, agora = new Date()) {
    const { inicio, fim } = limitesDoMes(agora)
    const mes = chaveMes(agora)
    const colunaFim = (await temColuna('servico', 'serv_finalizado_em')) ? 'servico.serv_finalizado_em' : 'servico.serv_data_atualizacao'

    const golpes = await db('servico')
        .join('candidatura', 'candidatura.serv_id', 'servico.serv_id')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('servico.serv_status', 'finalizado')
        .where('candidatura.cand_status', 'aceita')
        .whereBetween(colunaFim, [inicio, fim])
        .select('freelancer.usu_id')
    const [{ total: notas5 }] = await db('avaliacao').join('freelancer', 'freelancer.usu_id', 'avaliacao.usu_avaliado').where('avaliacao.aval_nota', 5).whereBetween('avaliacao.aval_data', [inicio, fim]).count('* as total')

    const dano = golpes.length * DANO_PROJETO + Number(notas5) * DANO_NOTA5
    const participantes = new Set(golpes.map((g) => g.usu_id))
    const resgatado = (await temTabela('chefao_resgate')) ? Boolean(await db('chefao_resgate').where({ usu_id, che_mes: mes }).first()) : false
    const indice = (agoraBrasil(agora).getUTCFullYear() * 12 + agoraBrasil(agora).getUTCMonth()) % CHEFOES.length

    return {
        mes,
        nome: CHEFOES[indice],
        vida_max: VIDA_CHEFAO,
        vida: Math.max(0, VIDA_CHEFAO - dano),
        dano,
        golpes: golpes.length,
        participantes: participantes.size,
        participei: participantes.has(usu_id),
        derrotado: dano >= VIDA_CHEFAO,
        resgatado,
        xp: XP_CHEFAO,
        termina: fim
    }
}

export const verChefao = async (req, res) => {
    try {
        return res.json(await estadoDoChefao(req.usuario.id))
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o chefão.' })
    }
}

export const resgatarChefao = async (req, res) => {
    try {
        if (!(await temTabela('chefao_resgate'))) return semMigracao(res)
        const e = await estadoDoChefao(req.usuario.id)
        if (!e.derrotado) return res.status(400).json({ erro: `${e.nome} ainda tem ${e.vida} de vida. Concluam mais projetos!` })
        if (!e.participei) return res.status(400).json({ erro: 'O prêmio é de quem concluiu pelo menos um projeto neste mês.' })
        if (e.resgatado) return res.status(400).json({ erro: 'Você já pegou o prêmio deste mês.' })
        const f = await db('freelancer').where('usu_id', req.usuario.id).select('free_id').first()
        await db.transaction(async (trx) => {
            await trx('chefao_resgate').insert({ usu_id: req.usuario.id, che_mes: e.mes })
            if (f) await concederXp(trx, f.free_id, XP_CHEFAO, 'chefao')
        })
        await liberarConquista(req.usuario.id, 'dragao')
        return res.json({ mensagem: `${e.nome} derrotado! +${XP_CHEFAO} XP e a conquista "Caçador de dragões".`, xp: XP_CHEFAO })
    } catch (erro) {
        if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já pegou o prêmio deste mês.' })
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pegar o prêmio.' })
    }
}

/* ---------- Desafio da semana ---------- */

export const TEMAS_DESAFIO = [
    'Logo para uma padaria', 'Página inicial de uma pet shop', 'Cartaz de festa junina', 'Ícone em pixel art de um castelo',
    'Post de Instagram para uma cafeteria', 'Mascote para um time de futebol de bairro', 'Cardápio de uma pizzaria', 'Tela de login de um app de receitas',
    'Convite de aniversário infantil', 'Banner para uma loja de bicicletas', 'Capa de podcast sobre tecnologia', 'Embalagem de um sabonete artesanal'
]
export const XP_DESAFIO = 60

function temaDa(semana) {
    const n = Number(semana.slice(0, 4)) * 53 + Number(semana.slice(6))
    return TEMAS_DESAFIO[n % TEMAS_DESAFIO.length]
}

function semanaAnterior(agora = new Date()) {
    return chaveSemana(new Date(agora.getTime() - 7 * DIA))
}

async function enviosDa(semana, usu_id) {
    const envios = await db('desafio_envio')
        .join('usuario', 'desafio_envio.usu_id', 'usuario.usu_id')
        .leftJoin('desafio_voto', 'desafio_voto.env_id', 'desafio_envio.env_id')
        .where('desafio_envio.des_semana', semana)
        .groupBy('desafio_envio.env_id', 'desafio_envio.env_titulo', 'desafio_envio.env_link', 'desafio_envio.env_desc', 'desafio_envio.env_data', 'desafio_envio.usu_id', 'usuario.usu_nome')
        .select('desafio_envio.env_id', 'desafio_envio.env_titulo', 'desafio_envio.env_link', 'desafio_envio.env_desc', 'desafio_envio.env_data', 'desafio_envio.usu_id', 'usuario.usu_nome', db.raw('COUNT(desafio_voto.usu_id) as votos'))
    const meusVotos = new Set(envios.length ? await db('desafio_voto').whereIn('env_id', envios.map((e) => e.env_id)).where('usu_id', usu_id).pluck('env_id') : [])
    return envios
        .map((e) => ({
            env_id: e.env_id,
            titulo: e.env_titulo,
            link: e.env_link,
            desc: e.env_desc,
            data: e.env_data,
            autor: nomeCurto(e.usu_nome),
            votos: Number(e.votos),
            votei: meusVotos.has(e.env_id),
            meu: e.usu_id === usu_id
        }))
        .sort((a, b) => b.votos - a.votos || new Date(a.data).getTime() - new Date(b.data).getTime())
}

/* O vencedor da semana passada ganha o XP na primeira vez que alguém abre o desafio depois que ela acabou */
async function premiarSemana(semana) {
    if (await db('desafio_premio').where('des_semana', semana).first()) return
    const envios = await enviosDa(semana, 0)
    const vencedor = envios[0] && envios[0].votos > 0 ? envios[0] : null
    const dono = vencedor ? await db('desafio_envio').where('env_id', vencedor.env_id).select('usu_id').first() : null
    try {
        await db('desafio_premio').insert({ des_semana: semana, usu_id: dono?.usu_id ?? null })
    } catch (erro) {
        if (erro?.code === 'ER_DUP_ENTRY') return
        throw erro
    }
    if (!dono) return
    const f = await db('freelancer').where('usu_id', dono.usu_id).select('free_id').first()
    if (f) await concederXp(db, f.free_id, XP_DESAFIO, 'desafio')
    const texto = `Seu trabalho "${vencedor.titulo}" venceu o desafio "${temaDa(semana)}" com ${vencedor.votos} ${vencedor.votos === 1 ? 'voto' : 'votos'}. +${XP_DESAFIO} XP!`
    await db('notificacao').insert({ usu_id: dono.usu_id, not_titulo: 'Você venceu o desafio da semana!', not_desc: texto })
    await enviarPush(dono.usu_id, { titulo: 'Você venceu o desafio da semana!', texto })
}

export const verDesafio = async (req, res) => {
    try {
        if (!(await temTabela('desafio_envio'))) return res.json({ disponivel: false })
        const semana = chaveSemana()
        const anterior = semanaAnterior()
        await premiarSemana(anterior)
        const envios = await enviosDa(semana, req.usuario.id)
        const premio = await db('desafio_premio').leftJoin('usuario', 'desafio_premio.usu_id', 'usuario.usu_id').where('desafio_premio.des_semana', anterior).select('usuario.usu_nome').first()
        return res.json({
            disponivel: true,
            semana,
            tema: temaDa(semana),
            termina: fimDaSemana(),
            xp: XP_DESAFIO,
            envios,
            meu_envio: envios.find((e) => e.meu) ?? null,
            anterior: { semana: anterior, tema: temaDa(anterior), vencedor: premio?.usu_nome ? nomeCurto(premio.usu_nome) : null }
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o desafio.' })
    }
}

export const enviarDesafio = async (req, res) => {
    try {
        if (!(await temTabela('desafio_envio'))) return semMigracao(res)
        if (req.usuario.tipo !== 'freelancer') return res.status(403).json({ erro: 'Só freelancers participam do desafio (contratantes votam).' })
        const titulo = String(req.body?.titulo ?? '').trim()
        const link = String(req.body?.link ?? '').trim()
        const desc = String(req.body?.desc ?? '').trim().slice(0, 300) || null
        if (titulo.length < 3 || titulo.length > 80) return res.status(400).json({ erro: 'Dê um nome de 3 a 80 letras para o trabalho.' })
        if (!/^https:\/\/\S+$/i.test(link) || link.length > 300) return res.status(400).json({ erro: 'Mande o link do trabalho começando com https:// (Behance, Drive, Figma...).' })
        try {
            await db('desafio_envio').insert({ des_semana: chaveSemana(), usu_id: req.usuario.id, env_titulo: titulo, env_link: link, env_desc: desc })
        } catch (erro) {
            if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já mandou um trabalho nesta semana.' })
            throw erro
        }
        return res.status(201).json({ mensagem: 'Trabalho enviado! Agora é torcer pelos votos.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao enviar o trabalho.' })
    }
}

/* Votar de novo tira o voto */
export const votarDesafio = async (req, res) => {
    try {
        if (!(await temTabela('desafio_voto'))) return semMigracao(res)
        const envio = await db('desafio_envio').where('env_id', req.params.envId).first()
        if (!envio || envio.des_semana !== chaveSemana()) return res.status(404).json({ erro: 'Este trabalho não está no desafio desta semana.' })
        if (envio.usu_id === req.usuario.id) return res.status(400).json({ erro: 'Não vale votar no próprio trabalho.' })
        const chave = { env_id: envio.env_id, usu_id: req.usuario.id }
        if (await db('desafio_voto').where(chave).first()) {
            await db('desafio_voto').where(chave).del()
            return res.json({ mensagem: 'Voto tirado.', votei: false })
        }
        await db('desafio_voto').insert(chave)
        return res.json({ mensagem: 'Voto registrado!', votei: true })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao votar.' })
    }
}

/* ---------- Árvore de habilidades ---------- */

export const GALHOS = [
    { codigo: 'primeiro', titulo: 'Primeiro passo', descricao: 'Concluir 1 projeto na área', meta: (d) => [d.projetos, 1] },
    { codigo: 'teste', titulo: 'Testado', descricao: 'Passar no teste de habilidade da área', meta: (d) => [d.teste ? 1 : 0, 1] },
    { codigo: 'tres', titulo: 'Mão na massa', descricao: 'Concluir 3 projetos na área', meta: (d) => [d.projetos, 3] },
    { codigo: 'nota', titulo: 'Bem avaliado', descricao: 'Média 4,5 ou mais em 3 avaliações da área', meta: (d) => [d.avaliacoes >= 3 && d.media >= 4.5 ? 1 : 0, 1] },
    { codigo: 'mestre', titulo: 'Mestre', descricao: 'Concluir 10 projetos na área', meta: (d) => [d.projetos, 10] }
]

export async function arvoreDe(usu_id) {
    const f = await db('freelancer').where('usu_id', usu_id).select('free_id').first()
    if (!f) return []
    const minhas = await db('freelancer_tipo_servico').join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id').where('freelancer_tipo_servico.free_id', f.free_id).select('tipo_servico.tipo_id', 'tipo_servico.tipo_nome')
    const projetos = await db('servico')
        .join('candidatura', 'candidatura.serv_id', 'servico.serv_id')
        .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
        .where({ 'candidatura.free_id': f.free_id, 'candidatura.cand_status': 'aceita', 'servico.serv_status': 'finalizado' })
        .select('servico.serv_id', 'tipo_servico.tipo_id', 'tipo_servico.tipo_nome')
    const notas = await db('avaliacao').join('servico', 'avaliacao.serv_id', 'servico.serv_id').where('avaliacao.usu_avaliado', usu_id).whereRaw(avaliacaoVisivel()).select('servico.tipo_id', 'avaliacao.aval_nota')
    const testes = (await temTabela('teste_habilidade')) ? await db('teste_habilidade').where('usu_id', usu_id).whereNotNull('tes_aprovado_em').pluck('tipo_id') : []

    const areas = new Map(minhas.map((a) => [a.tipo_id, a.tipo_nome]))
    for (const p of projetos) areas.set(p.tipo_id, p.tipo_nome)

    return [...areas.entries()].map(([tipo_id, nome]) => {
        const daArea = notas.filter((n) => n.tipo_id === tipo_id)
        const d = {
            projetos: projetos.filter((p) => p.tipo_id === tipo_id).length,
            teste: testes.includes(tipo_id),
            avaliacoes: daArea.length,
            media: daArea.length ? daArea.reduce((s, n) => s + n.aval_nota, 0) / daArea.length : 0
        }
        const galhos = GALHOS.map((g) => {
            const [feito, meta] = g.meta(d)
            return { codigo: g.codigo, titulo: g.titulo, descricao: g.descricao, progresso: Math.min(feito, meta), meta, aceso: feito >= meta }
        })
        return { tipo_id, area: nome, acesos: galhos.filter((g) => g.aceso).length, galhos }
    }).sort((a, b) => b.acesos - a.acesos || a.area.localeCompare(b.area))
}

export const verArvore = async (req, res) => {
    try {
        const usu_id = req.params.usuId ? Number(req.params.usuId) : req.usuario.id
        return res.json({ areas: await arvoreDe(usu_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a árvore de habilidades.' })
    }
}

/* ---------- Missões da guilda (do mês, para o time inteiro) ---------- */

export async function missoesDaGuilda(gui_id, agora = new Date()) {
    const { inicio, fim } = limitesDoMes(agora)
    const membros = await db('guilda_membro').where('gui_id', gui_id).pluck('usu_id')
    if (!membros.length) return []
    const colunaFim = (await temColuna('servico', 'serv_finalizado_em')) ? 'servico.serv_finalizado_em' : 'servico.serv_data_atualizacao'
    const [{ total: projetos }] = await db('servico')
        .join('candidatura', 'candidatura.serv_id', 'servico.serv_id')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .whereIn('freelancer.usu_id', membros)
        .where({ 'servico.serv_status': 'finalizado', 'candidatura.cand_status': 'aceita' })
        .whereBetween(colunaFim, [inicio, fim])
        .count('* as total')
    const [{ total: notas5 }] = await db('avaliacao').whereIn('usu_avaliado', membros).where('aval_nota', 5).whereBetween('aval_data', [inicio, fim]).count('* as total')
    const [{ total: testes }] = (await temTabela('teste_habilidade'))
        ? await db('teste_habilidade').whereIn('usu_id', membros).whereBetween('tes_aprovado_em', [inicio, fim]).count('* as total')
        : [{ total: 0 }]
    const lista = [
        { codigo: 'projetos', titulo: 'Concluir 5 projetos no mês', progresso: Number(projetos), meta: 5, enfeite: 'estandarte' },
        { codigo: 'notas', titulo: 'Receber 3 notas 5', progresso: Number(notas5), meta: 3, enfeite: 'coroa' },
        { codigo: 'testes', titulo: 'Passar em 2 testes de habilidade', progresso: Number(testes), meta: 2, enfeite: 'louros' },
        { codigo: 'time', titulo: 'Ter 4 membros ou mais', progresso: membros.length, meta: 4, enfeite: 'estrelas' }
    ]
    return lista.map((m) => ({ ...m, progresso: Math.min(m.progresso, m.meta), feita: m.progresso >= m.meta }))
}

export const verMissoesGuilda = async (req, res) => {
    try {
        if (!(await temTabela('guilda_membro'))) return res.json({ missoes: [] })
        const guilda = await db('guilda').where('gui_id', req.params.id).select('gui_id', 'gui_nome').first()
        if (!guilda) return res.status(404).json({ erro: 'Guilda não encontrada.' })
        return res.json({ guilda: guilda.gui_nome, missoes: await missoesDaGuilda(guilda.gui_id), termina: limitesDoMes().fim })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as missões da guilda.' })
    }
}
