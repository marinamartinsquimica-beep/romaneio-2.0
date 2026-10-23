// Cancelamento é uma intenção explícita; nunca inferir por SKU/volume/horário.
const texto=x=>String(x??'').trim();
const fisico=r=>JSON.stringify(['registroId','data','sku','destino','palete','loteCompleto','postura'].map(k=>texto(r?.[k])).concat(Number(r?.caixas)));
export const identidadeVersaoCorrecao=fisico;
// Só evidência explícita de correção cancela uma versão. Outro ID ou
// conteúdo editado permanece válido; igualdade de SKU/volume não basta.
export function registroCanceladoPorCorrecao(registro,arquivo=[],fila=[]){
 if(!registro?.registroId)return false;
 const id=texto(registro.registroId),chave=fisico(registro);
 const marcadores=arquivo.filter(r=>r.estado==='ARQUIVADA_APOS_CONFERENCIA'&&r.correcaoMovimentoId);
 const intencoes=fila.filter(m=>m.tipo==='exclusao'&&m.item?.finalidadeExclusao==='CORRECAO_LANCAMENTO').map(m=>m.item);
 return [...marcadores,...intencoes].some(r=>texto(r.registroId)===id&&(fisico(r)===chave||
  (registro.movimentoExclusaoId&&r.movimentoExclusaoId===registro.movimentoExclusaoId)));
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
 const encerradas=arquivo.map(r=>{
  const m=canceladas.get(fisico(r))||[...canceladas.values()].find(m=>r.movimentoExclusaoId===m.id&&texto(r.registroId)===texto(m.item.registroId));
  if(!m||r.estado==='BAIXA_CONCLUIDA'||r.estado==='ARQUIVADA_APOS_CONFERENCIA')return r;
  evidencias.push({movimentoId:m.id,origem:'arquivo',antes:{...r}});
  return {...r,estado:'ARQUIVADA_APOS_CONFERENCIA',motivoArquivo:'Lançamento cancelado por correção, sem baixa de estoque.',correcaoMovimentoId:m.id,correcaoRegistradaEm:m.criadoEm};
 });
 for(const [chave,m] of canceladas){
  if(encerradas.some(r=>fisico(r)===chave&&(!m.item.exclusaoSemBaixaOperador||(r.estado==='ARQUIVADA_APOS_CONFERENCIA'&&r.correcaoMovimentoId))))continue;
  const antes={...m.item,movimentoExclusaoId:m.id,excluidoEm:m.criadoEm};
  encerradas.push({...antes,estado:'ARQUIVADA_APOS_CONFERENCIA',motivoArquivo:'Lançamento cancelado por correção, sem baixa de estoque.',correcaoMovimentoId:m.id,correcaoRegistradaEm:m.criadoEm});
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
 if(registros.some(r=>registroCanceladoPorCorrecao(r,arquivo)))throw Error('Um lançamento foi cancelado por correção. Prepare novamente a conferência antes da baixa.');
}

