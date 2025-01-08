class TableTalk {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.userName = '';
        this.myTableNumber = null;
        this.isHost = false;
        this.debugInfo = document.getElementById('debugInfo');
        this.initializeElements();
        this.addEventListeners();
    }

    log(message) {
        console.log(message);
        this.debugInfo.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    }

    initializeElements() {
        // ... (mantener los elementos anteriores) ...

        // Nuevos elementos
        this.setupTableScreen = document.getElementById('setupTableScreen');
        this.setupTableNumber = document.getElementById('setupTableNumber');
        this.confirmTableSetup = document.getElementById('confirmTableSetup');
        this.backFromSetupBtn = document.getElementById('backFromSetupBtn');
        this.setupStatus = document.getElementById('setupStatus');
    }

    addEventListeners() {
        // ... (mantener los listeners anteriores) ...

        // Nuevos listeners
        this.beTableBtn.addEventListener('click', () => this.showSetupTableScreen());
        this.confirmTableSetup.addEventListener('click', () => this.confirmTableNumber());
        this.backFromSetupBtn.addEventListener('click', () => this.showInitialScreen());
    }

    showSetupTableScreen() {
        this.initialScreen.classList.add('hidden');
        this.setupTableScreen.classList.remove('hidden');
        this.setupTableNumber.focus();
    }

    confirmTableNumber() {
        const tableNumber = this.setupTableNumber.value.trim();
        if (!tableNumber) {
            alert('Por favor ingresa un número de mesa');
            return;
        }

        this.isHost = true;
        this.myTableNumber = tableNumber;
        this.tableNumberDisplay.textContent = tableNumber;
        this.setupStatus.textContent = 'Conectando...';
        
        this.initializePeer(`mesa_${tableNumber}`)
            .then(() => {
                this.setupTableScreen.classList.add('hidden');
                this.tableScreen.classList.remove('hidden');
                this.log(`Mesa ${tableNumber} lista para recibir conexiones`);
            })
            .catch(error => {
                this.setupStatus.textContent = `Error: ${error.message}`;
                this.log(`Error al inicializar mesa: ${error.message}`);
            });
    }

    async initializePeer(peerId = null) {
        if (this.peer) {
            this.peer.destroy();
        }

        return new Promise((resolve, reject) => {
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

            this.peer.on('open', (id) => {
                this.log(`Conectado con ID: ${id}`);
                resolve();
            });

            this.peer.on('connection', (conn) => {
                this.log(`Nueva conexión entrante`);
                if (this.isHost) {
                    this.handleIncomingRequest(conn);
                } else {
                    this.handleConnection(conn);
                }
            });

            this.peer.on('error', (err) => {
                this.log(`Error de conexión: ${err.type}`);
                if (err.type === 'peer-unavailable') {
                    alert('La mesa no está disponible en este momento');
                }
                reject(err);
            });

            // Timeout después de 10 segundos
            setTimeout(() => {
                if (!this.peer.open) {
                    reject(new Error('Timeout al conectar'));
                }
            }, 10000);
        });
    }

    // ... (resto de los métodos igual pero agregando this.log() en puntos clave) ...

    async requestChat() {
        const myTable = this.myTableNumberInput.value.trim();
        const targetTable = this.targetTableNumberInput.value.trim();
        this.userName = this.visitorNameInput.value.trim();

        if (!myTable || !targetTable || !this.userName) {
            alert('Por favor completa todos los campos');
            return;
        }

        this.myTableNumber = myTable;
        this.log(`Intentando conectar con mesa ${targetTable}`);
        
        try {
            await this.initializePeer();
            const conn = this.peer.connect(`mesa_${targetTable}`, {
                metadata: {
                    type: 'request',
                    fromTable: myTable,
                    userName: this.userName
                }
            });

            conn.on('open', () => {
                this.log(`Conexión establecida con mesa ${targetTable}`);
                this.chatStatus.textContent = 'Solicitud enviada. Esperando respuesta...';
                this.currentTable.textContent = targetTable;
                this.showChatArea();
            });

            conn.on('error', (err) => {
                this.log(`Error en conexión: ${err.message}`);
                alert(`Error al conectar: ${err.message}`);
            });

            conn.on('data', (data) => {
                if (data.type === 'request_response') {
                    if (data.accepted) {
                        this.log('Solicitud aceptada');
                        this.handleConnection(conn);
                    } else {
                        this.log('Solicitud rechazada');
                        alert('La mesa rechazó tu solicitud de chat');
                        this.showInitialScreen();
                    }
                }
            });
        } catch (error) {
            this.log(`Error: ${error.message}`);
            alert(`Error al conectar: ${error.message}`);
        }
    }
}

// Inicializar la aplicación
window.addEventListener('load', () => {
    new TableTalk();
});
