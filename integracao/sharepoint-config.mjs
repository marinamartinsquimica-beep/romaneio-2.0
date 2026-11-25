export const CONFIG_KEY='romaneio_sharepoint_config_v1';
export const SHAREPOINT_SCOPES=Object.freeze(['User.Read','Sites.ReadWrite.All','Files.ReadWrite.All']);
const empty=()=>({tenantId:'',clientId:'',siteId:'',listId:'',driveId:'',redirectUri:'',stockFolderPath:'',embaladoFileName:'',paripassuFileName:''});
export function readSharePointConfig(){try{return {...empty(),...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}}catch{return empty()}}
export function saveSharePointConfig(value){
 const next={...empty(),...value};
 for(const key of ['tenantId','clientId','siteId','listId']){if(!String(next[key]||'').trim())throw Error('Preencha os campos obrigatórios da conexão SharePoint.');next[key]=String(next[key]).trim();}
 for(const key of ['driveId','redirectUri','stockFolderPath','embaladoFileName','paripassuFileName'])next[key]=String(next[key]||'').trim();
 if(!next.redirectUri)next.redirectUri=location.href;
 localStorage.setItem(CONFIG_KEY,JSON.stringify(next));return next;
}
export function validateSharePointConfig(value=readSharePointConfig()){
 const missing=['tenantId','clientId','siteId','listId'].filter(k=>!String(value?.[k]||'').trim());
 if(missing.length)throw Error('Configuração SharePoint incompleta: '+missing.join(', ')+'.');return value;
}
export function validateSharePointStockConfig(value=readSharePointConfig()){
 validateSharePointConfig(value);
 const missing=['driveId','stockFolderPath','embaladoFileName','paripassuFileName'].filter(k=>!String(value?.[k]||'').trim());
 if(missing.length)throw Error('Configure a biblioteca, a pasta e os nomes dos dois arquivos de estoque na Central de Conexão.');return value;
}