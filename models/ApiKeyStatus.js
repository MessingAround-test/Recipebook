import mongoose from 'mongoose';

const ApiKeyStatusSchema = new mongoose.Schema(
    {
        keyIndex: { type: Number, required: true, unique: true }, // 1, 2, 3, 4
        primaryStatus: { 
            type: String, 
            enum: ['AVAILABLE', 'OVERLOADED'], 
            default: 'AVAILABLE' 
        },
        fallbackStatus: { 
            type: String, 
            enum: ['AVAILABLE', 'OVERLOADED'], 
            default: 'AVAILABLE' 
        },
        primaryLastOverloaded: { type: Date, default: null },
        fallbackLastOverloaded: { type: Date, default: null },
    },
    { timestamps: true }
);

export default mongoose.models.ApiKeyStatus || mongoose.model('ApiKeyStatus', ApiKeyStatusSchema);
