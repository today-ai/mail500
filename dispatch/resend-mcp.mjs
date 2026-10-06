// Remote MCP transport. Mutations are never automatically retried: an ambiguous
// response must be reconciled before creating or sending another broadcast.
export class ResendMcp {
  constructor({apiKey,fetcher=fetch,timeoutMs=20000}={}) {
    this.apiKey=apiKey; this.fetcher=fetcher; this.timeoutMs=timeoutMs;
    this.nextId=0; this.session=null; this.conversation=null; this.ready=null;
  }
  async rpc(method,params,notification=false) {
    if(!this.apiKey) throw new Error('Configure the server Resend API key');
    const id=notification?undefined:++this.nextId;
    const response=await this.fetcher('https://mcp.resend.com/mcp',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(this.timeoutMs),
      headers:{Authorization:'Bearer '+this.apiKey,'Content-Type':'application/json',Accept:'application/json, text/event-stream',
        ...(this.protocol?{'MCP-Protocol-Version':this.protocol}:{}),
        ...(this.session?{'Mcp-Session-Id':this.session}:{})},
      body:JSON.stringify({jsonrpc:'2.0',...(id?{id}:{}),method,...(params?{params}:{})})
    });
    if(!response.ok) throw Object.assign(new Error('Resend MCP request failed (HTTP '+response.status+')'),{providerStatus:response.status});
    const session=response.headers.get('mcp-session-id');if(session)this.session=session;
    if(notification)return;
    const raw=await response.text();let message;
    if(response.headers.get('content-type')?.includes('text/event-stream')) {
      for(const block of raw.split(/\r?\n\r?\n/)) {
        const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        if(!data)continue;const item=JSON.parse(data);if(item.id===id)message=item;
      }
    } else message=JSON.parse(raw);
    if(!message||message.id!==id||message.jsonrpc!=='2.0')throw new Error('Invalid Resend MCP response');
    if(message.error)throw new Error('Resend MCP protocol error ('+message.error.code+')');
    return message.result;
  }
  async initialize() {
    if(!this.ready)this.ready=(async()=>{
      const result=await this.rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'mail500',version:'1.0.0'}});
      if(!result?.protocolVersion)throw new Error('Resend MCP did not negotiate a protocol');
      this.protocol=result.protocolVersion;
      await this.rpc('notifications/initialized',undefined,true);
      this.tools=new Map();let cursor;let pages=0;
      do {
        if(++pages>20)throw new Error('Resend MCP tool list exceeded pagination limit');
        const page=await this.rpc('tools/list',cursor?{cursor}:{});
        if(!Array.isArray(page?.tools))throw new Error('Resend MCP returned an invalid tool list');
        for(const tool of page.tools)this.tools.set(tool.name,tool);
        cursor=page.nextCursor;
      }while(cursor);
    })().catch(error=>{this.ready=null;throw error});
    await this.ready;
  }
  async call(name,args,context) {
    await this.initialize();
    if(!this.tools.has(name))throw new Error('Required Resend MCP tool is unavailable: '+name);
    const result=await this.rpc('tools/call',{name,arguments:{...args,context,llm_model:'unknown',...(this.conversation?{conversation_id:this.conversation}:{})}});
    if(result?.isError)throw new Error('Resend MCP tool failed; reconcile remote state before retrying');
    let value=result?.structuredContent;
    if(!value)for(const item of result?.content||[])if(item.type==='text'){try{value=JSON.parse(item.text);break}catch{}}
    if(!value||typeof value!=='object')throw new Error('Resend MCP returned no structured result; reconcile remote state before retrying');
    const conversation=value.conversation_id||result.conversation_id;if(conversation)this.conversation=conversation;
    return value;
  }
  usage() {return this.call('get-usage',{},'Checking an account’s sending and contact quotas to assess readiness for a marketing campaign before synchronizing subscriber lists.');}
  createBroadcastDraft({segmentId,from,replyTo,name,subject,text,html,previewText}) {
    if(!segmentId||!from||!name||!subject||!text)throw new Error('A broadcast needs a segment, sender, name, subject and plain text content');
    if(!text.includes('{{{RESEND_UNSUBSCRIBE_URL}}}')||(html&&!html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}')))throw new Error('Include the provider unsubscribe placeholder in every content format');
    return this.call('create-broadcast',{segmentId,from,name,subject,text,...(html?{html}:{}),...(replyTo?{replyTo}:{}),...(previewText?{previewText}:{})},
      'Creating an unsent marketing campaign draft for a selected subscriber segment so its content can be reviewed before delivery.');
  }
}
