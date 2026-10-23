export function descreverErroPublicacao(erro){
 if(/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(String(erro?.message||'')))
  return 'Não foi possível carregar o leitor da planilha. Clique em ATUALIZAR AGORA e tente novamente com a conexão ativa. Nenhuma publicação foi realizada.';
 const codigo=String(erro?.code||'');
 if(codigo==='resource-exhausted'||codigo==='firestore/resource-exhausted')
  return 'Limite de uso do serviço compartilhado atingido (resource-exhausted). O envio não foi confirmado. Os dados locais foram preservados. Tente publicar novamente quando o serviço liberar o limite; repetir agora não resolve.';
 if(erro?.name==='QuotaExceededError')
  return 'Espaço de armazenamento deste navegador insuficiente (QuotaExceededError). Não apague os dados do aplicativo. Preserve uma cópia de segurança antes de revisar o espaço disponível.';
 return (erro?.message||String(erro))+(codigo?' ['+codigo+']':'');
}

