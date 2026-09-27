const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),WebSocket=require('ws');
const PORT=process.env.PORT||8787, rooms=new Map();
const roles={5:['狼人','狼人','预言家','平民','平民'],6:['狼人','狼人','预言家','女巫','平民','平民'],7:['狼人','狼人','预言家','女巫','平民','平民','平民'],8:['狼人','狼人','狼人','预言家','女巫','猎人','平民','平民']};
const server=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/werewolf.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'werewolf.html')))}res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('Moon Werewolf server running')});
const wss=new WebSocket.Server({server});
function send(ws,type,data={}){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,...data}))}function emit(room,type,data={}){room.players.forEach(p=>send(p.ws,type,data))}function pub(room){return{code:room.code,phase:room.phase,day:room.day,host:room.host,players:room.players.map(p=>({id:p.id,name:p.name,alive:p.alive,connected:!!p.ws}))}}
function start(room){room.phase='wolf';room.day=1;const rs=[...roles[room.count]].sort(()=>Math.random()-.5);room.players.forEach((p,i)=>p.role=rs[i]);emit(room,'started',{state:pub(room),roleById:Object.fromEntries(room.players.map(p=>[p.id,p.role]))})}
function validPhase(room,m){return ['wolf','seer','witch','day','vote'].includes(m.phase)&&m.phase===room.phase}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return send(ws,'error',{message:'invalid message'})}
 if(m.type==='create'){const code=crypto.randomBytes(3).toString('hex').toUpperCase(),token=crypto.randomBytes(18).toString('hex');const room={code,count:Math.max(5,Math.min(8,+m.count||8)),phase:'lobby',day:0,host:m.id,players:[]};const p={id:m.id,name:m.name||'玩家',token,ws,alive:true,role:null};room.players.push(p);rooms.set(code,room);ws.room=room;ws.player=p;send(ws,'room',{state:pub(room),token});return}
 if(m.type==='reconnect'){const room=rooms.get(String(m.code||'').toUpperCase()),p=room?.players.find(x=>x.token===m.token);if(!p)return send(ws,'error',{message:'重连令牌无效'});p.ws=ws;ws.room=room;ws.player=p;send(ws,'room',{state:pub(room),token:p.token});return}
 if(m.type==='join'){const room=rooms.get(String(m.code||'').toUpperCase());if(!room||room.phase!=='lobby'||room.players.length>=room.count)return send(ws,'error',{message:'房间不存在、已开始或已满'});const p={id:m.id,name:m.name||'玩家',token:crypto.randomBytes(18).toString('hex'),ws,alive:true,role:null};room.players.push(p);ws.room=room;ws.player=p;emit(room,'room',{state:pub(room)});send(ws,'token',{token:p.token});return}
 const room=ws.room,p=ws.player;if(!room||!p)return;
 if(m.type==='start'){if(p.id!==room.host||room.players.length!==room.count)return send(ws,'error',{message:'只有满员房主可以开始'});start(room);return}
 if(m.type==='phase'){if(p.id!==room.host||!validPhase(room,m))return send(ws,'error',{message:'非法阶段切换'});room.phase=m.next;emit(room,'state',{state:pub(room)});return}
 if(m.type==='signal'){const target=room.players.find(x=>x.id===m.to);if(target)send(target.ws,'signal',{from:p.id,data:m.data});return}
 if(m.type==='voice'){if(room.phase!=='day'||m.speakingId!==p.id)return send(ws,'error',{message:'当前不允许发言'});emit(room,'voice',{speaker:p.id,enabled:!!m.enabled});return}
 });ws.on('close',()=>{const p=ws.player;if(p)p.ws=null})});
server.listen(PORT,'0.0.0.0',()=>console.log(`Moon Werewolf server listening on ${PORT}`));
