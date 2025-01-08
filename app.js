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
        this.setupTableScreen = document.getElementById('setupTableScreen');
        this.findTableScreen = document.getElementById('findTableScreen');
        this.tableScreen = document.getElementById('tableScreen');
        this.chatArea = document.getElementById('chatArea');

        // Botones principales
        this.findTableBtn = document.getElementById('findTableBtn');
        this.beTableBtn = document.getElementById('beTableBtn');

        // Elementos de configuración de mesa
        this.setupTableNumber = document.getElementById('setupTableNumber');
        this.confirmTableSetup = document.getElementById('confirmTableSetup');
        this.backFromSetupBtn = document.getElementById('backFromSetupBtn');
        this.setupStatus = document.getElementById('setupStatus');

        // Elementos de búsqueda
        this.myTableNumberInput = document.getElementById('myTableNumber');
        this.targetTableNumberInput = document.getElementById('targetTableNumber');
        this.visitorNameInput = document.getElementById('visitorName');
        this.requestChatBtn = document.getElementById('requestChatBtn');
        this.backFromFindBtn = document.getElementById('backFromFindBtn');
        this.findStatus = document.getElementById('findStatus');

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
        // Botones principales
        this.findTableBtn.addEventListener('click', () => this.showFindTableScreen());
        this.beTableBtn.addEventListener('click', () => this.showSetupTableScreen());

        // Botones de configuración de mesa
        this.confirmTableSetup.addEventListener('click', () => this.handleTableSetup());
        this.backFromSetupBtn.addEventListener('click', () => this.showInitialScreen());

        // Botones de búsqueda
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

    hideAllScreens() {
        this.initialScreen.classList.add('hidden');
        this.setupTableScreen.classList.add('hidden');
        this.findTableScreen.classList.add('hidden');
        this.tableScreen.classList.add('hidden');
        this.chatArea.classList.add('hidden');
    }

    showInitialScreen() {
        this.hideAllScreens();
        this.initialScreen.classList.remove('hidden');
        this.destroyPeer();
    }

    showSetupTableScreen() {
        this.hideAllScreens();
        this.setupTableScreen.classList.remove('hidden');
        this.setupTableNumber.focus();
    }

    showFindTableScreen() {
        this.hideAllScreens();
        this.findTableScreen.classList.remove('hidden');
        this.myTableNumberInput.focus();
    }

    showTableScreen() {
        this.hideAllScreens();
        this.tableScreen.classList.remove('hidden');
    }

    showChatArea() {
        this.hideAllScreens();
        this.chatArea.classList.remove('hidden');
    }

    handleTableSetup() {
        const tableNumber = this.setupTableNumber.value.trim();
        if (!tableNumber) {
            alert('Por favor ingresa un número de mesa');
            return;
        }

        this.isHost = true;
        this.myTableNumber = tableNumber;
        this.tableNumberDisplay.textContent = tableNumber;
        this.initializePeer(`mesa_${tableNumber}`);
        this.showTableScreen();
    }

    // Aquí comienzan las funciones de PeerJS
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
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', id => {
            console.log('Conectado con ID:', id);
            
            if (this.isHost) {
                this.tableStatus.textContent = 'Listo para recibir solicitudes';
            }
        });

        this.peer.on('connection', conn => {
            console.log('Nueva conexión entrante');
            if (this.isHost) {
                this.handleIncomingRequest(conn);
            } else {
                this.handleConnection(conn);
            }
        });

        this.peer.on('error', err => {
            console.error('Error de PeerJS:', err);
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

            conn.on('data', data => {
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
            const requestElement = document.createElement('div');
            requestElement.className = 'request-card';
            requestElement.innerHTML = `
                <p>Mesa ${fromTable} quiere chatear</p>
                <p>Nombre: ${userName}</p>
                <button onclick="tableTalk.acceptRequest('${conn.id}')">Aceptar</button>
                <button onclick="tableTalk.rejectRequest('${conn.id}')">Rechazar</button>
            `;
            this.pendingRequests.appendChild(requestElement);
        });
    }

    handleConnection(conn) {
        this.connection = conn;
        this.chatStatus.textContent = 'Conectado';
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;

        conn.on('data', data => {
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
        messageElement.className = `message ${type}`;
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

    acceptRequest(connId) {
        // Implementar aceptación de solicitud
    }

    rejectRequest(connId) {
        // Implementar rechazo de solicitud
    }
}

// Crear instancia global para poder acceder desde los botones de solicitud
let tableTalk;
window.addEventListener('load', () => {
    tableTalk = new TableTalk();
    window.tableTalk = tableTalk; // Hacer accesible globalmente
});
