import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { projetoDe } from './pausaController.js'
import { camposModeracao } from '../services/moderacao.js'

/*
 * Durante o trabalho: horas registradas (projetos por hora), critérios de aceite, versões da entrega,
 * e depois dele: projeto recorrente e trabalho de amostra.
 */

const semMigracao = (res) => res.status(503).json({ erro: 'Esta opção ainda não está disponível no servidor (falta rodar as migrações).' })

async function notificar(usu_id, titulo, texto, url) {
    try {
        await db('notificacao').insert({ usu_id, not_titulo: titulo, not_desc: texto })
        await enviarPush(usu_id, { titulo, texto, url })
    } catch (erro) {
        console.error(erro)
    }
}

const ehFreelancerDe = (s, usu_id) => s.freelancer === usu_id
const ehDonoDe = (s, usu_id) => s.dono === usu_id

/* ---------- Horas trabalhadas ---------- */

const MAX_MINUTOS_REGISTRO = 12 * 60

async function resumoHoras(s) {
    const registros = await db('hora_registro').where('serv_id', s.serv_id).orderBy('hor_id', 'desc')
    const soma = (status) => registros.filter((r) => r.hor_status === status).reduce((t, r) => t + (r.hor_minutos ?? 0), 0)
    const aprovados = soma('aprovada')
    return {
        registros,
        minutos_aprovados: aprovados,
        minutos_pendentes: soma('pendente'),
        valor_hora: Number(s.serv_valor),
        valor_aprovado: Math.round((aprovados / 60) * Number(s.serv_valor) * 100) / 100,
        rodando: registros.find((r) => r.hor_status === 'rodando') ?? null
    }
}

export const listarHoras = async (req, res) => {
    try {
        if (!(await temTabela('hora_registro'))) return res.json({ disponivel: false })
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        return res.json({ disponivel: true, por_hora: s.serv_tipo_valor === 'hora', ...(await resumoHoras(s)) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as horas.' })
    }
}

/* acao: iniciar | parar | manual ({ minutos, desc, dia }) — só o freelancer contratado */
export const registrarHoras = async (req, res) => {
    try {
        if (!(await temTabela('hora_registro'))) return semMigracao(res)
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s || !ehFreelancerDe(s, req.usuario.id)) return res.status(404).json({ erro: 'Projeto não encontrado entre os seus trabalhos.' })
        if (s.serv_tipo_valor !== 'hora') return res.status(400).json({ erro: 'Este projeto tem valor fixo: não precisa registrar horas.' })
        if (s.serv_status !== 'em_andamento') return res.status(400).json({ erro: 'Só dá para registrar horas em projetos em andamento.' })

        const desc = String(req.body?.desc ?? '').trim().slice(0, 200) || null
        const rodando = await db('hora_registro').where({ serv_id: s.serv_id, usu_id: req.usuario.id, hor_status: 'rodando' }).first()

        if (req.body?.acao === 'iniciar') {
            if (rodando) return res.status(400).json({ erro: 'O cronômetro já está rodando.' })
            await db('hora_registro').insert({ serv_id: s.serv_id, usu_id: req.usuario.id, hor_inicio: db.fn.now(), hor_status: 'rodando', hor_desc: desc })
            return res.status(201).json({ mensagem: 'Cronômetro ligado. Bom trabalho!' })
        }

        if (req.body?.acao === 'parar') {
            if (!rodando) return res.status(400).json({ erro: 'O cronômetro não está rodando.' })
            const minutos = Math.max(1, Math.min(MAX_MINUTOS_REGISTRO, Math.round((Date.now() - new Date(rodando.hor_inicio).getTime()) / 60_000)))
            await db('hora_registro').where('hor_id', rodando.hor_id).update({ hor_fim: db.fn.now(), hor_minutos: minutos, hor_status: 'pendente', ...(desc ? { hor_desc: desc } : {}) })
            await notificar(s.dono, 'Horas para aprovar', `${minutos} min registrados em "${s.serv_titulo}". Aprove no histórico.`, '/contratante/historico')
            return res.json({ mensagem: `${minutos} min registrados. O contratante vai aprovar.`, minutos })
        }

        if (req.body?.acao === 'manual') {
            const minutos = Number(req.body?.minutos)
            if (!Number.isInteger(minutos) || minutos < 5 || minutos > MAX_MINUTOS_REGISTRO) return res.status(400).json({ erro: 'Informe de 5 minutos a 12 horas.' })
            if (!desc) return res.status(400).json({ erro: 'Conte o que foi feito nessas horas.' })
            const dia = req.body?.dia ? new Date(`${String(req.body.dia).slice(0, 10)}T12:00:00`) : new Date()
            if (Number.isNaN(dia.getTime()) || dia.getTime() > Date.now() + 86_400_000) return res.status(400).json({ erro: 'Data inválida.' })
            await db('hora_registro').insert({ serv_id: s.serv_id, usu_id: req.usuario.id, hor_inicio: dia, hor_fim: dia, hor_minutos: minutos, hor_desc: desc, hor_status: 'pendente' })
            await notificar(s.dono, 'Horas para aprovar', `${minutos} min registrados em "${s.serv_titulo}". Aprove no histórico.`, '/contratante/historico')
            return res.status(201).json({ mensagem: 'Horas registradas. O contratante vai aprovar.' })
        }

        return res.status(400).json({ erro: 'Ação inválida.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao registrar as horas.' })
    }
}

/* acao: aprovar | recusar (contratante); apagar (freelancer, só pendente) */
export const decidirHoras = async (req, res) => {
    try {
        if (!(await temTabela('hora_registro'))) return semMigracao(res)
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        const registro = await db('hora_registro').where({ hor_id: req.params.horId, serv_id: s.serv_id }).first()
        if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' })
        const acao = req.body?.acao

        if (acao === 'apagar') {
            if (!ehFreelancerDe(s, req.usuario.id) || registro.hor_status !== 'pendente') return res.status(403).json({ erro: 'Só dá para apagar horas suas que ainda não foram aprovadas.' })
            await db('hora_registro').where('hor_id', registro.hor_id).del()
            return res.json({ mensagem: 'Registro apagado.' })
        }
        if (acao !== 'aprovar' && acao !== 'recusar') return res.status(400).json({ erro: 'Ação inválida.' })
        if (!ehDonoDe(s, req.usuario.id)) return res.status(403).json({ erro: 'Quem aprova as horas é o contratante.' })
        if (registro.hor_status !== 'pendente') return res.status(400).json({ erro: 'Este registro já foi decidido.' })
        await db('hora_registro').where('hor_id', registro.hor_id).update({ hor_status: acao === 'aprovar' ? 'aprovada' : 'recusada' })
        await notificar(s.freelancer, acao === 'aprovar' ? 'Horas aprovadas' : 'Horas recusadas', `${registro.hor_minutos} min em "${s.serv_titulo}" foram ${acao === 'aprovar' ? 'aprovados' : 'recusados'}.`, '/freelancer/entregues')
        return res.json({ mensagem: acao === 'aprovar' ? 'Horas aprovadas.' : 'Horas recusadas.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao decidir as horas.' })
    }
}

/* ---------- Critérios de aceite ---------- */

const MAX_CRITERIOS = 12

async function listaCriterios(serv_id) {
    return db('servico_criterio').where('serv_id', serv_id).orderBy(['cri_ordem', 'cri_id']).select('cri_id', 'cri_texto', 'cri_entregue_em', 'cri_aprovado_em')
}

export const listarCriterios = async (req, res) => {
    try {
        if (!(await temTabela('servico_criterio'))) return res.json({ disponivel: false, criterios: [] })
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        return res.json({ disponivel: true, criterios: await listaCriterios(s.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os critérios.' })
    }
}

export const criarCriterio = async (req, res) => {
    try {
        if (!(await temTabela('servico_criterio'))) return semMigracao(res)
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s || !ehDonoDe(s, req.usuario.id)) return res.status(404).json({ erro: 'Projeto não encontrado entre os seus.' })
        if (s.serv_status !== 'em_andamento') return res.status(400).json({ erro: 'Os critérios são definidos com o projeto em andamento.' })
        const texto = String(req.body?.texto ?? '').trim()
        if (texto.length < 3 || texto.length > 150) return res.status(400).json({ erro: 'Escreva o critério com 3 a 150 letras (ex.: "Logo em PNG e SVG").' })
        const atuais = await listaCriterios(s.serv_id)
        if (atuais.length >= MAX_CRITERIOS) return res.status(400).json({ erro: `Um projeto pode ter até ${MAX_CRITERIOS} critérios.` })
        await db('servico_criterio').insert({ serv_id: s.serv_id, cri_texto: texto, cri_ordem: atuais.length + 1 })
        await notificar(s.freelancer, 'Critério de aceite novo', `"${s.serv_titulo}": ${texto}`, '/freelancer/entregues')
        return res.status(201).json({ mensagem: 'Critério adicionado.', criterios: await listaCriterios(s.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao adicionar o critério.' })
    }
}

/* acao: entregue | desfazer (freelancer); aprovar | reprovar (contratante); apagar (contratante, se não aprovado) */
export const mudarCriterio = async (req, res) => {
    try {
        if (!(await temTabela('servico_criterio'))) return semMigracao(res)
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        const c = await db('servico_criterio').where({ cri_id: req.params.criId, serv_id: s.serv_id }).first()
        if (!c) return res.status(404).json({ erro: 'Critério não encontrado.' })
        const acao = req.body?.acao
        const free = ehFreelancerDe(s, req.usuario.id)
        const dono = ehDonoDe(s, req.usuario.id)

        if ((acao === 'entregue' || acao === 'desfazer') && free) {
            if (c.cri_aprovado_em) return res.status(400).json({ erro: 'Este critério já foi aprovado.' })
            await db('servico_criterio').where('cri_id', c.cri_id).update({ cri_entregue_em: acao === 'entregue' ? db.fn.now() : null })
        } else if ((acao === 'aprovar' || acao === 'reprovar') && dono) {
            if (acao === 'aprovar' && !c.cri_entregue_em) return res.status(400).json({ erro: 'O freelancer ainda não marcou este critério como entregue.' })
            await db('servico_criterio').where('cri_id', c.cri_id).update(acao === 'aprovar' ? { cri_aprovado_em: db.fn.now() } : { cri_aprovado_em: null, cri_entregue_em: null })
            if (acao === 'reprovar') await notificar(s.freelancer, 'Critério para refazer', `"${s.serv_titulo}": ${c.cri_texto}`, '/freelancer/entregues')
        } else if (acao === 'apagar' && dono) {
            if (c.cri_aprovado_em) return res.status(400).json({ erro: 'Critério aprovado não pode ser apagado.' })
            await db('servico_criterio').where('cri_id', c.cri_id).del()
        } else {
            return res.status(403).json({ erro: 'Você não pode fazer isso neste critério.' })
        }
        return res.json({ mensagem: 'Critério atualizado.', criterios: await listaCriterios(s.serv_id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao atualizar o critério.' })
    }
}

/* ---------- Versões da entrega ---------- */

export const listarVersoes = async (req, res) => {
    try {
        if (!(await temTabela('entrega_versao'))) return res.json({ disponivel: false, versoes: [] })
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s) return res.status(404).json({ erro: 'Projeto não encontrado.' })
        const versoes = await db('entrega_versao').where('serv_id', s.serv_id).orderBy('ver_numero', 'desc').select('ver_id', 'ver_numero', 'ver_nota', 'ver_link', 'ver_data')
        return res.json({ disponivel: true, versoes })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as versões.' })
    }
}

/* ---------- Projeto recorrente ---------- */

const mesQueVem = (d = new Date()) => {
    const n = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28))
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

const CAMPOS_COPIA = ['cont_id', 'tipo_id', 'serv_titulo', 'serv_desc', 'serv_valor', 'serv_tipo_valor', 'serv_qtd_dias', 'serv_local', 'serv_cidade', 'serv_estado', 'serv_habilidades', 'serv_forma_pagamento', 'serv_vagas']

/* Copia o projeto como aberto e convida o mesmo freelancer; devolve o id novo */
export async function repetirProjeto(original) {
    const copia = Object.fromEntries(CAMPOS_COPIA.map((c) => [c, original[c]]))
    const [serv_id] = await db('servico').insert({
        ...copia,
        serv_status: 'aberto',
        serv_repetido_de: original.serv_id,
        ...(await camposModeracao({ titulo: original.serv_titulo, descricao: original.serv_desc, valor: original.serv_valor, tipo_valor: original.serv_tipo_valor }))
    })
    const contratado = await db('candidatura').where({ serv_id: original.serv_id, cand_status: 'aceita' }).select('free_id').first()
    if (contratado) {
        await db('convite').insert({ serv_id, free_id: contratado.free_id, conv_mensagem: 'Projeto do mês: quer fazer de novo?' })
        const free = await db('freelancer').where('free_id', contratado.free_id).select('usu_id').first()
        if (free) await notificar(free.usu_id, 'Você recebeu um convite!', `"${original.serv_titulo}" voltou este mês e o contratante quer você de novo.`, '/freelancer')
    }
    return serv_id
}

/* ativo: liga ("repete todo mês a partir do mês que vem") ou desliga */
export const configurarRepeticao = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_repetir'))) return semMigracao(res)
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s || !ehDonoDe(s, req.usuario.id)) return res.status(404).json({ erro: 'Projeto não encontrado entre os seus.' })
        if (s.serv_status !== 'finalizado') return res.status(400).json({ erro: 'Dá para repetir projetos concluídos.' })
        const ativo = Boolean(req.body?.ativo)
        await db('servico').where('serv_id', s.serv_id).update({ serv_repetir: ativo, serv_repetir_em: ativo ? mesQueVem() : null })
        return res.json({ mensagem: ativo ? `Combinado: este projeto volta todo mês (o próximo em ${mesQueVem().split('-').reverse().join('/')}), já com convite para o mesmo freelancer.` : 'O projeto não vai mais se repetir.', repetir_em: ativo ? mesQueVem() : null })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao configurar a repetição.' })
    }
}

export const repetirAgora = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_repetido_de'))) return semMigracao(res)
        const s = await projetoDe(Number(req.params.id), req.usuario.id)
        if (!s || !ehDonoDe(s, req.usuario.id)) return res.status(404).json({ erro: 'Projeto não encontrado entre os seus.' })
        if (s.serv_status !== 'finalizado') return res.status(400).json({ erro: 'Dá para repetir projetos concluídos.' })
        const novo = await repetirProjeto(s)
        return res.status(201).json({ mensagem: 'Projeto publicado de novo, com convite para o mesmo freelancer.', serv_id: novo })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao repetir o projeto.' })
    }
}

/* Agendador (uma vez por dia): repete os projetos cujo dia chegou e marca o mês seguinte */
export async function rodarRecorrentes() {
    if (!(await temColuna('servico', 'serv_repetir'))) return 0
    const hoje = new Date().toISOString().slice(0, 10)
    const vencidos = await db('servico').where('serv_repetir', true).where('serv_repetir_em', '<=', hoje)
    for (const s of vencidos) {
        await db('servico').where('serv_id', s.serv_id).update({ serv_repetir_em: mesQueVem() })
        await repetirProjeto(s)
    }
    return vencidos.length
}

/* ---------- Trabalho de amostra ---------- */

export const AMOSTRA_VALOR_MAXIMO = 300
export const AMOSTRA_PRAZO_MAXIMO = 7

export const pedirAmostra = async (req, res) => {
    try {
        if (!(await temColuna('servico', 'serv_amostra_de'))) return semMigracao(res)
        const free_usu = Number(req.body?.usu_id)
        const titulo = String(req.body?.titulo ?? '').trim()
        const descricao = String(req.body?.descricao ?? '').trim()
        const valor = Number(req.body?.valor)
        const prazo = Number(req.body?.prazo)
        const tipo_id = Number(req.body?.tipo_id)
        if (titulo.length < 5 || titulo.length > 150) return res.status(400).json({ erro: 'Dê um título de 5 a 150 letras para a amostra.' })
        if (descricao.length < 10) return res.status(400).json({ erro: 'Explique o que a amostra precisa ter.' })
        if (!Number.isFinite(valor) || valor <= 0 || valor > AMOSTRA_VALOR_MAXIMO) return res.status(400).json({ erro: `A amostra vale até R$ ${AMOSTRA_VALOR_MAXIMO}.` })
        if (!Number.isInteger(prazo) || prazo < 1 || prazo > AMOSTRA_PRAZO_MAXIMO) return res.status(400).json({ erro: `O prazo da amostra vai de 1 a ${AMOSTRA_PRAZO_MAXIMO} dias.` })

        const contratante = await db('contratante').where('usu_id', req.usuario.id).select('cont_id').first()
        const freelancer = await db('freelancer').join('usuario', 'freelancer.usu_id', 'usuario.usu_id').where('freelancer.usu_id', free_usu).select('freelancer.free_id', 'usuario.usu_nome').first()
        if (!contratante || !freelancer) return res.status(404).json({ erro: 'Freelancer não encontrado.' })
        const tipo = tipo_id ? await db('tipo_servico').where('tipo_id', tipo_id).first() : await db('tipo_servico').first()
        if (!tipo) return res.status(400).json({ erro: 'Escolha a área da amostra.' })

        const aberta = await db('servico').where({ cont_id: contratante.cont_id, serv_amostra_de: free_usu }).whereIn('serv_status', ['aberto', 'em_andamento']).first()
        if (aberta) return res.status(400).json({ erro: `Já existe uma amostra com ${freelancer.usu_nome.split(' ')[0]} em andamento.` })

        const [serv_id] = await db('servico').insert({
            cont_id: contratante.cont_id,
            tipo_id: tipo.tipo_id,
            serv_titulo: `Amostra: ${titulo}`.slice(0, 150),
            serv_desc: descricao,
            serv_valor: valor,
            serv_tipo_valor: 'fixo',
            serv_qtd_dias: prazo,
            serv_local: 'remoto',
            serv_vagas: 1,
            serv_status: 'aberto',
            serv_amostra_de: free_usu
        })
        await db('convite').insert({ serv_id, free_id: freelancer.free_id, conv_mensagem: 'Trabalho de amostra antes de um projeto maior.' })
        await notificar(free_usu, 'Convite para um trabalho de amostra', `Um contratante quer testar seu trabalho antes de um projeto maior: "${titulo}" (até R$ ${valor}).`, '/freelancer')
        return res.status(201).json({ mensagem: `Amostra criada e ${freelancer.usu_nome.split(' ')[0]} foi convidado.`, serv_id })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pedir a amostra.' })
    }
}
