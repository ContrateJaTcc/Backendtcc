import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'

/* Entre duas pessoas: bloqueio, anotações privadas, "me avise quando estiver livre" e horários de atendimento */

const semMigracao = (res) => res.status(503).json({ erro: 'Esta opção ainda não está disponível no servidor (falta rodar as migrações).' })
const alvoDe = (req) => Number(req.params.usuId)

/* ---------- Bloqueio ---------- */

export const listarBloqueados = async (req, res) => {
    try {
        if (!(await temTabela('bloqueio'))) return res.json({ disponivel: false, bloqueados: [] })
        const bloqueados = await db('bloqueio')
            .join('usuario', 'bloqueio.bloqueado_id', 'usuario.usu_id')
            .where('bloqueio.usu_id', req.usuario.id)
            .select('usuario.usu_id', 'usuario.usu_nome', 'usuario.tipo_usuario', 'bloqueio.blo_data')
            .orderBy('bloqueio.blo_data', 'desc')
        return res.json({ disponivel: true, bloqueados })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os bloqueios.' })
    }
}

export const bloquear = async (req, res) => {
    try {
        if (!(await temTabela('bloqueio'))) return semMigracao(res)
        const alvo = alvoDe(req)
        if (!alvo || alvo === req.usuario.id) return res.status(400).json({ erro: 'Escolha outra pessoa para bloquear.' })
        const existe = await db('usuario').where('usu_id', alvo).select('tipo_usuario').first()
        if (!existe) return res.status(404).json({ erro: 'Pessoa não encontrada.' })
        if (existe.tipo_usuario === 'administrador') return res.status(400).json({ erro: 'Não dá para bloquear a administração.' })
        await db('bloqueio').insert({ usu_id: req.usuario.id, bloqueado_id: alvo }).onConflict(['usu_id', 'bloqueado_id']).ignore()
        return res.json({ mensagem: 'Pessoa bloqueada. Ela não consegue mais falar com você nem se candidatar aos seus projetos.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao bloquear.' })
    }
}

export const desbloquear = async (req, res) => {
    try {
        if (!(await temTabela('bloqueio'))) return semMigracao(res)
        await db('bloqueio').where({ usu_id: req.usuario.id, bloqueado_id: alvoDe(req) }).del()
        return res.json({ mensagem: 'Pessoa desbloqueada.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao desbloquear.' })
    }
}

/* ---------- Anotações privadas (só quem escreveu vê) ---------- */

export const verNota = async (req, res) => {
    try {
        if (!(await temTabela('nota_privada'))) return res.json({ disponivel: false, texto: '' })
        const nota = await db('nota_privada').where({ usu_id: req.usuario.id, alvo_id: alvoDe(req) }).first()
        return res.json({ disponivel: true, texto: nota?.not_texto ?? '', atualizada_em: nota?.not_atualizada_em ?? null })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a anotação.' })
    }
}

export const salvarNota = async (req, res) => {
    try {
        if (!(await temTabela('nota_privada'))) return semMigracao(res)
        const texto = String(req.body?.texto ?? '').trim()
        if (texto.length > 1000) return res.status(400).json({ erro: 'A anotação pode ter até 1000 letras.' })
        const chave = { usu_id: req.usuario.id, alvo_id: alvoDe(req) }
        if (!texto) {
            await db('nota_privada').where(chave).del()
            return res.json({ mensagem: 'Anotação apagada.' })
        }
        await db('nota_privada').insert({ ...chave, not_texto: texto }).onConflict(['usu_id', 'alvo_id']).merge({ not_texto: texto, not_atualizada_em: db.fn.now() })
        return res.json({ mensagem: 'Anotação salva. Só você vê.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar a anotação.' })
    }
}

/* ---------- Me avise quando estiver livre ---------- */

export const verAvisoDisponivel = async (req, res) => {
    try {
        if (!(await temTabela('aviso_disponivel'))) return res.json({ disponivel: false, ativo: false })
        const linha = await db('aviso_disponivel').where({ usu_id: req.usuario.id, free_usu_id: alvoDe(req) }).first()
        return res.json({ disponivel: true, ativo: Boolean(linha) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o aviso.' })
    }
}

export const pedirAvisoDisponivel = async (req, res) => {
    try {
        if (!(await temTabela('aviso_disponivel'))) return semMigracao(res)
        const alvo = alvoDe(req)
        const free = await db('usuario').where({ usu_id: alvo, tipo_usuario: 'freelancer' }).first()
        if (!free) return res.status(404).json({ erro: 'Freelancer não encontrado.' })
        await db('aviso_disponivel').insert({ usu_id: req.usuario.id, free_usu_id: alvo }).onConflict(['usu_id', 'free_usu_id']).ignore()
        return res.json({ mensagem: `Combinado: avisamos quando ${free.usu_nome.split(' ')[0]} estiver livre.` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao pedir o aviso.' })
    }
}

export const cancelarAvisoDisponivel = async (req, res) => {
    try {
        if (!(await temTabela('aviso_disponivel'))) return semMigracao(res)
        await db('aviso_disponivel').where({ usu_id: req.usuario.id, free_usu_id: alvoDe(req) }).del()
        return res.json({ mensagem: 'Aviso cancelado.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao cancelar o aviso.' })
    }
}

/* Chamado quando o freelancer volta a ficar disponível: avisa quem pediu e limpa os pedidos */
export async function avisarQuemEsperava(free_usu_id) {
    try {
        if (!(await temTabela('aviso_disponivel'))) return
        const pedidos = await db('aviso_disponivel').where('free_usu_id', free_usu_id).pluck('usu_id')
        if (!pedidos.length) return
        const free = await db('usuario').where('usu_id', free_usu_id).select('usu_nome').first()
        const nome = free?.usu_nome?.split(' ')[0] ?? 'O freelancer'
        const titulo = `${nome} está livre`
        const texto = `${nome} voltou a aceitar projetos. Que tal mandar um convite?`
        await db('notificacao').insert(pedidos.map((usu_id) => ({ usu_id, not_titulo: titulo, not_desc: texto })))
        await enviarPush(pedidos, { titulo, texto, url: `/contratante/freelancer/${free_usu_id}` })
        await db('aviso_disponivel').where('free_usu_id', free_usu_id).del()
    } catch (erro) {
        console.error(erro)
    }
}

/* ---------- Horários de atendimento ---------- */

/* {"dias":[1,2,3,4,5],"de":9,"ate":18} (0 = domingo); null = não informou */
export function lerHorarios(texto) {
    try {
        const h = JSON.parse(texto ?? 'null')
        if (!h || !Array.isArray(h.dias)) return null
        const dias = [...new Set(h.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        const de = Number(h.de)
        const ate = Number(h.ate)
        if (!dias.length || !Number.isInteger(de) || !Number.isInteger(ate) || de < 0 || ate > 24 || de >= ate) return null
        return { dias, de, ate }
    } catch {
        return null
    }
}

export const salvarHorarios = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_horarios'))) return semMigracao(res)
        if (req.body?.horarios === null) {
            await db('usuario').where('usu_id', req.usuario.id).update({ usu_horarios: null })
            return res.json({ mensagem: 'Horários apagados.' })
        }
        const horarios = lerHorarios(JSON.stringify(req.body?.horarios ?? null))
        if (!horarios) return res.status(400).json({ erro: 'Escolha pelo menos um dia e um horário de início antes do fim.' })
        await db('usuario').where('usu_id', req.usuario.id).update({ usu_horarios: JSON.stringify(horarios) })
        return res.json({ mensagem: 'Horários salvos.', horarios })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar os horários.' })
    }
}

/* A reunião (em horário de Brasília) cai dentro dos horários? */
export function dentroDoHorario(horarios, quando) {
    if (!horarios) return true
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(quando)
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.find((p) => p.type === 'weekday')?.value)
    const hora = Number(partes.find((p) => p.type === 'hour')?.value)
    return horarios.dias.includes(dia) && hora >= horarios.de && hora < horarios.ate
}
