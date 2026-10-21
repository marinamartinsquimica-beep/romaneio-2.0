import {parcelaComprovada} from './comprovante-baixa-agrupada.mjs?v=2.0.105';
const texto=x=>String(x??'').trim().toUpperCase();
// Somente evidência positiva de baixa. Saldo zerado e Excel não são prova.
export function registroBaixadoNoEstoque(registro,comprovantes=[]){
 if(!registro||!Array.isArray(comprovantes))return false;
 return comprovantes.some(c=>{
  if(c?.estado!=='BAIXA_CONCLUIDA')return false;
  if(registro.registroId){if(texto(registro.registroId)!==texto(c.registroId))return false;}
  else if(!registro.data||texto(registro.data)!==texto(c.data))return false;
  for(const k of ['sku','destino','palete'])if(!texto(registro[k])||texto(registro[k])!==texto(c[k]))return false;
  if(!texto(registro.loteCompleto||registro.lote)||texto(registro.loteCompleto||registro.lote)!==texto(c.loteCompleto||c.lote))return false;
  if(registro.postura&&c.postura&&texto(registro.postura)!==texto(c.postura))return false;
  if(registro.data&&c.data&&texto(registro.data)!==texto(c.data))return false;
  return (Number(registro.caixas)>0&&Number(registro.caixas)===Number(c.caixas))||parcelaComprovada(registro,c);
 });
}
