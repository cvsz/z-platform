import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

const jobs = new Map();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8500);

function json(response, status, body) { response.writeHead(status, {"Content-Type":"application/json; charset=utf-8"}); response.end(JSON.stringify(body)); }
function authorized(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const expected = process.env.Z_PLATFORM_SERVICE_TOKEN;
  if (!token || !expected) return false;
  const a=Buffer.from(token), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function body(request) { let text=""; for await(const chunk of request){ text+=chunk; if(text.length>100000) throw new Error("Request body is too large"); } return JSON.parse(text); }

const server=createServer(async(request,response)=>{
  if(!authorized(request)) return json(response,401,{error:"Unauthorized"});
  try {
    if(request.method==="POST" && request.url==="/v1/jobs") {
      const input=await body(request);
      if(typeof input.tenant_id!=="string"||typeof input.task!=="string"||!input.task.trim()||!Array.isArray(input.tool_grants)||typeof input.idempotency_key!=="string") return json(response,400,{error:"Invalid job request"});
      const duplicate=[...jobs.values()].find(job=>job.tenant_id===input.tenant_id&&job.idempotency_key===input.idempotency_key);
      if(duplicate) return json(response,200,duplicate);
      const job={id:randomUUID(),tenant_id:input.tenant_id,task:input.task,tool_grants:input.tool_grants,status:"pending_approval",idempotency_key:input.idempotency_key,created_at:new Date().toISOString()};
      jobs.set(job.id,job); return json(response,202,job);
    }
    const match=request.url?.match(/^\/v1\/jobs\/([^/]+)\/approve$/);
    if(request.method==="POST"&&match) {
      const job=jobs.get(match[1]); if(!job) return json(response,404,{error:"Job not found"});
      if(job.status!=="pending_approval") return json(response,409,{error:"Job is not awaiting approval"});
      const input=await body(request); if(typeof input.approved_by!=="string"||!input.approved_by.trim()) return json(response,400,{error:"approved_by is required"});
      Object.assign(job,{status:"approved",approved_by:input.approved_by,approved_at:new Date().toISOString()});
      return json(response,200,job);
    }
    const get=request.url?.match(/^\/v1\/jobs\/([^/]+)$/);
    if(request.method==="GET"&&get) { const job=jobs.get(get[1]); return job?json(response,200,job):json(response,404,{error:"Job not found"}); }
    return json(response,404,{error:"Not found"});
  } catch(error) { return json(response,400,{error:error instanceof Error?error.message:"Invalid request"}); }
});
server.listen(port,host,()=>console.log("agent-orchestrator listening on http://"+host+":"+port));
