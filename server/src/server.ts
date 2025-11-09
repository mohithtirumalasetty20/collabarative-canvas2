import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import rooms from './rooms';
import drawingState from './drawing-state';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PUBLIC = path.join(__dirname, '..', '..', 'client');
app.use(express.static(PUBLIC));

app.get('/_health', (_req, res) => res.send('ok'));

io.on('connection', (socket) => {
    socket.on('join', (payload: any) => {
        try {
            const { room, username, color, userId } = payload || {};
            if (!room) return socket.emit('error', { message: 'missing room' });

            socket.join(room);
            rooms.addUser(room, socket.id, { userId, username, color });

            const state = drawingState.getState(room);
            socket.emit('init-state', state);

            socket.to(room).emit('user-join', { userId, username, color });

            io.in(room).emit('users', rooms.getUsers(room));
        } catch (err) {
            console.error('join error', err);
            socket.emit('error', { message: 'join failed' });
        }
    });

    socket.on('draw', (msg: any) => {
        try {
            const { room } = msg || {};
            if (!room || !msg.action || !msg.strokeId) {
                return socket.emit('error', { message: 'invalid draw message' });
            }
            if (['begin', 'draw', 'end'].indexOf(msg.action) === -1) {
                return socket.emit('error', { message: 'invalid draw action' });
            }

            drawingState.handleDraw(room, msg);
            socket.to(room).emit('draw', msg);
        } catch (err) {
            console.error('draw error', err);
            socket.emit('error', { message: 'draw failed' });
        }
    });

    socket.on('cursor', (msg: any) => {
        try {
            const { room } = msg;
            if (!room) return;
            socket.to(room).emit('cursor', msg);
        } catch (err) {
            console.error('cursor error', err);
        }
    });

    socket.on('undo', (msg: any) => {
        try {
            const { room } = msg;
            if (!room) return;
            const res = drawingState.undo(room);
            if (res) io.in(room).emit('undo', res);
        } catch (err) {
            console.error('undo error', err);
        }
    });

    socket.on('redo', (msg: any) => {
        try {
            const { room } = msg;
            if (!room) return;
            const res = drawingState.redo(room);
            if (res) io.in(room).emit('redo', res);
        } catch (err) {
            console.error('redo error', err);
        }
    });

    socket.on('disconnecting', () => {
        const joined = Array.from(socket.rooms).filter((r) => r !== socket.id);
        joined.forEach((room) => {
            const user = rooms.removeUserBySocket(room, socket.id);
            if (user) {
                io.in(room).emit('user-leave', { userId: user.userId });
                io.in(room).emit('users', rooms.getUsers(room));
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
