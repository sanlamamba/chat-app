import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      totalMessages: {
        type: Number,
        default: 0,
      },
      roomsJoined: [
        {
          type: String,
        },
      ],
      connectionCount: {
        type: Number,
        default: 0,
      },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    currentRoom: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ username: 1, currentRoom: 1 });
userSchema.index({ isOnline: 1 });

userSchema.methods.updateActivity = function () {
  this.lastSeen = new Date();
  return this.save();
};

userSchema.methods.incrementMessageCount = function () {
  this.metadata.totalMessages++;
  return this.save();
};

userSchema.methods.addRoomToHistory = function (roomName) {
  if (!this.metadata.roomsJoined.includes(roomName)) {
    this.metadata.roomsJoined.push(roomName);
    if (this.metadata.roomsJoined.length > 50) {
      this.metadata.roomsJoined.shift();
    }
  }
  return this.save();
};

userSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId });
};

userSchema.statics.findOnlineUsers = function () {
  return this.find({ isOnline: true });
};

userSchema.statics.findUsersInRoom = function (roomName) {
  return this.find({ currentRoom: roomName, isOnline: true });
};

userSchema.statics.setUserOnline = async function (userId, isOnline = true) {
  return this.findOneAndUpdate(
    { userId },
    {
      isOnline,
      lastSeen: new Date(),
      ...(isOnline ? {} : { currentRoom: null }),
    },
    { new: true }
  );
};

userSchema.statics.updateUserRoom = async function (userId, roomName) {
  return this.findOneAndUpdate(
    { userId },
    {
      currentRoom: roomName,
      lastSeen: new Date(),
    },
    { new: true }
  );
};

userSchema.virtual("displayName").get(function () {
  return `${this.username}#${this.userId.substring(0, 4)}`;
});

userSchema.statics.cleanupInactiveUsers = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    isOnline: false,
    lastSeen: { $lt: thirtyDaysAgo },
  });
};

export const User = mongoose.model("User", userSchema);
