import { filtroLiberados } from '../services/moderacao.js'
import db from '../config/knex.js'
import { temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'

/*
 * Alertas de busca: o freelancer salva "Web Design, a partir de R$ 300"
 * e recebe uma notificação quando um projeto parecido é publicado.
 */

const LIMITE_BUSCAS = 5
const LIMITE_TERMO = 80

async function freelancerDe(usu_id) {
    return db('freelancer').select('free_id').where('usu_id', usu_id).first()
}

function listar(usu_id) {
    return db('busca_salva')
        .leftJoin('tipo_servico', 'busca_salva.tipo_id', 'tipo_servico.tipo_id')
        .where('busca_salva.usu_id', usu_id)
        .select(
            'busca_salva.bus_id',
            'busca_salva.bus_termo',
            'busca_salva.tipo_id',
            'tipo_servico.tipo_nome as categoria',
            'busca_salva.bus_valor_min',
            'busca_salva.bus_data'
        )
        .orderBy('busca_salva.bus_id', 'desc')
}

async function disponivel(res) {
    if (await temTabela('busca_salva')) return true
    res.status(503).json({ erro: 'Alertas de busca ainda não disponíveis.' })
    return false
}

export const listarBuscas = async (req, res) => {
    try {
        if (!(await disponivel(res))) return
        return res.json({ buscas: await listar(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar seus alertas.' })
    }
}

export const criarBusca = async (req, res) => {
    try {
        if (!(await disponivel(res))) return
        if (!(await freelancerDe(req.usuario.id))) {
            return res.status(403).json({ erro: 'Apenas freelancers criam alertas.' })
        }

        const termo = String(req.body.termo ?? '').trim()
        const tipo_id = req.body.tipo_id ? Number(req.body.tipo_id) : null
        const valorMin = req.body.valor_min === '' || req.body.valor_min == null ? null : Number(req.body.valor_min)

        if (!termo && !tipo_id) {
            return res.status(400).json({ erro: 'Escolha uma palavra ou uma categoria para o alerta.' })
        }

        if (termo.length > LIMITE_TERMO) {
            return res.status(400).json({ erro: `A palavra pode ter até ${LIMITE_TERMO} letras.` })
        }

        if (valorMin !== null && (!Number.isFinite(valorMin) || valorMin < 0)) {
            return res.status(400).json({ erro: 'Valor mínimo inválido.' })
        }

        if (tipo_id && !(await db('tipo_servico').where('tipo_id', tipo_id).first())) {
            return res.status(400).json({ erro: 'Categoria não encontrada.' })
        }

        const atuais = await listar(req.usuario.id)

        if (atuais.length >= LIMITE_BUSCAS) {
            return res.status(400).json({ erro: `Você pode ter até ${LIMITE_BUSCAS} alertas. Apague um para criar outro.` })
        }

        await db('busca_salva').insert({
            usu_id: req.usuario.id,
            bus_termo: termo || null,
            tipo_id,
            bus_valor_min: valorMin
        })

        return res.status(201).json({ mensagem: 'Alerta criado! Avisamos quando sair um projeto assim.', buscas: await listar(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao criar o alerta.' })
    }
}

export const removerBusca = async (req, res) => {
    try {
        if (!(await disponivel(res))) return

        const apagadas = await db('busca_salva')
            .where({ bus_id: req.params.id, usu_id: req.usuario.id })
            .del()

        if (apagadas === 0) {
            return res.status(404).json({ erro: 'Alerta não encontrado.' })
        }

        return res.json({ mensagem: 'Alerta apagado.', buscas: await listar(req.usuario.id) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao apagar o alerta.' })
    }
}

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* Projeto confere com o alerta? (categoria, valor mínimo e palavra no título ou na descrição) */
export function confere(busca, servico) {
    if (busca.tipo_id && Number(busca.tipo_id) !== Number(servico.tipo_id)) return false
    if (busca.bus_valor_min != null && Number(servico.serv_valor) < Number(busca.bus_valor_min)) return false
    if (busca.bus_termo) {
        const texto = semAcento(`${servico.serv_titulo} ${servico.serv_desc}`)
        if (!texto.includes(semAcento(busca.bus_termo))) return false
    }
    return true
}

/*
 * Chamado quando um projeto passa a estar aberto: avisa uma vez cada freelancer
 * com alerta parecido (o dono do projeto fica de fora). Falha aqui nunca derruba a publicação.
 */
export async function avisarBuscas(serv_id) {
    try {
        if (!(await temTabela('busca_salva'))) return

        const servico = await db('servico')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .where('servico.serv_id', serv_id)
            .select('servico.serv_id', 'servico.tipo_id', 'servico.serv_titulo', 'servico.serv_desc', 'servico.serv_valor', 'servico.serv_status', 'contratante.usu_id as dono')
            .modify(await filtroLiberados())
            .first()

        /* Projeto em revisão (filtro de spam) avisa só depois de aprovado */
        if (!servico || servico.serv_status !== 'aberto') return

        const buscas = await db('busca_salva')
            .join('usuario', 'busca_salva.usu_id', 'usuario.usu_id')
            .where('usuario.status_conta', 'ativa')
            .whereNot('busca_salva.usu_id', servico.dono)
            .select('busca_salva.*')

        const avisados = new Set()

        for (const busca of buscas) {
            if (avisados.has(busca.usu_id) || !confere(busca, servico)) continue
            avisados.add(busca.usu_id)

            const texto = `"${servico.serv_titulo}" combina com o seu alerta${busca.bus_termo ? ` "${busca.bus_termo}"` : ''}.`
            await db('notificacao').insert({ usu_id: busca.usu_id, not_titulo: 'Projeto novo para você', not_desc: texto })
            await enviarPush(busca.usu_id, { titulo: 'Projeto novo para você', texto, url: `/freelancer/projetos/${servico.serv_id}` })
        }
    } catch (erro) {
        console.error(erro)
    }
}
