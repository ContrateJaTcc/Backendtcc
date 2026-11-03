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
})
