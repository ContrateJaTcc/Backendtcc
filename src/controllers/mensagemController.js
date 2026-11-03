import db from '../config/knex.js'
import { avisar, esperarAviso } from '../services/tempoReal.js'
import { temColuna, temTabela } from '../services/registro.js'
import { enviarPush } from '../services/push.js'
import { etapasDosProjetos } from './etapaController.js'
import { liberarConquista } from './conquistaController.js'
import { disputasAbertas } from './contratacaoController.js'
import { avaliacaoVisivel } from '../services/gamificacao.js'
import { temContatoExterno } from '../services/contatoExterno.js'
import { colunasPresenca, vistoDe, vistoDoUsuario } from '../services/presenca.js'
import { bloqueados, ERRO_BLOQUEIO } from '../services/bloqueio.js'
import { dentroDoHorario, lerHorarios } from './relacaoController.js'

/* Imagem no chat: data URI já comprimida no navegador (até ~200 KB) */
const LIMITE_IMAGEM = 200_000
const ehImagem = (v) => /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)

/* PDF no chat: data URI de até ~2 MB (o arquivo em si, uns 1,5 MB) */
const LIMITE_ARQUIVO = 2_100_000
const LIMITE_NOME_ARQUIVO = 120
const ehPdf = (v) => /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(v)

/* Colunas da mensagem (imagem e arquivo só existem depois das migrações).
   O PDF não vai na lista: só o nome; o conteúdo sai em /mensagens/arquivo/:id */
async function colunasMensagem(extra = []) {
    const base = ['msg_id', ...extra, 'usu_remetente', 'usu_destinatario', 'msg_texto', 'msg_data', 'msg_lida']
    if (await temColuna('mensagem', 'msg_imagem')) base.push('msg_imagem')
    if (await temColuna('mensagem', 'msg_arquivo')) base.push('msg_arquivo_nome')
    if (await temColuna('mensagem', 'msg_proposta_valor')) base.push('msg_proposta_valor', 'msg_proposta_prazo', 'msg_proposta_status')
    if (await temColuna('mensagem', 'msg_reuniao_em')) base.push('msg_reuniao_em', 'msg_reuniao_link', 'msg_reuniao_status', 'msg_alerta_contato')
    if (await temColuna('mensagem', 'msg_resposta_id')) base.push('msg_resposta_id')
    return base
}

/* "Maria S.": antes da contratação, o chat mostra só o primeiro nome e a inicial (para os dois lados) */
const nomeAnonimo = (nome) => {
    const [primeiro, segundo] = String(nome ?? 'Usuário').split(' ')
    return segundo ? `${primeiro} ${segundo[0]}.` : primeiro
}

/* O freelancer da conversa já foi contratado neste projeto? (antes disso, contato por fora ganha aviso) */
async function jaContratado(serv_id, usuA, usuB) {
    const aceita = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('candidatura.serv_id', serv_id)
        .where('candidatura.cand_status', 'aceita')
        .whereIn('freelancer.usu_id', [usuA, usuB])
        .first()
    return Boolean(aceita)
}

/* Mensagens */

/* Permissão */
async function podeConversar(usuarioId, servId) {
    const servico = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .where('servico.serv_id', servId)
        .select('servico.serv_id', 'contratante.usu_id as dono_usu_id')
        .first()

    if (!servico) return { ok: false, motivo: 'Projeto não encontrado.' }

    if (servico.dono_usu_id === usuarioId) {
        return { ok: true, servico, ehDono: true }
    }

    const candidatura = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('candidatura.serv_id', servId)
        .where('freelancer.usu_id', usuarioId)
        .select('candidatura.cand_id')
        .first()

    if (candidatura) return { ok: true, servico, ehDono: false }

    return { ok: false, motivo: 'Você não participa deste projeto.' }
}

/* Conversas */
export const listarConversas = async (req, res) => {
    try {
        const meuId = req.usuario.id

        const mensagens = await db('mensagem')
            .join('servico', 'mensagem.serv_id', 'servico.serv_id')
            .where('mensagem.usu_remetente', meuId)
            .orWhere('mensagem.usu_destinatario', meuId)
            .select(
                'mensagem.msg_id',
                'mensagem.serv_id',
                'mensagem.usu_remetente',
                'mensagem.usu_destinatario',
                'mensagem.msg_texto',
                'mensagem.msg_data',
                'mensagem.msg_lida',
                'servico.serv_titulo'
            )
            .orderBy('mensagem.msg_id', 'desc')

        /* Agrupar */
        const porChave = new Map()

        for (const m of mensagens) {
            const outroId =
                m.usu_remetente === meuId ? m.usu_destinatario : m.usu_remetente
            const chave = m.serv_id + ':' + outroId

            if (!porChave.has(chave)) {
                porChave.set(chave, {
                    serv_id: m.serv_id,
                    serv_titulo: m.serv_titulo,
                    outro_usu_id: outroId,
                    ultima_mensagem: m.msg_texto || 'Imagem',
                    ultima_data: m.msg_data,
                    nao_lidas: 0
                })
            }

            /* Não lidas */
            if (!m.msg_lida && m.usu_destinatario === meuId) {
                porChave.get(chave).nao_lidas += 1
            }
        }

        const conversas = [...porChave.values()]

        /* Nomes */
        if (conversas.length > 0) {
            const usuarios = await db('usuario')
                .whereIn('usu_id', conversas.map((c) => c.outro_usu_id))
                .select('usu_id', 'usu_nome', 'usu_foto', ...(await colunasPresenca()))

            const porId = new Map(usuarios.map((u) => [u.usu_id, u]))

            /* Quem já foi contratado em cada projeto (aí o nome aparece inteiro) */
            const contratados = await db('candidatura')
                .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
                .whereIn('candidatura.serv_id', [...new Set(conversas.map((c) => c.serv_id))])
                .where('candidatura.cand_status', 'aceita')
                .select('candidatura.serv_id', 'freelancer.usu_id')
            const contratadoEm = new Set(contratados.map((x) => `${x.serv_id}:${x.usu_id}`))

            for (const c of conversas) {
                const u = porId.get(c.outro_usu_id)
                const contratado = contratadoEm.has(`${c.serv_id}:${c.outro_usu_id}`) || contratadoEm.has(`${c.serv_id}:${req.usuario.id}`)
                c.outro_nome = u ? (contratado ? u.usu_nome : nomeAnonimo(u.usu_nome)) : 'Usuário'
                c.anonimo = !contratado
                c.outro_foto = u ? u.usu_foto : null
                c.outro_visto_em = vistoDe(u)
            }
        }

        return res.json({ conversas })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao listar conversas.'
        })
    }
}

/* Mensagens */
export const listarMensagens = async (req, res) => {
    try {
        const meuId = req.usuario.id
        const { servId, outroId } = req.params

        const permissao = await podeConversar(meuId, servId)

        if (!permissao.ok) {
            return res.status(403).json({ erro: permissao.motivo })
        }

        const mensagens = await db('mensagem')
            .where('serv_id', servId)
            .where((q) => {
                q.where((a) => {
                    a.where('usu_remetente', meuId).andWhere('usu_destinatario', outroId)
                }).orWhere((b) => {
                    b.where('usu_remetente', outroId).andWhere('usu_destinatario', meuId)
                })
            })
            .select(await colunasMensagem())
            .orderBy('msg_id', 'asc')

        /* Marcar lidas */
        await db('mensagem')
            .where('serv_id', servId)
            .where('usu_remetente', outroId)
            .where('usu_destinatario', meuId)
            .where('msg_lida', false)
            .update({ msg_lida: true })

        return res.json({ mensagens })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar mensagens.'
        })
    }
}

/* Enviar */
export const enviarMensagem = async (req, res) => {
    try {
        const { serv_id, destinatario_id } = req.body
        const texto = String(req.body.texto ?? '').trim()
        const imagem = req.body.imagem ? String(req.body.imagem) : null
        const arquivo = req.body.arquivo ? String(req.body.arquivo) : null
        const nomeArquivo = String(req.body.arquivo_nome ?? 'arquivo.pdf').trim().slice(0, LIMITE_NOME_ARQUIVO) || 'arquivo.pdf'

        if (!serv_id || !destinatario_id || (!texto && !imagem && !arquivo)) {
            return res.status(400).json({
                erro: 'Informe o projeto, o destinatário e o texto.'
            })
        }

        if (imagem && (!ehImagem(imagem) || imagem.length > LIMITE_IMAGEM)) {
            return res.status(400).json({ erro: 'Imagem inválida ou grande demais.' })
        }

        if (imagem && !(await temColuna('mensagem', 'msg_imagem'))) {
            return res.status(503).json({ erro: 'Envio de imagens ainda não disponível.' })
        }

        if (arquivo && (!ehPdf(arquivo) || arquivo.length > LIMITE_ARQUIVO)) {
            return res.status(400).json({ erro: 'Envie um PDF de até 1,5 MB.' })
        }

        if (arquivo && !(await temColuna('mensagem', 'msg_arquivo'))) {
            return res.status(503).json({ erro: 'Envio de arquivos ainda não disponível.' })
        }

        if (Number(destinatario_id) === Number(req.usuario.id)) {
            return res.status(400).json({
                erro: 'Você não pode enviar mensagem para si mesmo.'
            })
        }

        const permissao = await podeConversar(req.usuario.id, serv_id)

        if (!permissao.ok) {
            return res.status(403).json({ erro: permissao.motivo })
        }

        if (await bloqueados(req.usuario.id, Number(destinatario_id))) {
            return res.status(403).json({ erro: ERRO_BLOQUEIO })
        }

        /* Responder citando: a mensagem citada precisa ser desta conversa */
        let resposta = null
        if (req.body.resposta_id && (await temColuna('mensagem', 'msg_resposta_id'))) {
            const citada = await db('mensagem').where('msg_id', Number(req.body.resposta_id)).where('serv_id', serv_id).select('msg_id', 'usu_remetente', 'usu_destinatario').first()
            const mesmaConversa = citada && [citada.usu_remetente, citada.usu_destinatario].includes(Number(req.usuario.id)) && [citada.usu_remetente, citada.usu_destinatario].includes(Number(destinatario_id))
            if (!mesmaConversa) return res.status(400).json({ erro: 'A mensagem citada não é desta conversa.' })
            resposta = citada.msg_id
        }

        /* Telefone, e-mail ou "me chama no zap" antes da contratação: vai, mas com aviso para quem recebe */
        const alerta = temContatoExterno(texto) && (await temColuna('mensagem', 'msg_alerta_contato')) && !(await jaContratado(serv_id, Number(req.usuario.id), Number(destinatario_id)))

        const [msg_id] = await db('mensagem').insert({
            serv_id,
            usu_remetente: req.usuario.id,
            usu_destinatario: destinatario_id,
            msg_texto: texto,
            ...(imagem ? { msg_imagem: imagem } : {}),
            ...(arquivo ? { msg_arquivo: arquivo, msg_arquivo_nome: nomeArquivo } : {}),
            ...(alerta ? { msg_alerta_contato: true } : {}),
            ...(resposta ? { msg_resposta_id: resposta } : {})
        })

        /* Coruja noturna: mensagem entre meia-noite e 5h, no horário de Brasília */
        const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()))
        if (hora < 5) await liberarConquista(Number(req.usuario.id), 'coruja').catch((erro) => console.error(erro))

        /* Acorda quem está esperando (remetente e destinatário) */
        avisar(Number(req.usuario.id), Number(destinatario_id))

        /* Aviso no celular de quem recebe */
        const remetente = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const destino = await db('usuario').where('usu_id', destinatario_id).select('tipo_usuario').first()
        await enviarPush(Number(destinatario_id), {
            titulo: `Mensagem de ${remetente?.usu_nome ?? 'alguém'}`,
            texto: texto ? texto.slice(0, 120) : arquivo ? `Mandou o arquivo ${nomeArquivo}.` : 'Mandou uma imagem.',
            url: destino ? `/${destino.tipo_usuario}/mensagens` : '/'
        })

        return res.status(201).json({
            mensagem: 'Mensagem enviada!',
            msg_id,
            alerta_contato: alerta
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao enviar mensagem.'
        })
    }
}

/* Baixar o PDF de uma mensagem: só quem mandou ou recebeu */
export const baixarArquivo = async (req, res) => {
    try {
        if (!(await temColuna('mensagem', 'msg_arquivo'))) {
            return res.status(404).json({ erro: 'Arquivo não encontrado.' })
        }

        const msg = await db('mensagem')
            .where('msg_id', req.params.msgId)
            .where((q) => q.where('usu_remetente', req.usuario.id).orWhere('usu_destinatario', req.usuario.id))
            .whereNotNull('msg_arquivo')
            .select('msg_arquivo', 'msg_arquivo_nome')
            .first()

        if (!msg) {
            return res.status(404).json({ erro: 'Arquivo não encontrado.' })
        }

        return res.json({ arquivo: msg.msg_arquivo, nome: msg.msg_arquivo_nome })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao baixar o arquivo.' })
    }
}

/* Tempo real (long polling) */
/* Abaixo do limite de 10 s das funções da Vercel */
const ESPERA_MAXIMA = 8000
/* Outras instâncias não recebem o aviso em memória: confere o banco */
const CONFERIR_BANCO = 1500

const minhas = (meuId) => (q) => q.where('usu_remetente', meuId).orWhere('usu_destinatario', meuId)

export const aguardarMensagens = async (req, res) => {
    try {
        const meuId = req.usuario.id

        /* Sem 'desde': só informa o ponto de partida */
        if (req.query.desde === undefined) {
            const linha = await db('mensagem').where(minhas(meuId)).max('msg_id as ultimo').first()
            return res.json({ mensagens: [], ultimo: Number(linha?.ultimo) || 0 })
        }

        const desde = Number(req.query.desde)

        if (!Number.isInteger(desde) || desde < 0) {
            return res.status(400).json({ erro: 'Parâmetro desde inválido.' })
        }

        let fechou = false
        res.on('close', () => {
            fechou = true
        })

        const limite = Date.now() + ESPERA_MAXIMA

        /* Segura a resposta até chegar mensagem nova ou o tempo acabar */
        while (!fechou) {
            const mensagens = await db('mensagem')
                .where('msg_id', '>', desde)
                .where(minhas(meuId))
                .select(await colunasMensagem(['serv_id']))
                .orderBy('msg_id', 'asc')
                .limit(50)

            const resta = limite - Date.now()

            if (mensagens.length > 0 || resta <= 0) {
                return res.json({
                    mensagens,
                    ultimo: mensagens.length > 0 ? mensagens[mensagens.length - 1].msg_id : desde
                })
            }

            await esperarAviso(meuId, Math.min(CONFERIR_BANCO, resta))
        }
    } catch (erro) {
        console.error(erro)

        if (!res.headersSent) {
            return res.status(500).json({ erro: 'Erro ao aguardar mensagens.' })
        }
    }
}

/* Histórico */
export const listarHistorico = async (req, res) => {
    try {
        const ENCERRADOS = ['finalizado', 'cancelado', 'em_andamento']
        /* Linha do tempo: as datas novas só existem depois da migração */
        const datas = (await temColuna('servico', 'serv_contratado_em'))
            ? ['servico.serv_contratado_em', 'servico.serv_finalizado_em']
            : []
        /* Acordo, garantia e ajustes (depois da migração da contratação) */
        if (await temColuna('servico', 'serv_acordo_cont_em')) {
            datas.push(
                'servico.serv_acordo_cont_em',
                'servico.serv_acordo_free_em',
                'servico.serv_garantia_valor',
                'servico.serv_garantia_em',
                'servico.serv_garantia_liberada_em',
                'servico.serv_garantia_estornada_em',
                'servico.serv_revisoes',
                'servico.serv_revisao_nota'
            )
        }
        /* Bônus dado no fim do projeto */
        if (await temColuna('servico', 'serv_bonus_valor')) datas.push('servico.serv_bonus_valor', 'servico.serv_bonus_em')
        /* Pausa do prazo (pausaController) */
        if (await temColuna('servico', 'serv_pausado_em')) datas.push('servico.serv_pausa_pedida_por', 'servico.serv_pausa_motivo', 'servico.serv_pausado_em', 'servico.serv_pausa_dias')
        /* Projeto recorrente e trabalho de amostra */
        if (await temColuna('servico', 'serv_repetir')) datas.push('servico.serv_repetir', 'servico.serv_repetir_em', 'servico.serv_amostra_de')
        const comPortfolio = await temColuna('portfolio', 'port_serv_id')
        /* Etapas, disputa aberta, se já virou portfólio e a nota que cada um recebeu no projeto */
        const comEtapas = async (itens) => {
            const ids = itens.map((i) => i.serv_id)
            const [etapas, disputas, notas, noPortfolio] = await Promise.all([
                etapasDosProjetos(ids),
                disputasAbertas(ids),
                ids.length ? db('avaliacao').whereIn('serv_id', ids).where('usu_avaliado', req.usuario.id).whereRaw(avaliacaoVisivel()).select('serv_id', 'aval_nota') : [],
                comPortfolio && ids.length ? db('portfolio').whereIn('port_serv_id', ids).select('port_serv_id') : []
            ])
            const notaPorProjeto = new Map(notas.map((n) => [n.serv_id, n.aval_nota]))
            const portfolio = new Set(noPortfolio.map((p) => p.port_serv_id))
            return itens.map((i) => ({
                ...i,
                etapas: etapas[i.serv_id] ?? [],
                disputa: disputas[i.serv_id] ?? null,
                nota_recebida: notaPorProjeto.get(i.serv_id) ?? null,
                no_portfolio: portfolio.has(i.serv_id)
            }))
        }

        if (req.usuario.tipo === 'contratante') {
            const contratante = await db('contratante')
                .select('cont_id')
                .where('usu_id', req.usuario.id)
                .first()

            if (!contratante) {
                return res.status(404).json({ erro: 'Contratante não encontrado.' })
            }

            const itens = await db('servico')
                .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
                .where('servico.cont_id', contratante.cont_id)
                .whereIn('servico.serv_status', ENCERRADOS)
                .select(
                    'servico.serv_id',
                    'servico.serv_titulo',
                    'servico.serv_desc',
                    'tipo_servico.tipo_nome as categoria',
                    'servico.serv_valor',
                    'servico.serv_tipo_valor',
                    'servico.serv_status',
                    'servico.serv_data_criacao',
                    'servico.serv_entregue_em',
                    'servico.serv_entrega_nota',
                    'servico.serv_qtd_dias',
                    ...datas,
                    /* Freelancer */
                    db.raw(`(
                        SELECT u.usu_id FROM candidatura c
                        JOIN freelancer f ON f.free_id = c.free_id
                        JOIN usuario u ON u.usu_id = f.usu_id
                        WHERE c.serv_id = servico.serv_id AND c.cand_status = 'aceita'
                        ORDER BY c.cand_id LIMIT 1
                    ) AS outro_usu_id`),
                    db.raw(`(
                        SELECT u.usu_nome FROM candidatura c
                        JOIN freelancer f ON f.free_id = c.free_id
                        JOIN usuario u ON u.usu_id = f.usu_id
                        WHERE c.serv_id = servico.serv_id AND c.cand_status = 'aceita'
                        ORDER BY c.cand_id LIMIT 1
                    ) AS outro_nome`)
                )
                .orderBy('servico.serv_id', 'desc')

            return res.json({ itens: await comEtapas(itens) })
        }

        const freelancer = await db('freelancer')
            .select('free_id')
            .where('usu_id', req.usuario.id)
            .first()

        if (!freelancer) {
            return res.status(404).json({ erro: 'Freelancer não encontrado.' })
        }

        const itens = await db('candidatura')
            .join('servico', 'candidatura.serv_id', 'servico.serv_id')
            .join('tipo_servico', 'servico.tipo_id', 'tipo_servico.tipo_id')
            .join('contratante', 'servico.cont_id', 'contratante.cont_id')
            .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
            .where('candidatura.free_id', freelancer.free_id)
            .where('candidatura.cand_status', 'aceita')
            .whereIn('servico.serv_status', ENCERRADOS)
            .select(
                'servico.serv_id',
                'servico.serv_titulo',
                'servico.serv_desc',
                'tipo_servico.tipo_nome as categoria',
                'servico.serv_valor',
                'servico.serv_tipo_valor',
                'servico.serv_status',
                'servico.serv_data_criacao',
                'servico.serv_entregue_em',
                'servico.serv_entrega_nota',
                'servico.serv_qtd_dias',
                ...datas,
                'usuario.usu_id as outro_usu_id',
                'usuario.usu_nome as outro_nome'
            )
            .orderBy('servico.serv_id', 'desc')

        return res.json({ itens: await comEtapas(itens) })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar histórico.'
        })
    }
}

/* Contatos */
export const listarContatos = async (req, res) => {
    try {
        const ehContratante = req.usuario.tipo === 'contratante'

        const contatos = ehContratante
            ? await db('candidatura')
                .join('servico', 'candidatura.serv_id', 'servico.serv_id')
                .join('contratante', 'servico.cont_id', 'contratante.cont_id')
                .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
                .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
                .where('contratante.usu_id', req.usuario.id)
                .whereNot('candidatura.cand_status', 'cancelada')
                .select(
                    'servico.serv_id',
                    'servico.serv_titulo',
                    'usuario.usu_id as outro_usu_id',
                    'usuario.usu_nome as outro_nome',
                    'usuario.usu_foto as outro_foto',
                    'candidatura.cand_status'
                )
                .orderBy('candidatura.cand_id', 'desc')
            : await db('candidatura')
                .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
                .join('servico', 'candidatura.serv_id', 'servico.serv_id')
                .join('contratante', 'servico.cont_id', 'contratante.cont_id')
                .join('usuario', 'contratante.usu_id', 'usuario.usu_id')
                .where('freelancer.usu_id', req.usuario.id)
                .whereNot('candidatura.cand_status', 'cancelada')
                .select(
                    'servico.serv_id',
                    'servico.serv_titulo',
                    'usuario.usu_id as outro_usu_id',
                    'usuario.usu_nome as outro_nome',
                    'usuario.usu_foto as outro_foto',
                    'candidatura.cand_status'
                )
                .orderBy('candidatura.cand_id', 'desc')

        return res.json({ contatos })
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar contatos.' })
    }
}

/* ---------- Proposta de valor/prazo dentro da conversa ---------- */

const reais = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

/* Projeto da conversa com o dono e, se for o caso, a candidatura do freelancer */
async function contextoDaProposta(serv_id, usuA, usuB) {
    const s = await db('servico')
        .join('contratante', 'servico.cont_id', 'contratante.cont_id')
        .where('servico.serv_id', serv_id)
        .select('servico.serv_id', 'servico.serv_titulo', 'servico.serv_status', 'servico.serv_valor', 'servico.serv_tipo_valor', 'servico.serv_qtd_dias', 'contratante.usu_id as dono')
        .first()
    if (!s) return null
    const freelancerId = s.dono === usuA ? usuB : usuA
    const cand = await db('candidatura')
        .join('freelancer', 'candidatura.free_id', 'freelancer.free_id')
        .where('candidatura.serv_id', serv_id)
        .where('freelancer.usu_id', freelancerId)
        .whereNot('candidatura.cand_status', 'cancelada')
        .select('candidatura.cand_id', 'candidatura.cand_status')
        .first()
    return { s, freelancerId, cand }
}

export const enviarProposta = async (req, res) => {
    try {
        if (!(await temColuna('mensagem', 'msg_proposta_valor'))) return res.status(503).json({ erro: 'Propostas no chat ainda estão sendo preparadas.' })

        const serv_id = Number(req.body.serv_id)
        const destino = Number(req.body.destinatario_id)
        const valor = req.body.valor === '' || req.body.valor == null ? null : Math.round(Number(req.body.valor) * 100) / 100
        const prazo = req.body.prazo === '' || req.body.prazo == null ? null : Number(req.body.prazo)
        const recado = String(req.body.texto ?? '').trim().slice(0, 300)

        if (valor === null && prazo === null) return res.status(400).json({ erro: 'Proponha um valor, um prazo ou os dois.' })
        if (valor !== null && (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000)) return res.status(400).json({ erro: 'Valor inválido.' })
        if (prazo !== null && (!Number.isInteger(prazo) || prazo < 1 || prazo > 365)) return res.status(400).json({ erro: 'O prazo vai de 1 a 365 dias.' })

        const permissao = await podeConversar(req.usuario.id, serv_id)
        if (!permissao.ok) return res.status(403).json({ erro: permissao.motivo })

        if (await bloqueados(req.usuario.id, destino)) return res.status(403).json({ erro: ERRO_BLOQUEIO })
        const ctx = await contextoDaProposta(serv_id, req.usuario.id, destino)
        if (!ctx || ![ctx.s.dono, ctx.freelancerId].includes(destino) || destino === req.usuario.id) return res.status(400).json({ erro: 'Conversa inválida.' })

        const negociavel = ctx.s.serv_status === 'em_andamento' ? ctx.cand?.cand_status === 'aceita' : ctx.s.serv_status === 'aberto' && ctx.cand?.cand_status === 'pendente'
        if (!negociavel) return res.status(400).json({ erro: 'Só dá para propor valor e prazo em candidaturas em análise ou projetos em andamento.' })

        /* Uma proposta valendo por vez: a anterior que ninguém respondeu sai de cena */
        await db('mensagem')
            .where('serv_id', serv_id)
            .where((q) => q.where({ usu_remetente: req.usuario.id, usu_destinatario: destino }).orWhere({ usu_remetente: destino, usu_destinatario: req.usuario.id }))
            .where('msg_proposta_status', 'pendente')
            .update({ msg_proposta_status: 'recusada' })

        const partes = [valor !== null ? `${reais(valor)}${ctx.s.serv_tipo_valor === 'hora' ? '/hora' : ''}` : null, prazo !== null ? `${prazo} ${prazo === 1 ? 'dia' : 'dias'}` : null].filter(Boolean)
        const [msg_id] = await db('mensagem').insert({
            serv_id,
            usu_remetente: req.usuario.id,
            usu_destinatario: destino,
            msg_texto: recado || `Proposta: ${partes.join(' · ')}`,
            msg_proposta_valor: valor,
            msg_proposta_prazo: prazo,
            msg_proposta_status: 'pendente'
        })

        avisar(req.usuario.id, destino)
        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const tipoDestino = destino === ctx.s.dono ? 'contratante' : 'freelancer'
        await db('notificacao').insert({ usu_id: destino, not_titulo: 'Nova proposta', not_desc: `${eu?.usu_nome ?? 'Alguém'} propôs ${partes.join(' e ')} em "${ctx.s.serv_titulo}".` })
        await enviarPush(destino, { titulo: 'Nova proposta', texto: `${partes.join(' · ')} em "${ctx.s.serv_titulo}"`, url: `/${tipoDestino}/mensagens` })

        return res.status(201).json({ mensagem: 'Proposta enviada.', msg_id })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao enviar a proposta.' })
    }
}

/*
 * Quem recebeu responde. Aceitar muda o combinado:
 * - projeto em andamento: o valor e/ou o prazo do projeto;
 * - candidatura em análise: vira a contraproposta da candidatura (vale quando o contratante aceitar).
 */
export const responderProposta = async (req, res) => {
    try {
        if (!(await temColuna('mensagem', 'msg_proposta_valor'))) return res.status(503).json({ erro: 'Propostas no chat ainda estão sendo preparadas.' })

        const acao = req.body.acao === 'aceitar' ? 'aceita' : req.body.acao === 'recusar' ? 'recusada' : null
        if (!acao) return res.status(400).json({ erro: 'Escolha aceitar ou recusar.' })

        const msg = await db('mensagem').where('msg_id', req.params.msgId).first()
        if (!msg || msg.usu_destinatario !== req.usuario.id || !msg.msg_proposta_status) return res.status(404).json({ erro: 'Proposta não encontrada.' })
        if (msg.msg_proposta_status !== 'pendente') return res.status(400).json({ erro: 'Esta proposta já foi respondida.' })

        const ctx = await contextoDaProposta(msg.serv_id, msg.usu_remetente, msg.usu_destinatario)
        let efeito = ''

        if (acao === 'aceita') {
            if (ctx.s.serv_status === 'em_andamento' && ctx.cand?.cand_status === 'aceita') {
                await db('servico').where('serv_id', ctx.s.serv_id).update({
                    ...(msg.msg_proposta_valor !== null ? { serv_valor: msg.msg_proposta_valor } : {}),
                    ...(msg.msg_proposta_prazo !== null ? { serv_qtd_dias: msg.msg_proposta_prazo } : {})
                })
                efeito = ' O projeto foi atualizado com o novo combinado.'
            } else if (ctx.s.serv_status === 'aberto' && ctx.cand?.cand_status === 'pendente') {
                if (await temColuna('candidatura', 'cand_valor_proposto')) {
                    await db('candidatura').where('cand_id', ctx.cand.cand_id).update({
                        ...(msg.msg_proposta_valor !== null ? { cand_valor_proposto: msg.msg_proposta_valor } : {}),
                        ...(msg.msg_proposta_prazo !== null ? { cand_prazo_proposto: msg.msg_proposta_prazo } : {})
                    })
                }
                efeito = ' A candidatura foi atualizada: vale quando o contratante aceitar.'
            } else {
                return res.status(400).json({ erro: 'Esta proposta não vale mais: o projeto mudou de situação.' })
            }
        }

        await db('mensagem').where('msg_id', msg.msg_id).update({ msg_proposta_status: acao })
        avisar(msg.usu_remetente, msg.usu_destinatario)

        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        await db('notificacao').insert({
            usu_id: msg.usu_remetente,
            not_titulo: acao === 'aceita' ? 'Proposta aceita' : 'Proposta recusada',
            not_desc: `${eu?.usu_nome ?? 'A outra pessoa'} ${acao === 'aceita' ? 'aceitou' : 'recusou'} sua proposta em "${ctx.s.serv_titulo}".${acao === 'aceita' ? efeito : ''}`
        })

        return res.json({ mensagem: acao === 'aceita' ? `Proposta aceita.${efeito}` : 'Proposta recusada.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao responder a proposta.' })
    }
}

/* ---------- Reunião marcada pelo chat ---------- */

const ANTECEDENCIA_MINIMA = 15 * 60_000
const ANTECEDENCIA_MAXIMA = 60 * 86_400_000
const LINK_REUNIAO = /^https:\/\/[^\s]{4,290}$/i

const quandoTexto = (data) =>
    new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const marcarReuniao = async (req, res) => {
    try {
        if (!(await temColuna('mensagem', 'msg_reuniao_em'))) return res.status(503).json({ erro: 'Reuniões pelo chat ainda estão sendo preparadas.' })

        const serv_id = Number(req.body.serv_id)
        const destino = Number(req.body.destinatario_id)
        const quando = new Date(String(req.body.quando ?? ''))
        const link = String(req.body.link ?? '').trim()
        const recado = String(req.body.texto ?? '').trim().slice(0, 300)

        if (Number.isNaN(quando.getTime())) return res.status(400).json({ erro: 'Escolha o dia e a hora da reunião.' })
        const falta = quando.getTime() - Date.now()
        if (falta < ANTECEDENCIA_MINIMA) return res.status(400).json({ erro: 'Marque a reunião com pelo menos 15 minutos de antecedência.' })
        if (falta > ANTECEDENCIA_MAXIMA) return res.status(400).json({ erro: 'Dá para marcar reuniões até 60 dias para a frente.' })
        if (link && !LINK_REUNIAO.test(link)) return res.status(400).json({ erro: 'O link da chamada precisa começar com https://' })
        if (!destino || destino === req.usuario.id) return res.status(400).json({ erro: 'Conversa inválida.' })

        const permissao = await podeConversar(req.usuario.id, serv_id)
        if (!permissao.ok) return res.status(403).json({ erro: permissao.motivo })
        const doOutro = await podeConversar(destino, serv_id)
        if (!doOutro.ok) return res.status(400).json({ erro: 'Conversa inválida.' })
        if (await bloqueados(req.usuario.id, destino)) return res.status(403).json({ erro: ERRO_BLOQUEIO })

        /* Horários de atendimento do freelancer da conversa (horário de Brasília) */
        if (await temColuna('usuario', 'usu_horarios')) {
            const pessoas = await db('usuario').whereIn('usu_id', [req.usuario.id, destino]).where('tipo_usuario', 'freelancer').select('usu_nome', 'usu_horarios')
            for (const p of pessoas) {
                const horarios = lerHorarios(p.usu_horarios)
                if (!dentroDoHorario(horarios, quando)) {
                    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
                    return res.status(400).json({ erro: `${p.usu_nome.split(' ')[0]} atende ${horarios.dias.map((d) => dias[d]).join(', ')}, das ${horarios.de}h às ${horarios.ate}h. Escolha um horário dentro disso.` })
                }
            }
        }

        const quandoLegivel = quandoTexto(quando)
        const [msg_id] = await db('mensagem').insert({
            serv_id,
            usu_remetente: req.usuario.id,
            usu_destinatario: destino,
            msg_texto: recado || `Reunião proposta para ${quandoLegivel}`,
            msg_reuniao_em: quando,
            msg_reuniao_link: link || null,
            msg_reuniao_status: 'pendente'
        })

        avisar(req.usuario.id, destino)
        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const tipoDestino = (await db('usuario').where('usu_id', destino).select('tipo_usuario').first())?.tipo_usuario ?? 'freelancer'
        await db('notificacao').insert({ usu_id: destino, not_titulo: 'Convite para reunião', not_desc: `${eu?.usu_nome ?? 'Alguém'} quer conversar ${quandoLegivel}.` })
        await enviarPush(destino, { titulo: 'Convite para reunião', texto: quandoLegivel, url: `/${tipoDestino}/mensagens` })

        return res.status(201).json({ mensagem: 'Convite de reunião enviado.', msg_id })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao marcar a reunião.' })
    }
}

/* Quem recebeu aceita ou recusa; quem marcou pode cancelar (antes da hora) */
export const responderReuniao = async (req, res) => {
    try {
        if (!(await temColuna('mensagem', 'msg_reuniao_em'))) return res.status(503).json({ erro: 'Reuniões pelo chat ainda estão sendo preparadas.' })

        const acao = { aceitar: 'aceita', recusar: 'recusada', cancelar: 'cancelada' }[req.body.acao]
        if (!acao) return res.status(400).json({ erro: 'Escolha aceitar, recusar ou cancelar.' })

        const msg = await db('mensagem').where('msg_id', req.params.msgId).first()
        const souParte = msg && [msg.usu_remetente, msg.usu_destinatario].includes(req.usuario.id)
        if (!souParte || !msg.msg_reuniao_status) return res.status(404).json({ erro: 'Reunião não encontrada.' })

        if (acao === 'cancelada') {
            if (msg.usu_remetente !== req.usuario.id) return res.status(403).json({ erro: 'Só quem marcou pode cancelar. Você pode recusar.' })
            if (!['pendente', 'aceita'].includes(msg.msg_reuniao_status)) return res.status(400).json({ erro: 'Esta reunião já foi encerrada.' })
        } else {
            if (msg.usu_destinatario !== req.usuario.id) return res.status(403).json({ erro: 'Quem responde é quem recebeu o convite.' })
            if (msg.msg_reuniao_status !== 'pendente') return res.status(400).json({ erro: 'Este convite já foi respondido.' })
            if (new Date(msg.msg_reuniao_em).getTime() < Date.now()) return res.status(400).json({ erro: 'A hora desta reunião já passou. Marque outra.' })
        }

        await db('mensagem').where('msg_id', msg.msg_id).update({ msg_reuniao_status: acao })
        avisar(msg.usu_remetente, msg.usu_destinatario)

        const outro = msg.usu_remetente === req.usuario.id ? msg.usu_destinatario : msg.usu_remetente
        const eu = await db('usuario').where('usu_id', req.usuario.id).select('usu_nome').first()
        const verbo = { aceita: 'aceitou', recusada: 'recusou', cancelada: 'cancelou' }[acao]
        await db('notificacao').insert({
            usu_id: outro,
            not_titulo: `Reunião ${acao}`,
            not_desc: `${eu?.usu_nome ?? 'A outra pessoa'} ${verbo} a reunião de ${quandoTexto(msg.msg_reuniao_em)}.`
        })

        const mensagem = { aceita: 'Reunião confirmada! Avisamos uma hora antes.', recusada: 'Convite recusado.', cancelada: 'Reunião cancelada.' }[acao]
        return res.json({ mensagem })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao responder a reunião.' })
    }
}

/* ---------- "Digitando..." e "Visto" ---------- */

const DIGITANDO_MS = 6000

export const avisarDigitando = async (req, res) => {
    try {
        if (!(await temTabela('chat_digitando'))) return res.status(204).end()
        const serv_id = Number(req.body.serv_id)
        const outro = Number(req.body.destinatario_id)
        if (!serv_id || !outro) return res.status(400).json({ erro: 'Conversa inválida.' })
        const permissao = await podeConversar(req.usuario.id, serv_id)
        if (!permissao.ok) return res.status(403).json({ erro: permissao.motivo })

        await db('chat_digitando')
            .insert({ serv_id, usu_id: req.usuario.id, outro_id: outro, dig_ate: new Date(Date.now() + DIGITANDO_MS) })
            .onConflict(['serv_id', 'usu_id', 'outro_id'])
            .merge(['dig_ate'])
        return res.status(204).end()
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao avisar.' })
    }
}

/* O outro está digitando? Até qual mensagem minha ele já leu? */
export const estadoConversa = async (req, res) => {
    try {
        const serv_id = Number(req.params.servId)
        const outro = Number(req.params.outroId)
        const permissao = await podeConversar(req.usuario.id, serv_id)
        if (!permissao.ok) return res.status(403).json({ erro: permissao.motivo })

        const [digitando, lida, visto] = await Promise.all([
            (await temTabela('chat_digitando'))
                ? db('chat_digitando').where({ serv_id, usu_id: outro, outro_id: req.usuario.id }).where('dig_ate', '>', new Date()).first()
                : null,
            db('mensagem').where({ serv_id, usu_remetente: req.usuario.id, usu_destinatario: outro, msg_lida: true }).max('msg_id as ultimo').first(),
            vistoDoUsuario(outro)
        ])

        return res.json({ digitando: Boolean(digitando), lidas_ate: Number(lida?.ultimo) || 0, visto_em: visto })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar a conversa.' })
    }
}
