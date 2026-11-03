import db from '../config/knex.js'
import { enviarEmail } from '../services/email.js'
import { enviarPush } from '../services/push.js'
import { sincronizarInsignias, resumoFreelancer, listarAvaliacoesRecebidas, avaliacaoVisivel } from '../services/gamificacao.js'
import { verificacao, tempoResposta } from '../services/confianca.js'
import { aparenciaUm } from '../services/aparencia.js'
import { registrarVisita } from '../services/visitas.js'
import crypto from 'crypto'
import { temColuna, temTabela } from '../services/registro.js'
import { mediasPorCriterio } from '../services/reputacao.js'

/*
 * Dados de verdade para a home pública (não precisa de login).
 * Nomes saem só com o primeiro nome e a inicial do sobrenome, e nada de e-mail, telefone ou foto.
 */

/* "Ana Paula Freitas" -> "Ana F." */
export function nomeCurto(nome) {
    const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return 'Usuário'
    if (partes.length === 1) return partes[0]
    return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`
}

/*
 * Depoimentos da home: avaliações de verdade, deixadas ao final de projetos concluídos,
 * com nota 4 ou 5 e comentário de pelo menos 20 letras. Também devolve a média geral do site.
 */
export const depoimentos = async (req, res) => {
    try {
        const [linhas, [geral]] = await Promise.all([
            db('avaliacao as a')
                .join('usuario as autor', 'a.usu_avaliador', 'autor.usu_id')
                .join('usuario as alvo', 'a.usu_avaliado', 'alvo.usu_id')
                .join('servico as s', 'a.serv_id', 's.serv_id')
                .join('tipo_servico as t', 's.tipo_id', 't.tipo_id')
                .leftJoin('freelancer as fa', 'fa.usu_id', 'autor.usu_id')
                .leftJoin('freelancer as fv', 'fv.usu_id', 'alvo.usu_id')
                .whereNotNull('a.aval_comentario')
                .whereRaw(avaliacaoVisivel('a'))
                .where('a.aval_nota', '>=', 4)
                .whereRaw('CHAR_LENGTH(a.aval_comentario) >= 20')
                .where('autor.status_conta', 'ativa')
                .where('alvo.status_conta', 'ativa')
                .orderBy('a.aval_data', 'desc')
                .limit(8)
                .select(
                    'a.aval_id',
                    'a.aval_nota',
                    'a.aval_comentario',
                    'a.aval_data',
                    'autor.usu_nome as autor_nome',
                    'alvo.usu_nome as alvo_nome',
                    't.tipo_nome as categoria',
                    'fa.free_id as autor_free_id',
                    'fa.free_nivel as autor_nivel',
                    'fv.free_nivel as alvo_nivel'
                ),
            db('avaliacao').whereRaw(avaliacaoVisivel()).avg('aval_nota as media').count('aval_id as total'),
        ])

        return res.json({
            media: geral?.media === null || geral?.media === undefined ? null : Number(Number(geral.media).toFixed(1)),
            total: Number(geral?.total ?? 0),
            depoimentos: linhas.map((l) => {
                const autorFreelancer = l.autor_free_id !== null
                return {
                    id: l.aval_id,
                    nota: l.aval_nota,
                    texto: l.aval_comentario.trim(),
                    data: l.aval_data,
                    categoria: l.categoria,
                    autor: nomeCurto(l.autor_nome),
                    papel: autorFreelancer ? 'freelancer' : 'contratante',
                    nivel: autorFreelancer ? l.autor_nivel : null,
                    sobre: nomeCurto(l.alvo_nome),
                    sobre_nivel: autorFreelancer ? null : l.alvo_nivel,
                }
            }),
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar os depoimentos.' })
    }
}

/* Contato da home: no máximo 3 mensagens a cada 10 minutos por endereço, para ninguém lotar o sino dos admins */
const JANELA_CONTATO = 10 * 60_000
const MAX_CONTATOS = 3
const contatosPorIp = new Map()

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/*
 * Formulário "Entre em contato": a mensagem chega no sino (e no celular) de todos os administradores
 * e, com e-mail configurado no servidor, também na caixa de entrada deles (com resposta direto para quem escreveu).
 */
export const contato = async (req, res) => {
    try {
        const nome = String(req.body?.nome ?? '').trim().slice(0, 120)
        const email = String(req.body?.email ?? '').trim().slice(0, 200)
        const assunto = String(req.body?.assunto ?? '').trim().slice(0, 120)
        const mensagem = String(req.body?.mensagem ?? '').trim().slice(0, 2000)

        if (!nome || !assunto || mensagem.length < 10) {
            return res.status(400).json({ erro: 'Preencha nome, assunto e uma mensagem de pelo menos 10 letras.' })
        }
        if (!EMAIL_VALIDO.test(email)) return res.status(400).json({ erro: 'Confira o e-mail: é por ele que vamos responder.' })

        const agora = Date.now()
        const recentes = (contatosPorIp.get(req.ip) ?? []).filter((t) => agora - t < JANELA_CONTATO)
        if (recentes.length >= MAX_CONTATOS) {
            return res.status(429).json({ erro: 'Você já mandou algumas mensagens agora. Espere uns minutos e tente de novo.' })
        }
        contatosPorIp.set(req.ip, [...recentes, agora])

        const admins = await db('usuario')
            .where({ tipo_usuario: 'administrador', status_conta: 'ativa' })
            .select('usu_id', 'usu_email')

        if (admins.length > 0) {
            const titulo = 'Mensagem de contato'
            const resumo = `${nome} (${email}) — ${assunto}: ${mensagem.slice(0, 300)}${mensagem.length > 300 ? '…' : ''}`
            await db('notificacao').insert(admins.map((a) => ({ usu_id: a.usu_id, not_titulo: titulo, not_desc: resumo })))
            await enviarPush(admins.map((a) => a.usu_id), { titulo, texto: `${nome}: ${assunto}`, url: '/administrador' })

            const destinos = process.env.CONTATO_EMAIL || admins.map((a) => a.usu_email).filter(Boolean).join(',')
            if (destinos) {
                await enviarEmail({
                    para: destinos,
                    assunto: `[Contato] ${assunto}`,
                    texto: `Mensagem enviada pela home do ContrateJá\n\nDe: ${nome} <${email}>\nAssunto: ${assunto}\n\n${mensagem}\n\nResponda para: ${email}`,
                }).catch((erro) => console.error('[contato] e-mail não enviado:', erro))
            }
        }

        return res.status(201).json({ mensagem: 'Mensagem enviada! Vamos responder no seu e-mail.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Não foi possível enviar a mensagem agora.' })
    }
}

/*
 * Perfil público do freelancer: o link que ele divulga (/p/:id).
 * Só contas ativas; sai o que já aparece para contratantes, sem e-mail nem telefone,
 * e quem avaliou aparece com nome curto e sem foto.
 */
export const perfilFreelancer = async (req, res) => {
    try {
        const usuId = Number(req.params.usuId)

        if (!Number.isInteger(usuId) || usuId <= 0) {
            return res.status(404).json({ erro: 'Perfil não encontrado.' })
        }

        const perfil = await db('usuario')
            .join('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
            .where('usuario.usu_id', usuId)
            .where('usuario.status_conta', 'ativa')
            .select(
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_desc',
                'usuario.usu_cid',
                'usuario.usu_est',
                'usuario.usu_foto',
                'usuario.data_criacao',
                'freelancer.free_id'
            )
            .first()

        if (!perfil) {
            return res.status(404).json({ erro: 'Perfil não encontrado.' })
        }

        const [resumo, insignias, avaliacoes, areas, portfolio, selo, resposta, aparencia] = await Promise.all([
            resumoFreelancer(perfil.free_id),
            sincronizarInsignias(perfil.free_id),
            listarAvaliacoesRecebidas(usuId, 6),
            db('freelancer_tipo_servico')
                .join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id')
                .where('freelancer_tipo_servico.free_id', perfil.free_id)
                .pluck('tipo_servico.tipo_nome'),
            db('portfolio')
                .where('free_id', perfil.free_id)
                .select('port_id', 'port_titulo', 'port_desc', 'port_link', 'port_img', ...((await temColuna('portfolio', 'port_serv_id')) ? ['port_serv_id'] : []))
                .orderBy('port_id', 'desc')
                .limit(12),
            verificacao(usuId),
            tempoResposta(usuId),
            aparenciaUm(usuId)
        ])
        const criterios = await mediasPorCriterio(usuId)

        const { free_id: _f, ...dados } = perfil

        await registrarVisita(usuId, { req, origem: 'publico' })

        return res.json({
            perfil: dados,
            resumo,
            areas,
            portfolio,
            verificado: selo.verificado,
            tempo_resposta: resposta,
            criterios,
            ...aparencia,
            insignias: insignias.filter((i) => i.conquistada).map(({ codigo, nome, descricao }) => ({ codigo, nome, descricao })),
            avaliacoes: avaliacoes.map(({ avaliador_foto: _foto, avaliador_nome, ...a }) => ({ ...a, avaliador_nome: nomeCurto(avaliador_nome) }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o perfil.' })
    }
}

/* Código curto que prova que o certificado saiu daqui (muda se alguém trocar o número do projeto) */
export const codigoCertificado = (serv_id) =>
    crypto.createHmac('sha256', String(process.env.JWT_SECRET ?? 'contrateja')).update(`certificado:${serv_id}`).digest('hex').slice(0, 8).toUpperCase()

/*
 * Certificado de conclusão (/certificado/:id): só projetos finalizados, com o nome do freelancer,
 * o nome curto do cliente, a data e a nota que o cliente deu. Qualquer pessoa com o link vê.
 */
export const certificado = async (req, res) => {
    try {
        const servId = Number(req.params.servId)
        if (!Number.isInteger(servId) || servId <= 0) return res.status(404).json({ erro: 'Certificado não encontrado.' })

        const s = await db('servico')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario as cont', 'contratante.usu_id', 'cont.usu_id')
            .join('candidatura', function () {
                this.on('candidatura.serv_id', 'servico.serv_id').andOn('candidatura.cand_status', db.raw('?', ['aceita']))
            })
            .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
            .join('usuario as free', 'freelancer.usu_id', 'free.usu_id')
            .where('servico.serv_id', servId)
            .where('servico.serv_status', 'finalizado')
            .where('free.status_conta', 'ativa')
            .select(
                'servico.serv_id', 'servico.serv_titulo', 'tipo_servico.tipo_nome as categoria', 'servico.serv_data_criacao',
                'cont.usu_id as cliente_id', 'cont.usu_nome as cliente_nome',
                'free.usu_id as freelancer_id', 'free.usu_nome as freelancer_nome', 'freelancer.free_nivel'
            )
            .first()

        if (!s) return res.status(404).json({ erro: 'Certificado não encontrado.' })

        const [finalizado, avaliacao] = await Promise.all([
            db('servico').where('serv_id', servId).first().then((x) => x?.serv_finalizado_em ?? null),
            db('avaliacao').where({ serv_id: servId, usu_avaliador: s.cliente_id, usu_avaliado: s.freelancer_id }).whereRaw(avaliacaoVisivel()).select('aval_nota').first()
        ])

        return res.json({
            certificado: {
                serv_id: s.serv_id,
                titulo: s.serv_titulo,
                categoria: s.categoria,
                freelancer: s.freelancer_nome,
                freelancer_id: s.freelancer_id,
                nivel: s.free_nivel,
                cliente: nomeCurto(s.cliente_nome),
                concluido_em: finalizado ?? s.serv_data_criacao,
                nota: avaliacao?.aval_nota ?? null,
                codigo: codigoCertificado(s.serv_id)
            }
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o certificado.' })
    }
}

/*
 * Mural do reino: o que aconteceu no castelo nos últimos 30 dias, sem dados pessoais
 * (nome curto, nunca título de projeto nem valores). Quem escondeu o perfil da busca aparece como "Alguém".
 */
export const mural = async (req, res) => {
    try {
        const desde = new Date(Date.now() - 30 * 86_400_000)
        const comBusca = await temColuna('usuario', 'usu_aparecer_busca')
        const nomeDe = (u) => (comBusca && !u.usu_aparecer_busca ? 'Alguém' : nomeCurto(u.usu_nome))
        const itens = []

        if (await temTabela('guilda')) {
            const guildas = await db('guilda').where('gui_criada', '>=', desde).select('gui_nome', 'gui_brasao', 'gui_cor', 'gui_criada').orderBy('gui_criada', 'desc').limit(10)
            for (const g of guildas) itens.push({ tipo: 'guilda', data: g.gui_criada, texto: `A guilda ${g.gui_nome} foi fundada.`, brasao: g.gui_brasao, cor: g.gui_cor })
        }

        if (await temTabela('teste_habilidade')) {
            const testes = await db('teste_habilidade')
                .join('usuario', 'teste_habilidade.usu_id', 'usuario.usu_id')
                .join('tipo_servico', 'teste_habilidade.tipo_id', 'tipo_servico.tipo_id')
                .where('teste_habilidade.tes_aprovado_em', '>=', desde)
                .where('usuario.status_conta', 'ativa')
                .select('usuario.usu_nome', ...(comBusca ? ['usuario.usu_aparecer_busca'] : []), 'tipo_servico.tipo_nome', 'teste_habilidade.tes_aprovado_em')
                .orderBy('teste_habilidade.tes_aprovado_em', 'desc')
                .limit(10)
            for (const t of testes) itens.push({ tipo: 'teste', data: t.tes_aprovado_em, texto: `${nomeDe(t)} passou no teste de ${t.tipo_nome}.` })
        }

        const insignias = await db('freelancer_insignia')
            .join('freelancer', 'freelancer_insignia.free_id', 'freelancer.free_id')
            .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
            .join('insignia', 'freelancer_insignia.ins_id', 'insignia.ins_id')
            .where('freelancer_insignia.freeins_data', '>=', desde)
            .where('usuario.status_conta', 'ativa')
            .select('usuario.usu_nome', ...(comBusca ? ['usuario.usu_aparecer_busca'] : []), 'insignia.ins_nome', 'freelancer_insignia.freeins_data')
            .orderBy('freelancer_insignia.freeins_data', 'desc')
            .limit(10)
        for (const i of insignias) itens.push({ tipo: 'insignia', data: i.freeins_data, texto: `${nomeDe(i)} conquistou a insígnia ${i.ins_nome}.` })

        if (await temColuna('servico', 'serv_finalizado_em')) {
            const concluidos = await db('servico')
                .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
                .where('servico.serv_status', 'finalizado')
                .where('servico.serv_finalizado_em', '>=', desde)
                .select('tipo_servico.tipo_nome', 'servico.serv_finalizado_em')
                .orderBy('servico.serv_finalizado_em', 'desc')
                .limit(10)
            for (const s of concluidos) itens.push({ tipo: 'projeto', data: s.serv_finalizado_em, texto: `Um projeto de ${s.tipo_nome} foi concluído.` })
        }

        const [{ total }] = await db('usuario').where('data_criacao', '>=', new Date(Date.now() - 7 * 86_400_000)).count('* as total')
        if (Number(total) > 0) {
            itens.push({ tipo: 'chegada', data: new Date(), texto: Number(total) === 1 ? '1 pessoa chegou ao castelo esta semana.' : `${total} pessoas chegaram ao castelo esta semana.` })
        }

        itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        return res.json({ itens: itens.slice(0, 25) })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar o mural.' })
    }
}
