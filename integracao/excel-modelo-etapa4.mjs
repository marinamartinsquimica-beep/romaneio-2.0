/* Mantém o XLSX original como modelo: modifica apenas entradas/saídas e acrescenta histórico.
   A planilha original permanece intacta; nenhuma baixa é confirmada no Firebase. */
const norm=x=>String(x??'').trim().toUpperCase();
const key=(a,b)=>JSON.stringify([norm(a),norm(b)]);
const M='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P='http://schemas.openxmlformats.org/package/2006/relationships';
function el(doc,tag){return doc.createElementNS(M,tag)}
function parse(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('XML do Excel inválido.');return doc}
function serial(doc){return new XMLSerializer().serializeToString(doc)}
function numero(v){const x=v==null||v===''?0:Number(v);if(!Number.isSafeInteger(x)||x<0)throw Error('Quantidade do Excel inválida.');return x}
function setNumber(doc,row,col,value){
 const addr=col+row.getAttribute('r'),node=[...row.getElementsByTagNameNS(M,'c')].find(x=>x.getAttribute('r')===addr);
 const c=node||el(doc,'c');if(!node){c.setAttribute('r',addr);const order=col.charCodeAt(0);const next=[...row.children].find(x=>x.localName==='c'&&x.getAttribute('r').match(/^[A-Z]+/)[0].charCodeAt(0)>order);row.insertBefore(c,next||null)}
 if(c.getElementsByTagNameNS(M,'f').length)throw Error('Campo '+addr+' contém fórmula e não pode ser substituído.');
 c.removeAttribute('t');let v=c.getElementsByTagNameNS(M,'v')[0];if(!v){v=el(doc,'v');c.appendChild(v)}v.textContent=String(value);
}
function valueCell(row,col){const c=[...row.getElementsByTagNameNS(M,'c')].find(x=>x.getAttribute('r')===col+row.getAttribute('r'));if(!c)return 0;const v=c.getElementsByTagNameNS(M,'v')[0];return numero(v?.textContent)}
function histCell(doc,row,col,value){const c=el(doc,'c');c.setAttribute('r',col+row.getAttribute('r'));if(typeof value==='number'){const v=el(doc,'v');v.textContent=String(value);c.appendChild(v)}else{c.setAttribute('t','inlineStr');const is=el(doc,'is'),t=el(doc,'t');t.textContent=String(value??'');is.appendChild(t);c.appendChild(is)}row.appendChild(c)}
async function localizar(zip,nome){
 const wb=parse(await zip.file('xl/workbook.xml').async('string'));
 const rel=parse(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
 const sheet=[...wb.getElementsByTagNameNS(M,'sheet')].find(x=>norm(x.getAttribute('name'))===norm(nome));
 if(!sheet)throw Error('Aba '+nome+' não encontrada.');
 const id=sheet.getAttributeNS(R,'id')||sheet.getAttribute('r:id');
 const route=[...rel.getElementsByTagNameNS(P,'Relationship')].find(x=>x.getAttribute('Id')===id)?.getAttribute('Target');
 if(!route)throw Error('Relação da aba '+nome+' não encontrada.');
 const path=route.startsWith('/')?route.slice(1):'xl/'+route.replace(/^\.\//,'');
 return path.replace(/\\/g,'/');
}
export async function gerarExcelModeloEstoque({arquivo,operacao,estoqueOriginal,resultado}){
 if(typeof JSZip==='undefined'||typeof XLSX==='undefined')throw Error('Leitores XLSX necessários não carregados.');
 if(!arquivo)throw Error('Selecione o Excel oficial usado na consulta para preservar a formatação.');
 if(!['baixa','ajuste'].includes(operacao))throw Error('Operação inválida.');
 const buffer=await arquivo.arrayBuffer(),book=XLSX.read(buffer,{type:'array',cellDates:false});
 const sheet=book.Sheets[book.SheetNames.find(n=>norm(n)==='ESTOQUE')];
 if(!sheet)throw Error('Aba Estoque não encontrada no modelo.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
 if(['SKU','LOTE COMPLETO','CAIXAS ENTRADA','SAIDAS','SALDO'].some(h=>!rows[2]?.some(x=>norm(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'')===h)))throw Error('Estrutura do Estoque não corresponde ao modelo aprovado.');
 const entries=new Map(),sums=new Map();
 for(let i=3;i<rows.length;i++){const r=rows[i],sku=String(r[0]??'').trim(),lote=String(r[3]??'').trim();if(!sku||!lote)continue;const saldo=numero(r[9]),entrada=numero(r[7]),saida=numero(r[8]);if(entrada-saida!==saldo)throw Error('Fórmula SALDO divergente na linha '+(i+1)+'. Abra e salve o arquivo no Excel antes de continuar.');const k=key(sku,lote),a=entries.get(k)||[];a.push({row:i+1,sku,lote,produto:String(r[1]??''),saldo,entrada,saida});entries.set(k,a);sums.set(k,(sums.get(k)||0)+saldo)}
 if(!Array.isArray(estoqueOriginal)||!estoqueOriginal.length)throw Error('Estoque de referência ausente.');
 const known=new Set();for(const x of estoqueOriginal){const k=key(x.sku,x.lote);known.add(k);if((sums.get(k)||0)!==numero(x.saldo))throw Error('Modelo Excel difere do saldo compartilhado: '+x.sku+'/'+x.lote+'. Importe a versão atual antes da baixa.')}for(const [k,total] of sums){if(total&& !known.has(k))throw Error('Há lote no Excel que não consta no Firebase. Atualize a consulta antes de continuar.')}
 const mudancas=[],historico=[],id=crypto.randomUUID(),agora=new Date().toISOString();
 const movimentos=operacao==='baixa'?resultado.aplicados:resultado.alteracoes;
 if(!movimentos?.length)throw Error('Nenhuma alteração preparada.');
 for(const movimento of movimentos){
  const k=key(movimento.sku,movimento.lote),itens=entries.get(k);if(!itens?.length)throw Error('Lote não encontrado no arquivo.');
  if(operacao==='baixa'){
   let restante=numero(movimento.caixas);if(restante===0)continue;
   for(const item of itens){const delta=Math.min(restante,item.saldo);if(!delta)continue;const antes=item.saldo;item.saida+=delta;item.saldo-=delta;restante-=delta;mudancas.push({...item});historico.push([agora,item.sku,item.produto,item.lote,delta,delta,antes,item.saldo,'ROMANEIO '+id+' / '+movimento.id]);if(!restante)break}
   if(restante)throw Error('Caixas insuficientes no arquivo para '+movimento.sku+'/'+movimento.lote);
  }else{
   const alvo=numero(movimento.fisico),total=itens.reduce((a,x)=>a+x.saldo,0);
   let diff=alvo-total;
   if(diff>0){const item=itens[0],antes=item.saldo;item.entrada+=diff;item.saldo+=diff;mudancas.push({...item});historico.push([agora,item.sku,item.produto,item.lote,0,0,antes,item.saldo,'AJUSTE +'+diff+' / '+id]);}
   if(diff<0){diff=-diff;for(const item of itens){const delta=Math.min(diff,item.saldo);if(!delta)continue;const antes=item.saldo;item.saida+=delta;item.saldo-=delta;diff-=delta;mudancas.push({...item});historico.push([agora,item.sku,item.produto,item.lote,0,0,antes,item.saldo,'AJUSTE -'+delta+' / '+id]);if(!diff)break}if(diff)throw Error('Ajuste superior ao saldo registrado.')}
  }
 }
 if(!mudancas.length)throw Error('Nenhuma alteração no saldo.');
 const zip=await JSZip.loadAsync(buffer),path=await localizar(zip,'Estoque'),doc=parse(await zip.file(path).async('string'));
 const rowMap=new Map([...doc.getElementsByTagNameNS(M,'row')].map(r=>[Number(r.getAttribute('r')),r]));
 for(const m of mudancas){const row=rowMap.get(m.row);if(!row)throw Error('Linha '+m.row+' ausente no Excel.');setNumber(doc,row,'H',m.entrada);setNumber(doc,row,'I',m.saida)}
 zip.file(path,serial(doc));
 const hp=await localizar(zip,'Historico'),hd=parse(await zip.file(hp).async('string')),data=hd.getElementsByTagNameNS(M,'sheetData')[0];if(!data)throw Error('Histórico sem linhas.');
 let last=Math.max(1,...[...data.getElementsByTagNameNS(M,'row')].map(x=>Number(x.getAttribute('r'))));
 for(const vals of historico){const row=el(hd,'row');row.setAttribute('r',String(++last));'ABCDEFGHI'.split('').forEach((col,i)=>histCell(hd,row,col,vals[i]));data.appendChild(row)}
 const dim=hd.getElementsByTagNameNS(M,'dimension')[0];if(dim)dim.setAttribute('ref','A1:I'+last);zip.file(hp,serial(hd));
 const calc=zip.file('xl/workbook.xml');if(calc){const wd=parse(await calc.async('string'));let cp=wd.getElementsByTagNameNS(M,'calcPr')[0];if(!cp){cp=el(wd,'calcPr');wd.documentElement.appendChild(cp)}cp.setAttribute('fullCalcOnLoad','1');zip.file('xl/workbook.xml',serial(wd));}
 // A planilha preserva suas partes OOXML originais, exceto valores H/I, histórico e recálculo.
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
 return {blob,alteracoes:mudancas.length,registros:historico.length,operacao,id};
}
