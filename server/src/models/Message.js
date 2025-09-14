import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 4096,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ["message", "system", "notification"],
      default: "message",
    },
    metadata: {
      edited: {
        type: Boolean,
        default: false,
      },
      editedAt: {
        type: Date,
        default: null,
      },
      reactions: {
        type: Map,
        of: [String],
        default: new Map(),
      },
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
  }
);

messageSchema.methods.format = function () {
  return {
    id: this.messageId,
    roomId: this.roomId,
    userId: this.userId,
    username: this.username,
    content: this.content,
    timestamp: this.timestamp,
    type: this.type,
    edited: this.metadata.edited,
  };
};

messageSchema.methods.editContent = function (newContent) {
  this.content = newContent;
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  return this.save();
};

messageSchema.methods.addReaction = function (emoji, userId) {
  if (!this.metadata.reactions.has(emoji)) {
    this.metadata.reactions.set(emoji, []);
  }
  const users = this.metadata.reactions.get(emoji);
  if (!users.includes(userId)) {
    users.push(userId);
  }
  return this.save();
};

messageSchema.methods.removeReaction = function (emoji, userId) {
  if (this.metadata.reactions.has(emoji)) {
    const users = this.metadata.reactions.get(emoji);
    const index = users.indexOf(userId);
    if (index > -1) {
      users.splice(index, 1);
      if (users.length === 0) {
        this.metadata.reactions.delete(emoji);
      }
    }
  }
  return this.save();
};

messageSchema.statics.getRoomHistory = async function (
  roomId,
  limit = 20,
  before = null
) {
  const query = { roomId };
  if (before) {
    query.timestamp = { $lt: before };
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .select(
      "messageId roomId userId username content timestamp type metadata.edited"
    );
};

messageSchema.statics.getUserMessages = async function (userId, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select("messageId roomId content timestamp");
};

messageSchema.statics.createMessage = async function (messageData) {
  const message = new this(messageData);
  await message.save();
  return message.format();
};

messageSchema.statics.deleteOldMessages = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
};

messageSchema.statics.getMessageStats = async function (roomId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        roomId,
        timestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          hour: { $hour: "$timestamp" },
          day: { $dayOfMonth: "$timestamp" },
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        hour: "$_id.hour",
        day: "$_id.day",
        messageCount: "$count",
        userCount: { $size: "$uniqueUsers" },
      },
    },
    {
      $sort: { day: 1, hour: 1 },
    },
  ]);
};

messageSchema.virtual("formattedTime").get(function () {
  const date = new Date(this.timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
});

export const Message = mongoose.model("Message", messageSchema);
