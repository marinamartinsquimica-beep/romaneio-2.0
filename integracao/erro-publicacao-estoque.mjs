export function descreverErroPublicacao(erro){
 const codigo=String(erro?.code||'');
 if(codigo==='resource-exhausted'||codigo==='firestore/resource-exhausted')
  return 'Limite de uso do serviço compartilhado atingido (resource-exhausted). O envio não foi confirmado. Os dados locais foram preservados. Tente publicar novamente quando o serviço liberar o limite; repetir agora não resolve.';
 if(erro?.name==='QuotaExceededError')
  return 'Espaço de armazenamento deste navegador insuficiente (QuotaExceededError). Não apague os dados do aplicativo. Preserve uma cópia de segurança antes de revisar o espaço disponível.';
 return (erro?.message||String(erro))+(codigo?' ['+codigo+']':'');
}
