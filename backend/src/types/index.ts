export type IncomingEmail = { id:string; threadId:string; sender:string; subject:string; snippet:string; labels:string[] };
export type Rule = { type:'label'|'sender'|'domain'|'keyword'; value:string; enabled:boolean };
export type Classification = { important:boolean; priority:'urgent'|'action'|'normal'; reason:string; category:'work'|'college'|'personal' };
