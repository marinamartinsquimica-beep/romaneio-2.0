// Um ID legado repetido só pode ser agrupado se TODAS as linhas forem iguais.
// O comprovante guarda as parcelas; nenhuma linha ou caixa é descartada.
export const conteudoCanonico=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function parcelaComprovada(registro,comprovante){
 const linhas=comprovante?.linhasBaixa;
 if(!Array.isArray(linhas)||linhas.length<2||linhas.length>400)return false;
 const normalizar=x=>({...x,caixas:Number(x?.caixas)});
 const primeira=normalizar(linhas[0]);
 if(!Number.isSafeInteger(primeira.caixas)||primeira.caixas<=0)return false;
 if(linhas.some(x=>conteudoCanonico(normalizar(x))!==conteudoCanonico(primeira)))return false;
 const {linhasBaixa:_,...total}=comprovante;
 for(const campo of ['registroId','destino','palete','sku','loteCompleto','lote','postura','data']){
  if(String(total[campo]??'')!==String(primeira[campo]??'')||String(registro?.[campo]??'')!==String(primeira[campo]??''))return false;
 }
 return Number(comprovante.caixas)===primeira.caixas*linhas.length&&Number(registro?.caixas)===primeira.caixas;
}
