// Homologação só opera com conta e dados do ambiente de teste explicitamente configurado.
// Este controle é verificado antes de qualquer gravação no Firestore.
export function exigirHomologacao(config){
 const id=String(config?.ambienteId||'');
 if(!/^homologacao_[a-zA-Z0-9_-]{6,80}$/.test(id))throw Error('Ambiente de homologação não configurado.');
 if(config?.migracaoConcluida!==true)throw Error('Ambiente de homologação ainda não liberado.');
 if(config?.dadosFicticios!==true)throw Error('Somente dados de homologação podem ser utilizados.');
 return id;
}
