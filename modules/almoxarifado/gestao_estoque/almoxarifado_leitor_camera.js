// ==================== modules/almoxarifado/almoxarifado_leitor_camera.js ====================
// Módulo exclusivo para manipulação da Câmera do Dispositivo (QR Code / Código de Barras)

let html5QrCode = null;
let alvoLeituraAtual = null; // 'OS' ou 'PECA'
let ultimoCodigoLido = "";
let tempoUltimaLeitura = 0;

window.abrirCameraLeitor = function(alvo) {
    alvoLeituraAtual = alvo;
    
    // Exibe o container da câmera na tela
    document.getElementById('containerLeitorCamera').style.display = 'block';
    
    // Atualiza o título e a cor baseado no que estamos lendo
    const boxLabel = document.getElementById('labelCameraAlvo');
    const scannerLine = document.getElementById('scannerLineEffect');
    if (boxLabel && scannerLine) {
        if (alvo === 'OS') {
            boxLabel.innerHTML = '<i class="fas fa-file-invoice"></i> Escaneie o QR Code da O.S.';
            boxLabel.style.color = '#60a5fa'; // Azul
            scannerLine.style.background = '#3b82f6';
            scannerLine.style.boxShadow = '0 0 15px #3b82f6';
        } else {
            boxLabel.innerHTML = '<i class="fas fa-barcode"></i> Bipagem Contínua de Peças (Pode ler várias)';
            boxLabel.style.color = '#34d399'; // Verde
            scannerLine.style.background = '#10b981';
            scannerLine.style.boxShadow = '0 0 15px #10b981';
        }
    }

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("boxLeitorCamera");
    }

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        const agora = Date.now();
        
        // Evita ler o mesmo código 10x por segundo acidentalmente (Debounce de 2 segundos)
        if (decodedText === ultimoCodigoLido && (agora - tempoUltimaLeitura) < 2000) {
            return;
        }
        
        ultimoCodigoLido = decodedText;
        tempoUltimaLeitura = agora;

        // Toca um bipe para confirmar a leitura para o estoquista
        window.tocarBipeSucesso();

        // Direciona o texto lido para a função correta
        if (alvoLeituraAtual === 'OS') {
            window.pararLeituraCamera(); // Para a O.S., lemos uma só vez e fechamos a câmera
            if (typeof window.processarLeituraOS === 'function') window.processarLeituraOS(decodedText);
        } else if (alvoLeituraAtual === 'PECA') {
            // Para peças, NÃO fechamos a câmera! Ele processa a peça e continua lendo a próxima
            if (typeof window.processarLeituraPeca === 'function') window.processarLeituraPeca(decodedText);
        }
    };

    // Configurações: Câmera traseira e área de foco definida
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
    .catch(err => {
        console.error("Erro ao iniciar a câmera", err);
        Swal.fire('Erro na Câmera', 'Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador.', 'error');
        document.getElementById('containerLeitorCamera').style.display = 'none';
    });
};

window.pararLeituraCamera = function() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById('containerLeitorCamera').style.display = 'none';
        }).catch((err) => {
            console.error("Erro ao parar a câmera", err);
        });
    } else {
        document.getElementById('containerLeitorCamera').style.display = 'none';
    }
};

window.tocarBipeSucesso = function() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1000; // Frequência aguda de leitor de supermercado
        gainNode.gain.setValueAtTime(0.1, context.currentTime); // Volume
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.start();
        setTimeout(() => { oscillator.stop(); }, 150); // Duração do bipe
    } catch(e) {
        console.warn("Áudio não suportado neste navegador.");
    }
};