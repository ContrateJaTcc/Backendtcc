/* Regras puras (sem banco): sequência de dias, calendário de eventos, disponibilidade e certificado */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ??= 'segredo-dos-testes'
const { calcularSequencia } = await import('../src/controllers/contaController.js')
const { eventoAtual } = await import('../src/services/eventos.js')
const { disponibilidadeDe } = await import('../src/services/aparencia.js')
const { codigoCertificado } = await import('../src/controllers/publicoController.js')
const { temContatoExterno } = await import('../src/services/contatoExterno.js')
const { corrigir, areaDaCategoria, perguntasPublicas, BANCO } = await import('../src/services/testes.js')
const { gerarEspecificacao, conteudoDoArquivo, ARQUIVO_DOCS } = await import('../scripts/gerarDocs.js')
const fs = await import('fs')

describe('sequência de dias', () => {
    test('dias seguidos contam', () => {
        const s = calcularSequencia(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24')
        assert.equal(s.dias, 3)
        assert.equal(s.hoje, true)
        assert.equal(s.ultimos7.length, 7)
    })

    test('um dia perdido não apaga a chama (mas não conta)', () => {
        const s = calcularSequencia(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24'], '2026-10-24')
        assert.equal(s.dias, 4)
    })

    test('dois dias seguidos sem entrar apagam', () => {
        const s = calcularSequencia(['2026-10-19', '2026-10-20', '2026-10-23', '2026-10-24'], '2026-10-24')
        assert.equal(s.dias, 2)
    })

    test('ainda não entrou hoje e perdeu ontem: chama em risco', () => {
        const s = calcularSequencia(['2026-10-21', '2026-10-22'], '2026-10-24')
        assert.equal(s.dias, 2)
        assert.equal(s.em_risco, true)
    })
})

describe('calendário de eventos', () => {
    const em = (texto) => eventoAtual(new Date(`${texto}T15:00:00Z`))

    test('Halloween de 20 a 31 de outubro', () => {
        assert.equal(em('2026-10-24')?.codigo, 'halloween')
        assert.equal(em('2026-10-19'), null)
        assert.equal(em('2026-11-01'), null)
    })

    test('Ano Novo atravessa a virada e guarda o ano em que começou', () => {
        assert.equal(em('2026-12-30')?.codigo, 'ano_novo')
        assert.equal(em('2027-01-03')?.codigo, 'ano_novo')
        assert.equal(em('2027-01-03')?.ano, 2026)
    })

    test('Carnaval segue a Páscoa (2027: terça-feira 9 de fevereiro)', () => {
        assert.equal(em('2027-02-09')?.codigo, 'carnaval')
        assert.equal(em('2027-02-12'), null)
    })

    test('Natal e Festa Junina', () => {
        assert.equal(em('2026-12-10')?.codigo, 'natal')
        assert.equal(em('2027-06-15')?.codigo, 'festa_junina')
    })
})

describe('disponibilidade', () => {
    test('ocupado até uma data que já passou volta a ser disponível', () => {
        assert.deepEqual(disponibilidadeDe({ usu_disponibilidade: 'ocupado', usu_disponivel_ate: '2020-01-01' }), { status: 'disponivel', ate: null })
    })

    test('de férias até o futuro', () => {
        const d = disponibilidadeDe({ usu_disponibilidade: 'ferias', usu_disponivel_ate: '2999-01-10' })
        assert.equal(d.status, 'ferias')
        assert.equal(d.ate, '2999-01-10')
    })
})

describe('contato por fora no chat', () => {
    test('telefone, e-mail e aplicativos ganham aviso', () => {
        assert.equal(temContatoExterno('me chama no zap'), true)
        assert.equal(temContatoExterno('meu número é (24) 99999-1234'), true)
        assert.equal(temContatoExterno('manda para ana.silva@gmail.com'), true)
        assert.equal(temContatoExterno('Fala no WhatsApp'), true)
    })

    test('conversa normal e valores não', () => {
        assert.equal(temContatoExterno('Consigo entregar em 10 dias por R$ 1.500,00'), false)
        assert.equal(temContatoExterno('A página inicial já está pronta, falta o carrinho.'), false)
        assert.equal(temContatoExterno(''), false)
    })
})

describe('testes de habilidade', () => {
    test('a categoria acha a área pelo nome', () => {
        assert.equal(areaDaCategoria('Desenvolvimento Web'), 'web')
        assert.equal(areaDaCategoria('Design Gráfico'), 'design')
        assert.equal(areaDaCategoria('Redação e Tradução'), 'redacao')
        assert.equal(areaDaCategoria('Manutenção'), null)
    })

    test('o site recebe as perguntas sem o gabarito', () => {
        assert.equal(perguntasPublicas('web').some((p) => 'certa' in p), false)
    })

    test('passa com 4 de 5 e a correção bate com o gabarito', () => {
        const certas = BANCO.design.perguntas.map((p) => p.certa)
        assert.equal(corrigir('design', certas).aprovado, true)
        const errandoDuas = certas.map((c, i) => (i < 2 ? (c + 1) % 4 : c))
        const r = corrigir('design', errandoDuas)
        assert.equal(r.acertos, 3)
        assert.equal(r.aprovado, false)
    })
})

describe('documentação da API', () => {
    test('src/docs/openapi.js está em dia com as rotas (rode npm run docs)', () => {
        assert.equal(fs.readFileSync(ARQUIVO_DOCS, 'utf8').replace(/\r\n/g, '\n'), conteudoDoArquivo(gerarEspecificacao()))
    })
})

describe('certificado', () => {
    test('o código muda com o projeto e é sempre o mesmo para o mesmo projeto', () => {
        assert.equal(codigoCertificado(103), codigoCertificado(103))
        assert.notEqual(codigoCertificado(103), codigoCertificado(104))
        assert.match(codigoCertificado(103), /^[0-9A-F]{8}$/)
    })
})

describe('validação do cadastro', async () => {
    const v = await import('../src/services/validacao.js')

    test('CPF: confere os dígitos verificadores', () => {
        assert.equal(v.erroCpf('529.982.247-25'), '')
        assert.equal(v.erroCpf('52998224725'), '')
        assert.match(v.erroCpf('529.982.247-26'), /não existe/)
        assert.match(v.erroCpf('111.111.111-11'), /não existe/)
        assert.match(v.erroCpf('123'), /inválido/)
    })

    test('telefone: DDD real, celular com 9, fixo de 2 a 5', () => {
        assert.equal(v.erroTelefone('(24) 99999-0000'), '')
        assert.equal(v.erroTelefone('1133334444'), '')
        assert.match(v.erroTelefone('(20) 91234-5678'), /DDD 20/)
        assert.match(v.erroTelefone('(11) 81234-5678'), /começa com 9/)
        assert.match(v.erroTelefone('(11) 9999-9999'), /não parece real/)
        assert.match(v.erroTelefone('1191234'), /inválido/)
    })

    test('cidade precisa existir no estado e sai com o nome oficial', () => {
        assert.deepEqual(v.conferirLocal('sao jose dos campos', 'sp'), { cidade: 'São José dos Campos', estado: 'SP' })
        assert.match(v.conferirLocal('Cidade Inventada', 'RJ').erro, /Não achamos/)
        assert.match(v.conferirLocal('Volta Redonda', 'SP').erro, /em SP/)
        assert.match(v.conferirLocal('Volta Redonda', 'XX').erro, /Estado inválido/)
    })

    test('nascimento: 18 anos ou mais, sem data no futuro', () => {
        const hoje = new Date(2026, 9, 25)
        assert.equal(v.erroNascimento('2008-10-25', hoje), '')
        assert.match(v.erroNascimento('2008-10-26', hoje), /18 anos/)
        assert.match(v.erroNascimento('2030-01-01', hoje), /futuro/)
        assert.match(v.erroNascimento('1890-01-01', hoje), /ano/)
        assert.match(v.erroNascimento('ontem', hoje), /inválida/)
    })

    test('senha e nome', () => {
        assert.equal(v.erroSenha('castelo-roxo'), '')
        assert.match(v.erroSenha('123456'), /fácil/)
        assert.match(v.erroSenha('abc'), /pelo menos/)
        assert.equal(v.erroNome('Ana Lúcia D\'Ávila'), '')
        assert.match(v.erroNome('Ana123'), /letras/)
    })
})

describe('avisos por tipo', async () => {
    const a = await import('../src/services/avisos.js')

    test('cada título cai na categoria certa; aviso da conta não tem categoria', () => {
        assert.equal(a.categoriaDoAviso('Pagamento guardado'), 'pagamentos')
        assert.equal(a.categoriaDoAviso('Nova proposta'), 'mensagens')
        assert.equal(a.categoriaDoAviso('Prazo vencido'), 'projetos')
        assert.equal(a.categoriaDoAviso('Nova insígnia desbloqueada!'), 'conquistas')
        assert.equal(a.categoriaDoAviso('Seu papel mudou'), null)
    })

    test('só o desligado é guardado; aviso da conta sempre chega', () => {
        const prefs = a.lerPreferencia(JSON.stringify(a.limparPreferencia({ sino: { conquistas: false }, celular: { mensagens: true } })))
        assert.equal(prefs.sino.conquistas, false)
        assert.equal(prefs.sino.mensagens, true)
        assert.equal(a.avisoLigado(prefs, 'sino', 'Nova insígnia desbloqueada!'), false)
        assert.equal(a.avisoLigado(prefs, 'sino', 'Conta reativada'), true)
        assert.deepEqual(a.limparPreferencia({ sino: { inventada: false } }), {})
    })
})

describe('filtro de spam', async () => {
    const m = await import('../src/services/moderacao.js')

    test('pega termo de golpe, link encurtado, valor absurdo e título gritando', () => {
        assert.match(m.motivosDeSpam({ titulo: 'Ganhe dinheiro fácil', descricao: 'pix antecipado', valor: 100, tipo_valor: 'fixo' }).join(), /termo suspeito/)
        assert.match(m.motivosDeSpam({ titulo: 'Divulgação', descricao: 'veja bit.ly/abc', valor: 100, tipo_valor: 'fixo' }).join(), /link encurtado/)
        assert.match(m.motivosDeSpam({ titulo: 'Site', descricao: 'Loja virtual', valor: 5000, tipo_valor: 'hora' }).join(), /valor fora do normal/)
        assert.match(m.motivosDeSpam({ titulo: 'URGENTE PRECISO DE SITE', descricao: 'Loja virtual', valor: 500, tipo_valor: 'fixo' }).join(), /gritando/)
    })

    test('projeto normal passa (WhatsApp como recurso do site não é spam)', () => {
        assert.deepEqual(m.motivosDeSpam({ titulo: 'Site para cafeteria', descricao: 'Site com cardápio e pedidos pelo WhatsApp', valor: 1200, tipo_valor: 'fixo' }), [])
        assert.deepEqual(m.motivosDeSpam({ titulo: 'Criptografia de arquivos', descricao: 'Script em Python', valor: 300, tipo_valor: 'fixo' }), [])
    })
})

describe('migrations', () => {
    test('toda migration da pasta está na lista usada pelo servidor', async () => {
        const { MIGRACOES } = await import('../src/database/migracoes.js')
        const pasta = fs.readdirSync(new URL('../src/database/migrations/', import.meta.url)).filter((f) => f.endsWith('.js')).sort()
        assert.deepEqual(Object.keys(MIGRACOES).sort(), pasta)
        for (const nome of pasta) assert.equal(typeof MIGRACOES[nome].up, 'function', nome)
    })
})
