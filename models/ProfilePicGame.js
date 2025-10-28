import mongoose from 'mongoose';

const ProfilePicGame = new mongoose.Schema(
    {
        seed: {type: String, required: true},
        creator: {type: String, required: true},
        maxPlayers: {type: Number, required: true},
        currentPlayers: [{type: String}]
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

module.exports = mongoose.models.ProfilePicGame || mongoose.model('ProfilePicGame', ProfilePicGame)