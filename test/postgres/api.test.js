/*
 * O backend inteiro rodando em PostgreSQL (o mesmo banco do Neon), sem precisar de internet:
 * aplica todas as migrations, faz um projeto de ponta a ponta pela API e chama todas as rotas GET
 * da documentação com cada papel. Erro 500 = SQL que não funciona no PostgreSQL.
 *
 *   npm run test:pg
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { subirPostgres } from './banco.js'

process.env.JWT_SECRET ??= 'segredo-dos-testes-pg'
process.env.AGENDADOR = '0'

let pg, db, app
const erros500 = []

/* CPF válido a partir de 9 dígitos */
function cpf(base) {
    const d = String(base).padStart(9, '0').split('').map(Number)
    for (const tamanho of [9, 10]) {
        const soma = d.slice(0, tamanho).reduce((s, n, i) => s + n * (tamanho + 1 - i), 0)
        const resto = (soma * 10) % 11
        d.push(resto === 10 ? 0 : resto)
    }
    return d.join('')
}

/* Chamada à API que guarda os 500 com a mensagem do servidor */
async function chamar(metodo, caminho, token, corpo) {
    let r = request(app)[metodo](caminho)
    if (token) r = r.set('Authorization', `Bearer ${token}`)
    if (corpo !== undefined) r = r.send(corpo)
    const resposta = await r
    if (resposta.status >= 500) erros500.push(`${metodo.toUpperCase()} ${caminho} -> ${resposta.status} ${JSON.stringify(resposta.body).slice(0, 160)}`)
    return resposta
}

async function cadastrar(i, nome, tipo) {
    const email = `Pessoa${i}@Teste.com`
    const r = await chamar('post', '/auth/register', null, {
        nome, email, senha: 'Castelo#Pixel2026', cpf: cpf(123456700 + i * 37), telefone: '24999990000',
        data_nasc: '1995-05-05', cidade: 'Volta Redonda', estado: 'RJ', tipo, aceitouTermos: true
    })
    assert.equal(r.status, 201, `cadastro de ${nome}: ${JSON.stringify(r.body)}`)
    /* Login com o e-mail em outra caixa: no PostgreSQL só funciona porque o e-mail é guardado em minúsculas */
    const login = await chamar('post', '/auth/login', null, { email: email.toUpperCase(), senha: 'Castelo#Pixel2026' })
    assert.equal(login.status, 200, `login de ${nome}: ${JSON.stringify(login.body)}`)
    return { token: login.body.token, id: login.body.usuario?.usu_id ?? login.body.usu_id ?? login.body.id }
}

before(async () => {
    pg = await subirPostgres(54330)
    ;({ default: db } = await import('../../src/config/knex.js'))
    const { fonteMigracoes } = await import('../../src/database/migracoes.js')
    await db.migrate.latest({ migrationSource: fonteMigracoes })
    await db('tipo_servico').insert([
        { tipo_nome: 'Desenvolvimento Web', tipo_desc: 'Sites e sistemas' },
        { tipo_nome: 'Design Gráfico', tipo_desc: 'Logos e artes' },
        { tipo_nome: 'Redação', tipo_desc: null }
    ])
    ;({ default: app } = await import('../../src/app.js'))
})

after(async () => {
    await db?.destroy()
    await pg?.parar()
})

test('PostgreSQL: projeto de ponta a ponta, admin e todas as rotas GET sem erro 500', async () => {
    const lucas = await cadastrar(1, 'Lucas Contratante', 'contratante')
    const ana = await cadastrar(2, 'Ana Freelancer', 'freelancer')
    const bruno = await cadastrar(3, 'Bruno Silva', 'freelancer')
    const diego = await cadastrar(4, 'Diego Admin', 'contratante')
    await db('usuario').where('usu_email', 'pessoa4@teste.com').update({ tipo_usuario: 'administrador' })
    const admin = (await chamar('post', '/auth/login', null, { email: 'pessoa4@teste.com', senha: 'Castelo#Pixel2026' })).body.token
    assert.ok(admin)
    const anaId = (await db('usuario').where('usu_email', 'pessoa2@teste.com').first()).usu_id
    const lucasId = (await db('usuario').where('usu_email', 'pessoa1@teste.com').first()).usu_id
    void diego

    /* Projeto: criar (id do insert via RETURNING), editar, ver */
    const projeto = {
        titulo: 'Site para loja de cartas', descricao: 'Catálogo com busca e página de contato para a loja.', tipo_id: 1, valor: 1500,
        tipo_valor: 'fixo', qtd_dias: 20, local: 'remoto', vagas: 1, status: 'aberto', habilidades: 'React'
    }
    const criado = await chamar('post', '/servicos', lucas.token, projeto)
    assert.equal(criado.status, 201, JSON.stringify(criado.body))
    const servId = (await db('servico').orderBy('serv_id', 'desc').first()).serv_id
    assert.ok(Number.isInteger(servId))
    assert.equal((await chamar('put', `/servicos/${servId}`, lucas.token, { ...projeto, valor: 1600 })).status, 200)

    /* Segundo projeto só para excluir */
    await chamar('post', '/servicos', lucas.token, { ...projeto, titulo: 'Projeto para excluir' })
    const paraExcluir = (await db('servico').where('serv_titulo', 'Projeto para excluir').first()).serv_id
    assert.equal((await chamar('delete', `/servicos/${paraExcluir}`, lucas.token)).status, 200)

    /* Candidaturas: Ana e Bruno; Ana edita; Lucas aceita a Ana */
    assert.equal((await chamar('post', `/servicos/${servId}/candidaturas`, ana.token, { valor_proposto: 1400, mensagem: 'Faço em React.' })).status, 201)
    assert.equal((await chamar('post', `/servicos/${servId}/candidaturas`, bruno.token, {})).status, 201)
    assert.equal((await chamar('post', `/servicos/${servId}/candidaturas`, ana.token, {})).status, 409, 'candidatura repetida')
    assert.equal((await chamar('put', `/servicos/${servId}/candidaturas`, ana.token, { valor_proposto: 1450, prazo_proposto: 18, mensagem: 'Ajustei.' })).status, 200)
    const candAna = await db('candidatura').join('freelancer', 'candidatura.free_id', 'freelancer.free_id').where('freelancer.usu_id', anaId).first('candidatura.cand_id')
    assert.equal((await chamar('put', `/candidaturas/${candAna.cand_id}`, lucas.token, { acao: 'aceitar' })).status, 200)

    /* Chat: mensagem (id via RETURNING), editar, apagar, proposta */
    const msg = await chamar('post', '/mensagens', ana.token, { serv_id: servId, destinatario_id: lucasId, texto: 'Oi Lucas, comecei hoje!' })
    assert.equal(msg.status, 201)
    assert.ok(Number.isInteger(msg.body.msg_id), 'msg_id veio do RETURNING')
    assert.equal((await chamar('put', `/mensagens/${msg.body.msg_id}`, ana.token, { texto: 'Oi Lucas, comecei hoje cedo!' })).status, 200)
    await chamar('post', '/mensagens', lucas.token, { serv_id: servId, destinatario_id: anaId, texto: 'Ótimo!' })
    assert.equal((await chamar('delete', `/mensagens/${msg.body.msg_id}`, ana.token)).status, 200)
    await chamar('post', '/mensagens/proposta', ana.token, { serv_id: servId, destinatario_id: lucasId, valor: 1500, prazo: 15 })
    await chamar('post', '/mensagens/digitando', ana.token, { serv_id: servId, destinatario_id: lucasId })
    await chamar('post', '/mensagens/digitando', ana.token, { serv_id: servId, destinatario_id: lucasId })

    /* Acordo, garantia, etapas e critérios */
    await chamar('put', `/servicos/${servId}/acordo`, ana.token)
    await chamar('put', `/servicos/${servId}/acordo`, lucas.token)
    await chamar('post', '/carteira/credito', lucas.token, { valor: 5000 })
    await chamar('post', `/servicos/${servId}/garantia`, lucas.token)
    for (const titulo of ['Layout', 'Catálogo', 'Contato']) await chamar('post', `/servicos/${servId}/etapas`, lucas.token, { titulo })
    const etapas = await db('servico_etapa').where('serv_id', servId).orderBy('eta_ordem')
    assert.equal((await chamar('put', `/servicos/${servId}/etapas/${etapas[1].eta_id}/editar`, lucas.token, { mover: 'cima' })).status, 200)
    await chamar('put', `/servicos/${servId}/etapas/${etapas[0].eta_id}`, ana.token)
    await chamar('post', `/servicos/${servId}/etapas/${etapas[0].eta_id}/aprovar`, lucas.token)
    await chamar('post', `/servicos/${servId}/criterios`, lucas.token, { texto: 'Site funcionando no celular' })

    /* Entrega, fim e avaliações às cegas (editar e apagar) */
    await chamar('put', `/servicos/${servId}/entregar`, ana.token, { nota: 'Pronto!', link: 'https://github.com/exemplo/site' })
    assert.equal((await chamar('put', `/servicos/${servId}/finalizar`, lucas.token)).status, 200)
    assert.equal((await chamar('post', '/avaliacoes', lucas.token, { serv_id: servId, usu_avaliado: anaId, nota: 5, comentario: 'Excelente trabalho, entregou antes do prazo e com muito cuidado.' })).status, 201)
    const enviadas = await chamar('get', '/avaliacoes/enviadas', lucas.token)
    assert.equal(enviadas.body.avaliacoes[0].editavel, true)
    assert.equal((await chamar('put', `/avaliacoes/${enviadas.body.avaliacoes[0].aval_id}`, lucas.token, { nota: 4 })).status, 200)
    assert.equal((await chamar('post', '/avaliacoes', ana.token, { serv_id: servId, usu_avaliado: lucasId, nota: 5 })).status, 201)

    /* Portfólio, convite, orçamento, guilda, alertas, denúncia, notificações */
    await chamar('post', '/portfolio', ana.token, { titulo: 'Loja de cartas', descricao: 'Site com catálogo', link: 'https://exemplo.com' })
    await chamar('post', `/portfolio/de-projeto/${servId}`, ana.token, {})
    await chamar('post', '/servicos', lucas.token, { ...projeto, titulo: 'Logo da loja' })
    const logo = (await db('servico').where('serv_titulo', 'Logo da loja').first()).serv_id
    const convite = await chamar('post', '/convites', lucas.token, { serv_id: logo, usu_id: (await db('usuario').where('usu_email', 'pessoa3@teste.com').first()).usu_id, mensagem: 'Vem!' })
    assert.equal(convite.status, 201, JSON.stringify(convite.body))
    assert.equal((await chamar('delete', `/convites/${convite.body.conv_id}`, lucas.token)).status, 200)
    const pedido = await chamar('post', '/orcamentos', lucas.token, { pergunta: 'Quanto custa um logo em pixel art para a loja?', freelancers: [anaId] })
    assert.equal(pedido.status, 201)
    assert.equal((await chamar('put', `/orcamentos/${pedido.body.orc_id}`, lucas.token, { pergunta: 'Quanto custa um logo e um banner em pixel art?' })).status, 200)
    const guilda = await chamar('post', '/guildas', ana.token, { nome: 'Ordem dos Pixels', lema: 'Pixel a pixel', brasao: 'coroa', cor: 'ouro' })
    assert.equal(guilda.status, 201, JSON.stringify(guilda.body))
    assert.equal((await chamar('post', '/guildas', ana.token, { nome: 'Ordem dos Pixels', brasao: 'coroa', cor: 'ouro' })).status >= 400, true)
    await chamar('post', '/buscas', bruno.token, { termo: 'logo', valor_min: 100 })
    await chamar('post', '/denuncias', bruno.token, { alvo_tipo: 'servico', alvo_id: logo, motivo: 'spam' })
    assert.equal((await chamar('post', '/denuncias', bruno.token, { alvo_tipo: 'servico', alvo_id: logo, motivo: 'spam' })).status, 400, 'denúncia repetida')
    await chamar('put', '/notificacoes/lidas', ana.token)
    await chamar('delete', '/notificacoes', ana.token)

    /* Administração: categorias (com busca sem diferenciar maiúsculas) */
    assert.equal((await chamar('post', '/admin/categorias', admin, { nome: 'Fotografia' })).status, 201)
    assert.equal((await chamar('post', '/admin/categorias', admin, { nome: 'fotografia' })).status, 400, 'nome repetido')
    const busca = await chamar('get', '/admin/usuarios?busca=ANA', admin)
    assert.ok(JSON.stringify(busca.body).includes('Ana Freelancer'), 'busca com ILIKE')

    /* Todas as rotas GET da documentação, com cada papel */
    const { body: docs } = await request(app).get('/docs/openapi.json')
    const ids = { id: servId, servId, usuId: anaId, free_id: anaId, outroId: lucasId, tipoId: 1, msgId: msg.body.msg_id, etaId: etapas[0].eta_id }
    const tokens = [lucas.token, ana.token, admin, null]
    let chamadas = 0
    for (const [caminho, metodos] of Object.entries(docs.paths)) {
        if (!metodos.get || caminho.startsWith('/tarefas') || caminho === '/mensagens/novas' || caminho.startsWith('/docs')) continue
        const real = caminho.replace(/\{(\w+)\}/g, (_x, nome) => String(ids[nome] ?? servId))
        for (const token of tokens) {
            await chamar('get', real, token)
            chamadas++
        }
    }
    assert.ok(chamadas > 300, `poucas rotas chamadas: ${chamadas}`)

    assert.deepEqual(erros500, [], `rotas com erro 500 no PostgreSQL:\n${erros500.join('\n')}`)
})
