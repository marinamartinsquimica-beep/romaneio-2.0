/* 2.0.50: adaptador da fila do app. Não envia sem publicador configurado.
 * Remove somente IDs confirmados que ainda correspondem ao conteúdo enviado.
 * Preserva inclusões que chegarem durante a operação de rede.
 */
export function criarSincronizadorFila({ler,gravar,publicador,avisar}){
 if([ler,gravar,avisar].some(x=>typeof x!=='function')||!publicador||typeof publicador.publicar!=='function')throw TypeError('Dependências inválidas');
 let emAndamento=null;
 const assinatura=op=>JSON.stringify(op);
 async function executar(){
  if(emAndamento)return emAndamento;
  emAndamento=(async()=>{
   const antes=ler();
   if(!Array.isArray(antes))throw TypeError('Fila inválida');
   if(!antes.length)return {confirmados:0,pendentes:0};
   const resultado=await publicador.publicar(antes);
   const confirmados=new Map();
   for(const c of resultado.confirmacoes||[]){
    if(c.confirmado===true){
     const original=antes.find(x=>x.id===c.id);
     if(original)confirmados.set(c.id,assinatura(original));
    }
   }
   const atual=ler();
   if(!Array.isArray(atual))throw TypeError('Fila alterada incorretamente');
   const restante=atual.filter(x=>confirmados.get(x?.id)!==assinatura(x));
   gravar(restante);
   avisar({confirmados:atual.length-restante.length,pendentes:restante.length,rejeitados:resultado.rejeitados||[]});
   return {confirmados:atual.length-restante.length,pendentes:restante.length,falhas:(resultado.confirmacoes||[]).filter(x=>x.confirmado!==true),rejeitados:resultado.rejeitados||[]};
  })().finally(()=>{emAndamento=null});
  return emAndamento;
 }
 return {executar};
}
