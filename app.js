class TableTalk {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.userName = '';
        this.myTableNumber = null;
        this.isHost = false;
        this.initializeElements();
        this.addEventListeners();
    }

    initializeElements() {
        // Pantallas
        this.initialScreen = document.getElementById('initialScreen');
        this.findTableScreen = document.getElementById('findTableScreen');
        this.tableScreen = document.getElementById('tableScreen');
        this.chatArea = document.getElementById('chatArea');

        // Botones principales
        this.findTableBtn = document.getElementById('findTableBtn');
        this.beTableBtn = document.getElementById('beTableBtn');

        // Elementos de búsqueda
        this.myTableNumberInput = document.getElementById('myTableNumber');
        this.targetTableNumberInput = document.getElementById('targetTableNumber');
        this.visitorNameInput = document.getElementById('visitorName');
        this.requestChatBtn = document.getElementById('requestChatBtn');
        this.backFromFindBtn = document.getElementById('backFromFindBtn');

        // Elementos de mesa
        this.tableNumberDisplay = document.getElementById('tableNumberDisplay');
        this.pendingRequests = document.getElementById('pendingRequests');
        this.tableStatus = document.getElementById('tableStatus');
        this.backFromTableBtn = document.getElementById('backFromTableBtn');

        // Elementos de chat
        this.currentTable = document.getElementById('currentTable');
        this.chatStatus = document.getElementById('chatStatus');
        this.chatContainer = document.getElementById('chatContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.endChatBtn = document.getElementById('endChatBtn');
    }

    addEventListeners() {
        this.findTableBtn.addEventListener('click', () => this.showFindTableScreen());
        this.beTableBtn.addEventListener('click', () => this.showTableScreen());
        this.requestChatBtn.addEventListener('click', () => this.requestChat());
        this.backFromFindBtn.addEventListener('click', () => this.showInitialScreen());
        this.backFromTableBtn.addEventListener('click', () => this.showInitialScreen());
        this.endChatBtn.addEventListener('click', () => this.endChat());
        
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
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
            port: 443
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
            console.error('Error PeerJS:', err);
            if (err.type === 'peer-unavailable') {
                alert('La mesa no está disponible en este momento');
            }
        });
    }

    requestChat() {
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
            console.error('Error al conectar:', error);
            alert('Error al conectar con la mesa');
        }
    }

    handleIncomingRequest(conn) {
        conn.on('open', () => {
            const { fromTable, userName } = conn.metadata;
            
            const requestCard = document.createElement('div');
            requestCard.className = 'request-card';
            requestCard.innerHTML = `
                <p>Mesa ${fromTable} quiere chatear</p>
                <p>Nombre: ${userName}</p>
                <div class="request-buttons">
                    <button onclick="tableTalk.acceptRequest('${conn.id}')">Aceptar</button>
                    <button onclick="tableTalk.rejectRequest('${conn.id}')">Rechazar</button>
                </div>
            `;

            this.pendingRequests.appendChild(requestCard);
            conn.on('close', () => requestCard.remove());
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
            const messageData = {
                type: 'message',
                message: message
            };
            this.connection.send(messageData);
            this.addMessageToChat(message, 'sent');
            this.messageInput.value = '';
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
        this.addMessageToChat('⚠️ La conexión ha finalizado', 'system');
    }

    endChat() {
        if (confirm('¿Seguro que quieres terminar el chat?')) {
            this.destroyPeer();
            this.showInitialScreen();
        }
    }
}

// Inicializar la aplicación
let tableTalk;
window.addEventListener('load', () => {
    tableTalk = new TableTalk();
    window.tableTalk = tableTalk;
});
