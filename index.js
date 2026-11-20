const http = require('http');
const crypto = require("crypto");
const  WebSocket  = require('ws');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
let clientID = null;
let tankID = null;
let interval = null;

const server = http.createServer((req, res) => {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg'
    };
    if(req.url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(data);
        });
    }
    else if (req.url === '/reset') {
        console.log("reset");
        wss.clients.forEach(client => {
            if (client.id === clientID ) {
                client.close();
            }
        })
        res.end("ok");
    }
    else {
        fs.readFile(path.join(__dirname, req.url), (err, data) => {
            const ext = path.extname(req.url);
            res.writeHead(200, {'Content-Type': mimeTypes[ext] || 'application/octet-stream'});
            res.end(data);
        });
    }
});
// 
const wss = new WebSocket.Server(
    {
        server,
        maxPayload:5*1024*1024, // Set limit to 5 MB
        perMessageDeflate: false // Отключаем сжатие
    }
);

wss.on("connection", (ws, req)  => {
    ws.id = crypto.randomUUID();
    console.log(`${req.socket.remoteAddress} connected ID ${ws.id}`);
    if(req.headers['user-agent'] === "arduino-WebSocket-Client") {
        console.log("tank connected");
        tankID = ws.id;
        ws.role = "vehicle";
        ws.isAlive = true;
        // Отправляем пинг каждые 5 секунд для теста
        interval = setInterval(() => {
            console.log('Отправляем PING...');
            if (!ws.isAlive) {
                ws.close();
                clearInterval(interval);
                return;
            }
            ws.isAlive = false;
            ws.ping(JSON.stringify({id: ws.id})); 
        }, 3000);
    } else {
        console.log("client connected");
        clientID = ws.id;
        ws.role = "client";
        ws.isAlive = true;
        
    }
    
    
    
    ws.on("close", (code, reason) => {
        switch (ws.id) {
            case clientID: 
                console.log(`client closed  code ${code}`);
                clientID = null;
                break;
            case tankID: 
                console.log(`tank closed  code ${code}`);
                tankID = null;
                break;
            default: 
                console.log("???");
        }
        
    });
    ws.on("error", (err) => {
        console.log("Error " + err.message)
    });
    ws.on('pong', (data) => {
        // data — это Buffer, переводим его в строку (если при пинге передавали данные)
        let message = data.toString();
        ws.isAlive = true;
        console.log(`Получен PONG от клиента! Данные: ${(message.id === clientID) ? "client":"tank"}`);
    });

    
    ws.on("message", (data, isBinary)  => {
        if(isBinary) {
            // console.log("binary data");
            const readStream = Readable.from(data);
             wss.clients.forEach((client) => {
                if(client !== ws && client.readyState === 1) {
                    client.send(data);
                }
            });
        } else {
            wss.clients.forEach((client) => {
                if(client !== ws && client.protocol === "arduino" && client.readyState === 1) {
                    client.send(data.toString());
                }
            });
        }
        
    });
});

server.listen(8080, () => {
    console.log(`\\(0_0)/ port: 8080`)
});