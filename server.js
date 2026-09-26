const http = require('http');\nconst fs = require('fs');\nconst path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const server = http.createServer((req,res)=>{if(req.url==='/'||req.url==='/werewolf.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'werewolf.html')))}res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('月影狼人杀联机服务器运行中');});
const wss = new WebSocket.Server({server});
const rooms = new Map();
const roles={5:['狼人','预言家','女巫','平民','平民'],6:['狼人','狼人','预言家','女巫','平民','平民'],7:['狼人','狼人','预言家','女巫','猎人','平民','平民'],8:['狼人','狼人','预言家','女巫','猎人','平民','平民','平民']};
function send(ws,type,data={}){ws.send(JSON.stringify({type,...data}));} function broadcast(room,type,data={}){for(const p of room.players)if(p.ws.readyState===1)send(p.ws,type,data)}
function state(room){return {code:room.code,phase:room.phase,players:room.players.map(p=>({id:p.id,name:p.name,alive:p.alive,host:p.id===room.host})),count:room.count}};
function start(room){const list=[...roles[room.count]].sort(()=>Math.random()-.5);room.phase='night';room.roles=new Map(room.players.map((p,i)=>[p.id,list[i]]));broadcast(room,'started',{state:state(room),roleById:Object.fromEntries(room.roles)});}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(m.type==='create'){const code=crypto.randomBytes(3).toString('hex').toUpperCase();const room={code,count:Math.max(5,Math.min(8,Number(m.count)||8)),phase:'lobby',host:m.id,players:[]};rooms.set(code,room);room.players.push({id:m.id,name:m.name||'玩家',ws,alive:true});ws.room=room;send(ws,'room',{state:state(room)});return}if(m.type==='join'){const room=rooms.get(String(m.code||'').toUpperCase());if(!room||room.phase!=='lobby'||room.players.length>=room.count)return send(ws,'error',{message:'房间不存在、已开始或已满'});room.players.push({id:m.id,name:m.name||'玩家',ws,alive:true});ws.room=room;broadcast(room,'room',{state:state(room)});return}const room=ws.room;if(!room)return;if(m.type==='start'&&m.id===room.host&&room.players.length===room.count)start(room);if(m.type==='phase'&&m.id===room.host){room.phase=m.phase;broadcast(room,'state',{state:state(room)})}});ws.on('close',()=>{const r=ws.room;if(!r)return;r.players=r.players.filter(p=>p.ws!==ws);if(!r.players.length)rooms.delete(r.code);else {if(r.host===ws.id)r.host=r.players[0].id;broadcast(r,'room',{state:state(r)})}})});
server.listen(process.env.PORT||8787,'0.0.0.0',()=>console.log('Moon Werewolf server: http://localhost:8787'));


