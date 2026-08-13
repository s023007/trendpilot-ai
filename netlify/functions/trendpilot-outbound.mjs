import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const offers=JSON.parse(fs.readFileSync(path.join(DIR,'_product-data','offers.json'),'utf8'));
const byId=new Map(offers.map(o=>[o.tpoid,o]));
const safeSource=(v)=>String(v??'').replace(/[^a-z0-9_-]/gi,'').slice(0,40)||'unknown';
export const handler=async(event)=>{
  const id=String(event?.queryStringParameters?.offer||'').trim(); const o=byId.get(id);
  if(!o || !/^https?:\/\//i.test(o.url)) return {statusCode:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'},body:'Offer not found'};
  const src=safeSource(event?.queryStringParameters?.src);
  console.log(JSON.stringify({event:'outbound_click',source:src,tpoid:o.tpoid,tpid:o.tpid,tpvid:o.tpvid||null,seller:o.seller,cpcCapable:Boolean(o.cpcCapable),cpcConfirmed:Boolean(o.cpcConfirmed),at:new Date().toISOString()}));
  return {statusCode:302,headers:{location:o.url,'cache-control':'no-store','referrer-policy':'strict-origin-when-cross-origin'},body:''};
};
