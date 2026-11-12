import jwt from 'jsonwebtoken'
import db from '../config/knex.js'
import { ehSupremo } from '../config/supremo.js'
import { registrarAcao, temTabela } from '../services/registro.js'

const PAPEIS = ['freelancer', 'contratante', 'administrador']
const TEMAS = ['escuro', 'claro']
const CLIMAS = ['limpo', 'chuva', 'tempestade', 'neve', 'neblina']
const PUBLICOS = ['todos', 'freelancer', 'contratante', 'administrador']

/* Cenário que vale quando o supremo ainda não mexeu em nada: cada pessoa usa as próprias preferências */
const CENARIO_PADRAO = { tema: null, clima: null, fogos: null, aviso: null }

async function alvoDe(req, res) {
    const usu_id = Number(req.params.id)

    if (usu_id === req.usuario.id) {
        res.status(400).json({ erro: 'Você não pode fazer isso com a própria conta.' })
        return null
    }

    const alvo = await db('usuario').select('*').where('usu_id', usu_id).first()

    if (!alvo) {
        res.status(404).json({ erro: 'Usuário não encontrado.' })
        return null
    }

    if (ehSupremo(alvo)) {
        res.status(403).json({ erro: 'Não é possível mexer no administrador supremo.' })
        return null
    }

    return alvo
}

/* Papel: troca entre freelancer, contratante e administrador (cria a linha do papel novo se faltar) */
export const mudarPapel = async (req, res) => {
    try {
        const { tipo } = req.body

        if (!PAPEIS.includes(tipo)) {
            return res.status(400).json({ erro: 'Papel inválido.' })
        }

        const alvo = await alvoDe(req, res)
        if (!alvo) return

        await db.transaction(async (trx) => {
            await trx('usuario').where('usu_id', alvo.usu_id).update({ tipo_usuario: tipo, data_atualizacao: trx.fn.now() })

            /* Freelancer e contratante têm tabela própria (XP, projetos); a linha antiga fica guardada */
            if (tipo === 'freelancer' && !(await trx('freelancer').where('usu_id', alvo.usu_id).first())) {
                await trx('freelancer').insert({ usu_id: alvo.usu_id })
            }

            if (tipo === 'contratante' && !(await trx('contratante').where('usu_id', alvo.usu_id).first())) {
                await trx('contratante').insert({ usu_id: alvo.usu_id })
            }
        })

        await db('notificacao').insert({
            usu_id: alvo.usu_id,
            not_titulo: 'Seu papel mudou',
            not_desc: `A administração mudou sua conta para ${tipo}. Entre de novo para ver o painel novo.`
        })

        await registrarAcao(req, 'mudar_papel', { alvo: alvo.usu_id, detalhe: `${alvo.tipo_usuario} → ${tipo}` })

        return res.json({ mensagem: `${alvo.usu_nome} agora é ${tipo}.` })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao mudar o papel.' })
    }
}

/* Entrar como: abre uma sessão na conta escolhida, marcada com quem abriu (o site mostra o aviso para voltar) */
export const entrarComo = async (req, res) => {
    try {
        const alvo = await alvoDe(req, res)
        if (!alvo) return

        const token = jwt.sign(
            {
                id: alvo.usu_id,
                email: alvo.usu_email,
                tipo: alvo.tipo_usuario,
                supremo_id: req.usuario.id
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        await registrarAcao(req, 'entrar_como', { alvo: alvo.usu_id })

        return res.json({
            mensagem: `Você está vendo o site como ${alvo.usu_nome}.`,
            token,
            tipo: alvo.tipo_usuario,
            usuario: { id: alvo.usu_id, nome: alvo.usu_nome, email: alvo.usu_email, tipo: alvo.tipo_usuario }
        })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao entrar na conta.' })
    }
}

/* Excluir de vez (as tabelas ligadas à conta caem junto, pelas chaves estrangeiras) */
export const excluirUsuario = async (req, res) => {
    try {
        const alvo = await alvoDe(req, res)
        if (!alvo) return

        await db('usuario').where('usu_id', alvo.usu_id).del()
        await registrarAcao(req, 'excluir_conta', { alvoNome: alvo.usu_nome, detalhe: alvo.usu_email })

        return res.json({ mensagem: `A conta de ${alvo.usu_nome} foi excluída.` })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao excluir a conta. Ela pode ter dados presos a outras tabelas.' })
    }
}

/* Aviso: notificação para todo mundo (ou só para um papel) */
export const enviarAviso = async (req, res) => {
    try {
        const titulo = String(req.body.titulo ?? '').trim().slice(0, 150)
        const descricao = String(req.body.descricao ?? '').trim().slice(0, 1000)
        const para = req.body.para ?? 'todos'

        if (!titulo || !descricao) {
            return res.status(400).json({ erro: 'Escreva o título e o texto do aviso.' })
        }

        if (!PUBLICOS.includes(para)) {
            return res.status(400).json({ erro: 'Público inválido.' })
        }

        const usuarios = await db('usuario')
            .select('usu_id')
            .where('status_conta', 'ativa')
            .modify((q) => {
                if (para !== 'todos') q.where('tipo_usuario', para)
            })

        if (usuarios.length > 0) {
            await db('notificacao').insert(usuarios.map((u) => ({ usu_id: u.usu_id, not_titulo: titulo, not_desc: descricao })))
        }

        await registrarAcao(req, 'aviso', { detalhe: `${titulo} (para: ${para}, ${usuarios.length} contas)` })

        return res.json({ mensagem: `Aviso enviado para ${usuarios.length} ${usuarios.length === 1 ? 'pessoa' : 'pessoas'}.` })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao enviar o aviso.' })
    }
}

/* Registro: as últimas ações dos admins, mais recentes primeiro */
export const listarRegistro = async (req, res) => {
    try {
        if (!(await temTabela('admin_registro'))) return res.json({ registro: [] })

        const registro = await db('admin_registro')
            .modify((q) => {
                if (req.query.acao) q.where('reg_acao', req.query.acao)
            })
            .orderBy('reg_id', 'desc')
            .limit(300)

        return res.json({ registro })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar o registro.' })
    }
}

/* ---------- Cenário global ---------- */

async function lerCenario() {
    try {
        const linha = await db('config_site').where('cfg_chave', 'cenario').first()
        return linha ? { ...CENARIO_PADRAO, ...JSON.parse(linha.cfg_valor) } : CENARIO_PADRAO
    } catch {
        /* Sem a migração do supremo: ninguém força nada */
        return CENARIO_PADRAO
    }
}

/* Público (sem login): o site de todo mundo consulta para saber se o supremo forçou tema, clima, fogos ou aviso */
export const verCenario = async (req, res) => {
    return res.json(await lerCenario())
}

export const salvarCenario = async (req, res) => {
    try {
        const atual = await lerCenario()
        const novo = { ...atual }

        if ('tema' in req.body) {
            if (req.body.tema !== null && !TEMAS.includes(req.body.tema)) return res.status(400).json({ erro: 'Tema inválido.' })
            novo.tema = req.body.tema
        }

        if ('clima' in req.body) {
            if (req.body.clima !== null && !CLIMAS.includes(req.body.clima)) return res.status(400).json({ erro: 'Clima inválido.' })
            novo.clima = req.body.clima
        }

        if ('aviso' in req.body) {
            const aviso = req.body.aviso === null ? null : String(req.body.aviso).trim().slice(0, 200)
            novo.aviso = aviso || null
        }

        /* Fogos: guarda a hora; cada site solta os fogos uma vez quando vê uma hora nova */
        if (req.body.fogos) novo.fogos = Date.now()

        const valor = JSON.stringify(novo)
        const existe = await db('config_site').where('cfg_chave', 'cenario').first()

        if (existe) {
            await db('config_site').where('cfg_chave', 'cenario').update({ cfg_valor: valor, cfg_atualizado_em: db.fn.now() })
        } else {
            await db('config_site').insert({ cfg_chave: 'cenario', cfg_valor: valor })
        }

        await registrarAcao(req, 'cenario', { detalhe: JSON.stringify(req.body) })

        return res.json({ mensagem: 'Cenário atualizado para todo mundo.', cenario: novo })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao salvar o cenário. A migração do supremo já rodou?' })
    }
}

/*
 * Migrations pelo próprio servidor: roda com os dados do banco que já estão na Vercel,
 * sem ninguém precisar da senha do banco. GET mostra o que falta; POST aplica.
 */
const opcoesMigracao = async () => {
    const { fonteMigracoes } = await import('../database/migracoes.js')
    return { migrationSource: fonteMigracoes }
}

export const verMigracoes = async (req, res) => {
    try {
        const [feitas, pendentes] = await db.migrate.list(await opcoesMigracao())
        return res.json({
            feitas: feitas.map((m) => m.name ?? m),
            pendentes: pendentes.map((m) => m.file ?? m.name ?? m)
        })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'Não foi possível ler as migrations.', detalhe: String(erro?.message ?? erro).slice(0, 300) })
    }
}

export const rodarMigracoes = async (req, res) => {
    try {
        const [lote, aplicadas] = await db.migrate.latest(await opcoesMigracao())
        await registrarAcao(req, 'rodar_migracoes', { detalhe: aplicadas.length ? `lote ${lote}: ${aplicadas.join(', ')}` : 'nada pendente' })
        return res.json({ lote, aplicadas, mensagem: aplicadas.length ? `${aplicadas.length} migration(s) aplicada(s).` : 'O banco já estava em dia.' })
    } catch (erro) {
        console.error(erro)
        return res.status(500).json({ erro: 'A migration falhou.', detalhe: String(erro?.message ?? erro).slice(0, 300) })
    }
}
