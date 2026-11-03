import { camposModeracao, filtroLiberados } from '../services/moderacao.js'
import { reputacaoContratante } from '../services/reputacao.js'
import db from '../config/knex.js'
import { avisarBuscas } from './buscaController.js'
import { temColuna, temTabela } from '../services/registro.js'

/* Prazo para candidaturas (opcional): data de hoje em diante, ou vazio */
function lerPrazoCandidaturas(valor) {
    if (valor === undefined) return { ok: true, campos: {} }
    if (valor === null || valor === '') return { ok: true, campos: { serv_candidaturas_ate: null } }
    const texto = String(valor).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(new Date(texto).getTime())) {
        return { ok: false, erro: 'Data limite para candidaturas inválida.' }
    }
    const hoje = new Date().toISOString().slice(0, 10)
    if (texto < hoje) return { ok: false, erro: 'A data limite para candidaturas não pode estar no passado.' }
    return { ok: true, campos: { serv_candidaturas_ate: texto } }
}

/* ---------- Histórico de mudanças do anúncio ---------- */

const ROTULO_MUDANCA = { serv_titulo: 'título', serv_desc: 'descrição', serv_valor: 'valor', serv_qtd_dias: 'prazo', serv_local: 'local' }

const textoCampo = (campo, v) => {
    if (v === null || v === undefined || v === '') return '—'
    if (campo === 'serv_valor') return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
    if (campo === 'serv_qtd_dias') return `${v} dias`
    return String(v).slice(0, 300)
}

async function registrarMudancas(antes, depois) {
    try {
        if (!(await temTabela('servico_mudanca')) || antes.serv_status !== 'aberto') return
        const mudou = Object.keys(ROTULO_MUDANCA).filter((c) => {
            const a = antes[c]
            const d = depois[c]
            return c === 'serv_valor' || c === 'serv_qtd_dias' ? Number(a ?? 0) !== Number(d ?? 0) : String(a ?? '').trim() !== String(d ?? '').trim()
        })
        if (!mudou.length) return
        await db('servico_mudanca').insert(mudou.map((c) => ({ serv_id: antes.serv_id, mud_campo: c, mud_antes: textoCampo(c, antes[c]), mud_depois: textoCampo(c, depois[c]) })))

        /* Quem está com candidatura esperando resposta fica sabendo (só valor, prazo e local mudam o combinado) */
        const importantes = mudou.filter((c) => ['serv_valor', 'serv_qtd_dias', 'serv_local'].includes(c))
        if (!importantes.length) return
        const candidatos = await db('candidatura')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .where({ 'candidatura.serv_id': antes.serv_id, 'candidatura.cand_status': 'pendente' })
            .pluck('freelancer.usu_id')
        if (!candidatos.length) return
        const texto = `"${antes.serv_titulo}" mudou depois da sua candidatura: ${importantes.map((c) => `${ROTULO_MUDANCA[c]} ${textoCampo(c, antes[c])} → ${textoCampo(c, depois[c])}`).join('; ')}.`
        await db('notificacao').insert(candidatos.map((usu_id) => ({ usu_id, not_titulo: 'Projeto mudou depois da candidatura', not_desc: texto.slice(0, 500) })))
    } catch (erro) {
        console.error(erro)
    }
}

/* Freelancer: o que mudou depois que ele se candidatou (contratante: tudo o que mudou) */
async function mudancasDepoisDaCandidatura(serv_id, usuario) {
    if (!(await temTabela('servico_mudanca'))) return []
    let desde = null
    if (usuario.tipo === 'freelancer') {
        const cand = await db('candidatura')
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .where({ 'candidatura.serv_id': serv_id, 'freelancer.usu_id': usuario.id })
            .select('candidatura.cand_data')
            .first()
        if (!cand) return []
        desde = cand.cand_data
    }
    const q = db('servico_mudanca').where('serv_id', serv_id).orderBy('mud_id')
    if (desde) q.where('mud_data', '>=', desde)
    const linhas = await q.select('mud_campo', 'mud_antes', 'mud_depois', 'mud_data')
    return linhas.map((l) => ({ campo: ROTULO_MUDANCA[l.mud_campo] ?? l.mud_campo, antes: l.mud_antes, depois: l.mud_depois, data: l.mud_data }))
}

/* Fila de revisão do filtro de spam: os admins ficam sabendo */
async function avisarAdminsModeracao(titulo) {
    try {
        const admins = await db('usuario').where({ tipo_usuario: 'administrador', status_conta: 'ativa' }).select('usu_id')
        if (admins.length) {
            await db('notificacao').insert(admins.map((a) => ({ usu_id: a.usu_id, not_titulo: 'Projeto para revisar', not_desc: `"${String(titulo).slice(0, 80)}" caiu no filtro de spam e espera a sua revisão.` })))
        }
    } catch (erro) {
        console.error(erro)
    }
}

export const criarServico = async (req, res) => {
    try {
        const {
            titulo,
            descricao,
            tipo_id,
            valor,
            tipo_valor,
            data_inicio,
            qtd_dias,
            local,
            cidade,
            estado,
            habilidades,
            forma_pagamento,
            vagas,
            status
        } = req.body

        if (
            !titulo ||
            !descricao ||
            !tipo_id ||
            valor === undefined ||
            !tipo_valor ||
            !qtd_dias ||
            !local ||
            !vagas
        ) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            })
        }

        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem criar projetos.'
            })
        }

        const contratante = await db('contratante')
            .select('cont_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const prazoCand = lerPrazoCandidaturas(req.body.candidaturas_ate)

        if (!prazoCand.ok) {
            return res.status(400).json({ erro: prazoCand.erro })
        }

        const extrasPrazo = (await temColuna('servico', 'serv_candidaturas_ate')) ? prazoCand.campos : {}
        /* Filtro de spam: projeto suspeito vai para a revisão da administração antes de aparecer */
        const moderacao = await camposModeracao({ titulo, descricao, valor, tipo_valor })

        const [serv_id] = await db('servico').insert({
            ...extrasPrazo,
            ...moderacao,
            cont_id: contratante.cont_id,
            tipo_id,
            serv_titulo: titulo,
            serv_desc: descricao,
            serv_valor: valor,
            serv_tipo_valor: tipo_valor,
            serv_data_inicio: data_inicio || null,
            serv_qtd_dias: qtd_dias,
            serv_local: local,
            serv_cidade: cidade || null,
            serv_estado: estado || null,
            serv_habilidades: habilidades || null,
            serv_forma_pagamento: forma_pagamento || null,
            serv_vagas: vagas,
            serv_status: status || 'rascunho'
        })

        const projeto = await db('servico')
            .where('serv_id', serv_id)
            .first()

        if (projeto?.serv_status === 'aberto') await avisarBuscas(serv_id)
        if (moderacao.serv_moderacao) await avisarAdminsModeracao(titulo)

        return res.status(201).json({
            mensagem: moderacao.serv_moderacao
                ? 'Projeto criado! Ele passa por uma revisão rápida da administração antes de aparecer para os freelancers.'
                : 'Projeto criado com sucesso!',
            em_revisao: Boolean(moderacao.serv_moderacao),
            projeto
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao criar projeto.'
        })
    }
}

export const listarMeusServicos = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem visualizar seus projetos.'
            })
        }

        const contratante = await db('contratante')
            .select('cont_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const projetos = await db('servico')
            .join(
                'tipo_servico',
                'servico.tipo_id',
                'tipo_servico.tipo_id'
            )
            .where('servico.cont_id', contratante.cont_id)
            .select(
                'servico.serv_id',
                'servico.cont_id',
                'servico.tipo_id',
                'tipo_servico.tipo_nome as categoria',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_data_inicio',
                'servico.serv_qtd_dias',
                'servico.serv_local',
                'servico.serv_cidade',
                'servico.serv_estado',
                'servico.serv_habilidades',
                'servico.serv_forma_pagamento',
                'servico.serv_vagas',
                'servico.serv_status',
                'servico.serv_data_criacao',
                'servico.serv_data_atualizacao',
                /* "Em revisão" no cartão do projeto (filtro de spam) */
                ...((await temColuna('servico', 'serv_moderacao')) ? ['servico.serv_moderacao', 'servico.serv_moderacao_motivo'] : [])
            )
            .orderBy('servico.serv_id', 'desc')

        return res.json({
            projetos
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar projetos.'
        })
    }
}
export const buscarServicoPorId = async (req, res) => {
    try {
        const liberados = await filtroLiberados()
        const projeto = await db('servico')
            .join(
                'tipo_servico',
                'servico.tipo_id',
                'tipo_servico.tipo_id'
            )
            .join(
                'contratante',
                'servico.cont_id',
                'contratante.cont_id'
            )
            .join(
                'usuario',
                'contratante.usu_id',
                'usuario.usu_id'
            )
            .where('servico.serv_id', req.params.id)
            .where(function () {
                if (req.usuario.tipo === 'contratante') {
                    this.where('contratante.usu_id', req.usuario.id)
                } else {
                    this.where('servico.serv_status', 'aberto')
                }
            })
            /* Projeto em revisão (filtro de spam) só o dono vê */
            .modify((q) => {
                if (req.usuario.tipo !== 'contratante') liberados(q)
            })
            .select(
                'servico.serv_id',
                'servico.cont_id',
                'servico.tipo_id',
                'tipo_servico.tipo_nome as categoria',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_data_inicio',
                'servico.serv_qtd_dias',
                'servico.serv_local',
                'servico.serv_cidade',
                'servico.serv_estado',
                'servico.serv_habilidades',
                'servico.serv_forma_pagamento',
                'servico.serv_vagas',
                'servico.serv_status',
                'servico.serv_data_criacao',
                'servico.serv_data_atualizacao',
                ...((await temColuna('servico', 'serv_candidaturas_ate')) ? ['servico.serv_candidaturas_ate'] : []),
                'usuario.usu_id as contratante_usu_id',
                'usuario.usu_nome as contratante_nome',
                'usuario.usu_desc as contratante_desc',
                'usuario.usu_foto as contratante_foto',
                'usuario.data_criacao as contratante_data_criacao',
                db.raw(`
                    (
                        SELECT COUNT(*)
                        FROM servico AS s2
                        WHERE s2.cont_id = servico.cont_id
                        AND s2.serv_status = 'aberto'
                    ) AS contratante_servicos_postados
                `),
                /* Reputação */
                db.raw(`
                    (
                        SELECT ROUND(AVG(a.aval_nota), 1)
                        FROM avaliacao AS a
                        WHERE a.usu_avaliado = usuario.usu_id
                    ) AS contratante_nota
                `),
                db.raw(`
                    (
                        SELECT COUNT(*)
                        FROM avaliacao AS a
                        WHERE a.usu_avaliado = usuario.usu_id
                    ) AS contratante_total_avaliacoes
                `),
                /* Já candidatado */
                db.raw(`
                    (
                        SELECT COUNT(*)
                        FROM candidatura AS c
                        JOIN freelancer AS f ON f.free_id = c.free_id
                        WHERE c.serv_id = servico.serv_id AND f.usu_id = ?
                    ) AS ja_candidatado
                `, [req.usuario.id])
            )
            .first()

        if (!projeto) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        /* Reputação de quem contrata e o que mudou no anúncio depois da candidatura de quem está vendo */
        const dono = await db('contratante').where('cont_id', projeto.cont_id).select('usu_id').first()
        projeto.contratante_reputacao = dono ? await reputacaoContratante(dono.usu_id) : null
        projeto.mudancas = await mudancasDepoisDaCandidatura(projeto.serv_id, req.usuario)

        return res.json({ projeto })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar projeto.'
        })
    }
}
export const atualizarServico = async (req, res) => {
    try {
        if (req.usuario.tipo !== 'contratante') {
            return res.status(403).json({
                erro: 'Apenas contratantes podem editar projetos.'
            })
        }

        const contratante = await db('contratante')
            .select('cont_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!contratante) {
            return res.status(404).json({
                erro: 'Contratante não encontrado.'
            })
        }

        const {
            titulo,
            descricao,
            tipo_id,
            valor,
            tipo_valor,
            data_inicio,
            qtd_dias,
            local,
            cidade,
            estado,
            habilidades,
            forma_pagamento,
            vagas,
            status
        } = req.body

        const projeto = await db('servico')
            .where('serv_id', req.params.id)
            .where('cont_id', contratante.cont_id)
            .first()

        if (!projeto) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        /* Status editáveis */
        const EDITAVEIS = ['rascunho', 'aberto']

        if (!EDITAVEIS.includes(status) || !EDITAVEIS.includes(projeto.serv_status)) {
            return res.status(400).json({
                erro: 'Só é possível editar projetos em rascunho ou abertos.'
            })
        }

        const prazoCand = lerPrazoCandidaturas(req.body.candidaturas_ate)

        if (!prazoCand.ok) {
            return res.status(400).json({ erro: prazoCand.erro })
        }

        const extrasPrazo = (await temColuna('servico', 'serv_candidaturas_ate')) ? prazoCand.campos : {}

        /*
         * Filtro de spam na edição: texto suspeito volta para a revisão; texto limpo tira o "pendente"
         * (um projeto recusado pela administração, mesmo limpo, volta para ela olhar de novo)
         */
        /* Histórico do anúncio: guarda o que mudou e avisa quem já se candidatou */
        await registrarMudancas(projeto, { serv_titulo: titulo, serv_desc: descricao, serv_valor: valor, serv_qtd_dias: qtd_dias || null, serv_local: local })

        const novaModeracao = await camposModeracao({ titulo, descricao, valor, tipo_valor })
        const extrasModeracao = !(await temColuna('servico', 'serv_moderacao'))
            ? {}
            : novaModeracao.serv_moderacao
                ? novaModeracao
                : projeto.serv_moderacao === 'pendente'
                    ? { serv_moderacao: null, serv_moderacao_motivo: null }
                    : projeto.serv_moderacao === 'recusado'
                        ? { serv_moderacao: 'pendente', serv_moderacao_motivo: 'editado depois de recusado' }
                        : {}

        await db('servico')
            .where('serv_id', req.params.id)
            .update({
                ...extrasPrazo,
                ...extrasModeracao,
                tipo_id,
                serv_titulo: titulo,
                serv_desc: descricao,
                serv_valor: valor,
                serv_tipo_valor: tipo_valor,
                serv_data_inicio: data_inicio || null,
                serv_qtd_dias: qtd_dias || null,
                serv_local: local,
                serv_cidade: cidade || null,
                serv_estado: estado || null,
                serv_habilidades: habilidades || null,
                serv_forma_pagamento: forma_pagamento || null,
                serv_vagas: vagas,
                serv_status: status
            })

        /* Rascunho que virou aberto: agora sim é publicação */
        if (status === 'aberto' && projeto.serv_status !== 'aberto') await avisarBuscas(projeto.serv_id)
        const emRevisao = extrasModeracao.serv_moderacao === 'pendente'
        if (emRevisao && projeto.serv_moderacao !== 'pendente') await avisarAdminsModeracao(titulo)

        return res.json({
            mensagem: emRevisao ? 'Projeto atualizado. Ele passa por uma revisão rápida da administração antes de aparecer.' : 'Projeto atualizado com sucesso.',
            em_revisao: emRevisao
        })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao atualizar projeto.'
        })
    }
    
}
export const listarOutrosServicos = async (req, res) => {
    try {
        const servicoAtual = await db('servico')
            .select('cont_id')
            .where('serv_id', req.params.id)
            .first()

        if (!servicoAtual) {
            return res.status(404).json({
                erro: 'Projeto não encontrado.'
            })
        }

        const projetos = await db('servico')
            .join(
                'tipo_servico',
                'servico.tipo_id',
                'tipo_servico.tipo_id'
            )
            .where('servico.cont_id', servicoAtual.cont_id)
            .where('servico.serv_status', 'aberto')
            .modify(await filtroLiberados())
            .whereNot('servico.serv_id', req.params.id)
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_qtd_dias',
                'servico.serv_data_criacao',
                'tipo_servico.tipo_nome as categoria'
            )
            .orderBy('servico.serv_data_criacao', 'desc')

        return res.json({ projetos })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao buscar outros serviços.'
        })
    }
}

/* Projetos parecidos: mesma categoria, abertos, de outros contratantes (os mais novos primeiro) */
export const listarParecidos = async (req, res) => {
    try {
        const atual = await db('servico').select('serv_id', 'tipo_id', 'cont_id').where('serv_id', req.params.id).first()

        if (!atual) {
            return res.status(404).json({ erro: 'Projeto não encontrado.' })
        }

        const comPrazo = await temColuna('servico', 'serv_candidaturas_ate')

        const projetos = await db('servico')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('servico.tipo_id', atual.tipo_id)
            .whereNot('servico.cont_id', atual.cont_id)
            .whereNot('servico.serv_id', atual.serv_id)
            .where('servico.serv_status', 'aberto')
            .modify(await filtroLiberados())
            .where('usuario.status_conta', 'ativa')
            .modify((q) => {
                if (comPrazo) q.where((s) => s.whereNull('servico.serv_candidaturas_ate').orWhere('servico.serv_candidaturas_ate', '>=', db.raw('CURDATE()')))
            })
            .select(
                'servico.serv_id',
                'tipo_servico.tipo_nome as categoria',
                'servico.serv_titulo',
                'servico.serv_desc',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_qtd_dias',
                'servico.serv_data_criacao',
                'usuario.usu_nome as contratante_nome'
            )
            .orderBy('servico.serv_id', 'desc')
            .limit(4)

        return res.json({ projetos })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar projetos parecidos.' })
    }
}
