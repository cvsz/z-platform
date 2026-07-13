import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const host=process.env.HOST||"127.0.0.1",port=Number(process.env.PORT||3021);
function send(response,status,body,type="application/json; charset=utf-8"){response.writeHead(status,{"Content-Type":type});response.end(body);}
async function json(request){let text="";for await(const c of request){text+=c;if(text.length>100000)throw new Error("Request too large");}return JSON.parse(text);}
async function chat(body){
  const url=process.env.Z_PLATFORM_AI_GATEWAY_URL?.replace(/\/$/,""),token=process.env.Z_PLATFORM_SERVICE_TOKEN;
  if(!url||!token)throw new Error("AI gateway is not configured");
  if(typeof body.prompt!=="string"||!body.prompt.trim())throw new Error("Prompt is required");
  const result=await fetch(url+"/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({model:typeof body.model==="string"&&body.model?body.model:"default",messages:[{role:"user",content:body.prompt.trim()}],stream:false}),signal:AbortSignal.timeout(60000)});
  if(!result.ok)throw new Error("AI gateway rejected the request");
  const payload=await result.json(),content=payload?.choices?.[0]?.message?.content;
  if(typeof content!=="string")throw new Error("Unsupported AI gateway response");
  return {content};
}
createServer(async(req,res)=>{
  try{
    if(req.method==="POST"&&req.url==="/api/chat")return send(res,200,JSON.stringify(await chat(await json(req))));
    if(req.method==="GET"&&req.url==="/")return send(res,200,await readFile(new URL("./public/index.html",import.meta.url)),"text/html; charset=utf-8");
    if(req.method==="GET"&&req.url==="/app.js")return send(res,200,await readFile(new URL("./public/app.js",import.meta.url)),"text/javascript; charset=utf-8");
    return send(res,404,JSON.stringify({error:"Not found"}));
  }catch(error){return send(res,400,JSON.stringify({error:error instanceof Error?error.message:"Request failed"}));}
}).listen(port,host,()=>console.log("zchat listening on http://"+host+":"+port));
