const ALLOWED=new Set(['product_view','compare_open','variant_select','preview_open']);
export const handler=async(event)=>{
  if(event?.httpMethod!=='POST') return {statusCode:405,body:''};
  let data={}; try{data=JSON.parse(event.body||'{}')}catch{}
  const name=String(data.event||''); if(!ALLOWED.has(name)) return {statusCode:400,body:''};
  const clean=(v,n=100)=>String(v??'').replace(/[\r\n<>]/g,' ').slice(0,n);
  console.log(JSON.stringify({event:name,tpid:clean(data.tpid,40),tpvid:clean(data.tpvid,40),source:clean(data.source,40),at:new Date().toISOString()}));
  return {statusCode:204,headers:{'cache-control':'no-store'},body:''};
};
