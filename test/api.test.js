/*
 * Testes das rotas que respondem antes de tocar no banco: segurança, validação e permissões.
 * Rodam sem MySQL (npm test). As regras com banco são conferidas pelo site no modo demonstração.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'

process.env.JWT_SECRET ??= 'segredo-dos-testes'
const { default: app } = await import('../src/app.js')

describe('segurança', () => {
    test('cabeçalhos de segurança em toda resposta', async () => {
        const r = await request(app).get('/auth')
        assert.equal(r.status, 200)
        assert.equal(r.headers['x-content-type-options'], 'nosniff')
        assert.equal(r.headers['x-frame-options'], 'DENY')
        assert.equal(r.headers['x-powered-by'], undefined)
    })

    test('rota logada sem token responde 401', async () => {
        for (const caminho of ['/servicos/abertos', '/carteira', '/loja', '/eventos', '/usuarios/eu/dados', '/auth/sessoes', '/guildas', '/testes', '/usuarios/favoritos', '/usuarios/eu/visitas', '/conquistas/album', '/servicos/1/recibo']) {
            const r = await request(app).get(caminho)
            assert.equal(r.status, 401, caminho)
        }
    })

    test('token inválido ou mal formatado responde 401', async () => {
        const r1 = await request(app).get('/carteira').set('Authorization', 'Bearer nao-e-um-jwt')
        const r2 = await request(app).get('/carteira').set('Authorization', 'Basic abc')
        assert.equal(r1.status, 401)
        assert.equal(r2.status, 401)
    })

    test('tarefas agendadas fecham sem o segredo do cron', async () => {
        delete process.env.CRON_SECRET
        const r = await request(app).get('/tarefas/lembretes')
        assert.equal(r.status, 401)
        process.env.CRON_SECRET = 'abc123'
        const r2 = await request(app).get('/tarefas/resumo').set('Authorization', 'Bearer errado')
        assert.equal(r2.status, 401)
    })
})

describe('validação antes do banco', () => {
    test('login sem e-mail e senha', async () => {
        const r = await request(app).post('/auth/login').send({})
        assert.equal(r.status, 400)
        assert.match(r.body.erro, /obrigatórios/)
    })

    test('contato com mensagem curta ou e-mail errado', async () => {
        const curta = await request(app).post('/publico/contato').send({ nome: 'Ana', assunto: 'Oi', email: 'ana@x.com', mensagem: 'oi' })
        assert.equal(curta.status, 400)
        const email = await request(app).post('/publico/contato').send({ nome: 'Ana', assunto: 'Oi', email: 'ana', mensagem: 'Mensagem bem comprida aqui.' })
        assert.equal(email.status, 400)
    })

    test('certificado com número inválido', async () => {
        const r = await request(app).get('/publico/certificado/abc')
        assert.equal(r.status, 404)
    })
})

describe('documentação', () => {
    test('/docs abre o Swagger', async () => {
        const r = await request(app).get('/docs')
        assert.equal(r.status, 200)
        assert.match(r.text, /swagger-ui/)
    })

    test('/docs/openapi.json lista as rotas novas com cadeado', async () => {
        const r = await request(app).get('/docs/openapi.json')
        assert.equal(r.status, 200)
        assert.equal(r.body.openapi, '3.0.3')
        assert.ok(r.body.paths['/guildas'].post.security)
        assert.ok(r.body.paths['/servicos/{id}/etapas/{etaId}/aprovar'].post)
        assert.equal(r.body.paths['/publico/certificado/{servId}'].get.security, undefined)
    })

    test('rotas escritas em várias linhas também entram na documentação', async () => {
        const r = await request(app).get('/docs/openapi.json')
        for (const caminho of ['/tipos-servico', '/publico/numeros', '/insignias/{free_id}']) assert.ok(r.body.paths[caminho]?.get, caminho)
    })
})

describe('excluir e cancelar o próprio projeto', () => {
    test('sem login responde 401', async () => {
        const excluir = await request(app).delete('/servicos/1')
        const cancelar = await request(app).put('/servicos/1/cancelar')
        assert.equal(excluir.status, 401)
        assert.equal(cancelar.status, 401)
    })

    test('documentadas, com cadeado e só para contratante', async () => {
        const r = await request(app).get('/docs/openapi.json')
        const excluir = r.body.paths['/servicos/{id}'].delete
        const cancelar = r.body.paths['/servicos/{id}/cancelar'].put
        assert.ok(excluir.security && cancelar.security)
        assert.match(JSON.stringify(excluir) + JSON.stringify(cancelar), /contratante/)
    })
})

describe('CRUD completo (categorias, notificações, candidatura, convite, chat, avaliações e mais)', () => {
    const ROTAS = [
        ['get', '/admin/categorias'], ['post', '/admin/categorias'], ['put', '/admin/categorias/1'], ['delete', '/admin/categorias/1'],
        ['put', '/notificacoes/1'], ['delete', '/notificacoes/1'], ['delete', '/notificacoes'],
        ['put', '/servicos/1/candidaturas'],
        ['delete', '/convites/1'],
        ['put', '/mensagens/1'], ['delete', '/mensagens/1'],
        ['get', '/avaliacoes/enviadas'], ['put', '/avaliacoes/1'], ['delete', '/avaliacoes/1'],
        ['put', '/buscas/1'],
        ['put', '/servicos/1/etapas/1/editar'],
        ['put', '/orcamentos/1'], ['delete', '/orcamentos/1'],
        ['delete', '/guildas/1'],
        ['get', '/denuncias/minhas'], ['delete', '/denuncias/1']
    ]

    test('todas pedem login', async () => {
        for (const [metodo, caminho] of ROTAS) {
            const r = await request(app)[metodo](caminho)
            assert.equal(r.status, 401, `${metodo.toUpperCase()} ${caminho}`)
        }
    })

    test('todas estão na documentação, com o papel certo', async () => {
        const { body } = await request(app).get('/docs/openapi.json')
        for (const [metodo, caminho] of ROTAS) {
            const chave = Object.keys(body.paths).find((p) => new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(caminho) && body.paths[p][metodo])
            assert.ok(chave, `${metodo.toUpperCase()} ${caminho} na documentação`)
            assert.ok(body.paths[chave][metodo].security, `${metodo.toUpperCase()} ${caminho} com cadeado`)
        }
        assert.match(JSON.stringify(body.paths['/admin/categorias'].post), /administrador/)
        assert.match(JSON.stringify(body.paths['/convites/{id}'].delete), /contratante/)
        assert.match(JSON.stringify(body.paths['/guildas/{id}'].delete), /freelancer/)
    })

    test('a migration nova está na lista do servidor', async () => {
        const { MIGRACOES } = await import('../src/database/migracoes.js')
        assert.ok(MIGRACOES['20261126000000_crud_completo.js'])
    })
})
