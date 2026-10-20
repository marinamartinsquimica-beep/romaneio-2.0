// Controla apenas consultas automáticas completas. Não armazena dados remotos
// nem interfere em envios, consultas manuais ou validações de baixa.
export function criarControleLeituras({intervalo=300000,agora=()=>Date.now()}={}){
 let anterior=null,ultima=-Infinity;
 return {deveConsultar(assinatura){
  const instante=agora();
  if(assinatura===anterior&&instante-ultima<intervalo)return false;
  anterior=assinatura;ultima=instante;return true;
 }};
}
