import mongoose from 'mongoose';
import MailAccount from './src/mailAccountModel.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = "mongodb+srv://omer:cnZXReX0N7fiGIAQ@cluster0.a6nr3dw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

async function updateAll() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI environment variable is not set!');
        process.exit(1);
    }
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const accounts = await MailAccount.find({ active: true });
    for (const acc of accounts) {
        // Gmail örneği
        acc.imapHost = 'imap.gmail.com';
        acc.imapPort = 993;
        acc.imapSecure = true;
        acc.imapUser = acc.user;
        acc.imapPass = acc.pass;
        await acc.save();
        console.log(`Updated: ${acc.user}`);
    }
    await mongoose.disconnect();
    console.log('Tüm hesaplar güncellendi.');
}

updateAll(); 