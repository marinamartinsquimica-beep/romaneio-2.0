# Romaneio 2.0 — plano de migração e testes

## Origem aprovada
- Repositório de referência: https://github.com/marinamartinsquimica-beep/romaneio-data-matrix-caminhao
- Não alterar nem publicar no aplicativo original.
- Reproduzir todos os arquivos e recursos do original (HTML, JS, ícones, manifest, service worker, bibliotecas e licenças) antes de habilitar o novo aplicativo.

## Funcionalidades que devem ser preservadas
- Leitura Data Matrix, lançamento de caixas por SKU e lote, edição de paletes e numeração manual opcional.
- Destinos existentes/novos, exclusão por destino, romaneios simultâneos por destino.
- Romaneio por caminhão (placa, seleção de paletes, totalização, finalizar, reiniciar e histórico).
- Exportação Excel total e por destino, campos complemento, responsável e observações.
- PWA instalável, atualização de versão e layout já aprovado.

## Fluxo de estoque proposto — ainda não implementado
1. Registrar caixas no romaneio gera uma **reserva** de SKU+lote vinculada à expedição; não altera o Excel oficial.
2. Editar/excluir libera ou ajusta reservas de forma idempotente.
3. Finalizar romaneio marca expedição aguardando baixa; não realiza baixa oficial.
4. Operador processa a baixa no aplicativo de estoque e substitui manualmente o Excel no SharePoint/OneDrive.
5. Só após confirmação e conciliação com a movimentação efetiva, encerrar a reserva, sem descontar duas vezes.
6. Não considerar reservas de um navegador como compartilhadas entre celulares: sincronização multiusuário requer armazenamento central com autenticação e controle de concorrência.
7. Garantir rastreabilidade por ID único de movimentação, SKU, lote, quantidade, destino, caminhão, data e status.

## Critérios de segurança
- Nunca substituir o Excel oficial automaticamente na primeira fase.
- Não publicar integração real sem teste de duplicidade, falta de saldo, alterações de palete, cancelamento e duas sessões simultâneas.
- Criar nova versão e testar em ambiente isolado antes de liberar.
- Manter o aplicativo original intacto.

## Etapas
- [ ] Copiar integralmente a base original e validar que todas as funções existentes permanecem iguais.
- [ ] Validar protótipo de reserva/baixa com a operação.
- [ ] Implementar reserva automática e reconciliação com persistência segura.
- [ ] Testar e publicar Romaneio 2.0 separadamente.

## Arquitetura definitiva aprovada (08/10/2026)
- Um único aplicativo Romaneio 2.0 com três áreas: **ROMANEIO**, **CONTROLE DE ESTOQUE** e **AJUSTE ESTOQUE**.
- ROMANEIO: leitura Data Matrix, paletes, destinos, caminhões, reserva automática e finalização de expedição.
- CONTROLE DE ESTOQUE: operador autenticado confere romaneios finalizados, confirma baixa efetiva, acompanha gravação no SharePoint e concilia reservas; impedir baixa duplicada.
- AJUSTE ESTOQUE: reproduzir integralmente as regras de negócio, validações, rastreabilidade e resultados do módulo Ajuste Estoque do projeto de Baixa Estoque existente, **somente após análise do código-fonte de referência**. Restringir a usuários autorizados; não confundir ajuste com baixa de expedição.
- O SharePoint será a origem oficial do saldo. Integração exige autenticação, persistência central compartilhada, controle de concorrência, atualização segura e confirmação da gravação. Não prometer atualização direta antes da integração testada.
- O painel de importação/estoque atual é **temporário e exclusivo de teste**. A versão definitiva não o exibirá; importação manual não será exigida.
- A inserção manual e a leitura Data Matrix **nunca podem depender** de importar uma planilha. Sem estoque conectado, não alegar reserva efetivada; exibir status adequado.
- Projetos antigos são somente referência/cópia; nunca editar, publicar ou fazer commits neles.

## Ponto de retomada — v2.0.5
- Cópia do aplicativo e exportação Excel validadas pela operação.
- Leitura Excel validada: 122 lotes e 1.510 caixas.
- Teste local exibiu 37 caixas reservadas e 1.473 disponíveis.
- **Próxima etapa:** testar edição de quantidade, exclusão de entrada, exclusão por destino, lote inexistente e saldo insuficiente; verificar recálculo de reservas e funcionamento sem Excel. Corrigir defeitos sem modificar recursos aprovados.
- **Depois:** persistência central, integração SharePoint, tela de confirmação de baixas e módulo Ajuste Estoque conforme código de referência.

## Regra obrigatória: substituição do estoque oficial após ajuste
- Após confirmação autorizada de um AJUSTE ESTOQUE, obter a versão vigente do Excel oficial no SharePoint, aplicar o ajuste com as mesmas regras do sistema de referência e **substituir o conteúdo do arquivo oficial** no mesmo local, preservando sua identidade/link sempre que a API permitir.
- Preservar abas, fórmulas, estrutura e histórico; registrar responsável, data/hora, motivo, SKU/lote, saldo anterior, variação e saldo final.
- A operação deve verificar versão/ETag e tratar conflitos concorrentes sem sobrescrever atualizações de terceiros; confirmar sucesso da gravação e conferir o resultado antes de marcar como concluída.
- Manter recuperação/versionamento do SharePoint e tratamento de falhas; nunca anunciar sucesso quando a atualização falhar.
- O operador não deverá apagar manualmente o arquivo antigo nem copiar a planilha atualizada.
- A mesma política de gravação segura vale para baixas efetivas de expedição.
- **Ainda não implementado**: depende da integração autenticada com o SharePoint e testes com cópia, nunca diretamente no arquivo oficial durante desenvolvimento.

## Escopo definitivo da aba AJUSTE ESTOQUE — inventário físico
- Esta aba é **exclusiva para contagem física in loco e correção de divergências de lançamentos**, não faz parte da rotina diária de expedição ou confirmação de baixas.
- Fluxo: iniciar inventário por escopo (SKU/lote), registrar caixas contadas, comparar saldo registrado x saldo físico, revisar diferenças, autorizar ajustes e atualizar o Excel oficial no SharePoint com segurança.
- Contagens sem divergência não devem alterar saldos; itens fora do escopo da contagem não devem ser modificados.
- Tratar reservas ativas e baixas pendentes, definindo um momento de corte/congelamento lógico e conciliação, para evitar diferenças falsas e alterações concorrentes durante inventário.
- Preservar as regras existentes do ajuste no aplicativo de referência após análise do código, além de trilha de auditoria e permissões.

## Requisito crítico: romaneio para lançamento de vendas em sistema externo
- Preservar integralmente o download/exportação do romaneio em Excel e o compartilhamento do arquivo; são etapas essenciais do processo comercial, usadas para registrar vendas em outro sistema.
- Manter romaneio total, por destino e por caminhão, com dados, colunas e estrutura compatíveis com o fluxo atual. Não remover nem alterar o formato sem validação explícita da operação.
- Permitir reexportar e compartilhar romaneios já finalizados, inclusive depois da confirmação da baixa de estoque.
- Exportar, baixar ou compartilhar não pode, isoladamente, reservar, dar baixa ou modificar o estoque oficial.
- Incluir testes de regressão de exportação/compartilhamento em todas as etapas de integração de estoque e antes de cada publicação.

## Regra aprovada: divergência de estoque não bloqueia expedição
- Saldo insuficiente ou SKU/lote ausente no estoque deve gerar aviso, nunca impedir inclusão de caixas no romaneio.
- Registrar ocorrência para conferência pelo operador do estoque, com dados do lançamento e diferença; falhas de lançamento no Excel podem explicar divergências.
- Manter download e compartilhamento para vendas independentemente de divergências.
- Na confirmação da baixa, exigir tratamento/conciliação de divergências sem atualização incorreta do estoque oficial.
- Protótipo local v2.0.8: aviso e registro local no navegador; visualização central pelo operador do estoque ainda depende da integração futura. Recalcular divergências dinamicamente após edição/importação é melhoria pendente.

## Requisito obrigatório — operação offline e sincronização posterior
- Na versão definitiva, consulta normal de estoque no SharePoint; importação manual de Excel apenas para testes.
- PWA deve permitir lançamento de caixas, leitura de etiquetas, paletes, destinos, caminhões, exportação e compartilhamento quando offline (quando suportado pelo dispositivo), sem bloquear a expedição.
- Persistir movimentos localmente em fila durável com ID único, timestamp, SKU, lote, quantidade, destino, palete, operador, status de sincronização; não perder registros em recarga/queda de conexão.
- Na reconexão, sincronizar pendências com serviço central autenticado, garantir idempotência e proteção contra concorrência, consultar saldo vigente, reconciliar reservas e apontar divergências ao operador do estoque sem descartar movimentos.
- Não realizar baixa oficial automaticamente na reconexão: requer confirmação autorizada no Controle de Estoque; somente depois atualizar com segurança o Excel oficial no SharePoint e confirmar gravação.
- Interface deve mostrar pendentes, sincronizados, divergentes e falhas; retry seguro e indicação de última sincronização.
- Evitar duplicidade por reenvio, alterações em dois dispositivos e divergência entre cache local e estoque central. Sem conexão, saldo local é apenas referência e reservas ainda não são garantidas globalmente.
- Testar desligamento de rede, fechamento/reabertura, reconexão, reenvio duplicado, conflitos e exportação offline antes de liberar em produção.

## Avisos de divergência no Romaneio e na planilha oficial
- Ao identificar divergência, manter a expedição liberada e criar ocorrência de conferência vinculada a SKU, lote completo e data de postura, além de quantidade lançada, saldo do estoque, diferença, data/hora e origem.
- Exibir observação de conferência na entrada correspondente do Romaneio e na área Controle de Estoque; operador pode reconhecer e resolver com rastreabilidade.
- Quando houver conexão e integração autenticada, registrar observação visível na(s) linha(s) correspondentes de SKU + lote completo + postura na planilha oficial SharePoint, sem alterar saldo por causa do alerta. Tratar múltiplas linhas correspondentes sem duplicar a divergência ou sobrescrever observações existentes.
- Offline: enfileirar aviso localmente e sincronizar após reconexão com ID único e idempotência; não alegar que a planilha foi anotada até a confirmação da gravação.
- O ajuste de saldo permanece exclusivo do processo de baixa confirmada ou inventário autorizado; um alerta não efetua baixa.
