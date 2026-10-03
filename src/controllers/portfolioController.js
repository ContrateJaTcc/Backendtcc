import db from '../config/knex.js'

/*
 * A tabela portfolio ja existia na migration desde o inicio do projeto, mas
 * nenhum codigo a utilizava: nao havia controller, rota nem tela.
 *
 * Assim como em candidatura, portfolio.free_id referencia freelancer.free_id,
 * e NAO usuario.usu_id. O token carrega o usu_id, entao toda rota precisa
 * fazer essa traducao antes de tocar na tabela.
 */
const buscarFreelancer = (usu_id) =>
    db('freelancer').select('free_id').where('usu_id', usu_id).first()

/* As colunas port_link e port_img sao varchar(255). */
const LIMITE_URL = 255
const LIMITE_TITULO = 150

/*
 * port_img guarda endereco de imagem, nao arquivo. Aceitamos apenas http e
 * https: um valor como "javascript:..." acabaria dentro de um href no
 * frontend, e nao ha motivo para um portfolio apontar para outro esquema.
 */
function validarUrl(valor, campo) {
    if (!valor) return { ok: true, valor: null }

    const limpo = String(valor).trim()

    if (limpo === '') return { ok: true, valor: null }

    if (limpo.length > LIMITE_URL) {
        return { ok: false, erro: `O ${campo} deve ter no máximo ${LIMITE_URL} caracteres.` }
    }

    if (!/^https?:\/\//i.test(limpo)) {
        return { ok: false, erro: `O ${campo} deve começar com http:// ou https://` }
    }

    return { ok: true, valor: limpo }
}

/* Validacao comum ao criar e ao atualizar. */
function validarItem(corpo) {
    const titulo = String(corpo.port_titulo ?? '').trim()
    const desc = String(corpo.port_desc ?? '').trim()

    if (!titulo || !desc) {
        return { ok: false, erro: 'Informe o título e a descrição do trabalho.' }
    }

    if (titulo.length > LIMITE_TITULO) {
        return { ok: false, erro: `O título deve ter no máximo ${LIMITE_TITULO} caracteres.` }
    }

    const link = validarUrl(corpo.port_link, 'link')
    if (!link.ok) return link

    const img = validarUrl(corpo.port_img, 'endereço da imagem')
    if (!img.ok) return img

    return {
        ok: true,
        dados: {
            port_titulo: titulo,
            port_desc: desc,
            port_link: link.valor,
            port_img: img.valor
        }
    }
}

const CAMPOS = [
    'port_id',
    'free_id',
    'port_titulo',
    'port_desc',
    'port_link',
    'port_img',
    'port_data_criacao',
    'port_data_atualizacao'
]

/* GET /portfolio/meu — itens do freelancer logado, para a tela de edicao. */
export const listarMeuPortfolio = async (req, res) => {
    try {
        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(403).json({
                erro: 'Apenas freelancers possuem portfólio.'
            })
        }

        const itens = await db('portfolio')
            .select(CAMPOS)
            .where('free_id', freelancer.free_id)
            .orderBy('port_id', 'desc')

        return res.json({ itens })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar portfólio.'
        })
    }
}

/*
 * GET /portfolio/freelancer/:usuId — portfolio de um freelancer, para o
 * contratante avaliar o candidato antes de aceitar.
 *
 * Recebe o usu_id porque e o que a tela de candidatos ja tem em maos.
 * Devolve junto os dados publicos do perfil, evitando uma segunda requisicao.
 */
export const listarPorFreelancer = async (req, res) => {
    try {
        const perfil = await db('usuario')
            .join('freelancer', 'usuario.usu_id', 'freelancer.usu_id')
            .where('usuario.usu_id', req.params.usuId)
            .select(
                'usuario.usu_id',
                'usuario.usu_nome',
                'usuario.usu_desc',
                'usuario.usu_cid',
                'usuario.usu_est',
                'usuario.usu_foto',
                'freelancer.free_id',
                'freelancer.free_nivel',
                'freelancer.free_rank'
            )
            .first()

        if (!perfil) {
            return res.status(404).json({
                erro: 'Freelancer não encontrado.'
            })
        }

        const itens = await db('portfolio')
            .select(CAMPOS)
            .where('free_id', perfil.free_id)
            .orderBy('port_id', 'desc')

        /* As areas de atuacao ajudam o contratante a julgar o candidato tanto
           quanto os trabalhos, entao vao na mesma resposta. */
        const areas = await db('freelancer_tipo_servico')
            .join('tipo_servico', 'freelancer_tipo_servico.tipo_id', 'tipo_servico.tipo_id')
            .where('freelancer_tipo_servico.free_id', perfil.free_id)
            .select('tipo_servico.tipo_id', 'tipo_servico.tipo_nome')
            .orderBy('tipo_servico.tipo_nome')

        /* So campos publicos: nada de e-mail, CPF ou telefone aqui. */
        return res.json({ perfil, areas, itens })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao carregar portfólio.'
        })
    }
}

/* POST /portfolio — adiciona um trabalho ao quadro. */
export const criarItem = async (req, res) => {
    try {
        const freelancer = await buscarFreelancer(req.usuario.id)

        if (!freelancer) {
            return res.status(403).json({
                erro: 'Apenas freelancers podem adicionar trabalhos ao portfólio.'
            })
        }

        const validacao = validarItem(req.body)

        if (!validacao.ok) {
            return res.status(400).json({ erro: validacao.erro })
        }

        const [port_id] = await db('portfolio').insert({
            free_id: freelancer.free_id,
            ...validacao.dados
        })

        const item = await db('portfolio').select(CAMPOS).where('port_id', port_id).first()

        return res.status(201).json({
            mensagem: 'Trabalho adicionado ao portfólio!',
            item
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao adicionar trabalho.'
        })
    }
}

/*
 * Confere se o item existe e pertence a quem esta pedindo.
 *
 * Sem isso, um freelancer conseguiria editar ou apagar o trabalho de outro
 * so trocando o id na URL.
 */
async function buscarItemDoDono(port_id, usu_id) {
    const freelancer = await buscarFreelancer(usu_id)

    if (!freelancer) {
        return { erro: 'Apenas freelancers possuem portfólio.', status: 403 }
    }

    const item = await db('portfolio').select(CAMPOS).where('port_id', port_id).first()

    if (!item) {
        return { erro: 'Trabalho não encontrado.', status: 404 }
    }

    if (item.free_id !== freelancer.free_id) {
        return { erro: 'Este trabalho pertence a outro freelancer.', status: 403 }
    }

    return { item }
}

/* PUT /portfolio/:id — edita um trabalho do proprio quadro. */
export const atualizarItem = async (req, res) => {
    try {
        const dono = await buscarItemDoDono(req.params.id, req.usuario.id)

        if (dono.erro) {
            return res.status(dono.status).json({ erro: dono.erro })
        }

        const validacao = validarItem(req.body)

        if (!validacao.ok) {
            return res.status(400).json({ erro: validacao.erro })
        }

        await db('portfolio')
            .where('port_id', req.params.id)
            .update({
                ...validacao.dados,
                port_data_atualizacao: db.fn.now()
            })

        const item = await db('portfolio').select(CAMPOS).where('port_id', req.params.id).first()

        return res.json({
            mensagem: 'Trabalho atualizado!',
            item
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao atualizar trabalho.'
        })
    }
}

/* DELETE /portfolio/:id — remove um trabalho do proprio quadro. */
export const deletarItem = async (req, res) => {
    try {
        const dono = await buscarItemDoDono(req.params.id, req.usuario.id)

        if (dono.erro) {
            return res.status(dono.status).json({ erro: dono.erro })
        }

        await db('portfolio').where('port_id', req.params.id).del()

        return res.json({
            mensagem: 'Trabalho removido do portfólio.'
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({
            erro: 'Erro ao remover trabalho.'
        })
    }
}
