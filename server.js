'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{WebSocketServer}=require('ws'),{Game}=require('./game-engine');
function createService(){
 const rooms=new Map(),sessions=new Map();const send=(ws,m)=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));};
 const server=http.createServer((req,res)=>{const file={'/':'werewolf.html','/werewolf.html':'werewolf.html','/werewolf-voice.js':'werewolf-voice.js','/client.js':'client.js'}[req.url?.split('?')[0]];if(!file){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(path.join(__dirname,file)));});
 const wss=new WebSocketServer({server,maxPayload:65536});
 function broadcast(r){for(const p of r.players){const game=r.game?.view(p.id);send(p.ws,{type:'state',code:r.code,count:r.count,host:r.host,self:p.id,players:r.players.map(x=>({id:x.id,name:x.name,ready:x.ready,connected:x.ws?.readyState===1})),game:game||null,voicePeers:r.game?r.players.filter(x=>x.ws?.readyState===1&&(r.game.canHear(p.id,x.id)||r.game.canHear(x.id,p.id))).map(x=>x.id).filter(id=>id!==p.id):[]});}}
 wss.on('connection',ws=>{ws.on('message',raw=>{try{const m=JSON.parse(raw);let p=ws.player,r=p?.room;
 if(m.type==='resume'){if(p)throw Error('已加入房间');p=sessions.get(m.token);if(!p)throw Error('重连凭据已失效');p.ws?.close();p.ws=ws;ws.player=p;broadcast(p.room);return;}
 if(m.type==='create'||m.type==='join'){if(p)throw Error('请先退出当前房间');const name=String(m.name||'').trim();if(!name)throw Error('请输入玩家名称');if(m.type==='create'){if(![5,6,7,8].includes(m.count))throw Error('人数必须为5–8');r={code:crypto.randomBytes(5).toString('hex').toUpperCase(),count:m.count,players:[],options:{selfSave:!!m.selfSave,hunterFirst:!!m.hunterFirst}};rooms.set(r.code,r);}else {r=rooms.get(String(m.code).trim().toUpperCase());if(!r||r.game||r.players.length>=r.count)throw Error('房间不存在、已满或已开始');}p={id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),name:name.slice(0,24),ready:false,ws,room:r};r.players.push(p);r.host||=p.id;sessions.set(p.token,p);ws.player=p;send(ws,{type:'session',token:p.token});broadcast(r);return;}
 if(!p)throw Error('请先加入房间');
 if(m.type==='leave'){if(r.game&&r.game.phase!=='end'&&r.game.players.find(x=>x.id===p.id)?.alive)throw Error('存活玩家请保留席位，可断线重连');sessions.delete(p.token);p.ws=null;ws.player=null;if(!r.game)r.players=r.players.filter(x=>x!==p);if(r.host===p.id)r.host=r.players.find(x=>x.ws)?.id;send(ws,{type:'left'});broadcast(r);return;}
 if(m.type==='ready'){if(r.game)throw Error('已经开始');p.ready=!!m.ready;}
 else if(m.type==='start'){if(p.id!==r.host||r.game||r.players.length!==r.count||!r.players.every(x=>x.ready&&x.ws?.readyState===1))throw Error('需要满员、全部在线并准备');r.game=new Game(r.players.map(x=>({id:x.id,name:x.name})),r.options);r.game.start();}
 else if(m.type==='action'){if(!r.game)throw Error('尚未开始');r.game.action(p.id,m.action,m.target,m.revision);}
 else if(m.type==='signal'){const target=r.players.find(x=>x.id===m.to);if(!r.game||m.revision!==r.game.revision||!target||!(r.game.canHear(p.id,target.id)||r.game.canHear(target.id,p.id)))throw Error('当前阶段不允许该语音连接');send(target.ws,{type:'signal',from:p.id,data:m.data,revision:r.game.revision});return;}
 else throw Error('不支持的操作');broadcast(r);
 }catch(e){send(ws,{type:'error',message:e.message});}});ws.on('close',()=>{const p=ws.player;if(p?.ws===ws){p.ws=null;broadcast(p.room);}});});
 const timer=setInterval(()=>{for(const r of rooms.values())if(r.game?.tick())broadcast(r);},250);timer.unref();
 return {server,rooms,close:()=>{clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();server.close();}};
}
if(require.main===module)createService().server.listen(process.env.PORT||8787,'0.0.0.0',()=>console.log('狼人杀服务已启动'));
module.exports={createService};

