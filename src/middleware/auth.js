import jwt from 'jsonwebtoken'
import db from '../config/knex.js'
import { ehSupremo } from '../config/supremo.js'
import { registrarAcao, temColuna, temTabela } from '../services/registro.js'

/*
 * "Visto por último": marca quando a pessoa usou o site, no máximo a cada 2 minutos por conta
 * (o mapa guarda a última marcação, para não escrever no banco a cada pedido)
 */
const MARCAR_A_CADA = 2 * 60_000
const ultimaMarca = new Map()

async function marcarPresenca(usu_id, supremoComoOutro) {
    if (supremoComoOutro || !(await temColuna('usuario', 'usu_visto_em'))) return
    const agora = Date.now()
    if (agora - (ultimaMarca.get(usu_id) ?? 0) < MARCAR_A_CADA) return
    ultimaMarca.set(usu_id, agora)
    await db('usuario').where('usu_id', usu_id).update({ usu_visto_em: new Date(agora) })
}

/* Contas bloqueadas */
const BLOQUEADAS = ['suspensa', 'banida']

export default async (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({
            erro: "token nao informado"
        })
    }

    const partes = authHeader.split(' ')

    if (partes.length !== 2) {
        return res.status(401).json({
            erro: "token mal formatado"
        })
    }

    const [tipo, token] = partes

    if (tipo !== 'Bearer') {
        return res.status(401).json({
            erro: "token nao validado"
        })
    }

    let decoded

    try {
        /* Algoritmo fixo */
        decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    } catch (erro) {
        return res.status(401).json({
            erro: "token invalido"
        })
    }

    /* Só token de sessão: o de "falta o código do e-mail" (sem id) não entra */
    if (!decoded.id) {
        return res.status(401).json({ erro: "token invalido" })
    }

    try {
        const comDesde = await temColuna('usuario', 'usu_sessoes_desde')

        /* Conta ativa */
        const usuario = await db('usuario')
            .select('status_conta', 'tipo_usuario', 'usu_email', ...(comDesde ? ['usu_sessoes_desde'] : []))
            .where('usu_id', decoded.id)
            .first()

        if (!usuario) {
            return res.status(401).json({ erro: 'Conta não encontrada.' })
        }

        if (BLOQUEADAS.includes(usuario.status_conta)) {
            return res.status(403).json({
                erro: `Sua conta está ${usuario.status_conta}. Fale com o suporte.`
            })
        }

        /* Sessão encerrada em outro aparelho ("Sair deste aparelho" ou "Sair de todos") */
        if (decoded.sid && (await temTabela('sessao'))) {
            const sessao = await db('sessao').where('ses_id', decoded.sid).select('ses_revogada', 'ses_ultimo_uso').first()
            if (!sessao || sessao.ses_revogada) return res.status(401).json({ erro: 'Esta sessão foi encerrada. Entre novamente.' })
            /* Último uso: atualiza no máximo a cada 5 minutos */
            if (Date.now() - new Date(sessao.ses_ultimo_uso).getTime() > 5 * 60_000) {
                await db('sessao').where('ses_id', decoded.sid).update({ ses_ultimo_uso: db.fn.now() })
            }
        } else if (usuario.usu_sessoes_desde && !decoded.supremo_id && decoded.iat * 1000 < new Date(usuario.usu_sessoes_desde).getTime()) {
            /* Login antigo (sem sessão) de antes do "Sair de todos os aparelhos" */
            return res.status(401).json({ erro: 'Esta sessão foi encerrada. Entre novamente.' })
        }

        /* supremo: poderes totais; supremo_id (no token): sessão aberta pelo supremo "entrando como" esta conta */
        req.usuario = { ...decoded, tipo: usuario.tipo_usuario, supremo: ehSupremo(usuario) }

        /* O supremo "entrando como" alguém não deixa a pessoa online */
        await marcarPresenca(decoded.id, Boolean(decoded.supremo_id)).catch(() => {})

        /* Supremo "entrando como" alguém: tudo o que ele muda na conta da pessoa fica registrado */
        if (decoded.supremo_id && req.method !== 'GET') {
            await registrarAcao(req, 'acao_como_outra_conta', { alvo: decoded.id, detalhe: `${req.method} ${req.originalUrl}` })
        }

        next()
    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao validar a sessão.' })
    }
}
