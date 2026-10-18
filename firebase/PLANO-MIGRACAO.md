# Romaneio 2.0 — implantação única, sem Firebase Storage

## Decisão de arquitetura
- **OneDrive compartilhado:** guarda os arquivos XLSX oficiais completos e a versão anterior para recuperação. A substituição do Excel continua sendo feita na pasta corporativa autorizada.
- **Firestore:** guarda dados estruturados e histórico compartilhado (romaneios, movimentações, exclusões, pendências e status de baixas, estoques publicados). Os arquivos XLSX não serão enviados ao Firestore nem ao Firebase Storage.
- **IndexedDB:** mantém a cópia local do Excel já importado para permitir a exportação offline. Em um computador novo, abrir o arquivo vigente no OneDrive e importar quando precisar gerar uma baixa.
- **Firebase Authentication:** cada usuário tem seu login; dois perfis, administrador e operador. Ambos importam e publicam planilhas, somente administrador gerencia acessos.
- **Ambiente comum:** a operação pertence ao ambiente, não ao UID individual. A conta anterior é migrada sem apagar a coleção legada.

## Sequência de liberação em um único bloco
1. Fazer cópia segura dos dados atuais e exportar os históricos do ambiente legado.
2. Configurar regras Firestore com preservação integral das regras existentes do Romaneio; ativar membros e índices de usuários. O primeiro administrador deve ser provisionado via console ou backend privilegiado.
3. Migrar dados legados, com IDs estáveis, versão e auditoria, conferindo contagens de eventos, registros ativos e pendências; NÃO fazer baixa nem excluir a base legada.
4. Ativar leitura/gravação no ambiente compartilhado, isolamento por perfil e sincronização offline com reconciliação sem substituição destrutiva.
5. Fazer a publicação de Estoque Embalado e PariPassu por operador e administrador; manter a versão anterior **dos dados estruturados** no Firestore, enquanto o XLSX anterior é guardado no OneDrive.
6. Validar a recuperação em dois computadores e dois logins diferentes, uma exclusão no celular, preparação de baixa e Excel completo acessado pelo OneDrive.
7. Somente após a validação operacional publicar na main e atualizar versão/cache PWA.

## Restrições
Não há acesso direto nesta execução às regras Firebase efetivamente implantadas nem autorização para modificar a pasta OneDrive compartilhada. As regras preparadas no repositório NÃO devem substituir sozinhas as regras atuais do Firebase; o arquivo de regras precisa ser mesclado e revisado. Não ativar modo compartilhado antes da criação dos membros e da migração.
Não chamar leitura de Excel local de "arquivo recuperável da nuvem": sem um conector OneDrive autenticado ou seleção manual, o navegador não recupera o XLSX original automaticamente.
