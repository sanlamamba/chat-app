import mongoose from 'mongoose';

const roomMembershipSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    metadata: {
      messagesInRoom: {
        type: Number,
        default: 0
      },
      lastMessageAt: {
        type: Date,
        default: null
      },
      joinCount: {
        type: Number,
        default: 1
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

roomMembershipSchema.index({ roomId: 1, userId: 1 }, { unique: true });
roomMembershipSchema.index({ userId: 1, isActive: 1 });
roomMembershipSchema.index({ roomId: 1, isActive: 1 });

roomMembershipSchema.methods.leave = function () {
  this.isActive = false;
  this.leftAt = new Date();
  return this.save();
};

roomMembershipSchema.methods.rejoin = function () {
  this.isActive = true;
  this.leftAt = null;
  this.metadata.joinCount++;
  return this.save();
};

roomMembershipSchema.methods.incrementMessageCount = function () {
  this.metadata.messagesInRoom++;
  this.metadata.lastMessageAt = new Date();
  return this.save();
};

roomMembershipSchema.statics.joinRoom = async function (
  userId,
  username,
  roomId
) {
  const existing = await this.findOne({ userId, roomId });

  if (existing) {
    if (!existing.isActive) {
      return existing.rejoin();
    }
    return existing;
  }

  const membership = new this({
    userId,
    username,
    roomId
  });

  return membership.save();
};

roomMembershipSchema.statics.leaveRoom = async function (userId, roomId) {
  const membership = await this.findOne({ userId, roomId, isActive: true });
  if (membership) {
    return membership.leave();
  }
  return null;
};

roomMembershipSchema.statics.getActiveRoomMembers = async function (roomId) {
  return this.find({ roomId, isActive: true })
    .select('userId username joinedAt metadata.messagesInRoom')
    .sort({ joinedAt: 1 });
};

roomMembershipSchema.statics.getUserActiveRooms = async function (userId) {
  return this.find({ userId, isActive: true })
    .select('roomId joinedAt metadata.messagesInRoom')
    .sort({ joinedAt: -1 });
};

roomMembershipSchema.statics.getRoomMemberCount = async function (roomId) {
  return this.countDocuments({ roomId, isActive: true });
};

roomMembershipSchema.statics.cleanupInactiveMemberships = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    isActive: false,
    leftAt: { $lt: thirtyDaysAgo }
  });
};

export const RoomMembership = mongoose.model(
  'RoomMembership',
  roomMembershipSchema
);
