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
