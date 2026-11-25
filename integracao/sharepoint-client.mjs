import {readSharePointConfig,validateSharePointConfig,SHAREPOINT_SCOPES} from './sharepoint-config.mjs';
const GRAPH='https://graph.microsoft.com/v1.0';
const MSAL_CDN='https://alcdn.msauth.net/browser/2.35.0/js/msal-browser.min.js';
let clientPromise=null;
function carregarMsal(){
 if(globalThis.msal?.PublicClientApplication)return Promise.resolve(globalThis.msal);
 return new Promise((resolve,reject)=>{
  const antigo=document.querySelector('script[data-sharepoint-msal]');
  if(antigo){antigo.addEventListener('load',()=>resolve(globalThis.msal),{once:true});antigo.addEventListener('error',()=>reject(Error('Biblioteca de autenticação Microsoft indisponível.')),{once:true});return;}
  const script=document.createElement('script');script.src=MSAL_CDN;script.async=true;script.dataset.sharepointMsal='1';
  script.onload=()=>globalThis.msal?.PublicClientApplication?resolve(globalThis.msal):reject(Error('Biblioteca de autenticação Microsoft não carregou.'));
  script.onerror=()=>reject(Error('Não foi possível carregar a autenticação Microsoft.'));
  document.head.appendChild(script);
 });
}
async function getClient(){
 const config=validateSharePointConfig();
 if(!clientPromise){
  clientPromise=carregarMsal().then(msal=>{
   const app=new msal.PublicClientApplication({auth:{clientId:config.clientId,authority:'https://login.microsoftonline.com/'+config.tenantId,redirectUri:config.redirectUri},cache:{cacheLocation:'localStorage',storeAuthStateInCookie:false}});
   return app;
  }).catch(e=>{clientPromise=null;throw e;});
 }
 return clientPromise;
}
export async function connectSharePoint(){
 const config=validateSharePointConfig();
 const app=await getClient();
 const result=await app.loginPopup({scopes:[...SHAREPOINT_SCOPES]});
 if(result?.account)app.setActiveAccount(result.account);
 return result?.account||null;
}
async function accessToken(){
 const app=await getClient();
 const account=app.getActiveAccount()||app.getAllAccounts()[0];
 if(!account)throw Error('Conecte sua conta Microsoft na Central de Conexão.');
 try{return (await app.acquireTokenSilent({account,scopes:[...SHAREPOINT_SCOPES]})).accessToken;}
 catch(error){if(error?.name==='InteractionRequiredAuthError')throw Error('A sessão Microsoft expirou. Abra a Central de Conexão e conecte novamente.');throw error;}
}
async function graph(path,options={}){
 const token=await accessToken(),url=/^https:\/\//i.test(path)?path:GRAPH+path;
 const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...(options.headers||{})}});
 if(!response.ok){let detail='';try{detail=(await response.json()).error?.message||'';}catch{}throw Error('SharePoint respondeu '+response.status+(detail?': '+detail:''));}
 if(response.status===204)return null;
 const type=response.headers.get('content-type')||'';
 return type.includes('application/json')?response.json():response.blob();
}
function siteListPath(config=readSharePointConfig()){
 validateSharePointConfig(config);
 return '/sites/'+encodeURIComponent(config.siteId)+'/lists/'+encodeURIComponent(config.listId);
}
export async function readAllSharePointRecords(){
 const config=readSharePointConfig(),base=siteListPath(config)+'/items?$expand=fields&$top=200',records=[];
 let next=GRAPH+base;
 while(next){const page=await graph(next);records.push(...(page.value||[]));next=page['@odata.nextLink']||'';}
 return records.map(x=>({itemId:String(x.id),etag:String(x.eTag||''),title:String(x.fields?.Title||''),recordType:String(x.fields?.RecordType||''),scope:String(x.fields?.Scope||''),payload:parsePayload(x.fields?.Payload)}));
}
function parsePayload(value){if(value&&typeof value==='object')return value;try{return JSON.parse(String(value||'{}'));}catch{throw Error('Há um registro SharePoint com conteúdo inválido.');}}
export async function writeSharePointRecord({id,type,scope='romaneio',payload}){
 if(!id||!type||!payload)throw Error('Registro incompleto para publicação.');
 const config=readSharePointConfig();
 await graph(siteListPath(config)+'/items',{method:'POST',body:JSON.stringify({fields:{Title:String(id),RecordType:String(type),Scope:String(scope),Payload:JSON.stringify(payload)}})});
 return {id:String(id),type:String(type),scope:String(scope)};
}
export async function testSharePointConnection(){
 const config=readSharePointConfig();
 const app=await getClient(),account=app.getActiveAccount()||app.getAllAccounts()[0];
 if(!account)throw Error('Conecte primeiro sua conta Microsoft.');
 const user=await graph('/me?$select=id,displayName,userPrincipalName');
 const list=await graph(siteListPath(config)+'?$select=id,displayName');
 await graph(siteListPath(config)+'/items?$top=1');
 return {user:user.displayName||user.userPrincipalName,list:list.displayName||config.listId};
}
function drivePath(path){return String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');}
export async function getSharePointFileMetadataByPath(path){
 const config=readSharePointConfig();
 if(!config.driveId)throw Error('Informe o ID da biblioteca de documentos SharePoint.');
 if(!String(path||'').trim())throw Error('Caminho do arquivo SharePoint não informado.');
 return graph('/drives/'+encodeURIComponent(config.driveId)+'/root:/'+drivePath(path)+'?%24select=id,name,size,eTag,lastModifiedDateTime,%40microsoft.graph.downloadUrl');
}
export async function downloadSharePointDriveItem(itemId){
 const config=readSharePointConfig();
 if(!config.driveId||!itemId)throw Error('Arquivo SharePoint sem identificador.');
 const meta=await graph('/drives/'+encodeURIComponent(config.driveId)+'/items/'+encodeURIComponent(itemId)+'?%24select=id,%40microsoft.graph.downloadUrl');
 const url=meta?.['@microsoft.graph.downloadUrl'];
 if(!url)throw Error('O SharePoint não forneceu o endereço de leitura do arquivo.');
 const response=await fetch(url);if(!response.ok)throw Error('Download do arquivo SharePoint falhou: HTTP '+response.status+'.');return response.blob();
}
export async function replaceSharePointDriveItemContent(itemId,blob,etag){
 const config=readSharePointConfig();
 if(!config.driveId||!itemId||!blob)throw Error('Arquivo SharePoint incompleto para atualização.');
 if(!etag)throw Error('Versão do estoque não identificada; atualize os estoques antes da baixa.');
 if(blob.size>250*1024*1024)throw Error('O arquivo excede o limite de envio direto do SharePoint.');
 return graph('/drives/'+encodeURIComponent(config.driveId)+'/items/'+encodeURIComponent(itemId)+'/content',{method:'PUT',body:blob,headers:{'Content-Type':blob.type||'application/octet-stream','If-Match':etag}});
}
export async function downloadSharePointFile(driveId,itemId){
 if(!driveId||!itemId)throw Error('Arquivo SharePoint sem identificador.');
 const meta=await graph('/drives/'+encodeURIComponent(driveId)+'/items/'+encodeURIComponent(itemId)+'?%24select=id,%40microsoft.graph.downloadUrl');
 const url=meta?.['@microsoft.graph.downloadUrl'];if(!url)throw Error('O SharePoint não forneceu o endereço de leitura do arquivo.');
 const response=await fetch(url);if(!response.ok)throw Error('Download do arquivo SharePoint falhou: HTTP '+response.status+'.');return response.blob();
}
