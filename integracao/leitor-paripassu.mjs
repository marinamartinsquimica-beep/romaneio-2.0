// Exportação PariPassu: aba "1. Estoque". Quantidade = ovos, Qtd. Caixas não é saldo confiável.
const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
export function extrairParipassu(linhas){
 const cab=linhas.findIndex(l=>l.some(v=>normalizar(v)==='TIPO PRODUTO')&&l.some(v=>normalizar(v)==='QUANTIDADE')&&l.some(v=>normalizar(v)==='LOTE'));
 if(cab<0)throw Error('Cabeçalho PariPassu não encontrado: Tipo Produto, Lote e Quantidade.');
 const h=linhas[cab].map(normalizar),iProduto=h.indexOf('TIPO PRODUTO'),iLote=h.indexOf('LOTE'),iOvos=h.indexOf('QUANTIDADE'),iRastro=h.indexOf('CODIGO DE RASTREAMENTO'),iPostura=h.indexOf('POSTURA')>=0?h.indexOf('POSTURA'):h.indexOf('DATA DE POSTURA');
 const mapa=new Map(),rastros=new Map(),conflitos=[],naoIdentificados=[];let industriais=0,semSku=0,linhasValidas=0,fracionadas=0,duplicados=0;
 for(const linha of linhas.slice(cab+1)){
  if(linha.every(v=>String(v??'').trim()===''))continue;
  const produto=String(linha[iProduto]??'').trim(),lote=String(linha[iLote]??'').trim();
  if(/INDUSTRI/i.test(normalizar(produto))){industriais++;continue;}
  const skuMatch=produto.match(/^(\d+)\s*-/),ovosCaixaMatch=produto.match(/\(\s*(\d+)\s*\)/);
  if(!skuMatch||!ovosCaixaMatch||Number(ovosCaixaMatch[1])<=0){semSku++;if(naoIdentificados.length<5)naoIdentificados.push(produto);continue;}
  if(!lote)throw Error('Lote ausente em produto '+skuMatch[1]+'.');
  const bruto=linha[iOvos],ovos=Number(String(bruto??'').trim().replace(',','.'));
  if(String(bruto??'').trim()===''||!Number.isSafeInteger(ovos)||ovos<0)throw Error('Quantidade de ovos inválida no SKU '+skuMatch[1]+' e lote '+lote+'.');
  const sku=skuMatch[1],ovosPorCaixa=Number(ovosCaixaMatch[1]),postura=iPostura<0?'':String(linha[iPostura]??'').trim();
  const rastro=iRastro<0?'':String(linha[iRastro]??'').trim();
  if(rastro){
   const anteriorRastro=rastros.get(rastro);
   if(anteriorRastro){
    duplicados++;
    if(anteriorRastro.sku!==sku||anteriorRastro.lote!==lote||anteriorRastro.ovos!==ovos){
     conflitos.push({codigo:rastro,sku,lote,anterior:anteriorRastro.ovos,atual:ovos});
     // Registros diferentes com a mesma referência permanecem somados, mas a divergência é sinalizada.
     // Apenas repetição idêntica é ignorada, evitando eliminar caixas legítimas.
    }else continue;
   }
   rastros.set(rastro,{sku,lote,ovos,postura});
  }

  if(!Number.isSafeInteger(ovosPorCaixa)||ovosPorCaixa<=0)throw Error('Capacidade inválida: '+produto);
  const chave=JSON.stringify([sku,lote.toUpperCase(),postura.toUpperCase()]),anterior=mapa.get(chave);
  if(anterior){
   if(anterior.ovosPorCaixa!==ovosPorCaixa)throw Error('Embalagens incompatíveis para SKU '+sku+' e lote '+lote+'.');
   anterior.ovos+=ovos;
   if(!Number.isSafeInteger(anterior.ovos))throw Error('Volume de ovos excede o limite seguro: '+sku+'/'+lote);
  }else mapa.set(chave,{sku,lote,postura,ovos,ovosPorCaixa});
  linhasValidas++;
 }
 if(semSku)throw Error(semSku+' produtos sem SKU ou ovos/caixa identificados. Exemplos: '+naoIdentificados.join(' | ')+'. Nenhuma publicação realizada.');
 if(!mapa.size)throw Error('Nenhum produto embalado reconhecido no PariPassu.');
 const itens=[...mapa.values()].map(x=>{
  if(x.ovos%x.ovosPorCaixa!==0)fracionadas++;
  return {sku:x.sku,lote:x.lote,postura:x.postura,saldo:x.ovos/x.ovosPorCaixa,ovos:x.ovos,ovosPorCaixa:x.ovosPorCaixa};
 });
 // Caixas fracionadas são divergências de conferência, não motivo para bloquear a importação.
 return {itens,industriaisIgnorados:industriais,linhasValidas,caixasFracionadas:fracionadas,duplicadosIgnorados:duplicados,conflitosRastreabilidade:conflitos};
}
