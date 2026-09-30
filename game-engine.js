'use strict';
// 纯规则模块：仅服务器持有完整身份，浏览器不能指定阶段或修改死亡状态。
const configs={5:['狼人','狼人','平民','平民','预言家'],6:['狼人','狼人','平民','平民','预言家','猎人'],7:['狼人','狼人','平民','平民','平民','预言家','女巫'],8:['狼人','狼人','狼人','平民','平民','预言家','女巫','猎人']};
function victory(players){const live=players.filter(p=>p.alive),wolves=live.filter(p=>p.role==='狼人').length,good=live.length-wolves,civilians=live.filter(p=>p.role==='平民').length;if(!wolves)return '好人';return wolves>=good||!civilians||civilians===good?'狼人':null;}
class Game{
 constructor(players,options={}){if(!configs[players.length])throw Error('人数必须为5–8');this.options=options;this.players=players.map(p=>({...p,alive:true,mayVote:true,privateLog:[]}));this.day=1;this.logs=[];this.result=null;this.medicine={save:true,poison:true};this.revision=0;this.lastWords=[];this.shots=[];}
 start(random=Math.random){const roles=[...configs[this.players.length]];for(let i=roles.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[roles[i],roles[j]]=[roles[j],roles[i]];}this.players.forEach((p,i)=>p.role=roles[i]);this.night();}
 set(phase,seconds=60){this.phase=phase;this.revision++;this.deadline=Date.now()+seconds*1000;}
 night(){this.kill=null;this.poison=null;this.saved=false;this.wolfVotes={};this.set('wolf');}
 living(role){return this.players.filter(p=>p.alive&&(!role||p.role===role));}
 actor(){return this.players.find(p=>p.id===this.current);}
 check(){this.result=victory(this.players);if(this.result)this.set('end',0);return !!this.result;}
 nextNightRole(){if(this.phase==='wolf'){const counts={};Object.values(this.wolfVotes).forEach(id=>counts[id]=(counts[id]||0)+1);const targets=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);this.kill=targets.length&&(!targets[1]||counts[targets[0]]>counts[targets[1]])?targets[0]:null;this.set('seer');if(!this.living('预言家').length)this.nextNightRole();}else if(this.phase==='seer'){this.set('witch');if(!this.living('女巫').length)this.dawn();}}
 die(p,cause){if(!p||!p.alive)return;p.alive=false;this.logs.push(`${p.name}出局`);if(this.day===1)this.lastWords.push(p.id);if(p.role==='猎人'&&cause!=='poison'&&(this.day!==1||cause!=='wolf'||this.options.hunterFirst))this.shots.push(p.id);}
 dawn(){this.lastWords=[];this.shots=[];for(const p of this.players){if(p.id===this.poison)this.die(p,'poison');else if(p.id===this.kill&&!this.saved)this.die(p,'wolf');}this.afterDeath='speech';this.deathQueue();}
 deathQueue(){if(this.shots.length){this.current=this.shots.shift();this.set('hunter');return;}if(this.lastWords.length){this.current=this.lastWords.shift();this.set('lastWords');return;}if(this.check())return;if(this.afterDeath==='speech'){this.speakers=this.living().map(p=>p.id);this.nextSpeaker();}else {this.day++;this.night();}}
 nextSpeaker(){this.current=this.speakers.shift();if(this.current)this.set('speech');else {this.votes={};this.set('vote');}}
 finishVote(){const counts={};Object.values(this.votes).filter(Boolean).forEach(id=>counts[id]=(counts[id]||0)+1);const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);this.logs.push('投票：'+JSON.stringify(counts));this.lastWords=[];this.shots=[];if(entries.length&&(!entries[1]||entries[0][1]>entries[1][1])){const p=this.players.find(p=>p.id===entries[0][0]);if(p.role==='白痴'){p.mayVote=false;this.logs.push(`${p.name}翻牌，失去投票权`);}else this.die(p,'vote');}else this.logs.push('平票或全体弃票，无人出局');this.afterDeath='night';this.deathQueue();}
 action(id,type,target,revision){if(revision!==this.revision)throw Error('阶段已改变，请重试');const p=this.players.find(p=>p.id===id),t=this.players.find(p=>p.id===target);if(!p)throw Error('玩家不存在');if(type==='finish'&&id===this.current&&['speech','lastWords'].includes(this.phase)){this.phase==='speech'?this.nextSpeaker():this.deathQueue();return;}
 if(this.phase==='hunter'&&id===this.current&&type==='shoot'){if(target&&(!t?.alive||t.id===id))throw Error('无效目标');if(t)this.die(t,'shot');this.deathQueue();return;}
 if(!p.alive)throw Error('死亡玩家不能行动');
 if(this.phase==='wolf'&&p.role==='狼人'&&type==='kill'){if(!t?.alive||t.role==='狼人')throw Error('无效目标');this.wolfVotes[id]=target;return;}
 if(this.phase==='seer'&&p.role==='预言家'&&type==='inspect'){if(!t?.alive||id===target)throw Error('无效目标');p.privateLog.push(`第${this.day}夜：${t.name}是${t.role==='狼人'?'狼人':'好人'}`);this.nextNightRole();return;}
 if(this.phase==='witch'&&p.role==='女巫'&&['save','poison','skip'].includes(type)){if(type==='save'){if(!this.medicine.save||!this.kill||this.day===1&&this.kill===id&&!this.options.selfSave)throw Error('不能使用解药');this.medicine.save=false;this.saved=true;}if(type==='poison'){if(!this.medicine.poison||!t?.alive)throw Error('不能使用毒药');this.medicine.poison=false;this.poison=target;}this.dawn();return;}
 if(this.phase==='vote'&&p.mayVote&&type==='vote'){if(Object.hasOwn(this.votes,id))throw Error('不能重复投票');if(target&&(!t?.alive||id===target))throw Error('无效目标');this.votes[id]=target||null;if(this.living().filter(x=>x.mayVote).every(x=>Object.hasOwn(this.votes,x.id)))this.finishVote();return;}throw Error('当前阶段不允许该动作');}
 tick(now=Date.now()){if(now<this.deadline||this.phase==='end')return false;if(['wolf','seer'].includes(this.phase))this.nextNightRole();else if(this.phase==='witch')this.dawn();else if(this.phase==='speech')this.nextSpeaker();else if(['hunter','lastWords'].includes(this.phase))this.deathQueue();else if(this.phase==='vote')this.finishVote();return true;}
 canSpeak(id){const p=this.players.find(p=>p.id===id);return !!p&&(this.phase==='wolf'&&p.alive&&p.role==='狼人'||['speech','lastWords'].includes(this.phase)&&id===this.current);}
 canHear(from,to){return this.canSpeak(from)&&(this.phase!=='wolf'||this.players.some(p=>p.id===to&&p.alive&&p.role==='狼人'));}
 view(id){const p=this.players.find(p=>p.id===id);return {phase:this.phase,day:this.day,revision:this.revision,deadline:this.deadline,current:this.current,result:this.result,role:p?.role,privateLog:p?.privateLog||[],logs:this.logs,canSpeak:this.canSpeak(id),players:this.players.map(x=>({id:x.id,name:x.name,alive:x.alive,mayVote:x.mayVote,role:this.phase==='end'||x.id===id||p?.role==='狼人'&&x.role==='狼人'?x.role:null})),medicine:p?.role==='女巫'?this.medicine:null,victim:this.phase==='witch'&&p?.role==='女巫'&&this.medicine.save?this.kill:null};}
}
module.exports={Game,configs,victory};

