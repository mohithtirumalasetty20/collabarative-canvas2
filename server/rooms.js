const rooms = new Map();

function ensure(room) {
    if (!rooms.has(room)) {
        rooms.set(room, { users: new Map() });
    }
    return rooms.get(room);
}

function addUser(room, socketId, user) {
    const r = ensure(room);
    r.users.set(socketId, user);
}

function removeUserBySocket(room, socketId) {
    const r = rooms.get(room);
    if (!r) return null;
    const user = r.users.get(socketId);
    r.users.delete(socketId);
    return user || null;
}

function getUsers(room) {
    const r = rooms.get(room);
    if (!r) return [];
    return Array.from(r.users.values()).map((u) => ({ userId: u.userId, username: u.username, color: u.color }));
}

module.exports = { addUser, removeUserBySocket, getUsers };
