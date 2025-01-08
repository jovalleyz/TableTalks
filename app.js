class TableTalk {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.userName = 'Anfitrión';
        this.tableNumber = this.getTableNumber();
        this.isHost = !this.getTargetTableFromURL();
        this.initializeElements();
        
        if (this.isHost) {
            this.initializePeer();
            this.showHostInterface();
        } else {
            this.showWelcomeScreen();
        }
    }

    initializeElements() {
        // Elementos de bienvenida
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.visitorNameInput = document.getElementById('visitorName');
        this.joinChatBtn = document.getElementById('joinChatBtn');
        this.targetTable = document.getElementById('targetTable');
        
        // Elementos del chat
        this.chatArea = document.getElementById('chatArea');
        this.sendBtn = document.getElementById('sendBtn');
        this.messageInput = document.getElementById('messageInput');
        this.chatContainer = document.getElementById('chatContainer');
        this.statusElement = document.getElementById('status');
        this.hostModeDiv = document.getElementById('hostMode');
        this.currentTable = document.getElementById('currentTable');
        this.tableNumberElement = document.getElementById('tableNumber');
        this.emergencyBtn = document.getElementById('emergencyBtn');

        // Configurar reacciones rápidas y emojis
        this.setupReactions();
        this.setupEmojis();
        
        this.addEventListeners();
    }

    setupReactions() {
        const reactionButtons = document.querySelectorAll('.reaction-btn');
        reactionButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.sendMessage(button.textContent);
            });
        });
    }

    setupEmojis() {
        const emojiButtons = document.querySelectorAll('.emoji-btn');
        emojiButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.messageInput.value += button.textContent;
                this.messageInput.focus();
            });
        });
    }

    getTableNumber() {
        // En una implementación real, esto vendría de un QR específico por mesa
        return Math.floor(Math.random() * 20) + 1;
    }

    showWelcomeScreen() {
        this.welcomeScreen.classList.remove('hidden');
        this.hostModeDiv.classList.add('hidden');
        this.chatArea.classList.add('hidden');
        
        const targetTable = this.getTargetTableFromURL();
        if (targetTable) {
            this.targetTable.textContent = targetTable.replace('mesa_', '');
        }
    }

    showHostInterface() {
        this.welcomeScreen.classList.add('hidden');
        this.hostModeDiv.classList.remove('hidden');
        this.chatArea.classList.remove('hidden');
        this.tableNumberElement.textContent = this.tableNumber;
    }

    showChatInterface() {
        this.welcomeScreen.classList.add('hidden');
        this.hostModeDiv.classList.add('hidden');
        this.chatArea.classList.remove('hidden');
        
        const targetTable = this.getTargetTableFromURL();
        if (targetTable) {
            this.currentTable.textContent = targetTable.replace('mesa_', '');
        }
    }

    getTargetTableFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mesa');
    }

    addEventListeners() {
        if (!this.isHost) {
            this.joinChatBtn.addEventListener('click', () => this.handleJoinChat());
            this.visitorNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleJoinChat();
            });
        }
        
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        this.emergencyBtn.addEventListener('click', () => this.handleEmergency());
    }

    handleJoinChat() {
        const name = this.visitorNameInput.value.trim();
        if (name) {
            this.userName = name;
            this.showChatInterface();
            this.initializePeer();
        } else {
            alert('Por favor ingresa un nombre o alias');
        }
    }

    handleEmergency() {
        if (confirm('¿Seguro que quieres cerrar el chat inmediatamente?')) {
            if (this.connection) {
                this.connection.close();
            }
            if (this.peer) {
                this.peer.destroy();
            }
            window.location.reload();
        }
    }

    initializePeer() {
        const peerId = this.isHost ? `mesa_${this.tableNumber}` : undefined;
        
        this.peer = new Peer(peerId, {
            host: 'peerjs-server.herokuapp.com',
            secure: true,
            port: 443,
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log('Mi ID:', id);
            if (this.isHost) {
                this.generateQR(id);
            } else {
                this.connectToTable(this.getTargetTableFromURL());
            }
        });

        this.peer.on('connection', (conn) => {
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error(err);
            this.statusElement.textContent = `Error: ${err.type}`;
            if (err.type === 'peer-unavailable') {
                this.statusElement.textContent = 'La mesa no está disponible en este momento';
            }
        });
    }

    generateQR(tableId) {
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        
        const chatURL = `${window.location.origin}${window.location.pathname}?mesa=${tableId}`;
        
        new QRCode(qrContainer, {
            text: chatURL,
            width: 256,
            height: 256,
            colorDark: "#FF4B91",
            colorLight: "#ffffff",
        });
    }

    connectToTable(tableId) {
        if (!tableId) {
            this.statusElement.textContent = 'Error: Mesa no especificada';
            return;
        }

        this.statusElement.textContent = 'Conectando con la mesa...';
        const conn = this.peer.connect(tableId, {
            metadata: { 
                userName: this.userName,
                timestamp: new Date().toISOString()
            }
        });
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        this.connection = conn;
        
        conn.on('open', () => {
            const peerName = conn.metadata?.userName || 'Visitante';
            this.statusElement.textContent = `Conectado con ${peerName}`;
            this.messageInput.disabled = false;
            this.sendBtn.disabled = false;

            // Mensaje de bienvenida automático
            if (!this.isHost) {
                setTimeout(() => {
                    this.sendMessage('👋 ¡Hola! Me gustaría charlar contigo.');
                }, 1000);
            }
        });

        conn.on('data', (data) => {
            if (typeof data === 'object' && data.type === 'message') {
                this.addMessageToChat(data.message, 'received', data.userName);
            }
        });

        conn.on('close', () => {
            this.handleDisconnection();
        });

        conn.on('error', (err) => {
            console.error(err);
            this.statusElement.textContent = `Error de conexión: ${err.type}`;
        });
    }

    sendMessage(presetMessage = null) {
        const message = presetMessage || this.messageInput.value.trim();
        if (message && this.connection) {
            try {
                const messageData = {
                    type: 'message',
                    message: message,
                    userName: this.userName,
                    timestamp: new Date().toISOString()
                };
                this.connection.send(messageData);
                this.addMessageToChat(message, 'sent', this.userName);
                if (!presetMessage) {
                    this.messageInput.value = '';
                }
            } catch (error) {
                console.error('Error al enviar:', error);
                this.statusElement.textContent = `Error al enviar: ${error.message}`;
            }
        }
    }

    addMessageToChat(message, type, userName) {
        const messageContainer = document.createElement('div');
        
        const metaDiv = document.createElement('div');
        metaDiv.classList.add('username');
        metaDiv.textContent = type === 'sent' ? 'Tú' : userName;
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        messageDiv.textContent = message;
        
        messageContainer.appendChild(metaDiv);
        messageContainer.appendChild(messageDiv);
        
        this.chatContainer.appendChild(messageContainer);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    handleDisconnection() {
        this.statusElement.textContent = 'Desconectado';
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        this.connection = null;
        
        // Mostrar mensaje de desconexión en el chat
        this.addMessageToChat('⚠️ La conexión ha finalizado', 'system', 'Sistema');
    }
}

// Inicializar la aplicación
window.addEventListener('load', () => {
    new TableTalk();
});
