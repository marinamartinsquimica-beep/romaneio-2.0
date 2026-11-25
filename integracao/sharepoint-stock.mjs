import {readSharePointConfig,validateSharePointStockConfig} from './sharepoint-config.mjs';
import {getSharePointFileMetadataByPath,downloadSharePointDriveItem,replaceSharePointDriveItemContent} from './sharepoint-client.mjs';
const STATE_KEY='romaneio_sharepoint_stock_etags_v1';
const readState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}};
const writeState=value=>localStorage.setItem(STATE_KEY,JSON.stringify(value));
function stockPath(tipo,config=readSharePointConfig()){
 const name=tipo==='embalado'?config.embaladoFileName:tipo==='paripassu'?config.paripassuFileName:'';
 if(!name)throw Error('Nome do arquivo de estoque não configurado.');
 return [config.stockFolderPath,name].filter(Boolean).join('/');
}
async function fetchFile(tipo,{force=false}={}){
 const config=validateSharePointStockConfig(),path=stockPath(tipo,config);
 const meta=await getSharePointFileMetadataByPath(path),state=readState(),saved=state[tipo];
 let file=tipo==='embalado'?await (await import('./modelo-estoque-persistente.mjs')).recuperarModeloEmbalado():window.__sharePointParipassuFile||null;
 const changed=!saved||saved.eTag!==meta.eTag;
 if(force||changed||!file){
  const blob=await downloadSharePointDriveItem(meta.id);
  file=new File([blob],String(meta.name||path).split('/').pop(),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',lastModified:Date.parse(meta.lastModifiedDateTime||'')||Date.now()});
  if(tipo==='embalado')await (await import('./modelo-estoque-persistente.mjs')).guardarModeloEmbalado(file);
  else window.__sharePointParipassuFile=file;
  state[tipo]={eTag:meta.eTag,itemId:meta.id,path,name:meta.name,lastModifiedDateTime:meta.lastModifiedDateTime||''};writeState(state);
 }else{
  state[tipo]={...saved,itemId:meta.id,path,name:meta.name,lastModifiedDateTime:meta.lastModifiedDateTime||''};writeState(state);
 }
 if(tipo==='embalado'){
  window.__etapa4ArquivoEmbalado=file;window.__etapa4Versoes={...(window.__etapa4Versoes||{}),embalado:meta.eTag};window.__sharePointEmbaladoMeta={...meta,path};
  if(typeof window.importarEstoqueTeste==='function'&&window.__sharePointParsedEmbaladoETag!==meta.eTag){
   await window.importarEstoqueTeste(file);
   if(!window.estoqueTesteConsulta?.size)throw Error('O arquivo Embalado foi baixado, mas não pôde ser lido pelo modelo de estoque.');
   window.__sharePointParsedEmbaladoETag=meta.eTag;
  }
 }else{window.__sharePointParipassuFile=file;window.__sharePointParipassuMeta={...meta,path};}
 return {file,meta,changed,path};
}
export async function refreshSharePointStocks({force=false}={}){
 const a=await fetchFile('embalado',{force}),p=await fetchFile('paripassu',{force});
 return {embalado:a,paripassu:p,changed:a.changed||p.changed,message:'Estoques atualizados do SharePoint. Embalado: '+a.meta.name+'; PariPassu: '+p.meta.name+'.'};
}
export async function downloadUpdatedSharePointEmbalado(){
 const {file}=await fetchFile('embalado',{force:true});
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name||'Estoque Embalado.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),120000);return file;
}
export async function publishConfirmedSharePointBaixa({resultado,versaoInicial}={}){
 const workbook=resultado?.excelAtualizado?.blob;
 if(!workbook)throw Error('Excel atualizado da baixa não está disponível.');
 if(!resultado?.aplicados?.length)throw Error('Nenhuma caixa confirmada para baixa.');
 const config=validateSharePointStockConfig(),path=stockPath('embalado',config),meta=await getSharePointFileMetadataByPath(path);
 if(!versaoInicial||meta.eTag!==versaoInicial)throw Error('O Estoque Embalado mudou no SharePoint desde a conferência. Atualize os estoques e prepare a baixa novamente; o arquivo oficial não foi substituído.');
 const enviado=await replaceSharePointDriveItemContent(meta.id,workbook,versaoInicial);
 const confirmado=await getSharePointFileMetadataByPath(path);
 if(confirmado.id!==meta.id||confirmado.eTag===meta.eTag)throw Error('O SharePoint não confirmou a atualização do arquivo oficial.');
 const file=new File([workbook],String(meta.name||path).split('/').pop(),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',lastModified:Date.now()});
 await (await import('./modelo-estoque-persistente.mjs')).guardarModeloEmbalado(file);
 const state=readState();state.embalado={eTag:confirmado.eTag,itemId:confirmado.id,path,name:confirmado.name,lastModifiedDateTime:confirmado.lastModifiedDateTime||new Date().toISOString()};writeState(state);
 window.__etapa4ArquivoEmbalado=file;window.__sharePointEmbaladoMeta={...confirmado,path};
 window.__etapa4Versoes={...(window.__etapa4Versoes||{}),embalado:confirmado.eTag};window.__sharePointParsedEmbaladoETag='';
 if(typeof window.importarEstoqueTeste==='function')await window.importarEstoqueTeste(file);
 return {success:true,name:confirmado.name||meta.name,eTag:confirmado.eTag,driveItem:enviado?.id||meta.id};
}
