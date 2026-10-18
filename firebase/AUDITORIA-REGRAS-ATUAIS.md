# Auditoria das regras Firestore fornecidas — 18/10/2026

A versão recebida tem regras de testes históricos e as regras operacionais atuais. **Não substituí-la pelo arquivo de regras novas isoladamente.**

## Regras operacionais identificadas
- `rom_v250_contas/{contaUid}/movimentos/{movimentoId}`: acesso restrito ao UID da conta; documentos append-only; consultas com `limit <= 50`. Preservar integralmente durante a migração.
- `rom_v250_contas/{uid}/estoques_oficiais/{tipo}`: leitura da própria conta; publicação condicionada à existência de `rom_v250_admins/{uid}`. Isso impede que novos operadores com UID diferente publiquem nos estoques compartilhados atuais.
- `rom_v250_admins/{uid}`: autorização aprovisionada no console, fechada para escrita pelo cliente.
- `match /{document=**}`: nega por padrão.

## Anomalias anteriores
- Existem regras `match` repetidas para `rom_lab_duplicidade14`, `rom_lab_paletes14`, `rom_lab_idempotencia` e `rom_lab_reservas17`.
- No Firestore, regras sobrepostas concedem permissão se **alguma** condição permitir, logo não usar uma nova regra mais restritiva para supostamente bloquear permissões existentes.
- As coleções `rom_lab_*` são exclusivamente laboratoriais; não incluí-las no ambiente de produção compartilhado.
- As novas regras de `romaneio_ambientes` precisam ser **mescladas dentro do match principal existente**, antes do deny final, mantendo todas as regras legadas. O arquivo `firestore-novo-ambiente.rules` é somente um modelo; não publicar diretamente no Console.

## Implementação segura, sem Storage pago
- Excel completo no OneDrive. Seu caminho ou versão pode ser metadado no Firestore, mas o navegador não lê a pasta sem autorização/seleção do arquivo.
- Dois perfis ativos, Administrador e Operador, com direito a publicação do estoque.
- Gestão de usuários apenas por Admin SDK/backend confiável ou provisionamento privilegiado via console, não autoelevação de papel no navegador.
- Movimentos, estoques estruturados e expedições no ambiente compartilhado; migração preserva IDs e contagens da conta UID original.
- Troca de dados entre UIDs só após checagem de regras de membros e migração auditável.

## Antes de ativar em produção
Confirmar capacidade do Firestore free tier, ambiente inicial e usuários provisionados, realizar testes de autorização para usuário não membro, usuário inativo, operador, administrador, arquivo Excel, publicação versionada e read-only legado. Não misturar com deploy do GitHub Pages até passar a validação.
