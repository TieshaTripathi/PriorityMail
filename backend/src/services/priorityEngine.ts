import { Classification, IncomingEmail, Rule } from '../types/index.js';

const actionWords=['deadline','interview','confirm','approval','approve','submit','submission','reply','review','meeting','action required','urgent'];

export function classifyEmail(email:IncomingEmail,rules:Rule[]):Classification{
  const text=`${email.sender} ${email.subject} ${email.snippet}`.toLowerCase();
  const matches=rules.filter(r=>r.enabled).filter(r=>{
    const v=r.value.toLowerCase();
    if(r.type==='label') return email.labels.some(x=>x.toLowerCase()===v);
    if(r.type==='sender') return email.sender.toLowerCase().includes(v);
    if(r.type==='domain') return email.sender.toLowerCase().includes(`@${v.replace(/^@/,'')}`);
    return text.includes(v);
  });
  const action=actionWords.find(w=>text.includes(w));
  const important=matches.length>0 || !!action;
  const urgent=/today|tomorrow|urgent|immediately|deadline/.test(text);
  const category=/college|placement|exam|academic|student/.test(text)?'college':/intern|work|manager|job|career/.test(text)?'work':'personal';
  return {important,priority:urgent?'urgent':important?'action':'normal',reason:[...matches.map(m=>`${m.type}: ${m.value}`),action?`action signal: ${action}`:''].filter(Boolean).join(' + ')||'No priority signal',category};
}
