// Migração não destrutiva da conta individual para o ambiente compartilhado.
// Executar somente depois de provisionar o ambiente e publicar regras mescladas.
// Nenhuma operação de exclusão, baixa ou ajuste de estoque é efetuada.
export async function migrarHistorico({
 origemUid,ambienteId,lerPagina,lerDestino,criarDestino,registrarResumo,maximo=20000
}){
 if(!origemUid||!ambienteId)throw Error('Origem e ambiente são obrigatórios.');
 if([lerPagina,lerDestino,criarDestino,registrarResumo].some(f=>typeof f!=='function'))throw Error('Adaptadores de migração ausentes.');
 if(!Number.isSafeInteger(maximo)||maximo<1)throw Error('Limite inválido.');
 let cursor=null,examinados=0,copiados=0,existentes=0;
 const ids=new Set();
 do{
  const pagina=await lerPagina({origemUid,cursor,limite:50});
  if(!Array.isArray(pagina?.registros)||pagina.registros.length>50)throw Error('Página inválida.');
  if(!pagina.registros.length)break;
  for(const registro of pagina.registros){
   if(++examinados>maximo)throw Error('Limite de segurança atingido; migração não homologada.');
   if(!registro?.id||!registro?.dados||ids.has(registro.id))throw Error('ID ausente ou duplicado na migração.');
   ids.add(registro.id);
   const atual=await lerDestino({ambienteId,id:registro.id});
   if(atual){
    if(JSON.stringify(ordenar(atual))!==JSON.stringify(ordenar(registro.dados)))throw Error('Conflito de histórico no ID '+registro.id);
    existentes++;
   }else{
    await criarDestino({ambienteId,id:registro.id,dados:registro.dados});
    copiados++;
   }
  }
  const proximo=pagina.proximoCursor||null;
  if(!proximo)break;
  if(proximo===cursor)throw Error('Cursor de leitura repetido.');
  cursor=proximo;
 }while(true);
 const resumo={origemUid,ambienteId,examinados,copiados,existentes,finalizada:true};
 await registrarResumo(resumo);
 return resumo;
}
function ordenar(x){
 if(Array.isArray(x))return x.map(ordenar);
 if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordenar(v)]));
 return x;
}
