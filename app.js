const express = require("express");
const io = require("socket.io")();
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

const namespaces = io.of(/^\/[0-9]{6}$/);

namespaces.on('connection', (socket) => {
    const namespace = socket.nsp;
    socket.broadcast.emit('connected peer');

    // listen for signals
    socket.on('signal', (signal) => {
        socket.broadcast.emit('signal', signal)
    })
    // listen for disconnects
    socket.on('disconnect', () => {
        namespace.emit('disconnected peer');
    })
    
});

module.exports = {app, io};
