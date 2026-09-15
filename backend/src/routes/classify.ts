import { Router } from 'express';
import { classifyEmail } from '../services/priorityEngine.js';
export const classifyRouter=Router();
classifyRouter.post('/',(req,res)=>{const {email,rules}=req.body; if(!email||!rules) return res.status(400).json({error:'email and rules required'}); return res.json(classifyEmail(email,rules));});
