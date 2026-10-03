import db from '../config/knex.js'

/*
 * A tabela mensagem guarda serv_id + remetente + destinatario, ou seja, a
 * conversa e sempre no contexto de um projeto. Nao existe tabela de conversa,
 * entao ela e derivada: agrupamos as mensagens por (projeto, outra pessoa).
 */

/*
 * So quem participa do projeto pode trocar mensagens nele: o contratante dono
 * ou um freelancer com candidatura naquele projeto. Sem esta checagem,
 * qualquer usuario logado poderia ler e escrever em conversas alheias.
 */
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

/*
 * GET /mensagens — lista as conversas do usuario logado.
 *
 * "Conversa" aqui e o par (projeto, outra pessoa), montado a partir das
 * mensagens trocadas. A ultima mensagem vem da propria tabela, entao nunca
 * fica dessincronizada.
 */
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

        /* Agrupa mantendo a ordem (a consulta ja vem da mais recente). */
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
                    ultima_mensagem: m.msg_texto,
                    ultima_data: m.msg_data,
                    nao_lidas: 0
                })
            }

            /* Nao lidas sao so as que chegaram para mim. */
            if (!m.msg_lida && m.usu_destinatario === meuId) {
                porChave.get(chave).nao_lidas += 1
            }
        }

        const conversas = [...porChave.values()]

        /* Uma consulta so para os nomes, em vez de uma por conversa. */
        if (conversas.length > 0) {
            const usuarios = await db('usuario')
                .whereIn('usu_id', conversas.map((c) => c.outro_usu_id))
                .select('usu_id', 'usu_nome', 'usu_foto')

            const porId = new Map(usuarios.map((u) => [u.usu_id, u]))

            for (const c of conversas) {
                const u = porId.get(c.outro_usu_id)
                c.outro_nome = u ? u.usu_nome : 'Usuário'
                c.outro_foto = u ? u.usu_foto : null
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

/* GET /mensagens/:servId/:outroId — mensagens de uma conversa. */
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
            .select('msg_id', 'usu_remetente', 'usu_destinatario', 'msg_texto', 'msg_data', 'msg_lida')
            .orderBy('msg_id', 'asc')

        /* Marca como lidas so as que chegaram para mim. */
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

/* POST /mensagens — envia mensagem dentro de um projeto. */
export const enviarMensagem = async (req, res) => {
    try {
        const { serv_id, destinatario_id, texto } = req.body

        if (!serv_id || !destinatario_id || !texto || !texto.trim()) {
            return res.status(400).json({
                erro: 'Informe o projeto, o destinatário e o texto.'
            })
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

        const [msg_id] = await db('mensagem').insert({
            serv_id,
            usu_remetente: req.usuario.id,
            usu_destinatario: destinatario_id,
            msg_texto: texto.trim()
        })

        return res.status(201).json({
            mensagem: 'Mensagem enviada!',
            msg_id
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao enviar mensagem.'
        })
    }
}

/*
 * GET /historico — projetos encerrados do usuario logado.
 *
 * Para o contratante, os projetos dele; para o freelancer, aqueles em que a
 * candidatura foi aceita.
 */
export const listarHistorico = async (req, res) => {
    try {
        const ENCERRADOS = ['finalizado', 'cancelado', 'em_andamento']

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
                    /* Quem trabalha no projeto, para o botao Mensagem do historico. */
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

            return res.json({ itens })
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
                'usuario.usu_id as outro_usu_id',
                'usuario.usu_nome as outro_nome'
            )
            .orderBy('servico.serv_id', 'desc')

        return res.json({ itens })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar histórico.'
        })
    }
}

/*
 * GET /mensagens/contatos — com quem o usuario logado pode conversar.
 *
 * As mesmas regras de podeConversar: o freelancer fala com o contratante de
 * cada projeto em que se candidatou; o contratante, com cada candidato dos
 * projetos dele. A tela de Mensagens usa isso para oferecer "começar
 * conversa" sem a pessoa precisar caçar o botão em outra tela.
 */
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
