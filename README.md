# MSK Studio Pro

PROMPT MESTRE — MSK AGENTE · PAINEL PROFISSIONAL DE EDIÇÃO

Quero criar uma aplicação web completa chamada:

MSK AGENTE — PAINEL PROFISSIONAL

IMPORTANTE:

Este painel NÃO é apenas um dashboard administrativo.

Ele deve funcionar como uma CENTRAL COMPLETA DE EDIÇÃO DE PROJETOS conectada ao meu MSK Agente, GitHub e projetos Lovable.

O painel deve abrir em uma ABA PRÓPRIA DO NAVEGADOR, como um site/aplicação independente.

A extensão MSK continuará existindo dentro da Lovable com o popup em formato de iPhone.

Dentro desse popup haverá o botão:

“ABRIR PAINEL PROFISSIONAL”

Ao clicar nele:

1. abrir uma nova aba;

2. carregar o Painel Profissional MSK;

3. reconhecer automaticamente o usuário logado;

4. reconhecer a licença;

5. reconhecer o projeto Lovable ativo;

6. reconhecer o GitHub conectado;

7. continuar exatamente a mesma sessão do MSK Agente;

8. permitir continuar a edição pelo painel sem perder conversa, histórico ou projeto selecionado.

NÃO criar dois agentes diferentes.

O popup e o Painel Profissional são DUAS INTERFACES PARA O MESMO MSK AGENTE.

==================================================

1. CONCEITO PRINCIPAL

==================================================

Quero uma interface semelhante à experiência de um editor profissional de aplicações.

Não copiar identidade visual proprietária da Lovable.

Criar identidade própria MSK.

Layout principal:

ESQUERDA:

- projetos;

- chat da IA;

- histórico;

- arquivos/anexos;

- ações rápidas.

CENTRO:

- preview do projeto.

TOPO:

- projeto atual;

- GitHub;

- branch;

- status;

- dispositivo;

- atualizar preview;

- publicar.

DIREITA opcional:

- informações da execução;

- arquivos alterados;

- commits;

- propriedades do projeto.

O usuário deve conseguir editar seu projeto inteiro sem precisar ficar dentro da interface da Lovable.

==================================================

2. PREVIEW DO PROJETO

==================================================

Criar uma área central chamada:

PREVIEW DO PROJETO

Ela deve refletir o projeto selecionado.

Deve possuir os modos:

DESKTOP

TABLET

MOBILE

Botões no topo:

[ Desktop ] [ Tablet ] [ Mobile ]

Desktop:

largura máxima disponível.

Tablet:

aproximadamente 768px.

Mobile:

aproximadamente 390px.

O preview deve ser responsivo e centralizado.

Criar também:

- recarregar preview;

- abrir preview em nova aba;

- zoom;

- 100%;

- ajustar à tela;

- tela cheia.

Quando o MSK Agente terminar uma edição:

1. commit GitHub concluído;

2. sincronização concluída;

3. botão “Atualizar Preview” deve ativar;

4. preview deve recarregar;

5. mostrar a nova versão.

Mostrar estados:

● Preview sincronizado

● Atualização disponível

● Atualizando

● Erro no preview

Não mostrar preview falso.

Sempre utilizar o projeto real selecionado.

==================================================

3. IDENTIFICAÇÃO DO PROJETO LOVABLE

==================================================

O sistema precisa trabalhar com:

project_id Lovable

nome do projeto

URL

repositório GitHub

branch

preview URL

deploy URL

última sincronização

Quando o usuário estiver dentro de:

lovable.dev/projects/{PROJECT_ID}

a extensão deve identificar automaticamente PROJECT_ID.

Salvar no backend:

active_project_id

Também manter localmente para recuperação rápida.

Ao abrir o Painel Profissional:

carregar automaticamente o mesmo projeto.

Se o usuário escolher outro projeto no painel:

active_project_id deve ser atualizado também no popup.

POPUP E PAINEL DEVEM FICAR SINCRONIZADOS.

==================================================

4. HISTÓRICO DE PROJETOS

==================================================

Criar menu:

MEUS PROJETOS

Mostrar cards profissionais:

Nome

Lovable

GitHub

última edição

status

branch

preview

Exemplo:

MSK System

Lovable conectado

GitHub conectado

main

Editado há 5 minutos

Ao clicar no projeto:

1. selecionar;

2. carregar histórico;

3. carregar conversa;

4. carregar repositório correspondente;

5. carregar preview;

6. carregar execuções anteriores;

7. torná-lo projeto ativo.

Ter pesquisa:

“Pesquisar projetos...”

Filtros:

Todos

Recentes

Favoritos

Lovable

GitHub

==================================================

5. CHAT MSK

==================================================

Criar chat profissional semelhante a um editor de código com IA.

Campo:

“Peça uma alteração no seu projeto...”

Exemplos:

“Mude o fundo da home para preto.”

“Coloque essa imagem no banner.”

“Corrija o erro deste print.”

“Troque minha API de pagamento.”

“Crie uma nova página de planos.”

A IA deve entender comandos naturais.

NÃO ficar perguntando coisas desnecessárias.

Pedidos claros:

EXECUTAR DIRETAMENTE.

Somente perguntar quando existir ambiguidade que realmente impeça a edição.

==================================================

6. STATUS DA EXECUÇÃO

==================================================

Ao executar edição mostrar em tempo real:

✓ Pedido recebido

✓ Projeto identificado

✓ Repositório localizado

✓ Analisando

✓ Localizando arquivos

✓ Editando

✓ Validando

✓ Criando commit

✓ Sincronizando

✓ Preview disponível

✓ Finalizado

Não usar status falso.

Cada etapa deve refletir o backend.

Durante execução:

bolinha MSK pulsando.

Ao finalizar:

verde.

Em erro:

vermelho.

==================================================

7. CARD FINAL DA EDIÇÃO

==================================================

Depois de cada edição criar card:

CONCLUÍDO POR MSK

Resumo:

“Alterado fundo da página inicial para azul.”

Arquivos:

src/pages/Home.tsx

src/index.css

Projeto:

MSK System

Repositório:

usuario/repositorio

Branch:

main

Commit:

abc123

Botões:

[ Ver resumo completo ]

[ Ver Commit ]

[ Atualizar Preview ]

[ Desfazer ]

[ Nova edição ]

==================================================

8. HISTÓRICO DE EDIÇÕES

==================================================

Criar aba:

HISTÓRICO

Mostrar:

data

hora

projeto

pedido

arquivos alterados

resultado

commit

status

Exemplo:

Hoje 18:42

“Mude a cor da home”

✓ Concluído

2 arquivos

Commit abc123

Ao clicar:

mostrar detalhes completos.

O histórico precisa ficar salvo no backend.

Não deve desaparecer ao atualizar página.

==================================================

9. ARRASTAR E SOLTAR ARQUIVOS

==================================================

O painel deve aceitar drag-and-drop.

Suportar:

PNG

JPG

JPEG

WEBP

SVG

PDF

TXT

JSON

ZIP

documentos permitidos

Quando o usuário arrastar:

mostrar overlay:

“SOLTE O ARQUIVO PARA ENVIAR AO MSK”

Depois:

popup MSK central:

LOGO MSK

✓ Arquivo recebido com sucesso

nome-do-arquivo.png

Depois mostrar status:

Recebido

Lendo

Analisado

Pronto

A IA deve realmente receber o conteúdo.

Exemplo 1:

Usuário envia print de erro.

Depois escreve:

“Corrija isso.”

A IA deve analisar o print e corrigir o projeto.

Exemplo 2:

Usuário envia imagem.

Depois escreve:

“Coloque essa imagem na home.”

A imagem deve ser enviada ao projeto/repositório e o agente deve alterar o código para utilizá-la.

Exemplo 3:

Usuário envia PDF.

Depois:

“Faça essa página de acordo com este documento.”

A IA deve ler o documento e utilizar as informações.

==================================================

10. GITHUB

==================================================

Criar botão no topo:

GitHub

Estados:

○ Não conectado

ou

✓ GitHub conectado

Ao clicar:

se não conectado:

iniciar OAuth GitHub.

Se conectado:

mostrar:

usuário

repositório

branch

último commit

Criar menu:

Repositório

Branches

Commits

Alterações

O MSK Agente deve editar o projeto DIRETAMENTE pelo GitHub.

Fluxo:

Comando

↓

MSK Agente

↓

identifica projeto

↓

identifica repositório

↓

IA analisa

↓

edita arquivos

↓

valida

↓

commit

↓

GitHub

↓

sincronização

↓

preview

==================================================

11. LOVABLE

==================================================

Lovable não deve ser usada como agente de programação.

A Lovable serve para:

project_id

projeto

sincronização

preview

deploy/publicação

Toda edição deve acontecer pela infraestrutura MSK/GitHub.

NÃO enviar automaticamente prompts ao agente da Lovable.

==================================================

12. BOTÃO PUBLICAR

==================================================

No canto superior direito:

PUBLICAR

Ao clicar:

abrir modal:

PUBLICAR PROJETO

Projeto:

MSK System

Branch:

main

Último commit:

abc123

Status:

Pronto para publicar

Botão:

PUBLICAR AGORA

Estados:

Preparando

Sincronizando

Publicando

Verificando

Publicado

Quando possível, utilizar integração oficial do projeto.

Nunca fingir que uma publicação ocorreu.

==================================================

13. FUNÇÕES DO POPUP

==================================================

TODAS AS PRINCIPAIS FUNÇÕES EXISTENTES NO POPUP MSK DEVEM TAMBÉM ESTAR DISPONÍVEIS NO PAINEL.

Não remover o popup.

São duas maneiras de utilizar o mesmo sistema.

Incluir no painel:

Chat

Projetos

GitHub

Lovable

Supabase

Histórico

Anexos

Remover marca

Publicar

Atualizar preview

Configurações

Status

Notificações

Ajuda

Conexões

IA

Modelos

API

Licença

Quando uma nova função for adicionada futuramente ao MSK, criar arquitetura modular para ela poder ser adicionada também ao painel.

==================================================

14. REMOVER MARCA D'ÁGUA

==================================================

Criar ação:

REMOVER MARCA

Ela deve utilizar o project_id ATIVO.

Antes:

Identificando projeto

Lendo arquivos

Localizando estrutura

Aplicando alteração

Validando

Finalizado

Não depender exclusivamente de:

src/index.css

Procurar CSS global corretamente.

Possíveis:

src/index.css

src/styles.css

src/App.css

src/globals.css

app/globals.css

styles/globals.css

Criar fallback seguro se necessário.

==================================================

15. PLANO / LICENÇA

==================================================

No perfil mostrar:

PLANO ATUAL

Exemplo:

MSK Agente 1

Tempo restante:

23h 42min

Expira:

03/09/2026 21:00

Mostrar barra visual proporcional ao tempo restante.

Estados:

Verde = normal

Amarelo = próximo do vencimento

Vermelho = crítico

Expirado = acesso bloqueado conforme regras do produto

O tempo NÃO pode depender somente de JavaScript local.

Usar data de expiração do servidor.

Mostrar também:

uso de IA

edições realizadas

limite do plano

arquivos enviados

tokens/créditos quando aplicável

Exemplo:

Edições

42 / 100

IA

R$ 7,21 utilizados

Tempo

23h restantes

==================================================

16. LINKS / TUTORIAIS YOUTUBE

==================================================

Criar menu:

TUTORIAIS

Os links devem vir do painel administrativo.

Banco:

tutorial_links

Campos:

id

title

description

youtube_url

thumbnail_url

category

active

sort_order

Categorias:

Primeiros passos

GitHub

Lovable

IA

Configuração

Pagamentos

Projetos

O Super Admin deve conseguir adicionar e remover vídeos sem alterar código.

==================================================

17. NOTIFICAÇÕES

==================================================

Criar sino no topo.

Atualização em tempo real.

Exemplos:

✓ Projeto atualizado

✓ Commit criado

✓ GitHub conectado

⚠ Licença expira em breve

⚠ API indisponível

✓ Nova versão disponível

Notificações devem vir do backend.

==================================================

18. BANCO DE DADOS

==================================================

Utilizar Supabase.

Estrutura sugerida:

profiles

projects

- id

- user_id

- lovable_project_id

- name

- lovable_url

- preview_url

- production_url

- active

project_connections

- project_id

- provider

- repository

- branch

- metadata

agent_conversations

agent_messages

agent_runs

agent_run_steps

agent_edits

agent_commits

agent_attachments

user_connections

notifications

tutorial_links

licenses

plans

usage_logs

api_connections

Guardar timestamps.

Criar RLS corretamente.

Cada usuário só acessa seus projetos.

Super Admin pode administrar conforme permissões.

==================================================

19. SINCRONIZAÇÃO EM TEMPO REAL

==================================================

Utilizar realtime onde fizer sentido.

Se o agente está editando pelo popup:

o Painel Profissional deve mostrar.

Se está editando pelo painel:

o popup deve mostrar.

Exemplo:

Painel:

“Editando...”

Popup:

“Editando...”

Quando concluir:

ambos:

“Finalizado.”

Não criar estados isolados.

Criar uma fonte única:

agent_runs

==================================================

20. CONTINUIDADE DA CONVERSA

==================================================

A conversa pertence ao:

user_id

+

project_id

Portanto:

Usuário começa edição no popup.

Depois abre painel.

O painel mostra a mesma conversa.

Depois volta ao popup.

A conversa continua.

Não reiniciar.

==================================================

21. TELA INICIAL DO PAINEL

==================================================

Quando abrir sem projeto:

Olá, [nome]

“Qual projeto você quer editar hoje?”

Mostrar:

Projetos recentes

Novo projeto

Conectar GitHub

Abrir projeto Lovable

Ao detectar um projeto ativo vindo da extensão:

abrir diretamente o editor.

==================================================

22. LAYOUT DO EDITOR

==================================================

Sugestão:

---------------------------------------------------

TOPBAR

Logo MSK | Projeto | Branch | Device | GitHub | Publicar

---------------------------------------------------

SIDEBAR      |         PREVIEW

             |

Chat         |

Projetos     |

Histórico    |

Arquivos     |

Conexões     |

             |

---------------------------------------------------

Chat pode ficar numa coluna esquerda redimensionável.

Preview ocupa maior parte.

Permitir recolher sidebar.

Responsivo.

==================================================

23. MOBILE DO PAINEL

==================================================

O Painel Profissional também deve funcionar em:

Windows

macOS

iOS

Android

tablet

No celular:

Preview

Chat

Projetos

Histórico

viram abas inferiores.

Não quebrar interface.

==================================================

24. DESIGN

==================================================

Visual premium MSK.

Cores:

preto

verde neon

roxo

azul

Liquid Glass leve.

IMPORTANTE:

Não usar blur excessivo.

Não criar efeitos pesados.

Deve rodar bem inclusive em computadores menos potentes.

Usar:

bordas translúcidas

sombras leves

gradientes controlados

microanimações

Botões profissionais.

==================================================

25. SEGURANÇA

==================================================

NUNCA expor:

GitHub token

Supabase service role

API keys

segredos

tokens internos

no frontend.

Todas operações sensíveis no backend.

GitHub OAuth server-side.

APIs criptografadas.

RLS.

Logs de segurança.

Rate limiting.

Validação de sessão.

==================================================

26. ARQUITETURA

==================================================

Criar arquitetura modular.

Frontend

↓

MSK API

↓

Agent Orchestrator

↓

GitHub

↓

AI Provider

↓

Supabase

↓

Lovable/project preview

Não acoplar interface diretamente às APIs secretas.

Criar serviços:

ProjectService

AgentService

GitHubService

LovableProjectService

PreviewService

AttachmentService

LicenseService

UsageService

NotificationService

==================================================

27. NÃO QUEBRAR O MSK EXISTENTE

==================================================

REGRA ABSOLUTA:

O novo painel NÃO pode quebrar:

popup iPhone

chat atual

GitHub

IA

licenças

histórico

cards

projetos

anexos

marca d'água

conexões existentes

Antes de alterar qualquer estrutura atual:

identificar componentes existentes e reaproveitar serviços.

Não duplicar backend sem necessidade.

==================================================

28. BOTÃO DO POPUP

==================================================

Adicionar ao popup do iPhone:

ABRIR PAINEL PROFISSIONAL ↗

Ao clicar:

chrome.tabs.create()

abrindo:

https://MEU-DOMINIO/painel

ou rota equivalente.

Passar o contexto pelo backend/sessão.

NÃO colocar token secreto na URL.

O painel identifica usuário e projeto pela sessão.

==================================================

29. ADMIN

==================================================

Criar no Super Admin:

PAINEL PROFISSIONAL

Permitir:

ativar/desativar painel

links YouTube

limites

planos

funções habilitadas

modelos IA

mensagens

avisos

versão

manutenção

Também poder definir recursos por plano.

Exemplo:

Plano Diário

Chat ✓

Preview ✓

GitHub ✓

Histórico ✓

Plano Premium

Tudo ✓

==================================================

30. RESULTADO ESPERADO

==================================================

O produto final deve permitir este fluxo:

Usuário abre Lovable.

Extensão MSK detecta:

Projeto MSK System

project_id XYZ

Usuário abre popup.

Clica:

ABRIR PAINEL PROFISSIONAL

Nova aba abre.

Painel mostra:

MSK System

GitHub conectado

main

23h restantes

Preview aparece.

Usuário seleciona:

Mobile.

Preview muda para mobile.

Usuário arrasta um print.

MSK:

✓ Arquivo recebido

Usuário escreve:

“Corrija esse erro.”

IA analisa.

MSK mostra:

Pedido recebido

Analisando

Editando

Validando

Criando commit

Sincronizando

Finalizado

Preview:

Atualização disponível.

Usuário clica:

Atualizar Preview.

Projeto atualizado aparece.

Card mostra:

Concluído por MSK

2 arquivos

Commit abc123

Usuário pode continuar editando sem voltar para a Lovable.

==================================================

31. CRITÉRIO DE ENTREGA

==================================================

NÃO quero somente mockup visual.

Implementar:

frontend

backend

banco

rotas

estados

realtime

persistência

GitHub

preview

chat

histórico

projetos

anexos

licença

uso

notificações

Tudo deve ser funcional.

Não substituir funções reais por dados fictícios.

Se uma integração externa ainda não estiver disponível:

criar interface/service adapter preparada e deixar o estado claramente como não conectado, em vez de simular sucesso.

Antes de finalizar:

1. rodar TypeScript;

2. build;

3. verificar erros;

4. verificar responsividade;

5. verificar RLS;

6. verificar exposição de segredos;

7. testar troca de projetos;

8. testar Desktop/Tablet/Mobile;

9. testar continuidade popup ↔ painel;

10. testar edição → commit → preview.

O objetivo final é transformar o MSK Agente em uma plat a cima e a extencao que deve se conectar com o painel ok nao mude nada dela adicione apenas um botao de abrir painel ao clicar abrir o painel que vc fexzaforma própria de edição de projetos, com experiência semelhante a um editor SaaS profissional, mas com identidade MSK e usando o mesmo agente existente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://msk-pro-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b21ea21d-4e29-489b-9bde-b669950438b3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
