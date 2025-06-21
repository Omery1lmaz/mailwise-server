import mongoose from 'mongoose';

const emailQueueSchema = new mongoose.Schema({
    to: String,
    firstName: String,
    lastName: String,
    title: String,
    company: String,
    companyNameForEmails: String,
    email: String,
    seniority: String,
    departments: String,
    workDirectPhone: String,
    mobilePhone: String,
    industry: String,
    personLinkedinUrl: String,
    companyLinkedinUrl: String,
    city: String,
    state: String,
    country: String,
    companyAddress: String,
    companyPhone: String,
    website: String,
    annualRevenue: String,
    totalFunding: String,
    emailStatus: String,
    emailConfidence: String,
    replied: String,
    emailOpen: String,
    emailBounced: String,
    secondaryEmail: String,
    tertiaryEmail: String,
    technologies: String,
    personData: Object, // Tüm satırın orijinali
    isSend: { type: Boolean, default: false },
    isProcessing: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    sendAt: { type: Date }
});

export default mongoose.model('EmailQueue', emailQueueSchema); 