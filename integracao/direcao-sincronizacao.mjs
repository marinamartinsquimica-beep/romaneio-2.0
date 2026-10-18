// Direção operacional: celular envia os movimentos, computador recebe.
// Uso sem Firebase: evita que o aparelho móvel reimporte paletes do operador.
export function dispositivoMobile({userAgent='',mobile=false,platform='',touchPoints=0}={}){
 return Boolean(mobile) || /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(String(userAgent)) ||
  (String(platform)==='MacIntel'&&Number(touchPoints)>1);
}
export function permiteReceberPaletes(remoto){
 return !dispositivoMobile(remoto);
}
