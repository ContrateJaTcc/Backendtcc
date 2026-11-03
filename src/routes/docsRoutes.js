import express from 'express'
import especificacao from '../docs/openapi.js'

/*
 * Documentação da API: /docs abre o Swagger UI (dá para testar as rotas pelo navegador)
 * e /docs/openapi.json entrega a especificação crua. O arquivo sai de scripts/gerarDocs.js.
 */
const router = express.Router()

const SWAGGER = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14'

const pagina = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>API do ContrateJá</title>
<link rel="stylesheet" href="${SWAGGER}/swagger-ui.css" />
<style>
  body { margin: 0; background: #fafafa; }
  .topbar { display: none; }
  .faixa { background: #1b1b30; color: #ffd45e; font: 600 15px system-ui, sans-serif; padding: 12px 20px; }
</style>
</head>
<body>
<div class="faixa">ContrateJá · documentação da API</div>
<div id="swagger"></div>
<script src="${SWAGGER}/swagger-ui-bundle.js" crossorigin></script>
<script>
  window.ui = SwaggerUIBundle({ url: './docs/openapi.json', dom_id: '#swagger', persistAuthorization: true, docExpansion: 'none', filter: true })
</script>
</body>
</html>`

/* Com ou sem barra no fim, a especificação fica em /docs/openapi.json */
router.get('/', (req, res) => {
    const base = req.originalUrl.endsWith('/') ? './openapi.json' : './docs/openapi.json'
    res.type('html').send(pagina.replace("'./docs/openapi.json'", `'${base}'`))
})

router.get('/openapi.json', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.json(especificacao)
})

export default router
