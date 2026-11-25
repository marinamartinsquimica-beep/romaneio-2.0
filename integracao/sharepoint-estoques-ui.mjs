import {readAllSharePointRecords,writeSharePointRecord,uploadSharePointFile,downloadSharePointFile} from './sharepoint-client.mjs';
const $=id=>document.getElementById(id);
async function publicar(){
 const botao=$('etapa4Publicar'),status=$('etapa4SharePointStatus'),tipo=$('etapa4Tipo')?.value||'',file=$('etapa4Arquivo')?.files?.[0];
 if(!file){if(status)status.textContent='Selecione uma planilha.';return;}
 if(!['embalado','paripassu'].includes(tipo)){if(status)status.textContent='Selecione o tipo de estoque.';return;}
 if(botao)botao.disabled=true;
 try{
  const stamp=Date.now(),stored=await uploadSharePointFile(file,'Romaneio/estoque-'+tipo+'-'+stamp+'-'+file.name.replace(/[^A-Za-z0-9._-]/g,'_'));
  const payload={tipo,nome:file.name,tamanho:file.size,driveId:stored.driveId,itemId:stored.itemId,webUrl:stored.webUrl,publicadoEm:new Date().toISOString(),autor:'conta Microsoft'};
  await writeSharePointRecord({id:'stock-'+tipo+'-'+stamp,type:'stock',scope:tipo,payload});
  if(status)status.textContent='Planilha publicada no SharePoint. A atualização dos aparelhos será feita pela Central de Conexão.';
 }catch(error){if(status)status.textContent='Publicação não concluída: '+String(error?.message||error)+'. Arquivo local preservado.';}
 finally{if(botao)botao.disabled=false;}
}
const btn=$('etapa4Publicar');btn?.addEventListener('click',publicar);
export async function baixarUltimaPlanilhaSharePoint(tipo){
 const rows=await readAllSharePointRecords(),latest=rows.filter(x=>x.recordType==='stock'&&x.scope===tipo).sort((a,b)=>String(b.payload?.publicadoEm||'').localeCompare(String(a.payload?.publicadoEm||'')))[0];
 if(!latest)throw Error('Não há planilha deste tipo no SharePoint.');
 return {metadata:latest.payload,blob:await downloadSharePointFile(latest.payload.driveId,latest.payload.itemId)};
}
