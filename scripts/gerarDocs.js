/*
 * Gera a documentação da API (OpenAPI 3) lendo as rotas de verdade:
 * src/app.js diz o prefixo de cada arquivo e src/routes/*.js diz método, caminho, login e papel.
 *
 *   npm run docs        -> grava src/docs/openapi.js
 *   npm test            -> confere se o arquivo está em dia com as rotas
 *
 * O resumo de cada rota sai do nome da função do controller (listarFavoritos -> "Listar favoritos")
 * e o comentário logo acima da rota, quando existe, vira a descrição.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ARQUIVO_DOCS = path.join(RAIZ, 'src', 'docs', 'openapi.js')

/* O que cada grupo de rotas faz (aparece como seção na página /docs) */
const GRUPOS = {
    '/auth': 'Login, cadastro, verificação em 2 etapas e sessões',
    '/usuarios': 'Conta, perfil, disponibilidade, ganhos, mascote, visitas e favoritos',
    '/servicos': 'Projetos, candidaturas, entrega, acordo, garantia, etapas, bônus e recibo',
    '/tipos-servico': 'Categorias de projeto',
    '/candidaturas': 'Candidaturas dos freelancers',
    '/mensagens': 'Chat: mensagens, propostas, reuniões, digitando e visto',
    '/historico': 'Histórico de projetos',
    '/portfolio': 'Portfólio dos freelancers',
    '/perfil': 'Perfis com XP, insígnias e avaliações',
    '/avaliacoes': 'Avaliações (às cegas por 7 dias)',
    '/notificacoes': 'Sino de notificações',
    '/convites': 'Convites de contratantes para freelancers',
    '/admin': 'Painel da administração',
    '/config': 'Cenário do site',
    '/missoes': 'Missões da semana e do dia',
    '/ranking': 'Ranking e temporadas',
    '/publico': 'Rotas sem login: home, perfil público e certificado',
    '/push': 'Avisos no celular (Web Push)',
    '/denuncias': 'Denúncias',
    '/passos': 'Primeiros passos do freelancer',
    '/buscas': 'Alertas de busca',
    '/conquistas': 'Conquistas secretas e álbum de insígnias',
    '/carteira': 'Carteira fictícia (simulação de pagamento)',
    '/loja': 'Loja de cosméticos com XP',
    '/eventos': 'Eventos sazonais',
    '/tarefas': 'Tarefas agendadas (Vercel Cron)',
    '/guildas': 'Guildas de freelancers',
    '/testes': 'Testes de habilidade',
    '/docs': 'Esta documentação'
}

const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8')

/* "listarServicosAbertos" -> "Listar servicos abertos" */
function resumoDe(handler) {
    const nome = handler.split('.').pop().replace(/[^A-Za-z0-9]/g, '')
    const palavras = nome.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
    return palavras ? palavras[0].toUpperCase() + palavras.slice(1) : handler
}

/* De app.js: qual arquivo/roteador fica em qual prefixo */
function montagens() {
    const app = ler('src/app.js')
    const origem = new Map()
    for (const [, nome, arquivo] of app.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/(\w+)\.js'/g)) origem.set(nome, { arquivo, roteador: 'router' })
    for (const [, nomes, arquivo] of app.matchAll(/import\s+\{([^}]+)\}\s+from\s+'\.\/routes\/(\w+)\.js'/g)) {
        for (const nome of nomes.split(',').map((n) => n.trim()).filter(Boolean)) origem.set(nome, { arquivo, roteador: nome })
    }
    const lista = []
    for (const [, prefixo, nome] of app.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)) {
        if (origem.has(nome)) lista.push({ prefixo, ...origem.get(nome) })
    }
    return lista
}

/* Papéis exigidos numa linha de rota (direto ou por variável do arquivo) */
function papeisDe(trecho, variaveis) {
    const papeis = new Set()
    for (const [, lista] of trecho.matchAll(/exigirPapel\(([^)]*)\)/g)) for (const [, p] of lista.matchAll(/'(\w+)'/g)) papeis.add(p)
    for (const [nome, lista] of variaveis) if (new RegExp(`\\b${nome}\\b`).test(trecho)) lista.forEach((p) => papeis.add(p))
    if (/\bexigirAdmin\b/.test(trecho)) papeis.add('administrador')
    if (/\bexigirSupremo\b/.test(trecho)) papeis.add('supremo')
    return [...papeis]
}

function rotasDoArquivo({ prefixo, arquivo, roteador }) {
    const texto = ler(`src/routes/${arquivo}.js`)
    const linhas = texto.split('\n')
    const variaveis = new Map()
    for (const [, nome, lista] of texto.matchAll(/const\s+(\w+)\s*=\s*exigirPapel\(([^)]*)\)/g)) {
        variaveis.set(nome, [...lista.matchAll(/'(\w+)'/g)].map((m) => m[1]))
    }
    /* router.use(auth, exigirAdmin) no começo vale para o arquivo todo */
    const geral = linhas.find((l) => l.startsWith(`${roteador}.use(`)) ?? ''
    const loginGeral = /\bauth\b/.test(geral)
    const papeisGerais = papeisDe(geral, variaveis)

    const rotas = []
    let comentario = null
    for (const linha of linhas) {
        const c = linha.trim().match(/^\/\*\s*(.+?)\s*\*\/$/)
        if (c) {
            comentario = c[1]
            continue
        }
        const m = linha.match(new RegExp(`^${roteador}\\.(get|post|put|patch|delete)\\('([^']*)',\\s*(.+)\\)\\s*$`))
        if (!m) {
            if (linha.trim() === '') comentario = null
            continue
        }
        const [, metodo, caminho, resto] = m
        const partes = resto.split(',').map((p) => p.trim())
        const handler = partes[partes.length - 1].startsWith('(') ? 'resposta direta' : partes[partes.length - 1]
        const completo = (prefixo + (caminho === '/' ? '' : caminho)).replace(/\/+$/, '') || '/'
        rotas.push({
            metodo,
            caminho: completo.replace(/:(\w+)/g, '{$1}'),
            parametros: [...completo.matchAll(/:(\w+)/g)].map((p) => p[1]),
            login: loginGeral || /\bauth\b/.test(resto),
            papeis: [...new Set([...papeisGerais, ...papeisDe(resto, variaveis)])],
            resumo: resumoDe(handler),
            descricao: comentario,
            grupo: prefixo
        })
    }
    return rotas
}

export function gerarEspecificacao() {
    const rotas = montagens().flatMap(rotasDoArquivo)
    const paths = {}
    for (const r of rotas) {
        const partes = []
        if (r.descricao) partes.push(r.descricao + '.')
        if (r.papeis.length) partes.push(`Papel: ${r.papeis.join(' ou ')}.`)
        paths[r.caminho] ??= {}
        paths[r.caminho][r.metodo] = {
            tags: [r.grupo],
            summary: r.resumo,
            ...(partes.length ? { description: partes.join(' ') } : {}),
            ...(r.parametros.length ? { parameters: r.parametros.map((nome) => ({ name: nome, in: 'path', required: true, schema: { type: 'string' } })) } : {}),
            ...(r.login ? { security: [{ token: [] }] } : {}),
            responses: {
                200: { description: 'Deu certo (JSON)' },
                ...(['post', 'put', 'patch', 'delete'].includes(r.metodo) ? { 400: { description: 'Dados inválidos: { erro }' } } : {}),
                ...(r.login ? { 401: { description: 'Sem login ou sessão encerrada' } } : {}),
                ...(r.papeis.length ? { 403: { description: 'Papel sem permissão' } } : {})
            }
        }
    }
    const usados = [...new Set(rotas.map((r) => r.grupo))]
    return {
        openapi: '3.0.3',
        info: {
            title: 'API do ContrateJá',
            version: '1.0.0',
            description:
                'Backend do TCC ContrateJá (Express + MySQL). Erros vêm como { "erro": "mensagem" }. ' +
                'Para testar as rotas com cadeado, faça login em POST /auth/login e cole o token em "Authorize". ' +
                'Pagamentos são simulação: nenhum dinheiro de verdade passa pela carteira.'
        },
        tags: usados.map((g) => ({ name: g, description: GRUPOS[g] ?? '' })),
        components: { securitySchemes: { token: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
        paths
    }
}

export const conteudoDoArquivo = (especificacao) =>
    `/* Gerado por scripts/gerarDocs.js (npm run docs). Não edite à mão. */\nexport default ${JSON.stringify(especificacao, null, 4)}\n`

/* Rodando direto: grava o arquivo */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const especificacao = gerarEspecificacao()
    fs.mkdirSync(path.dirname(ARQUIVO_DOCS), { recursive: true })
    fs.writeFileSync(ARQUIVO_DOCS, conteudoDoArquivo(especificacao))
    console.log(`Documentação gerada: ${Object.keys(especificacao.paths).length} caminhos em src/docs/openapi.js`)
}
