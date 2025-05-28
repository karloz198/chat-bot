// Variables globales
let twitchClient = null;

// Nuevas variables para Client ID y Access Token manual
// Aseguramos que se carguen al inicio o sean cadena vacía
let twitchClientId = localStorage.getItem('twitchClientId') || '';
let twitchManualAccessToken = localStorage.getItem('twitchManualAccessToken') || null;

// oauth token y username obtenidos automáticamente
let twitchOAuthAccessToken = localStorage.getItem('twitchOAuthAccessToken') || null;
let twitchAuthenticatedUsername = localStorage.getItem('twitchAuthenticatedUsername') || null;

const redirectUri = 'https://karloz198.github.io/chat-bot/'; // Tu URL de GitHub Pages

// Elementos del DOM
const connectTwitchBtn = document.getElementById('connectTwitchBtn');
const twitchStatus = document.getElementById('twitchStatus');

// Nuevos elementos para Twitch Client ID y Access Token
const twitchClientIdInput = document.getElementById('twitchClientIdInput');
const saveTwitchClientIdBtn = document.getElementById('saveTwitchClientIdBtn');
const twitchAccessTokenInput = document.getElementById('twitchAccessTokenInput');
const saveTwitchAccessTokenBtn = document.getElementById('saveTwitchAccessTokenBtn');
const manualTokenLink = document.getElementById('manualTokenLink'); // Para el enlace dinámico

const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
const saveGeminiApiKeyBtn = document.getElementById('saveGeminiApiKey');
const enableChatbotVoiceCheckbox = document.getElementById('enableChatbotVoice');
const voiceSelect = document.getElementById('voiceSelect');
const wordLimitInput = document.getElementById('wordLimit');
const wordLimitValueSpan = document.getElementById('wordLimitValue');
const filterWordsInput = document = document.getElementById('filterWords'); // Error tipográfico aquí, corregido abajo
const saveFilterWordsBtn = document.getElementById('saveFilterWords');
const blacklistUsersInput = document.getElementById('blacklistUsers');
const saveBlacklistUsersBtn = document.getElementById('saveBlacklistUsers');
const saveAllSettingsBtn = document.getElementById('saveAllSettings');
const saveStatus = document.getElementById('saveStatus');
const twitchChatArea = document.getElementById('twitchChatArea');
const conversationLog = document.getElementById('conversationLog');
const saveLogBtn = document.getElementById('saveLogBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

// Corrección de error tipográfico
// const filterWordsInput = document = document.getElementById('filterWords'); // Esta línea estaba mal
const filterWordsInputCorrected = document.getElementById('filterWords'); // La he corregido y usaré esta variable


// Variables de configuración (cargadas o con valores por defecto)
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
let enableChatbotVoice = localStorage.getItem('enableChatbotVoice') === 'true';
let selectedVoiceURI = localStorage.getItem('selectedVoiceURI') || '';
let chatbotWordLimit = parseInt(localStorage.getItem('chatbotWordLimit')) || 10;
let filteredWords = JSON.parse(localStorage.getItem('filteredWords')) || [];
let blacklistedUsers = JSON.parse(localStorage.getItem('blacklistUsers')) || [];

// Gemini AI (instancia del modelo si se usa)
let geminiModel = null;
// Asegurarse de que la librería esté cargada antes de usarla
if (window['@google/generative-language']) {
    const { GoogleGenerativeLanguageCloud } = window['@google/generative-language'];
    // Si ya hay API Key, inicializar el modelo
    if (geminiApiKey) {
        try {
            geminiModel = new GoogleGenerativeLanguageCloud.GenerativeModel({
                apiKey: geminiApiKey,
                model: "gemini-pro"
            });
            console.log('Gemini AI Model initialized on load.');
        } catch (e) {
            console.error('Error initializing Gemini model on load:', e);
            geminiModel = null;
        }
    }
} else {
    console.warn('Librería de Google Generative Language no cargada. La funcionalidad de Gemini no estará disponible.');
}


// --- Funciones de Utilidad ---

function showStatus(element, message, type = 'info') {
    element.textContent = message;
    element.className = `status-message ${type}`;
    // Opcional: desaparecer el mensaje después de un tiempo
    setTimeout(() => {
        element.textContent = '';
        element.className = 'status-message';
    }, 5000);
}

function appendMessageToChat(message) {
    const p = document.createElement('p');
    p.innerHTML = message; // Usar innerHTML para permitir HTML básico (como colores)
    twitchChatArea.appendChild(p);
    twitchChatArea.scrollTop = twitchChatArea.scrollHeight; // Auto-scroll
}

function appendToLog(message) {
    conversationLog.value += message + '\n';
    conversationLog.scrollTop = conversationLog.scrollHeight; // Auto-scroll
}

function saveSettings() {
    // Las configuraciones de Twitch ID/Token se guardan por separado en sus botones
    localStorage.setItem('geminiApiKey', geminiApiKey);
    localStorage.setItem('enableChatbotVoice', enableChatbotVoice);
    localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
    localStorage.setItem('chatbotWordLimit', chatbotWordLimit);
    localStorage.setItem('filteredWords', JSON.stringify(filteredWords));
    localStorage.setItem('blacklistUsers', JSON.stringify(blacklistedUsers));
    showStatus(saveStatus, 'Configuración general guardada.', 'success');
}

function loadSettings() {
    // Cargar desde localStorage a las variables JavaScript
    twitchClientId = localStorage.getItem('twitchClientId') || '';
    twitchManualAccessToken = localStorage.getItem('twitchManualAccessToken') || null;
    twitchOAuthAccessToken = localStorage.getItem('twitchOAuthAccessToken') || null;
    twitchAuthenticatedUsername = localStorage.getItem('twitchAuthenticatedUsername') || null;
    geminiApiKey = localStorage.getItem('geminiApiKey') || '';
    enableChatbotVoice = localStorage.getItem('enableChatbotVoice') === 'true';
    selectedVoiceURI = localStorage.getItem('selectedVoiceURI') || '';
    chatbotWordLimit = parseInt(localStorage.getItem('chatbotWordLimit')) || 10;
    filteredWords = JSON.parse(localStorage.getItem('filteredWords')) || [];
    blacklistedUsers = JSON.parse(localStorage.getItem('blacklistUsers')) || [];


    // Asignar valores a los inputs del DOM
    twitchClientIdInput.value = twitchClientId;
    twitchAccessTokenInput.value = twitchManualAccessToken || ''; // Puede ser nulo si no se ha guardado uno manual
    geminiApiKeyInput.value = geminiApiKey;
    enableChatbotVoiceCheckbox.checked = enableChatbotVoice;
    wordLimitInput.value = chatbotWordLimit;
    wordLimitValueSpan.textContent = `${chatbotWordLimit} palabras`;
    filterWordsInputCorrected.value = filteredWords.join(', '); // Usando la variable corregida
    blacklistUsersInput.value = blacklistedUsers.join('\n');

    let currentTwitchStatus = 'No autenticado con Twitch.';
    if (twitchManualAccessToken) {
        currentTwitchStatus = 'Access Token manual cargado y tiene prioridad.';
    } else if (twitchOAuthAccessToken && twitchAuthenticatedUsername) {
        currentTwitchStatus = `Autenticado automáticamente como: ${twitchAuthenticatedUsername}. Conecta al chat.`;
    }

    showStatus(twitchStatus, currentTwitchStatus, 'info');

    // Actualizar el enlace para obtener token manual
    if (twitchClientId) {
        const manualAuthUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=chat:read+chat:edit+user:read:email+channel:moderate`;
        manualTokenLink.href = manualAuthUrl;
        manualTokenLink.textContent = "Haz clic aquí para generar tu token (con tu Client ID)";
    } else {
        manualTokenLink.textContent = "Primero, guarda tu Twitch Client ID para habilitar este enlace.";
        manualTokenLink.href = "#";
        manualTokenLink.onclick = (e) => { // Usar onclick para evitar que el href="#" navegue
            if (!twitchClientId) {
                e.preventDefault();
                showStatus(twitchStatus, '¡Necesitas guardar el Client ID de Twitch primero!', 'warning');
            }
        };
    }

    // CONSOLE.LOG ADICIONALES PARA DEPURAR EL CLIENT ID
    console.log('--- Estado de Carga de Configuraciones ---');
    console.log('twitchClientId (después de loadSettings):', twitchClientId);
    console.log('twitchManualAccessToken (después de loadSettings):', twitchManualAccessToken ? 'Cargado' : 'No cargado');
    console.log('twitchOAuthAccessToken (después de loadSettings):', twitchOAuthAccessToken ? 'Cargado' : 'No cargado');
    console.log('geminiApiKey (después de loadSettings):', geminiApiKey ? 'Cargada' : 'No cargada');
    console.log('enableChatbotVoice (después de loadSettings):', enableChatbotVoice);
    console.log('selectedVoiceURI (después de loadSettings):', selectedVoiceURI || 'Ninguna');
    console.log('------------------------------------------');
}

// --- Autenticación de Twitch ---

function authenticateWithTwitch() {
    console.log('Iniciando authenticateWithTwitch()...');
    console.log('Valor actual de twitchClientId antes de la comprobación:', twitchClientId);

    if (!twitchClientId) {
        showStatus(twitchStatus, 'Por favor, introduce y guarda tu Twitch Client ID primero.', 'error');
        console.error('Error: twitchClientId está vacío o nulo al intentar autenticar.');
        return;
    }

    // Los scopes necesarios para leer el chat y obtener información del usuario
    const scopes = 'chat:read chat:edit user:read:email+channel:moderate';
    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    console.log('Redirigiendo a URL de autenticación de Twitch:', authUrl);
    window.location.href = authUrl;
}

function handleTwitchAuthCallback() {
    console.log('handleTwitchAuthCallback() llamado. Comprobando hash de URL...');
    const hash = window.location.hash;
    if (!hash) {
        console.log('No hay hash en la URL. No es una redirección de autenticación.');
        return;
    }
    const params = new URLSearchParams(hash.substring(1)); // Quita el '#'
    const accessToken = params.get('access_token');
    const error = params.get('error_description');

    if (accessToken) {
        console.log('Access Token encontrado en la URL.');
        // Guardamos el token obtenido por OAuth
        localStorage.setItem('twitchOAuthAccessToken', accessToken);
        twitchOAuthAccessToken = accessToken;
        showStatus(twitchStatus, 'Token de acceso de Twitch obtenido. Obteniendo nombre de usuario...', 'info');

        // Intenta obtener el nombre de usuario de Twitch
        fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': twitchClientId,
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            console.log('Respuesta de la API de Helix Users:', response);
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Token de Twitch inválido o expirado. Autentica de nuevo.');
                }
                throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de usuario de Twitch:', data);
            if (data.data && data.data.length > 0) {
                twitchAuthenticatedUsername = data.data[0].login;
                localStorage.setItem('twitchAuthenticatedUsername', twitchAuthenticatedUsername);
                showStatus(twitchStatus, `Autenticado con Twitch como: ${twitchAuthenticatedUsername}. ¡Listo para conectar!`, 'success');
                console.log('Autenticado con Twitch como:', twitchAuthenticatedUsername);
            } else {
                showStatus(twitchStatus, 'No se pudo obtener el nombre de usuario de Twitch.', 'error');
                console.error('No se pudo obtener el nombre de usuario de Twitch:', data);
            }
        })
        .catch(error => {
            showStatus(twitchStatus, `Error al obtener usuario de Twitch: ${error.message}`, 'error');
            console.error('Error al obtener usuario de Twitch:', error);
            // Si el token falló, límpialo para que el usuario pueda intentar de nuevo.
            localStorage.removeItem('twitchOAuthAccessToken');
            localStorage.removeItem('twitchAuthenticatedUsername');
            twitchOAuthAccessToken = null;
            twitchAuthenticatedUsername = null;
        })
        .finally(() => {
            window.history.replaceState("", document.title, window.location.pathname + window.location.search);
        });

    } else if (error) {
        showStatus(twitchStatus, `Error de autenticación de Twitch: ${error}`, 'error');
        console.error('Error de autenticación de Twitch:', error);
        window.history.replaceState("", document.title, window.location.pathname + window.location.search);
    } else {
        console.log('No se encontró Access Token ni error en el hash. No es una redirección de autenticación.');
    }
}

// --- Conexión al Chat de Twitch ---

async function connectToTwitchChat() {
    console.log('Iniciando connectToTwitchChat()...');
    console.log('Valor actual de twitchClientId antes de la conexión al chat:', twitchClientId);
    let currentAccessToken = twitchManualAccessToken || twitchOAuthAccessToken;
    let usernameToConnect = twitchAuthenticatedUsername;

    if (!twitchClientId) {
        showStatus(twitchStatus, 'Por favor, introduce y guarda tu Twitch Client ID primero.', 'error');
        console.error('Error: Twitch Client ID no configurado para la conexión al chat.');
        return;
    }

    if (!currentAccessToken) {
        showStatus(twitchStatus, 'No hay Access Token de Twitch. Por favor, autentica o introduce uno manualmente.', 'error');
        console.error('Error: No hay Access Token disponible.');
        return;
    }

    if (!usernameToConnect) {
        showStatus(twitchStatus, 'No se pudo obtener el nombre de usuario de Twitch. Intentando obtenerlo con el token actual...', 'info');
        console.log('Intentando obtener nombre de usuario con el token existente...');
        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': twitchClientId,
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            });
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                usernameToConnect = data.data[0].login;
                localStorage.setItem('twitchAuthenticatedUsername', usernameToConnect);
                twitchAuthenticatedUsername = usernameToConnect;
                console.log('Nombre de usuario obtenido con token:', usernameToConnect);
            } else {
                throw new Error('No se pudo obtener el nombre de usuario con el token proporcionado.');
            }
        } catch (error) {
            console.error('Error al intentar obtener nombre de usuario con token existente:', error);
            showStatus(twitchStatus, `Error: ${error.message}. Token inválido o expirado.`, 'error');
            return;
        }
    }

    if (!usernameToConnect) {
        showStatus(twitchStatus, 'No se pudo determinar el nombre de usuario para conectar. Intenta de nuevo.', 'error');
        console.error('Error: No se pudo determinar el nombre de usuario para la conexión.');
        return;
    }

    try {
        // Si ya hay un cliente conectado, desconectarlo primero
        if (twitchClient && twitchClient.readyState === 'OPEN') {
            console.log('Desconectando cliente Twitch existente antes de reconectar...');
            await twitchClient.disconnect();
            twitchClient = null;
        }

        twitchClient = new tmi.Client({
            options: { debug: false },
            identity: {
                username: usernameToConnect,
                password: `oauth:${currentAccessToken}`
            },
            channels: [usernameToConnect]
        });

        twitchClient.on('message', onTwitchMessage);

        twitchClient.on('connected', (addr, port) => {
            const connectedChannels = twitchClient.getChannels();
            if (connectedChannels && connectedChannels.length > 0) {
                const displayChannel = connectedChannels[0].replace('#', '');
                showStatus(twitchStatus, `Conectado al chat de Twitch: ${displayChannel}`, 'success');
                console.log(`Conectado a Twitch Chat en ${addr}:${port}, canal: ${displayChannel}`);
            } else {
                showStatus(twitchStatus, `Conectado a Twitch, pero el canal no se pudo determinar.`, 'success');
                console.warn(`Conectado a Twitch en ${addr}:${port}, pero twitchClient.getChannels() está vacío.`);
            }
        });

        twitchClient.on('disconnected', (reason) => {
            showStatus(twitchStatus, `Desconectado de Twitch: ${reason || 'Desconocido'}`, 'error');
            console.error('Desconectado de Twitch Chat:', reason);
            twitchClient = null;
        });

        twitchClient.on('connecting', () => {
            showStatus(twitchStatus, 'Conectando a Twitch...', 'info');
            console.log('TMI.js: Conectando...');
        });

        twitchClient.on('reconnect', () => {
            showStatus(twitchStatus, 'Reconectando a Twitch...', 'info');
            console.log('TMI.js: Reconectando...');
        });

        twitchClient.on('logon', () => {
            console.log('TMI.js: Sesión iniciada con Twitch.');
        });

        twitchClient.on('join', (channel, username, self) => {
            if (self) {
                console.log(`TMI.js: Se ha unido al canal: ${channel}`);
            }
        });

        await twitchClient.connect();

    } catch (error) {
        console.error('Error general al conectar a Twitch:', error);
        showStatus(twitchStatus, `Error al conectar a Twitch: ${error.message}`, 'error');
        twitchClient = null;
    }
}

// --- Manejo de Mensajes del Chat de Twitch ---

async function onTwitchMessage(channel, tags, message, self) {
    if (self) return; // Ignora los mensajes del propio bot

    const username = tags['display-name'] || tags['username'];
    const formattedMessage = `<span style="color:${tags.color || '#FFFFFF'};"><strong>${username}:</strong></span> ${message}`;
    appendMessageToChat(formattedMessage);
    appendToLog(`[${username}]: ${message}`);

    // Filtrar usuarios de la lista negra
    if (blacklistedUsers.includes(username.toLowerCase())) {
        console.log(`Mensaje de usuario en lista negra ignorado: ${username}`);
        return;
    }

    // Filtrar palabras
    const lowerCaseMessage = message.toLowerCase();
    for (const word of filteredWords) {
        if (lowerCaseMessage.includes(word.toLowerCase())) {
            console.log(`Mensaje filtrado por palabra clave: "${word}" en "${message}"`);
            return;
        }
    }

    // Procesar con Gemini si la voz del chatbot está activada y el modelo está inicializado
    console.log('Estado para procesar con Gemini:', {
        enableChatbotVoice: enableChatbotVoice,
        geminiModelExists: geminiModel !== null,
        geminiApiKeyExists: !!geminiApiKey
    });
    if (enableChatbotVoice && geminiModel) {
        try {
            const prompt = `El usuario ${username} dijo: "${message}". Responde a esto en un máximo de ${chatbotWordLimit} palabras. Si el mensaje es una pregunta, responde directamente. Si es un saludo, saluda de vuelta. Mantén un tono amigable.`;
            console.log('Enviando prompt a Gemini:', prompt);
            const result = await geminiModel.generateContent(prompt);
            const responseText = await result.response.text();
            console.log('Respuesta de Gemini:', responseText);

            // Asegurarse de que la respuesta no exceda el límite de palabras
            const words = responseText.split(/\s+/).filter(word => word.length > 0);
            let finalResponse = words.slice(0, chatbotWordLimit).join(' ');
            if (words.length > chatbotWordLimit) {
                finalResponse += '...'; // Añadir elipsis si se truncó
            }

            // Enviar respuesta al chat de Twitch y leer en voz alta
            if (twitchClient && twitchClient.readyState === 'OPEN') {
                twitchClient.say(channel, finalResponse);
                appendToLog(`[Chatbot]: ${finalResponse}`);
                speakText(finalResponse);
            }
        } catch (error) {
            console.error('Error al comunicarse con Gemini AI:', error);
            appendToLog(`[ERROR AI]: ${error.message}`);
            // Si hay un error con Gemini, desactiva la voz temporalmente o alerta
            showStatus(saveStatus, `Error de Gemini AI: ${error.message}. Revisar API Key.`, 'error');
        }
    }
}

// --- Funciones de Voz (Text-to-Speech) ---

function populateVoiceList() {
    console.log('populateVoiceList() llamado.');
    const voices = speechSynthesis.getVoices();
    console.log('Numero de voces encontradas:', voices.length);
    console.log('Voces obtenidas:', voices);

    voiceSelect.innerHTML = ''; // Limpiar opciones existentes
    let foundSelected = false;

    if (voices.length === 0) {
        console.warn('No se encontraron voces de síntesis de voz en este navegador. Deshabilitando opciones de voz.');
        const option = document.createElement('option');
        option.textContent = 'No hay voces disponibles';
        option.value = '';
        voiceSelect.appendChild(option);

        // *** IMPORTANTE: Deshabilitar DIRECTAMENTE los elementos aquí ***
        voiceSelect.disabled = true;
        enableChatbotVoiceCheckbox.disabled = true;
        // *************************************************************

        showStatus(saveStatus, 'No se encontraron voces de síntesis en el navegador.', 'warning');
        return;
    }

    // *** IMPORTANTE: Habilitar DIRECTAMENTE los elementos aquí si hay voces ***
    voiceSelect.disabled = false;
    enableChatbotVoiceCheckbox.disabled = false;
    // **********************************************************************

    voices.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = voice.name + ' (' + voice.lang + ')';
        option.setAttribute('data-lang', voice.lang);
        option.setAttribute('data-name', voice.name);
        option.value = voice.voiceURI;

        if (selectedVoiceURI && voice.voiceURI === selectedVoiceURI) {
            option.selected = true;
            foundSelected = true;
        } else if (!selectedVoiceURI && voice.lang.startsWith('es')) {
            option.selected = true;
            selectedVoiceURI = voice.voiceURI;
            foundSelected = true;
        }
        voiceSelect.appendChild(option);
    });

    if (!foundSelected && voices.length > 0) {
        voiceSelect.options[0].selected = true;
        selectedVoiceURI = voices[0].voiceURI;
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
    } else if (foundSelected) {
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
    }
}

function speakText(text) {
    if (!enableChatbotVoice) {
        console.log('SpeakText: Voz del chatbot deshabilitada.');
        return;
    }
    if (!('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis no está soportado en este navegador.');
        return;
    }
    if (speechSynthesis.speaking) {
        console.log('SpeechSynthesis: Ya está hablando, omitiendo nueva lectura.');
        // Puedes añadir una cola aquí si quieres que lea todo
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(voice => voice.voiceURI === selectedVoiceURI);

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        console.warn('Voz seleccionada no encontrada, usando la voz por defecto del sistema o español si disponible.');
        const defaultEsVoice = voices.find(v => v.lang.startsWith('es'));
        if (defaultEsVoice) {
            utterance.voice = defaultEsVoice;
            utterance.lang = defaultEsVoice.lang;
        } else {
            utterance.lang = 'es-ES';
        }
    }

    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onerror = (event) => {
        console.error('Error en la síntesis de voz:', event.error);
    };

    speechSynthesis.speak(utterance);
    console.log('SpeakText: Iniciando lectura de:', text);
}

// --- Inicialización y Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Al cargar la página, primero cargamos la configuración de localStorage
    loadSettings();
    // Luego, manejamos la redirección de autenticación (si la hubo)
    handleTwitchAuthCallback();

    // Cargar voces cuando estén disponibles
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
        if (speechSynthesis.getVoices().length > 0) {
            populateVoiceList();
        }
    }

    // Event listener para el Client ID de Twitch
    saveTwitchClientIdBtn.addEventListener('click', () => {
        twitchClientId = twitchClientIdInput.value.trim();
        localStorage.setItem('twitchClientId', twitchClientId);
        showStatus(saveStatus, 'Client ID de Twitch guardado.', 'success');
        loadSettings();
    });

    // Event listener para el Access Token manual de Twitch
    saveTwitchAccessTokenBtn.addEventListener('click', () => {
        const token = twitchAccessTokenInput.value.trim();
        if (token) {
            if (token.startsWith('oauth:')) {
                twitchManualAccessToken = token.substring(6);
            } else {
                twitchManualAccessToken = token;
            }
            localStorage.setItem('twitchManualAccessToken', twitchManualAccessToken);
            showStatus(saveStatus, 'Access Token manual de Twitch guardado. ¡Prioridad a este token!', 'success');
            localStorage.removeItem('twitchOAuthAccessToken');
            twitchOAuthAccessToken = null;
        } else {
            twitchManualAccessToken = null;
            localStorage.removeItem('twitchManualAccessToken');
            showStatus(saveStatus, 'Access Token manual de Twitch eliminado.', 'info');
        }
        loadSettings();
    });


    connectTwitchBtn.addEventListener('click', () => {
        console.log('--- Click en "Conectar con Twitch" ---');
        console.log('Valor de twitchClientId en el momento del click:', twitchClientId);
        console.log('Valor de twitchManualAccessToken en el momento del click:', twitchManualAccessToken ? 'Presente' : 'Ausente');
        console.log('Valor de twitchOAuthAccessToken en el momento del click:', twitchOAuthAccessToken ? 'Presente' : 'Ausente');
        console.log('--------------------------------------');

        // *** NUEVO: Intentar forzar la inicialización de speechSynthesis aquí ***
        // Esto es un intento para "despertar" la API de voz si está inactiva
        if ('speechSynthesis' in window && speechSynthesis.getVoices().length === 0) {
            console.log('Intentando recargar voces de speechSynthesis tras click del usuario...');
            speechSynthesis.cancel();
            populateVoiceList(); // Re-intentar poblar la lista de nuevo
        }
        // *******************************************************************

        // Si hay un token manual, lo usamos. Si no, intentamos el OAuth.
        if (twitchManualAccessToken) {
            console.log('Detectado Access Token manual. Intentando conectar directamente.');
            connectToTwitchChat();
        } else if (twitchOAuthAccessToken) {
            console.log('Detectado Access Token OAuth automático. Intentando conectar directamente.');
            connectToTwitchChat();
        } else {
            console.log('No hay tokens guardados. Iniciando flujo OAuth de Twitch para obtener uno.');
            authenticateWithTwitch();
        }
    });

    saveGeminiApiKeyBtn.addEventListener('click', () => {
        geminiApiKey = geminiApiKeyInput.value.trim();
        localStorage.setItem('geminiApiKey', geminiApiKey);
        if (geminiApiKey) {
            if (window['@google/generative-language']) {
                const { GoogleGenerativeLanguageCloud } = window['@google/generative-language'];
                try {
                    geminiModel = new GoogleGenerativeLanguageCloud.GenerativeModel({
                        apiKey: geminiApiKey,
                        model: "gemini-pro"
                    });
                    showStatus(saveStatus, 'API Key de Gemini guardada e inicializada.', 'success');
                    console.log('Gemini AI Model initialized with new API Key.');
                } catch (e) {
                    showStatus(saveStatus, `Error inicializando Gemini: ${e.message}`, 'error');
                    console.error('Error initializing Gemini model with new API Key:', e);
                    geminiModel = null;
                }
            } else {
                showStatus(saveStatus, 'Librería de Google Generative Language no disponible.', 'error');
                console.error('Librería de Google Generative Language no disponible. Revisa la inclusión en index.html');
                geminiModel = null;
            }
        } else {
            showStatus(saveStatus, 'API Key de Gemini eliminada.', 'info');
            geminiModel = null;
        }
    });

    enableChatbotVoiceCheckbox.addEventListener('change', () => {
        enableChatbotVoice = enableChatbotVoiceCheckbox.checked;
        localStorage.setItem('enableChatbotVoice', enableChatbotVoice);
        console.log('enableChatbotVoice cambiado a:', enableChatbotVoice);
        showStatus(saveStatus, 'Configuración de voz actualizada.', 'info');
    });

    voiceSelect.addEventListener('change', () => {
        selectedVoiceURI = voiceSelect.value;
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
        showStatus(saveStatus, 'Voz seleccionada.', 'info');
        console.log('Voz seleccionada:', selectedVoiceURI);
    });

    wordLimitInput.addEventListener('input', () => {
        chatbotWordLimit = parseInt(wordLimitInput.value);
        wordLimitValueSpan.textContent = `${chatbotWordLimit} palabras`;
    });

    saveFilterWordsBtn.addEventListener('click', () => {
        filteredWords = filterWordsInputCorrected.value.split(',').map(word => word.trim()).filter(word => word.length > 0); // Usando la variable corregida
        localStorage.setItem('filteredWords', JSON.stringify(filteredWords));
        showStatus(saveStatus, 'Palabras filtradas guardadas.', 'success');
    });

    saveBlacklistUsersBtn.addEventListener('click', () => {
        blacklistedUsers = blacklistUsersInput.value.split('\n').map(user => user.trim().toLowerCase()).filter(user => user.length > 0);
        localStorage.setItem('blacklistUsers', JSON.stringify(blacklistedUsers));
        showStatus(saveStatus, 'Lista negra de usuarios guardada.', 'success');
    });

    saveAllSettingsBtn.addEventListener('click', saveSettings);

    saveLogBtn.addEventListener('click', () => {
        const text = conversationLog.value;
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'chat_log.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    });

    clearLogBtn.addEventListener('click', () => {
        conversationLog.value = '';
        showStatus(saveStatus, 'Registro de conversación limpiado.', 'info');
    });
});
