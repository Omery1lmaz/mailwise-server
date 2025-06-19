import mongoose from 'mongoose';
import { parentPort, workerData } from 'worker_threads';
import EmailQueue from './emailQueueModel.js';
import { sendMail, createMailBody } from './index.js';
import dotenv from 'dotenv';
dotenv.config();

// Worker içinde MongoDB bağlantısı aç
mongoose.connect("mongodb+srv://omer:cnZXReX0N7fiGIAQ@cluster0.a6nr3dw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" || "mongodb://localhost:27017/maildb", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    for (const item of workerData.batch) {
        const to = item.to;
        const person = item.personData;
        const body = createMailBody(person);
        await sendMail(to, body, person);
        await EmailQueue.updateOne({ _id: item._id }, { isSend: true, isProcessing: false });
        await new Promise(resolve => setTimeout(resolve, 45000));
    }
    parentPort.postMessage({ done: true });
    process.exit(0);
}).catch(err => {
    console.error('Worker MongoDB bağlantı hatası:', err);
    process.exit(1);
}); 