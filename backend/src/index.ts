import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { classifyRouter } from './routes/classify.js';
const app=express(); app.use(cors()); app.use(express.json());
app.get('/health',(_req,res)=>res.json({ok:true,service:'priority-mail-backend'}));
app.use('/api/classify',classifyRouter);
const port=Number(process.env.PORT||4000); app.listen(port,()=>console.log(`PriorityMail API running on :${port}`));
