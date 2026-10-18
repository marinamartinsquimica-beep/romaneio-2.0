// Verificação de backup ANTES de migrar, sem gravar no Firebase ou restaurar dados.
export function conferirBackupPreMigracao(pacote){
 const erros=[];
 if(!pacote||pacote.formato!=='romaneio2-backup-v2')erros.push('Formato de backup não reconhecido');
 if(!pacote?.origemUid||typeof pacote.origemUid!=='string')erros.push('Conta de origem ausente');
 if(!Array.isArray(pacote?.movimentos))erros.push('Histórico remoto ausente');
 else{
  if(pacote.totalMovimentos!==pacote.movimentos.length)erros.push('Contagem de movimentos divergente');
  const ids=new Set();
  for(const x of pacote.movimentos){
   if(!x?.id||!x?.dados||x.id!==x.dados.id||ids.has(x.id)){erros.push('Movimento duplicado ou inconsistente');break;}
   ids.add(x.id);
  }
 }
 for(const tipo of ['embalado','paripassu']){
  const e=pacote?.estoques?.[tipo];
  if(e!=null&&(!Array.isArray(e.itens)||!e.versao||e.tipo!==tipo))erros.push('Estoque '+tipo+' inválido');
 }
 if(!pacote?.dadosLocais||typeof pacote.dadosLocais!=='object')erros.push('Dados locais ausentes');
 else for(const [chave,valor] of Object.entries(pacote.dadosLocais)){
  if(typeof valor!=='string'){erros.push('Campo local inválido: '+chave);continue;}
  try{JSON.parse(valor)}catch{erros.push('JSON local inválido: '+chave)}
 }
 if(pacote?.excelLocal!=null&&!/^[A-Za-z0-9+/]*={0,2}$/.test(pacote.excelLocal.base64||''))erros.push('Excel local inválido');
 return {valido:erros.length===0,erros,totalMovimentos:Array.isArray(pacote?.movimentos)?pacote.movimentos.length:0};
}
