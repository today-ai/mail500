import test from 'node:test';
import assert from 'node:assert/strict';
import {ResendMcp} from './resend-mcp.mjs';

function fixture({sse=false,fail=false}={}) {
  const calls=[];const client=new ResendMcp({apiKey:'synthetic-test-key',fetcher:async(url,options)=>{
    assert.equal(url,'https://mcp.resend.com/mcp');assert.equal(options.redirect,'error');
    const request=JSON.parse(options.body);calls.push(request);
    if(request.method==='notifications/initialized')return new Response(null,{status:202});
    let result=request.method==='initialize'?{protocolVersion:'2025-06-18'}:request.method==='tools/list'?{tools:[{name:'get-usage'},{name:'create-broadcast'}]}:{structuredContent:{id:'draft-test',conversation_id:'conversation-test'}};
    if(fail&&request.method==='tools/call')return new Response('Unavailable',{status:503});
    const message={jsonrpc:'2.0',id:request.id,result};
    return sse?new Response('event: message\ndata: '+JSON.stringify(message)+'\n\n',{headers:{'content-type':'text/event-stream','mcp-session-id':'session-test'}}):Response.json(message,{headers:{'mcp-session-id':'session-test'}});
  }});return {client,calls};
}
test('MCP initialization, session and analytics conversation across calls',async()=>{
  const {client,calls}=fixture();await client.usage();await client.usage();
  assert.equal(calls.filter(x=>x.method==='initialize').length,1);
  assert.equal(calls.at(-1).params.arguments.conversation_id,'conversation-test');
  assert.equal(calls.at(-1).params.arguments.llm_model,'unknown');
  assert.equal(client.session,'session-test');
});
test('SSE transport creates a draft and never sends it',async()=>{
  const {client,calls}=fixture({sse:true});await client.createBroadcastDraft({segmentId:'segment-test',from:'sender@example.com',name:'Batch 1',subject:'Newsletter',text:'Updates\n{{{RESEND_UNSUBSCRIBE_URL}}}'});
  assert.equal(calls.at(-1).params.name,'create-broadcast');
  assert.equal(calls.some(x=>x.params?.name==='send-broadcast'),false);
});
test('Ambiguous errors are never retried and unsubscribe is mandatory',async()=>{
  const {client,calls}=fixture({fail:true});await assert.rejects(client.usage(),/HTTP 503/);
  assert.equal(calls.filter(x=>x.method==='tools/call').length,1);
  assert.throws(()=>client.createBroadcastDraft({segmentId:'segment',from:'sender',name:'Batch',subject:'News',text:'No unsubscribe'}),/unsubscribe/);
});
