# Integração SharePoint — cópia do Romaneio

Esta cópia usa Microsoft Graph e uma lista SharePoint como canal de movimentações. As configurações são preenchidas na página **Conexão do sistema** e ficam somente neste aparelho. Não inclua senha ou segredo de aplicativo no código do navegador.

## Configuração necessária

1. Registrar um aplicativo de página única (SPA) no Microsoft Entra ID.
2. Cadastrar como endereço de retorno a URL exata da página **Conexão do sistema** desta cópia.
3. Conceder consentimento delegado de leitura e gravação no site SharePoint e na biblioteca de documentos usados pelo sistema.
4. Criar uma lista chamada, por exemplo, **RomaneioDados**, com:
   - **Title**: texto de uma linha; habilitar valores exclusivos.
   - **RecordType**: texto de uma linha.
   - **Scope**: texto de uma linha.
   - **Payload**: várias linhas de texto sem formatação.
5. Na página de conexão, preencher os IDs do locatário, aplicativo, site, lista e biblioteca de documentos.
6. Conectar a conta Microsoft e executar **TESTAR SHAREPOINT**.

A API de lista exige token Microsoft Graph e permissão delegada apropriada. O envio grava cada movimentação por identificador; o computador consulta a lista pelo botão de sincronização. Edições ambíguas são mantidas para conferência, e exclusões do celular continuam como pendência no computador até a baixa.

## Estado desta cópia

A estrutura de conexão e o armazenamento de movimentações estão preparados. A conexão real depende dos IDs e consentimentos da organização. Os dados existentes no sistema original não são copiados automaticamente.
