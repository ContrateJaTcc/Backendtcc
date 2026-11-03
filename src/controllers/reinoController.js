import db from '../config/knex.js'
import { temColuna, temTabela } from '../services/registro.js'
import { concederXp, sincronizarInsignias } from '../services/gamificacao.js'
import { SECRETAS } from './conquistaController.js'
import { hojeBrasil } from '../services/visitas.js'
import { BANCO, areaDaCategoria, perguntasPublicas, corrigir, ESPERA_REFAZER, XP_TESTE, ACERTOS_PARA_PASSAR } from '../services/testes.js'

/*
 * Coisas do reino que não cabem em outro lugar: testes de habilidade, freelancers favoritos,
 * mascote do castelo, visitas ao perfil e o álbum de insígnias (com quantos por cento já têm cada uma).
 */

const DIA = 86_400_000

/* ---------- Testes de habilidade ---------- */

/* Categorias do site que têm teste no banco */
async function areasComTeste() {
    const tipos = await db('tipo_servico').select('tipo_id', 'tipo_nome').orderBy('tipo_nome')
    return tipos.map((t) => ({ ...t, area: areaDaCategoria(t.tipo_nome) })).filter((t) => t.area)
}

export const listarTestes = async (req, res) => {
    try {
        const pronto = await temTabela('teste_habilidade')
        const areas = await areasComTeste()
        const meus = pronto ? await db('teste_habilidade').where('usu_id', req.usuario.id) : []
        const porTipo = new Map(meus.map((m) => [m.tipo_id, m]))

        return res.json({
            disponivel: pronto,
            para_passar: ACERTOS_PARA_PASSAR,
            xp: XP_TESTE,
            testes: areas.map((t) => {
                const m = porTipo.get(t.tipo_id)
                const refazer = m && !m.tes_aprovado_em ? new Date(new Date(m.tes_ultima_em).getTime() + ESPERA_REFAZER) : null
                return {
                    tipo_id: t.tipo_id,
                    nome: t.tipo_nome,
                    perguntas: BANCO[t.area].perguntas.length,
                    aprovado_em: m?.tes_aprovado_em ?? null,
                    ultima_em: m?.tes_ultima_em ?? null,
                    acertos: m?.tes_acertos ?? null,
                    pode_refazer_em: refazer && refazer.getTime() > Date.now() ? refazer.toISOString() : null
                }
            })
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os testes.' })
    }
}

async function testeDaCategoria(tipoId) {
    const tipo = await db('tipo_servico').where('tipo_id', Number(tipoId)).select('tipo_id', 'tipo_nome').first()
    const area = tipo ? areaDaCategoria(tipo.tipo_nome) : null
    return area ? { ...tipo, area } : null
}

export const verTeste = async (req, res) => {
    try {
        const t = await testeDaCategoria(req.params.tipoId)
        if (!t) return res.status(404).json({ erro: 'Ainda não há teste para esta área.' })
        return res.json({ tipo_id: t.tipo_id, nome: t.tipo_nome, para_passar: ACERTOS_PARA_PASSAR, perguntas: perguntasPublicas(t.area) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao abrir o teste.' })
    }
}

export const responderTeste = async (req, res) => {
    try {
        if (!(await temTabela('teste_habilidade'))) return res.status(503).json({ erro: 'Os testes ainda estão sendo preparados. Tente mais tarde.' })

        const t = await testeDaCategoria(req.params.tipoId)
        if (!t) return res.status(404).json({ erro: 'Ainda não há teste para esta área.' })

        const respostas = req.body.respostas
        if (!Array.isArray(respostas) || respostas.length !== BANCO[t.area].perguntas.length) {
            return res.status(400).json({ erro: 'Responda todas as perguntas.' })
        }

        const anterior = await db('teste_habilidade').where({ usu_id: req.usuario.id, tipo_id: t.tipo_id }).first()
        if (anterior?.tes_aprovado_em) return res.status(400).json({ erro: 'Você já passou neste teste.' })
        if (anterior && Date.now() - new Date(anterior.tes_ultima_em).getTime() < ESPERA_REFAZER) {
            return res.status(429).json({ erro: 'Dá para tentar de novo 24 horas depois da última tentativa.' })
        }

        const r = corrigir(t.area, respostas)
        const linha = {
            usu_id: req.usuario.id,
            tipo_id: t.tipo_id,
            tes_acertos: r.acertos,
            tes_total: r.total,
            tes_ultima_em: db.fn.now(),
            tes_aprovado_em: r.aprovado ? db.fn.now() : null
        }

        await db.transaction(async (trx) => {
            await trx('teste_habilidade').insert(linha).onConflict(['usu_id', 'tipo_id']).merge()
            if (r.aprovado) {
                const free = await trx('freelancer').where('usu_id', req.usuario.id).select('free_id').first()
                if (free) await concederXp(trx, free.free_id, XP_TESTE, `teste_${t.area}`)
            }
        })

        if (r.aprovado) {
            await db('notificacao').insert({ usu_id: req.usuario.id, not_titulo: 'Teste aprovado!', not_desc: `Você passou no teste de ${t.tipo_nome} e ganhou o selo da área (+${XP_TESTE} XP).` })
        }

        return res.json({
            acertos: r.acertos,
            total: r.total,
            aprovado: r.aprovado,
            /* O gabarito só aparece para quem passou (assim a segunda tentativa ainda vale) */
            gabarito: r.aprovado ? r.gabarito : null,
            mensagem: r.aprovado
                ? `Aprovado! ${r.acertos} de ${r.total}. O selo de ${t.tipo_nome} já aparece no seu perfil. +${XP_TESTE} XP`
                : `${r.acertos} de ${r.total}: faltou pouco. Precisa de ${ACERTOS_PARA_PASSAR} acertos; dá para tentar de novo amanhã.`
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao corrigir o teste.' })
    }
}

/* ---------- Freelancers favoritos (contratante) ---------- */

export const listarFavoritos = async (req, res) => {
    try {
        if (!(await temTabela('freelancer_favorito'))) return res.json({ disponivel: false, ids: [] })
        const ids = await db('freelancer_favorito').where('usu_id', req.usuario.id).orderBy('fav_data', 'desc').pluck('fav_usu_id')
        return res.json({ disponivel: true, ids })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os favoritos.' })
    }
}

export const favoritar = async (req, res) => {
    try {
        if (!(await temTabela('freelancer_favorito'))) return res.status(503).json({ erro: 'Favoritos ainda estão sendo preparados.' })
        const alvo = Number(req.params.usuId)
        const free = await db('freelancer').where('usu_id', alvo).first()
        if (!free) return res.status(404).json({ erro: 'Freelancer não encontrado.' })

        const total = Number((await db('freelancer_favorito').where('usu_id', req.usuario.id).count('* as n').first())?.n ?? 0)
        if (total >= 100) return res.status(400).json({ erro: 'Você pode guardar até 100 freelancers.' })

        await db('freelancer_favorito').insert({ usu_id: req.usuario.id, fav_usu_id: alvo }).onConflict(['usu_id', 'fav_usu_id']).ignore()
        const ids = await db('freelancer_favorito').where('usu_id', req.usuario.id).pluck('fav_usu_id')
        return res.json({ mensagem: 'Freelancer guardado nos favoritos.', ids })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao guardar o favorito.' })
    }
}

export const desfavoritar = async (req, res) => {
    try {
        if (!(await temTabela('freelancer_favorito'))) return res.status(503).json({ erro: 'Favoritos ainda estão sendo preparados.' })
        await db('freelancer_favorito').where({ usu_id: req.usuario.id, fav_usu_id: Number(req.params.usuId) }).del()
        const ids = await db('freelancer_favorito').where('usu_id', req.usuario.id).pluck('fav_usu_id')
        return res.json({ mensagem: 'Tirado dos favoritos.', ids })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao tirar o favorito.' })
    }
}

/* ---------- Mascote do castelo ---------- */

export const ESPECIES = ['dragao', 'gato', 'coruja', 'slime']

export const salvarMascote = async (req, res) => {
    try {
        if (!(await temColuna('usuario', 'usu_mascote'))) return res.status(503).json({ erro: 'O mascote ainda está sendo preparado.' })

        const especie = String(req.body.especie ?? '')
        const nome = String(req.body.nome ?? '').trim().replace(/\s+/g, ' ')
        if (!ESPECIES.includes(especie)) return res.status(400).json({ erro: 'Escolha um dos bichinhos.' })
        if (nome.length < 2 || nome.length > 20) return res.status(400).json({ erro: 'Dê um nome de 2 a 20 letras ao mascote.' })

        await db('usuario').where('usu_id', req.usuario.id).update({ usu_mascote: especie, usu_mascote_nome: nome })
        return res.json({ mensagem: `${nome} agora mora no seu castelo!`, mascote: { especie, nome } })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao salvar o mascote.' })
    }
}

/* ---------- Visitas ao perfil (freelancer) ---------- */

export const minhasVisitas = async (req, res) => {
    try {
        if (!(await temTabela('perfil_visita'))) return res.json({ disponivel: false, dias: [], semana: 0, semana_passada: 0, contratantes: 0 })

        const hoje = hojeBrasil()
        const base = new Date(`${hoje}T12:00:00Z`).getTime()
        const dia = (n) => new Date(base - n * DIA).toISOString().slice(0, 10)

        const linhas = await db('perfil_visita')
            .where('usu_id', req.usuario.id)
            .where('vis_dia', '>=', dia(13))
            .groupBy('vis_dia', 'vis_origem')
            .select('vis_dia', 'vis_origem', db.raw('COUNT(*) as total'))

        const porDia = new Map()
        let contratantes = 0
        let semanaPassada = 0
        for (const l of linhas) {
            const d = new Date(l.vis_dia).toISOString().slice(0, 10)
            const n = Number(l.total)
            if (d >= dia(6)) {
                porDia.set(d, (porDia.get(d) ?? 0) + n)
                if (l.vis_origem === 'contratante') contratantes += n
            } else {
                semanaPassada += n
            }
        }

        const dias = Array.from({ length: 7 }, (_, i) => {
            const d = dia(6 - i)
            return { dia: d, total: porDia.get(d) ?? 0 }
        })

        return res.json({
            disponivel: true,
            dias,
            semana: dias.reduce((t, d) => t + d.total, 0),
            semana_passada: semanaPassada,
            contratantes
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as visitas.' })
    }
}

/* ---------- Álbum de insígnias ---------- */

const RARIDADE = {
    primeiro_projeto: 'bronze', perfil_completo: 'bronze', primeira_entrega: 'bronze', vitrine: 'bronze',
    em_ascensao: 'prata', nota_maxima: 'prata', requisitado: 'prata', pontual: 'prata',
    veterano: 'ouro', favorito: 'ouro', nivel_5: 'ouro'
}

const porcento = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : 0)

export const album = async (req, res) => {
    try {
        const free = await db('freelancer').where('usu_id', req.usuario.id).select('free_id').first()

        const [ativos, pessoas, minhas, contagem, secretasMinhas, secretasContagem] = await Promise.all([
            db('freelancer').join('usuario', 'freelancer.usu_id', 'usuario.usu_id').where('usuario.status_conta', 'ativa').count('* as n').first(),
            db('usuario').where('status_conta', 'ativa').count('* as n').first(),
            free ? sincronizarInsignias(free.free_id) : [],
            db('freelancer_insignia').join('insignia', 'freelancer_insignia.ins_id', 'insignia.ins_id').groupBy('insignia.ins_codigo').select('insignia.ins_codigo', db.raw('COUNT(*) as n')),
            (await temTabela('conquista_secreta')) ? db('conquista_secreta').where('usu_id', req.usuario.id).select('con_codigo', 'con_data') : [],
            (await temTabela('conquista_secreta')) ? db('conquista_secreta').groupBy('con_codigo').select('con_codigo', db.raw('COUNT(*) as n')) : []
        ])

        const totalFree = Number(ativos?.n ?? 0)
        const totalPessoas = Number(pessoas?.n ?? 0)
        const quantos = new Map(contagem.map((c) => [c.ins_codigo, Number(c.n)]))
        const secretasQuantos = new Map(secretasContagem.map((c) => [c.con_codigo, Number(c.n)]))
        const minhasSecretas = new Map(secretasMinhas.map((c) => [c.con_codigo, c.con_data]))

        return res.json({
            insignias: minhas.map((i) => ({
                ...i,
                raridade: RARIDADE[i.codigo] ?? 'bronze',
                porcentagem: porcento(quantos.get(i.codigo) ?? 0, totalFree)
            })),
            secretas: Object.entries(SECRETAS).map(([codigo, c]) => {
                const data = minhasSecretas.get(codigo) ?? null
                return {
                    codigo,
                    nome: data ? c.nome : '???',
                    descricao: data ? c.descricao : c.dica,
                    conquistada: Boolean(data),
                    data,
                    porcentagem: porcento(secretasQuantos.get(codigo) ?? 0, totalPessoas)
                }
            }),
            total_freelancers: totalFree
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao montar o álbum.' })
    }
}
