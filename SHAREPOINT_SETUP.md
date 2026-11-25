# Integração SharePoint — configuração da cópia Romaneio 2.0

Esta cópia está preparada para ler automaticamente os arquivos de estoque de uma pasta SharePoint, receber movimentações do celular e atualizar o arquivo oficial de Estoque Embalado após uma baixa confirmada. A configuração é local ao aparelho.

## Configuração do Microsoft 365

1. Registrar um aplicativo de página única (SPA) no Microsoft Entra ID.
2. Cadastrar como endereço de retorno a URL exata da página **Conexão do sistema** desta cópia.
3. Conceder consentimento delegado de leitura e gravação no site SharePoint e na biblioteca usada pelo sistema.
4. Criar uma lista de movimentações com as colunas:
   - `Title`: texto de uma linha, com valores exclusivos.
   - `RecordType`: texto de uma linha.
   - `Scope`: texto de uma linha.
   - `Payload`: várias linhas de texto sem formatação.
5. Manter os dois arquivos Excel oficiais em uma pasta da biblioteca de documentos.

Não gravar senha ou segredo de aplicativo no código do navegador.

## Campos da Central de Conexão

Preencher:

- ID do locatário Microsoft.
- ID do aplicativo SPA.
- ID do site.
- ID da lista de movimentações.
- ID da biblioteca de documentos.
- Caminho relativo exato da pasta dentro da biblioteca.
- Nome exato do arquivo Embalado, incluindo extensão.
- Nome exato do arquivo PariPassu, incluindo extensão.
- Endereço de retorno cadastrado no aplicativo Microsoft.

O caminho da pasta é relativo à raiz da biblioteca informada. Exemplo ilustrativo: `Estoque/Atual`. Os nomes dos arquivos precisam corresponder exatamente aos arquivos existentes.

## Operação preparada

- O painel recebe movimentações da lista SharePoint quando o operador aciona **SINCRONIZAR AGORA**.
- Depois desse recebimento, consulta metadados dos arquivos Embalado e PariPassu. A planilha só é baixada quando seu `eTag` mudou ou quando ainda não há cópia local utilizável.
- O botão **ATUALIZAR ESTOQUES DO SHAREPOINT** executa a consulta dos dois arquivos quando necessário.
- O botão **BAIXAR ESTOQUE EMBALADO ATUALIZADO** força a leitura da versão atual e inicia o download.
- Após a confirmação da baixa, o Excel gerado pelo fluxo existente é gravado no mesmo item oficial de Estoque Embalado. O sistema compara a versão remota com aquela usada na preparação; se mudou, interrompe a gravação para que o operador atualize e prepare novamente.
- O arquivo PariPassu é somente leitura e não é alterado pela baixa.

## Limites antes da ativação

A conexão real ainda depende dos IDs e do consentimento da organização, dos caminhos e nomes exatos dos arquivos e de validação no tenant. Não há migração automática dos dados do sistema anterior. A autenticação, a leitura real dos formatos, a gravação do Excel e o comportamento com dois operadores ainda precisam de homologação. A verificação de versão antes e depois da escrita reduz o risco de sobrescrever uma versão mais nova, mas a concorrência deve ser confirmada no tenant real.

Esta versão está na branch `codex/copia-sharepoint` e não está mesclada nem publicada para os operadores.
