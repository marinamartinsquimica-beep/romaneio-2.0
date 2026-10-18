// Verificação prévia de integridade antes de habilitar o novo ambiente.
// Não modifica registros, não altera estoques e não conclui migração automaticamente.
export function validarCorteMigracao({origem,destino,estoquesOrigem,estoquesDestino,pendenciasOrigem,pendenciasDestino}){
 const numero=x=>Number.isSafeInteger(x)&&x>=0;
 const erro=[];
 if(!origem||!destino||!numero(origem.total)||!numero(destino.total))erro.push('Contagem de movimentos ausente');
 else if(origem.total!==destino.total)erro.push('Contagem de movimentos divergente');
 if(!origem?.assinatura||origem.assinatura!==destino?.assinatura)erro.push('Assinatura de histórico divergente');
 for(const tipo of ['embalado','paripassu']){
  const a=estoquesOrigem?.[tipo],b=estoquesDestino?.[tipo];
  if(a?.versao && a.versao!==b?.versao)erro.push('Estoque '+tipo+' com versão divergente');
 }
 if(!numero(pendenciasOrigem)||pendenciasOrigem!==pendenciasDestino)erro.push('Pendências de baixa divergentes');
 return Object.freeze({apto:erro.length===0,erros:erro});
}
