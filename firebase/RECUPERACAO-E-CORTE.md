# Ponto de retorno e migração controlada (sem Storage pago)

**Backup de código:** `backup/romaneio-2.0.57-antes-multiusuarios` aponta para o commit `94527d410fcc152b3cd6460e131a8405553e4c49`.

**Backup dos dados:** `integracao/backup-pre-migracao.html` exporta os movimentos da conta atual (com paginação) e os dois documentos de estoque oficial como JSON, somente leitura. Requer login da conta operacional e regras atuais que já permitem acesso. Se o Firestore retornar cache, erro ou atingir o limite de leitura, não declara backup concluído. Preserve esse arquivo fora do navegador (por exemplo, no OneDrive já autorizado).

**Não cobertos pelo JSON do Firestore:** XLSX original (preservado no OneDrive/IndexedDB), paletes que ainda estejam somente em armazenamento local e não enviados, rascunhos locais, e arquivo local de expedições excluídas pendentes de baixa. A recuperação completa exige cópia destes dados locais de cada aparelho que os possua, antes do corte.

**Corte:** manter `main` e regras Firebase antigas inalteradas até configurar ambiente e membros, exportar backups, copiar e auditar histórico, saldos e pendências, e confirmar a validação em dois dispositivos. Depois da homologação, habilitar `migracaoConcluida=true` por processo administrativo seguro; nunca ativar isso apenas porque o código foi publicado. Não substituir regras no console com arquivo isolado; usar arquivo mesclado revisado.

**Rollback:** antes do corte, basta permanecer em `main`. Depois do corte, restaurar o commit de backup pode recuperar o app, mas **não transfere nem reverte automaticamente as gravações feitas no novo ambiente**. Fazer reconciliação auditada dos movimentos novos antes de retornar à versão antiga. Não excluir dados de nenhum dos dois ambientes automaticamente.
