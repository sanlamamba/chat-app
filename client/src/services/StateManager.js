import EventEmitter from 'events';

export class StateManager extends EventEmitter {
  constructor() {
    super();
    this.state = {
      username: null,
      userId: null,
      currentRoom: null,
      isConnected: false,
      typingUsers: [],
      onlineUsers: [],
      roomList: []
    };
  }

  setUsername(username) {
    this.state.username = username;
    this.emit('usernameChanged', username);
  }

  getUsername() {
    return this.state.username;
  }

  setUserId(userId) {
    this.state.userId = userId;
    this.emit('userIdChanged', userId);
  }

  getUserId() {
    return this.state.userId;
  }

  setCurrentRoom(roomId, roomName) {
    this.state.currentRoom = {
      id: roomId,
      name: roomName
    };
    this.emit('roomChanged', this.state.currentRoom);
  }

  getCurrentRoom() {
    return this.state.currentRoom;
  }

  clearCurrentRoom() {
    this.state.currentRoom = null;
    this.emit('roomChanged', null);
  }

  isInRoom() {
    return this.state.currentRoom !== null;
  }

  setConnected(connected) {
    this.state.isConnected = connected;
    this.emit('connectionChanged', connected);
  }

  isConnected() {
    return this.state.isConnected;
  }

  setTypingUsers(users) {
    this.state.typingUsers = users;
    this.emit('typingUsersChanged', users);
  }

  getTypingUsers() {
    return this.state.typingUsers;
  }

  setOnlineUsers(users) {
    this.state.onlineUsers = users;
    this.emit('onlineUsersChanged', users);
  }

  getOnlineUsers() {
    return this.state.onlineUsers;
  }

  setRoomList(rooms) {
    this.state.roomList = rooms;
    this.emit('roomListChanged', rooms);
  }

  getRoomList() {
    return this.state.roomList;
  }

  reset() {
    this.state = {
      username: null,
      userId: null,
      currentRoom: null,
      isConnected: false,
      typingUsers: [],
      onlineUsers: [],
      roomList: []
    };
    this.emit('stateReset');
  }

  getState() {
    return { ...this.state };
  }
}
