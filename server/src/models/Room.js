import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      messageCount: {
        type: Number,
        default: 0,
      },
      peakUsers: {
        type: Number,
        default: 0,
      },
      currentUsers: {
        type: Number,
        default: 0,
      },
      totalUniqueUsers: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

roomSchema.index({ isActive: 1, lastActivity: -1 });
roomSchema.index({ "metadata.currentUsers": -1 });

roomSchema.methods.incrementMessageCount = function () {
  this.metadata.messageCount++;
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.updateUserCount = function (count) {
  this.metadata.currentUsers = count;
  if (count > this.metadata.peakUsers) {
    this.metadata.peakUsers = count;
  }
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.markInactive = function () {
  this.isActive = false;
  this.metadata.currentUsers = 0;
  return this.save();
};

roomSchema.statics.findByName = function (name) {
  return this.findOne({ name, isActive: true });
};

roomSchema.statics.findActiveRooms = function (limit = 50) {
  return this.find({ isActive: true })
    .sort({ "metadata.currentUsers": -1, lastActivity: -1 })
    .limit(limit)
    .select(
      "roomId name metadata.currentUsers metadata.messageCount createdAt"
    );
};

roomSchema.statics.createRoom = async function (roomData) {
  const room = new this(roomData);
  try {
    await room.save();
    return { success: true, room };
  } catch (error) {
    if (error.code === 11000) {
      return { success: false, error: "ROOM_EXISTS" };
    }
    throw error;
  }
};

roomSchema.statics.incrementUserCount = async function (roomId, increment = 1) {
  const room = await this.findOne({ roomId });
  if (!room) return null;

  room.metadata.currentUsers = Math.max(
    0,
    room.metadata.currentUsers + increment
  );
  if (increment > 0 && room.metadata.currentUsers > room.metadata.peakUsers) {
    room.metadata.peakUsers = room.metadata.currentUsers;
  }
  if (increment > 0) {
    room.metadata.totalUniqueUsers++;
  }

  room.lastActivity = new Date();

  if (room.metadata.currentUsers === 0) {
    room.isActive = false;
  }

  return room.save();
};

roomSchema.statics.cleanupEmptyRooms = async function () {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.updateMany(
    {
      "metadata.currentUsers": 0,
      lastActivity: { $lt: oneHourAgo },
      isActive: true,
    },
    { isActive: false }
  );
};

roomSchema.virtual("info").get(function () {
  return {
    id: this.roomId,
    name: this.name,
    users: this.metadata.currentUsers,
    messages: this.metadata.messageCount,
    created: this.createdAt,
    active: this.isActive,
  };
});

export const Room = mongoose.model("Room", roomSchema);
