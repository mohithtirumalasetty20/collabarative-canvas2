const rooms = new Map<string, { users: Map<string, any> }>();

function ensure(room: string) {
    if (!rooms.has(room)) {
        rooms.set(room, { users: new Map() });
    }
    return rooms.get(room)!;
}

export function addUser(room: string, socketId: string, user: any) {
    const r = ensure(room);
    r.users.set(socketId, user);
}

export function removeUserBySocket(room: string, socketId: string) {
    const r = rooms.get(room);
    if (!r) return null;
    const user = r.users.get(socketId);
    r.users.delete(socketId);
    return user || null;
}

export function getUsers(room: string) {
    const r = rooms.get(room);
    if (!r) return [];
    return Array.from(r.users.values()).map((u: any) => ({ userId: u.userId, username: u.username, color: u.color }));
}

export default { addUser, removeUserBySocket, getUsers };
