/*
 * Categorias de projeto (tabela tipo_servico): o site lista as ativas; a administração cria, edita,
 * desativa e exclui. Categoria com projetos não pode ser excluída (o banco usa RESTRICT): é desativada,
 * some dos formulários e continua aparecendo nos projetos antigos.
 */
import db from '../config/knex.js'
import { temColuna, registrarAcao } from '../services/registro.js'

const LIMITE_NOME = 100
const LIMITE_DESC = 300

const comAtivo = () => temColuna('tipo_servico', 'tipo_ativo')

/* Erro (texto) se a categoria não puder ser usada num projeto; null se puder.
   Editando um projeto, a categoria que ele já tem continua valendo mesmo desativada. */
export async function categoriaInvalida(tipo_id, atual = null) {
    const tipo = await db('tipo_servico').where('tipo_id', Number(tipo_id)).first()
    if (!tipo) return 'Categoria não encontrada.'
    if (tipo.tipo_ativo === 0 || tipo.tipo_ativo === false) {
        if (atual !== null && Number(atual) === Number(tipo.tipo_id)) return null
        return 'Esta categoria não está mais disponível. Escolha outra.'
    }
    return null
}

/* GET /tipos-servico: as ativas, para os formulários do site */
export const listarAtivas = async (req, res) => {
    try {
        const ativo = await comAtivo()
        const tipos = await db('tipo_servico')
            .modify((q) => {
                if (ativo) q.where('tipo_ativo', true)
            })
            .select('tipo_id', 'tipo_nome', 'tipo_desc')
            .orderBy('tipo_nome')

        return res.status(200).json({ tipos })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao listar tipos de serviço' })
    }
}

/* Contagem de uso de cada categoria (projetos e freelancers que atuam nela) */
async function usoDasCategorias() {
    const projetos = await db('servico').select('tipo_id').count('* as total').groupBy('tipo_id')
    const freelancers = await db('freelancer_tipo_servico').select('tipo_id').count('* as total').groupBy('tipo_id')
    const mapa = (linhas) => new Map(linhas.map((l) => [Number(l.tipo_id), Number(l.total)]))
    return { projetos: mapa(projetos), freelancers: mapa(freelancers) }
}

/* GET /admin/categorias: todas, com o uso de cada uma */
export const listarTodas = async (req, res) => {
    try {
        const ativo = await comAtivo()
        const tipos = await db('tipo_servico')
            .select('tipo_id', 'tipo_nome', 'tipo_desc', ...(ativo ? ['tipo_ativo'] : []))
            .orderBy('tipo_nome')
        const uso = await usoDasCategorias()

        return res.json({
            desativar_disponivel: ativo,
            categorias: tipos.map((t) => ({
                tipo_id: t.tipo_id,
                tipo_nome: t.tipo_nome,
                tipo_desc: t.tipo_desc,
                ativo: ativo ? Boolean(t.tipo_ativo) : true,
                projetos: uso.projetos.get(t.tipo_id) ?? 0,
                freelancers: uso.freelancers.get(t.tipo_id) ?? 0
            }))
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao carregar as categorias.' })
    }
}

/* Nome e descrição do corpo; devolve { erro } ou os campos */
async function lerCategoria(body, ignorarId = null) {
    const nome = String(body?.nome ?? '').trim().replace(/\s+/g, ' ')
    const desc = String(body?.descricao ?? '').trim()

    if (nome.length < 2 || nome.length > LIMITE_NOME) return { erro: `Dê um nome de 2 a ${LIMITE_NOME} letras para a categoria.` }
    if (desc.length > LIMITE_DESC) return { erro: `A descrição pode ter até ${LIMITE_DESC} letras.` }

    /* Nome único sem diferenciar maiúsculas ("design" e "Design" são a mesma) */
    const repetida = await db('tipo_servico')
        .whereRaw('LOWER(tipo_nome) = ?', [nome.toLowerCase()])
        .modify((q) => {
            if (ignorarId) q.whereNot('tipo_id', ignorarId)
        })
        .first()
    if (repetida) return { erro: `Já existe a categoria "${repetida.tipo_nome}".` }

    return { campos: { tipo_nome: nome, tipo_desc: desc || null } }
}

/* POST /admin/categorias */
export const criar = async (req, res) => {
    try {
        const lido = await lerCategoria(req.body)
        if (lido.erro) return res.status(400).json({ erro: lido.erro })

        await db('tipo_servico').insert(lido.campos)
        await registrarAcao(req, 'categoria_criada', { detalhe: lido.campos.tipo_nome })

        return res.status(201).json({ mensagem: `Categoria "${lido.campos.tipo_nome}" criada.` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao criar a categoria.' })
    }
}

/* PUT /admin/categorias/:id: nome, descrição e ativa/desativada */
export const editar = async (req, res) => {
    try {
        const id = Number(req.params.id)
        const atual = await db('tipo_servico').where('tipo_id', id).first()
        if (!atual) return res.status(404).json({ erro: 'Categoria não encontrada.' })

        const lido = await lerCategoria(req.body, id)
        if (lido.erro) return res.status(400).json({ erro: lido.erro })

        const campos = { ...lido.campos }
        if (typeof req.body?.ativo === 'boolean') {
            if (!(await comAtivo())) return res.status(503).json({ erro: 'Desativar categorias ainda não está disponível (falta rodar as migrações).' })
            /* Pelo menos uma categoria ativa: sem nenhuma, ninguém consegue criar projeto */
            if (!req.body.ativo) {
                const outrasAtivas = await db('tipo_servico').where('tipo_ativo', true).whereNot('tipo_id', id).count('* as total').first()
                if (Number(outrasAtivas?.total ?? 0) === 0) return res.status(400).json({ erro: 'O site precisa de pelo menos uma categoria ativa.' })
            }
            campos.tipo_ativo = req.body.ativo
        }

        await db('tipo_servico').where('tipo_id', id).update(campos)
        await registrarAcao(req, 'categoria_editada', { detalhe: atual.tipo_nome === campos.tipo_nome ? campos.tipo_nome : `${atual.tipo_nome} → ${campos.tipo_nome}` })

        const mudouAtivo = 'tipo_ativo' in campos && Boolean(atual.tipo_ativo ?? true) !== campos.tipo_ativo
        return res.json({
            mensagem: mudouAtivo
                ? campos.tipo_ativo ? `Categoria "${campos.tipo_nome}" reativada.` : `Categoria "${campos.tipo_nome}" desativada: some dos formulários, mas continua nos projetos antigos.`
                : 'Categoria atualizada.'
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao atualizar a categoria.' })
    }
}

/* DELETE /admin/categorias/:id: só sem projetos (freelancers, alertas e testes dela saem junto pelo CASCADE) */
export const excluir = async (req, res) => {
    try {
        const id = Number(req.params.id)
        const atual = await db('tipo_servico').where('tipo_id', id).first()
        if (!atual) return res.status(404).json({ erro: 'Categoria não encontrada.' })

        const usada = await db('servico').where('tipo_id', id).count('* as total').first()
        const total = Number(usada?.total ?? 0)
        if (total > 0) {
            return res.status(409).json({
                erro: `"${atual.tipo_nome}" tem ${total} ${total === 1 ? 'projeto' : 'projetos'} e não pode ser excluída. Desative a categoria: ela some dos formulários e os projetos antigos continuam iguais.`,
                projetos: total
            })
        }

        const restantes = await db('tipo_servico').whereNot('tipo_id', id).count('* as total').first()
        if (Number(restantes?.total ?? 0) === 0) return res.status(400).json({ erro: 'O site precisa de pelo menos uma categoria.' })

        await db('tipo_servico').where('tipo_id', id).del()
        await registrarAcao(req, 'categoria_excluida', { detalhe: atual.tipo_nome })

        return res.json({ mensagem: `Categoria "${atual.tipo_nome}" excluída.` })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Erro ao excluir a categoria.' })
    }
}
