import db from '../config/knex.js'
import { concederXp } from '../services/gamificacao.js'
import { chavePublicaPush, enviarPush } from '../services/push.js'
import { registrarAcao, temTabela } from '../services/registro.js'

/* ---------- Notificações no celular ---------- */

/* Público: a chave para o navegador se inscrever (null = servidor sem push configurado) */
export const chavePush = async (req, res) => res.json({ chave: chavePublicaPush() })

export const inscreverPush = async (req, res) => {
    try {
        const { endpoint, keys } = req.body ?? {}

        if (!endpoint || !keys?.p256dh || !keys?.auth || String(endpoint).length > 600) {
            return res.status(400).json({ erro: 'Inscrição inválida.' })
        }

        if (!(await temTabela('push_inscricao'))) return res.status(503).json({ erro: 'Notificações ainda não disponíveis.' })

        /* O mesmo aparelho pode trocar de conta: fica com a de agora */
        await db('push_inscricao').where('pus_endpoint', endpoint).del()
        await db('push_inscricao').insert({ usu_id: req.usuario.id, pus_endpoint: endpoint, pus_p256dh: keys.p256dh, pus_auth: keys.auth })

        return res.status(201).json({ mensagem: 'Pronto! Você vai receber avisos neste aparelho.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao ativar as notificações.' })
    }
}

export const desinscreverPush = async (req, res) => {
    try {
        if (await temTabela('push_inscricao')) {
            await db('push_inscricao').where({ usu_id: req.usuario.id, pus_endpoint: String(req.body?.endpoint ?? '') }).del()
        }

        return res.json({ mensagem: 'Avisos desligados neste aparelho.' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao desligar as notificações.' })
    }
}

/* ---------- Denúncias ---------- */

const MOTIVOS = ['golpe', 'spam', 'ofensivo', 'falso', 'outro']

export const denunciar = async (req, res) => {
    try {
        const { alvo_tipo, alvo_id, motivo } = req.body ?? {}
        const detalhe = String(req.body?.detalhe ?? '').trim().slice(0, 500) || null

        if (!['servico', 'usuario', 'mensagem'].includes(alvo_tipo) || !Number(alvo_id) || !MOTIVOS.includes(motivo)) {
            return res.status(400).json({ erro: 'Escolha o motivo da denúncia.' })
        }

        if (!(await temTabela('denuncia'))) return res.status(503).json({ erro: 'Denúncias ainda não disponíveis.' })

        const existe =
            alvo_tipo === 'servico'
                ? await db('servico').where('serv_id', alvo_id).first()
                : alvo_tipo === 'mensagem'
                    ? await db('mensagem').where('msg_id', alvo_id).first()
                    : await db('usuario').where('usu_id', alvo_id).first()

        if (!existe) return res.status(404).json({ erro: 'Não encontramos o que você quer denunciar.' })
        /* Mensagem: só quem recebeu pode denunciar (e não a própria) */
        if (alvo_tipo === 'mensagem' && existe.usu_destinatario !== req.usuario.id) return res.status(403).json({ erro: 'Só dá para denunciar mensagens que você recebeu.' })
        if (alvo_tipo === 'usuario' && Number(alvo_id) === req.usuario.id) return res.status(400).json({ erro: 'Você não pode denunciar a si mesmo.' })

        try {
            await db('denuncia').insert({ usu_id: req.usuario.id, den_alvo_tipo: alvo_tipo, den_alvo_id: alvo_id, den_motivo: motivo, den_detalhe: detalhe })
        } catch (erro) {
            if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já denunciou isso. A administração vai analisar.' })
            throw erro
        }

        /* Avisa os admins (sino e celular) */
        const admins = await db('usuario').where({ tipo_usuario: 'administrador', status_conta: 'ativa' }).select('usu_id')
        if (admins.length > 0) {
            const titulo = 'Nova denúncia'
            const texto = alvo_tipo === 'servico' ? `Um projeto foi denunciado (${motivo}).` : alvo_tipo === 'mensagem' ? `Uma mensagem do chat foi denunciada (${motivo}).` : `Um perfil foi denunciado (${motivo}).`
            await db('notificacao').insert(admins.map((a) => ({ usu_id: a.usu_id, not_titulo: titulo, not_desc: texto })))
            await enviarPush(admins.map((a) => a.usu_id), { titulo, texto, url: '/administrador' })
        }

        return res.status(201).json({ mensagem: 'Denúncia enviada. Obrigado por ajudar a manter a plataforma segura!' })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao enviar a denúncia.' })
    }
}

/* Fila dos admins: denúncias agrupadas pelo alvo (quantas pessoas denunciaram cada coisa) */
export const listarDenuncias = async (req, res) => {
    try {
        if (!(await temTabela('denuncia'))) return res.json({ denuncias: [] })

        const status = ['aberta', 'resolvida', 'descartada'].includes(req.query.status) ? req.query.status : 'aberta'

        const linhas = await db('denuncia')
            .join('usuario as autor', 'denuncia.usu_id', 'autor.usu_id')
            .leftJoin('servico', function () {
                this.on('denuncia.den_alvo_id', '=', 'servico.serv_id').andOn('denuncia.den_alvo_tipo', '=', db.raw('?', ['servico']))
            })
            .leftJoin('contratante', 'servico.cont_id', 'contratante.cont_id')
            /* Mensagem denunciada: o alvo é quem mandou */
            .leftJoin('mensagem', function () {
                this.on('denuncia.den_alvo_id', '=', 'mensagem.msg_id').andOn('denuncia.den_alvo_tipo', '=', db.raw('?', ['mensagem']))
            })
            .leftJoin('usuario as alvo', function () {
                this.on('alvo.usu_id', '=', db.raw("CASE denuncia.den_alvo_tipo WHEN 'usuario' THEN denuncia.den_alvo_id WHEN 'mensagem' THEN mensagem.usu_remetente ELSE contratante.usu_id END"))
            })
            .where('denuncia.den_status', status)
            .select(
                'denuncia.den_id',
                'denuncia.den_alvo_tipo',
                'denuncia.den_alvo_id',
                'denuncia.den_motivo',
                'denuncia.den_detalhe',
                'denuncia.den_data',
                'autor.usu_nome as autor_nome',
                'servico.serv_titulo',
                'servico.serv_status',
                'alvo.usu_id as alvo_usu_id',
                'alvo.usu_nome as alvo_nome',
                'alvo.status_conta as alvo_status',
                'alvo.tipo_usuario as alvo_tipo_usuario',
                'mensagem.msg_texto'
            )
            .orderBy('denuncia.den_id', 'desc')
            .limit(300)

        return res.json({ denuncias: linhas })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar as denúncias.' })
    }
}

/* Fecha todas as denúncias abertas do mesmo alvo (resolvida = o admin agiu; descartada = não era nada) */
export const fecharDenuncia = async (req, res) => {
    try {
        const status = req.body?.acao === 'descartar' ? 'descartada' : 'resolvida'
        const den = await db('denuncia').where('den_id', req.params.id).first()

        if (!den) return res.status(404).json({ erro: 'Denúncia não encontrada.' })

        const fechadas = await db('denuncia')
            .where({ den_alvo_tipo: den.den_alvo_tipo, den_alvo_id: den.den_alvo_id, den_status: 'aberta' })
            .update({ den_status: status, den_resolvida_por: req.usuario.id, den_resolvida_em: db.fn.now() })

        await registrarAcao(req, status === 'resolvida' ? 'denuncia_resolvida' : 'denuncia_descartada', {
            alvo: den.den_alvo_tipo === 'usuario' ? den.den_alvo_id : null,
            detalhe: `${den.den_alvo_tipo} #${den.den_alvo_id} (${den.den_motivo})`
        })

        return res.json({ mensagem: status === 'resolvida' ? `Denúncia resolvida (${fechadas}).` : `Denúncia descartada (${fechadas}).` })

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao fechar a denúncia.' })
    }
}

/* ---------- Primeiros passos do freelancer ---------- */

const XP_PASSO = 20

const contar = async (consulta) => Number((await consulta.count('* as total').first())?.total ?? 0)

const PASSOS = [
    { codigo: 'foto', titulo: 'Coloque uma foto', descricao: 'Contratantes confiam mais em quem mostra o rosto.', link: '/freelancer/perfil', feito: async (f) => Boolean(f.usu_foto) },
    { codigo: 'sobre', titulo: 'Conte sobre você', descricao: 'Escreva uma descrição curta no seu perfil.', link: '/freelancer/perfil', feito: async (f) => Boolean(f.usu_desc?.trim()) },
    { codigo: 'areas', titulo: 'Escolha suas áreas', descricao: 'Diga em que tipo de trabalho você atua.', link: '/freelancer/perfil', feito: async (f) => (await contar(db('freelancer_tipo_servico').where('free_id', f.free_id))) > 0 },
    { codigo: 'portfolio', titulo: 'Mostre um trabalho', descricao: 'Adicione 1 trabalho ao seu portfólio.', link: '/freelancer/perfil', feito: async (f) => (await contar(db('portfolio').where('free_id', f.free_id))) > 0 },
    { codigo: 'candidatura', titulo: 'Candidate-se a um projeto', descricao: 'Encontre um projeto e mande sua candidatura.', link: '/freelancer', feito: async (f) => (await contar(db('candidatura').where('free_id', f.free_id))) > 0 }
]

async function freelancerCompleto(req) {
    return db('freelancer')
        .join('usuario', 'freelancer.usu_id', 'usuario.usu_id')
        .where('freelancer.usu_id', req.usuario.id)
        .select('freelancer.free_id', 'freelancer.free_xp', 'usuario.usu_foto', 'usuario.usu_desc')
        .first()
}

async function situacaoPassos(f) {
    const temResgate = await temTabela('passo_resgate')
    const resgatados = temResgate ? new Set((await db('passo_resgate').where('free_id', f.free_id).select('pas_codigo')).map((r) => r.pas_codigo)) : new Set()

    const passos = await Promise.all(
        PASSOS.map(async (p) => ({ codigo: p.codigo, titulo: p.titulo, descricao: p.descricao, link: p.link, xp: XP_PASSO, feito: await p.feito(f), resgatado: resgatados.has(p.codigo) }))
    )

    return { resgateDisponivel: temResgate, passos }
}

export const listarPassos = async (req, res) => {
    try {
        const f = await freelancerCompleto(req)
        if (!f) return res.status(403).json({ erro: 'Primeiros passos são só para freelancers.' })

        return res.json(await situacaoPassos(f))

    } catch (erro) {
        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao carregar os primeiros passos.' })
    }
}

export const resgatarPasso = async (req, res) => {
    try {
        const f = await freelancerCompleto(req)
        if (!f) return res.status(403).json({ erro: 'Primeiros passos são só para freelancers.' })

        const atual = await situacaoPassos(f)
        const passo = atual.passos.find((p) => p.codigo === req.params.codigo)

        if (!passo) return res.status(404).json({ erro: 'Passo não encontrado.' })
        if (!atual.resgateDisponivel) return res.status(503).json({ erro: 'Os primeiros passos ainda estão sendo preparados.' })
        if (passo.resgatado) return res.status(400).json({ erro: 'Você já ganhou o XP deste passo.' })
        if (!passo.feito) return res.status(400).json({ erro: 'Este passo ainda não foi feito.' })

        await db.transaction(async (trx) => {
            await trx('passo_resgate').insert({ free_id: f.free_id, pas_codigo: passo.codigo })
            await concederXp(trx, f.free_id, XP_PASSO, `passo_${passo.codigo}`)
        })

        return res.json({ mensagem: `Passo concluído! +${XP_PASSO} XP`, xp: XP_PASSO })

    } catch (erro) {
        if (erro?.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Você já ganhou o XP deste passo.' })

        console.error(erro)

        return res.status(500).json({ erro: 'Erro ao resgatar o passo.' })
    }
}
