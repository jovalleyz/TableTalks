class TableTalk {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.userName = '';
        this.myTableNumber = null;
        this.isHost = false;
        this.pendingRequests = new Map();
        this.initializeElements();
        this.addEventListeners();
    }

    initializeElements() {
        // Pantalla inicial
        this.initialScreen = document.getElementById('initialScreen');
        this.findTableBtn = document.getElementById('findTableBtn');
        this.beTableBtn = document.getElementById('beTableBtn');

        // Pantalla buscar mesa
        this.findTableScreen = document.getElementById('findTableScreen');
        this.myTableNumberInput = document.getElementById('myTableNumber');
        this.targetTableNumberInput = document.getElementById('targetTableNumber');
        this.visitorNameInput = document.getElementById('visitorName');
        this.requestChatBtn = document.getElementById('requestChatBtn');
        this.backFromFindBtn = document.getElementById('backFromFindBtn');

        // Pantalla mesa
        this.tableScreen = document.getElementById('tableScreen');
        this.tableNumberDisplay = document.getElementById('tableNumberDisplay');
        this.requestsList = document.getElementById('requestsList');
        this.tableStatus = document.getElementById('tableStatus');
        this.backFromTableBtn = document.getElementById('backFromTableBtn');

        // Área de chat
        this.chatArea = document.getElementById('chatArea');
        this.currentTable = document.getElementById('currentTable');
        this.chatStatus = document.getElementById('chatStatus');
        this.chatContainer = document.getElementById('chatContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.endChatBtn = document.getElementById('endChatBtn');
    }

    addEventListeners() {
        // Botones de pantalla inicial
        this.findTableBtn.addEventListener('click', () => this.showFindTableScreen());
        this.beTableBtn.addEventListener('click', () => this.showTableScreen());

        // Botones de búsqueda de mesa
        this.requestChatBtn.addEventListener('click', () => this.requestChat());
        this.backFromFindBtn.addEventListener('click', () => this.showInitialScreen());

        // Botones de mesa
        this.backFromTableBtn.addEventListener('click', () => this.showInitialScreen());

        // Botones de chat
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.endChatBtn.addEventListener('click', () => this.endChat());
    }

    showInitialScreen() {
        this.initialScreen.classList.remove('hidden');
        this.findTableScreen.classList.add('hidden');
        this.tableScreen.classList.add('hidden');
        this.chatArea.classList.add('hidden');
        this.destroyPeer();
    }

    showFindTableScreen() {
        this.initialScreen.classList.add('hidden');
        this.findTableScreen.classList.remove('hidden');
        this.tableScreen.classList.add('hidden');
        this.chatArea.classList.add('hidden');
    }

    showTableScreen() {
        this.isHost = true;
        this.myTableNumber = prompt('Ingresa el número de esta mesa:');
        if (!this.myTableNumber) {
            return this.showInitialScreen();
        }

        this.tableNumberDisplay.textContent = this.myTableNumber;
        this.initializePeer(`mesa_${this.myTableNumber}`);

        this.initialScreen.classList.add('hidden');
        this.findTableScreen.classList.add('hidden');
        this.tableScreen.classList.remove('hidden');
        this.chatArea.classList.add('hidden');
    }

    showChatArea() {
        this.initialScreen.classList.add('hidden');
        this.findTableScreen.classList.add('hidden');
        this.tableScreen.classList.add('hidden');
        this.chatArea.classList.remove('hidden');
    }

    destroyPeer() {
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.peer = null;
        this.connection = null;
    }

    initializePeer(peerId = null) {
        if (this.peer) {
            this.peer.destroy();
        }

        this.peer = new Peer(peerId, {
            host: '0.peerjs.com',
            secure: true,
            port: 443,
            debug: 2,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log('Conectado con ID:', id);
        });

        this.peer.on('connection', (conn) => {
            if (this.isHost) {
                this.handleIncomingRequest(conn);
            } else {
                this.handleConnection(conn);
            }
        });

        this.peer.on('error', (err) => {
            console.error(err);
            if (err.type === 'peer-unavailable') {
                alert('La mesa no está disponible en este momento');
            }
        });
    }

    async requestChat() {
        const myTable = this.myTableNumberInput.value.trim();
        const targetTable = this.targetTableNumberInput.value.trim();
        this.userName = this.visitorNameInput.value.trim();

        if (!myTable || !targetTable || !this.userName) {
            alert('Por favor completa todos los campos');
            return;
        }

        this.myTableNumber = myTable;
        this.initializePeer();
        
        try {
            const conn = this.peer.connect(`mesa_${targetTable}`, {
                metadata: {
                    type: 'request',
                    fromTable: myTable,
                    userName: this.userName
                }
            });

            conn.on('open', () => {
                this.chatStatus.textContent = 'Solicitud enviada. Esperando respuesta...';
                this.currentTable.textContent = targetTable;
                this.showChatArea();
            });

            conn.on('data', (data) => {
                if (data.type === 'request_response') {
                    if (data.accepted) {
                        this.handleConnection(conn);
                    } else {
                        alert('La mesa rechazó tu solicitud de chat');
                        this.showInitialScreen();
                    }
                }
            });
        } catch (error) {
            console.error(error);
            alert('Error al conectar con la mesa');
        }
    }

    handleIncomingRequest(conn) {
        conn.on('open', () => {
            const { fromTable, userName } = conn.metadata;
            
            // Crear tarjeta de solicitud
            const requestCard = document.createElement('div');
            requestCard.className = 'request-card';
            requestCard.innerHTML = `
                <p>Mesa ${fromTable} quiere chatear</p>
                <p>Nombre: ${userName}</p>
                <div class="request-buttons">
                    <button class="accept-btn">Aceptar</button>
                    <button class="reject-btn">Rechazar</button>
                </div>
            `;

            // Agregar eventos a los botones
            const acceptBtn = requestCard.querySelector('.accept-btn');
            const rejectBtn = requestCard.querySelector('.reject-btn');

            acceptBtn.addEventListener('click', () => {
                conn.send({ type: 'request_response', accepted: true });
                this.handleConnection(conn);
                requestCard.remove();
                this.currentTable.textContent = fromTable;
                this.showChatArea();
            });

            rejectBtn.addEventListener('click', () => {
                conn.send({ type: 'request_response', accepted: false });
                requestCard.remove();
                conn.close();
            });

            this.requestsList.appendChild(requestCard);
        });
    }

    handleConnection(conn) {
        this.connection = conn;
        this.chatStatus.textContent = 'Conectado';
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;

        conn.on('data', (data) => {
            if (data.type === 'message') {
                this.addMessageToChat(data.message, 'received');
            }
        });

        conn.on('close', () => {
            this.handleDisconnection();
        });
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (message && this.connection) {
            try {
                const messageData = {
                    type: 'message',
                    message: message
                };
                this.connection.send(messageData);
                this.addMessageToChat(message, 'sent');
                this.messageInput.value = '';
            } catch (error) {
                console.error('Error al enviar:', error);
                this.chatStatus.textContent = 'Error al enviar mensaje';
            }
        }
    }

    addMessageToChat(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.textContent = message;
        
        this.chatContainer.appendChild(messageElement);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    handleDisconnection() {
        this.chatStatus.textContent = 'Desconectado';
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        
        // Mostrar mensaje de desconexión en el chat
        this.addMessageToChat('⚠️ La conexión ha finalizado', 'system');
        
        // Esperar un momento y volver a la pantalla inicial
        setTimeout(() => {
            if (confirm('La conexión ha finalizado. ¿Volver al inicio?')) {
                this.showInitialScreen();
            }
        }, 1500);
    }

    endChat() {
        if (confirm('¿Seguro que quieres terminar el chat?')) {
            if (this.connection) {
                this.connection.close();
            }
            this.showInitialScreen();
        }
    }
}

// Inicializar la aplicación
window.addEventListener('load', () => {
    new TableTalk();
});
