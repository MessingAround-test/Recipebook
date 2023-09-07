import mongoose from 'mongoose'
import User from './User.js';
import Game_Selectable_Options_Template from './Game_Selectable_Options_Template'

const GameSchema = new mongoose.Schema(
  {
    username: { type: ObjectId, unique: true, index: true, required: true},
    name: String,
    admin_user: { type: User, required: true },
    selectable_options_id: {type: Game_Selectable_Options_Template, required: true }

  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

module.exports = mongoose.models.Game || mongoose.model('Game', GameSchema)