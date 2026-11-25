export const CONFIG_KEY='romaneio_sharepoint_config_v1';
export const SHAREPOINT_SCOPES=Object.freeze(['User.Read','Sites.ReadWrite.All','Files.ReadWrite.All']);
const empty=()=>({tenantId:'',clientId:'',siteId:'',listId:'',driveId:'',redirectUri:''});
export function readSharePointConfig(){
 try{return {...empty(),...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')};}
 catch{return empty();}
}
export function saveSharePointConfig(value){
 const next={...empty(),...value};
 for(const key of ['tenantId','clientId','siteId','listId']){
  if(!String(next[key]||'').trim())throw Error('Preencha os campos obrigatórios da conexão SharePoint.');
  next[key]=String(next[key]).trim();
 }
 next.driveId=String(next.driveId||'').trim();
 next.redirectUri=String(next.redirectUri||location.href).trim();
 localStorage.setItem(CONFIG_KEY,JSON.stringify(next));
 return next;
}
export function validateSharePointConfig(value=readSharePointConfig()){
 const missing=['tenantId','clientId','siteId','listId'].filter(k=>!String(value?.[k]||'').trim());
 if(missing.length)throw Error('Configuração SharePoint incompleta: '+missing.join(', ')+'.');
 return value;
}
