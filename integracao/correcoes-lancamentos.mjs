// Cancelamento é uma intenção explícita; nunca inferir por SKU/volume/horário.
const texto=x=>String(x??'').trim();
const fisico=r=>JSON.stringify(['registroId','data','sku','destino','palete','loteCompleto','postura'].map(k=>texto(r?.[k])).concat(Number(r?.caixas)));
export const identidadeVersaoCorrecao=fisico;
// Só evidência explícita de correção cancela uma versão. Outro ID ou
// conteúdo editado permanece válido; igualdade de SKU/volume não basta.
export function criarIndiceCancelamentos(arquivo=[],fila=[]){
 const versoes=new Set(),exclusoes=new Set();
 const adicionar=r=>{
  if(!r?.registroId)return;
  versoes.add(fisico(r));
  if(r.movimentoExclusaoId)exclusoes.add(JSON.stringify([texto(r.registroId),r.movimentoExclusaoId]));
 };
 for(const r of arquivo)if(r.estado==='ARQUIVADA_APOS_CONFERENCIA'&&r.correcaoMovimentoId)adicionar(r);
 for(const m of fila)if(m.tipo==='exclusao'&&m.item?.finalidadeExclusao==='CORRECAO_LANCAMENTO')adicionar(m.item);
 return registro=>Boolean(registro?.registroId&&(versoes.has(fisico(registro))||
  (registro.movimentoExclusaoId&&exclusoes.has(JSON.stringify([texto(registro.registroId),registro.movimentoExclusaoId])))));
}
export function registroCanceladoPorCorrecao(registro,arquivo=[],fila=[]){
 return criarIndiceCancelamentos(arquivo,fila)(registro);
}
// Reparação restrita às duas substituições analisadas e autorizadas em 22/10.
const reparos=[
 {exclusao:'fe2fc4ad-44c2-4ad7-b48f-7d7231578062',registro:'5beef855-fe01-4cae-ab1d-0a1dd8495148',lote:'L20.01.18.10.26',postura:'.18.10.26',caixas:32,novo:'9a1e0eb0-fafa-4b81-a34b-1e2394efe3af',novoCx:35},
 {exclusao:'437907ca-edee-4f7c-9190-50011e55b9e5',registro:'09674644-eb7e-4d3c-a875-eaaf79c73c46',lote:'L21.15.19.10.26',postura:'.19.10.26',caixas:3,novo:'8da81d44-9abc-42c2-a0f7-1d517b6a25cc',novoCx:3}
];
export function identificarCorrecoes(movimentos){
 const movimentosValidos=Array.isArray(movimentos)?movimentos:[];
 return movimentosValidos.filter(m=>{
  if(m?.tipo!=='exclusao'||!m.id||!m.item?.registroId)return false;
  if(m.item.finalidadeExclusao==='CORRECAO_LANCAMENTO')return true;
  const p=reparos.find(p=>p.exclusao===m.id);if(!p)return false;
  const esperado={registroId:p.registro,data:'21/10/2026',sku:'3938',destino:'NHT',palete:'1',loteCompleto:p.lote,postura:p.postura,caixas:p.caixas};
  if(fisico(m.item)!==fisico(esperado))return false;
  return movimentosValidos.some(n=>n.tipo==='inclusao'&&n.autorUid===m.autorUid&&n.dispositivoId===m.dispositivoId&&n.criadoEm>m.criadoEm&&fisico(n.item)===fisico({...esperado,registroId:p.novo,caixas:p.novoCx}));
 });
}
// Reparo comprovado no backup de 23/10: a versão 16 foi editada para 35,
// excluída e depois cancelada explicitamente sem baixa. Não ampliar por ID.
function predecessorComprovado(movimentos,correcoes,fila,confirmados){
 const porId=new Map(movimentos.map(m=>[m.id,m]));
 const inclusao=porId.get('e5c20236-4f64-400a-957b-848e0df60dd3');
 const edicao=porId.get('6b1b8099-e01a-454f-84e1-16d18573ce9f');
 const exclusao=porId.get('400e4f4a-a33e-4d64-a621-7dd8d8048530');
 const cancelamento=correcoes.find(m=>m.id==='612fd7fe-d3cd-4a5c-8f85-3e6a02ef2ea2');
 if(!inclusao||!edicao||!exclusao||!cancelamento?.item?.exclusaoSemBaixaOperador)return null;
 const antes={registroId:'96c2b5c6-9538-45e0-af37-5680c69efb6b',data:'22/10/2026',sku:'3938',destino:'RS',palete:'5',loteCompleto:'L31.11.19.10.26',postura:'.19.10.26',caixas:16};
 const depois={...antes,caixas:35};
 if(inclusao.tipo!=='inclusao'||edicao.tipo!=='edicao'||exclusao.tipo!=='exclusao'||
  fisico(inclusao.item)!==fisico(antes)||fisico(edicao.antes)!==fisico(antes)||
  fisico(edicao.item)!==fisico(depois)||fisico(exclusao.item)!==fisico(depois)||
  fisico(cancelamento.item)!==fisico(depois)||cancelamento.item.movimentoExclusaoId!==exclusao.id)return null;
 if(!inclusao.autorUid||![edicao,exclusao,cancelamento].every(m=>m.autorUid===inclusao.autorUid)||
  !(inclusao.criadoEm<edicao.criadoEm&&edicao.criadoEm<exclusao.criadoEm&&exclusao.criadoEm<cancelamento.criadoEm))return null;
 // Uma edição local, baixa ou reinclusão posterior exige nova conferência.
 if(fila.some(m=>texto(m.item?.registroId||m.antes?.registroId)===antes.registroId)||
  confirmados.some(r=>fisico(r)===fisico(antes))||
  movimentos.some(m=>['inclusao','edicao'].includes(m.tipo)&&m.criadoEm>edicao.criadoEm&&fisico(m.item)===fisico(antes)))return null;
 return {...cancelamento,item:{...edicao.antes,finalidadeExclusao:'CORRECAO_LANCAMENTO',exclusaoSemBaixaOperador:true},edicaoComprovanteId:edicao.id};
}
export function conciliarCorrecoes({entradas,arquivo,movimentos,comprovantes=[],fila=[]}){
 if(![entradas,arquivo,movimentos,comprovantes,fila].every(Array.isArray))throw Error('Base de correções inválida; dados preservados.');
 const correcoes=identificarCorrecoes(movimentos);
 const confirmados=[...arquivo,...comprovantes].filter(x=>x?.estado==='BAIXA_CONCLUIDA');
 const evidencias=[],canceladas=new Map();
 for(const m of correcoes){
  const r=m.item;
  if(!r.exclusaoSemBaixaOperador&&entradas.filter(x=>texto(x.registroId)===texto(r.registroId)).length>1)continue;
  // Não desfaz baixa nem interfere em edição local ainda não confirmada.
  if(!r.exclusaoSemBaixaOperador&&confirmados.some(x=>texto(x.registroId)===texto(r.registroId)))continue;
  if(!r.exclusaoSemBaixaOperador&&fila.some(x=>texto(x.item?.registroId||x.antes?.registroId)===texto(r.registroId)))continue;
  canceladas.set(fisico(r),m);
 }
 const predecessor=predecessorComprovado(movimentos,correcoes,fila,confirmados);
 if(predecessor)canceladas.set(fisico(predecessor.item),predecessor);
 const encerradas=arquivo.map(r=>{
  const m=canceladas.get(fisico(r))||[...canceladas.values()].find(m=>r.movimentoExclusaoId===m.id&&texto(r.registroId)===texto(m.item.registroId));
  if(!m||r.estado==='BAIXA_CONCLUIDA'||r.estado==='ARQUIVADA_APOS_CONFERENCIA')return r;
  evidencias.push({movimentoId:m.id,origem:'arquivo',antes:{...r}});
  return {...r,estado:'ARQUIVADA_APOS_CONFERENCIA',motivoArquivo:'Lançamento cancelado por correção, sem baixa de estoque.',correcaoMovimentoId:m.id,correcaoRegistradaEm:m.criadoEm};
 });
 for(const [chave,m] of canceladas){
  if(encerradas.some(r=>fisico(r)===chave&&(!m.item.exclusaoSemBaixaOperador||(r.estado==='ARQUIVADA_APOS_CONFERENCIA'&&r.correcaoMovimentoId))))continue;
  const antes={...m.item,movimentoExclusaoId:m.id,excluidoEm:m.criadoEm};
  encerradas.push({...antes,estado:'ARQUIVADA_APOS_CONFERENCIA',motivoArquivo:'Lançamento cancelado por correção, sem baixa de estoque.',correcaoMovimentoId:m.id,correcaoRegistradaEm:m.criadoEm,...(m.edicaoComprovanteId?{edicaoComprovanteId:m.edicaoComprovanteId}:{})});
  evidencias.push({movimentoId:m.id,origem:'marcador-correcao',antes});
 }
 const ativas=entradas.filter(r=>{
  const m=canceladas.get(fisico(r));if(!m)return true;
  evidencias.push({movimentoId:m.id,origem:'entradas',antes:{...r}});return false;
 });
 return {entradas:ativas,arquivo:encerradas,evidencias};
}
export function validarSelecaoSemCancelamentos(registros,arquivo){
 if(!Array.isArray(registros)||!Array.isArray(arquivo))throw Error('Seleção de baixa inválida.');
 const cancelado=criarIndiceCancelamentos(arquivo);
 if(registros.some(cancelado))throw Error('Um lançamento foi cancelado por correção. Prepare novamente a conferência antes da baixa.');
}

