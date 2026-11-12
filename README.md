Contrate Já - Backend

SOBRE O PROJETO:
 API desenvolvida para o Trabalho de Conclusão de Curso, responsável pelo gerenciamento de autenticação e comunicação com o banco de dados da plataforma Contrate Já.
A plataforma tem como objetivo conectar contratantes e trabalhadores autônomos utilizando elementos de gamificação, como níveis, experiência e insígnias.

TECNOLOGIAS UTILIZADAS:
- Node.js + Express
- MySQL (Knex para consultas e migrações)
- JWT e bcrypt (login e senhas)
- Nodemailer (e-mails), web-push (avisos no celular)
- Vercel (hospedagem e tarefas agendadas)

FUNCIONALIDADES:

- Cadastro, login (senha ou Google), confirmação de e-mail e "esqueci minha senha"
- Perfis de contratante e freelancer, portfólio e avaliações
- Serviços, candidaturas, contratações, orçamentos e etapas
- Mensagens, notificações e avisos push
- Gamificação: níveis, XP, insígnias, conquistas, missões semanais, ranking, loja e guildas
- Painel de administração e moderação (denúncias, banimentos, registro de ações)
- Documentação da API em /docs

COMO RODAR:

1. npm install
2. Copiar .env.example para .env.local e preencher
3. npm run testar-banco   (confere a conexão com o MySQL)
4. npm run migrate
5. npm run dev
Testes (sem banco): npm test

ESTRUTURA DO PROJETO:

server.js            inicia o servidor
src
 ├── app.js          monta o Express e as rotas
 ├── config          conexão com o banco e conta do supremo
 ├── controllers     lógica de cada rota
 ├── dados           dados fixos (cidades)
 ├── database        migrações e seeds
 ├── docs            documentação OpenAPI
 ├── middleware      autenticação, papéis e segurança
 ├── models          consultas de usuário
 ├── routes          definição das rotas
 └── services        e-mail, push, gamificação, agendador etc.
scripts              criar admin/supremo, trocar senha, gerar docs
test                 testes automatizados

ADMINISTRADOR SUPREMO:

Existe um só: a conta lucas@gmail.com (fixa em src/config/supremo.js). Nenhuma tela, rota ou script
transforma outra conta em supremo. Ele modera e exclui qualquer conta (até de outros admins), muda o papel
das pessoas, entra no site como qualquer conta, manda notificações para todos e controla o cenário do site
inteiro (tema, clima, fogos e faixa de aviso).

1. Rodar a migração (cria a tabela config_site):
   npm run migrate
2. Criar a conta do supremo (ou atualizar a senha dela):
   npm run criar-supremo -- "SuaSenha"
3. Publicar o backend de novo na Vercel.

Rotas novas:
- GET  /config/cenario               (público) cenário que vale para todos
- PUT  /admin/cenario                (supremo) { tema, clima, aviso, fogos }
- PUT  /admin/usuarios/:id/papel     (supremo) { tipo }
- POST /admin/usuarios/:id/entrar    (supremo) devolve um token da conta escolhida
- DELETE /admin/usuarios/:id         (supremo)
- POST /admin/avisos                 (supremo) { titulo, descricao, para }

TROCAR A SENHA DE UMA CONTA:

Quando o e-mail de "Esqueci minha senha" não chega, quem tem acesso ao banco define uma senha nova:
   npm run trocar-senha -- email@exemplo.com "SenhaNova"
(A senha antiga não aparece em lugar nenhum: o banco só guarda o hash bcrypt.)

REGISTRO, MISSÕES, RANKING E CÓDIGO DO SUPREMO:

Rodar a migração (cria admin_registro, codigo_login, missao_resgate e xp_evento):
   npm run migrate

- Registro de ações: toda ação de admin (banir, cancelar, mudar papel, entrar como, excluir, avisos,
  cenário) e tudo o que o supremo altera "entrando como" alguém fica em admin_registro.
  GET /admin/registro (supremo).
- Código por e-mail: o login do supremo pede um código de 6 números mandado por e-mail
  (POST /auth/codigo). Só vale quando o e-mail está configurado (SMTP_HOST, SMTP_USER, SMTP_PASS);
  sem isso o login segue só com senha, para o supremo não ficar trancado para fora.
  Para desligar de propósito: SUPREMO_SEM_CODIGO=1.
- Manter conectado: POST /auth/login com { lembrar: true } dá sessão de 30 dias (supremo: 12 horas).
- Missões da semana (freelancer): GET /missoes e POST /missoes/:codigo/resgatar. Renovam toda
  segunda-feira (horário de Brasília).
- Ranking: GET /ranking?periodo=mes|geral. O do mês usa xp_evento, que só começa a contar
  depois da migração.

DENÚNCIAS, IMAGENS NO CHAT, AVISOS NO CELULAR E PRIMEIROS PASSOS:

Rodar a migração (cria denuncia, push_inscricao, passo_resgate e a coluna mensagem.msg_imagem):
   npm run migrate

- Denúncias: POST /denuncias (freelancer/contratante), GET e PUT /admin/denuncias (admins).
- Imagem no chat: POST /mensagens aceita { imagem } (data URI de até ~200 KB, já diminuída no site).
- Primeiros passos (freelancer): GET /passos e POST /passos/:codigo/resgatar (+20 XP cada).
- Avisos no celular (Web Push): mensagem nova, contratação, convite, insígnia, conta reativada etc.
  Só liga com as chaves nas variáveis de ambiente da Vercel. Gerar uma vez com:
     npx web-push generate-vapid-keys
  e cadastrar VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_EMAIL (ex.: mailto:seu@email.com).
  Sem as chaves, o resto funciona e a opção aparece desligada no site.
