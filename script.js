// Variables globales
let twitchClient = null;

// Nuevas variables para Client ID y Access Token manual
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
const filterWordsInput = document.getElementById('filterWords');
const saveFilterWordsBtn = document.getElementById('saveFilterWords');
const blacklistUsersInput = document.getElementById('blacklistUsers');
const saveBlacklistUsersBtn = document.getElementById('saveBlacklistUsers');
const saveAllSettingsBtn = document.getElementById('saveAllSettings');
const saveStatus = document.getElementById('saveStatus');
const twitchChatArea = document.getElementById('twitchChatArea');
const conversationLog = document.getElementById('conversationLog');
const saveLogBtn = document.getElementById('saveLogBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

// Variables de configuración (cargadas o con valores por defecto)
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
let enableChatbotVoice = localStorage.getItem('enableChatbotVoice') === 'true';
let selectedVoiceURI = localStorage.getItem('selectedVoiceURI') || '';
let chatbotWordLimit = parseInt(localStorage.getItem('chatbotWordLimit')) || 10;
let filteredWords = JSON.parse(localStorage.getItem('filteredWords')) || [];
let blacklistedUsers = JSON.parse(localStorage.getItem('blacklistedUsers')) || [];

// Gemini AI (instancia del modelo si se usa)
let geminiModel = null;
const { GoogleGenerativeLanguageCloud } = window['@google/generative-language'];

// --- Funciones de Utilidad ---

function showStatus(element, message, type = 'info') {
    element.textContent = message;
    element.className = `status-message ${type}`;
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
    geminiApiKeyInput.value = geminiApiKey;
    enableChatbotVoiceCheckbox.checked = enableChatbotVoice;
    wordLimitInput.value = chatbotWordLimit;
    wordLimitValueSpan.textContent = `${chatbotWordLimit} palabras`;
    filterWordsInput.value = filteredWords.join(', ');
    blacklistUsersInput.value = blacklistedUsers.join('\n');

    // Cargar y mostrar los campos de Twitch
    twitchClientIdInput.value = twitchClientId;
    twitchAccessTokenInput.value = twitchManualAccessToken || ''; // Puede ser nulo si no se ha guardado uno manual

    let currentTwitchStatus = 'No autenticado con Twitch.';
    if (twitchManualAccessToken) {
        currentTwitchStatus = 'Access Token manual cargado.';
    } else if (twitchOAuthAccessToken && twitchAuthenticatedUsername) {
        currentTwitchStatus = `Autenticado como: ${twitchAuthenticatedUsername}. Conecta al chat.`;
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
    }
}

// --- Autenticación de Twitch ---

function authenticateWithTwitch() {
    if (!twitchClientId) {
        showStatus(twitchStatus, 'Por favor, introduce y guarda tu Twitch Client ID primero.', 'error');
        return;
    }

    // Los scopes necesarios para leer el chat y obtener información del usuario
    const scopes = 'chat:read chat:edit user:read:email channel:moderate'; // Añadido channel:moderate por si acaso
    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
}

function handleTwitchAuthCallback() {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const error = params.get('error_description');

    if (accessToken) {
        // Guardamos el token obtenido por OAuth
        localStorage.setItem('twitchOAuthAccessToken', accessToken);
        twitchOAuthAccessToken = accessToken;
        showStatus(twitchStatus, 'Token de acceso de Twitch obtenido. Obteniendo nombre de usuario...', 'info');

        // Intenta obtener el nombre de usuario de Twitch
        fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': twitchClientId, // Usamos el client ID guardado
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Token de Twitch inválido o expirado. Autentica de nuevo.');
                }
                throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
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
        });

        // Limpia el hash de la URL para que no quede expuesto el token
        window.history.pushState("", document.title, window.location.pathname + window.location.search);
    } else if (error) {
        showStatus(twitchStatus, `Error de autenticación de Twitch: ${error}`, 'error');
        console.error('Error de autenticación de Twitch:', error);
    }
    // Si no hay token ni error, significa que no estamos en una redirección de auth
}

// --- Conexión al Chat de Twitch ---

async function connectToTwitchChat() {
    let currentAccessToken = twitchManualAccessToken || twitchOAuthAccessToken;
    let usernameToConnect = twitchAuthenticatedUsername; // Siempre usamos el username autenticado

    if (!twitchClientId) {
        showStatus(twitchStatus, 'Por favor, introduce y guarda tu Twitch Client ID primero.', 'error');
        return;
    }

    if (!currentAccessToken) {
        showStatus(twitchStatus, 'No hay Access Token de Twitch. Por favor, autentica o introduce uno manualmente.', 'error');
        return;
    }

    if (!usernameToConnect) {
        showStatus(twitchStatus, 'No se pudo obtener el nombre de usuario de Twitch. Autentica de nuevo.', 'error');
        // Intenta obtener el username si solo tienes el token (por ejemplo, si pegaste el manual)
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
                localStorage.setItem('twitchAuthenticatedUsername', usernameToConnect); // Guardar para futuro
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

    if (!usernameToConnect) { // Doble chequeo después del intento de obtenerlo
        showStatus(twitchStatus, 'No se pudo determinar el nombre de usuario para conectar. Intenta de nuevo.', 'error');
        return;
    }

    try {
        // Si ya hay un cliente conectado, desconectarlo primero
        if (twitchClient && twitchClient.readyState === 'OPEN') {
            console.log('Desconectando cliente Twitch existente antes de reconectar...');
            await twitchClient.disconnect();
            twitchClient = null; // Asegúrate de resetearlo
        }

        twitchClient = new tmi.Client({
            options: { debug: false }, // Cambiar a true para ver logs detallados de tmi.js en la consola
            identity: {
                username: usernameToConnect,
                password: `oauth:${currentAccessToken}`
            },
            channels: [usernameToConnect] // Conectamos al canal del usuario autenticado
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
        });

        twitchClient.on('reconnect', () => {
            showStatus(twitchStatus, 'Reconectando a Twitch...', 'info');
        });

        twitchClient.on('logon', () => {
            console.log('Sesión iniciada con Twitch.');
        });

        await twitchClient.connect();

    } catch (error) {
        console.error('Error al conectar a Twitch:', error);
        showStatus(twitchStatus, `Error al conectar a Twitch: ${error.message}`, 'error');
        twitchClient = null; // Asegúrate de resetear el cliente en caso de error
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
    if (enableChatbotVoice && geminiModel) {
        try {
            const prompt = `El usuario ${username} dijo: "${message}". Responde a esto en un máximo de ${chatbotWordLimit} palabras. Si el mensaje es una pregunta, responde directamente. Si es un saludo, saluda de vuelta. Mantén un tono amigable.`;
            const result = await geminiModel.generateContent(prompt);
            const responseText = await result.response.text();

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
        }
    }
}

// --- Funciones de Voz (Text-to-Speech) ---

function populateVoiceList() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = ''; // Limpiar opciones existentes
    let foundSelected = false;

    voices.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = voice.name + ' (' + voice.lang + ')';
        option.setAttribute('data-lang', voice.lang);
        option.setAttribute('data-name', voice.name);
        option.value = voice.voiceURI;

        if (selectedVoiceURI && voice.voiceURI === selectedVoiceURI) {
            option.selected = true;
            foundSelected = true;
        }
        voiceSelect.appendChild(option);
    });

    // Si la voz guardada no se encuentra, selecciona la primera por defecto
    if (!foundSelected && voices.length > 0) {
        voiceSelect.options[0].selected = true;
        selectedVoiceURI = voices[0].voiceURI;
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
    }
}

function speakText(text) {
    if (!enableChatbotVoice) return;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice => voice.voiceURI === selectedVoiceURI);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn('Voz seleccionada no encontrada, usando la voz por defecto.');
        }

        utterance.lang = utterance.voice ? utterance.voice.lang : 'es-ES'; // O usa un valor predeterminado seguro

        speechSynthesis.speak(utterance);
    } else {
        console.warn('SpeechSynthesis no está soportado en este navegador.');
    }
}

// --- Inicialización y Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    handleTwitchAuthCallback(); // Siempre intenta manejar la redirección de Twitch al cargar

    // Cargar voces cuando estén disponibles
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
        // Si las voces ya están cargadas, populamos la lista de inmediato
        if (speechSynthesis.getVoices().length > 0) {
            populateVoiceList();
        }
    }

    // Event listener para el Client ID de Twitch
    saveTwitchClientIdBtn.addEventListener('click', () => {
        twitchClientId = twitchClientIdInput.value.trim();
        localStorage.setItem('twitchClientId', twitchClientId);
        showStatus(saveStatus, 'Client ID de Twitch guardado.', 'success');
        loadSettings(); // Recargar settings para actualizar el enlace de token manual
    });

    // Event listener para el Access Token manual de Twitch
    saveTwitchAccessTokenBtn.addEventListener('click', () => {
        const token = twitchAccessTokenInput.value.trim();
        if (token) {
            // Verificar si el token es un OAuth token completo (ej. oauth:abc...)
            if (token.startsWith('oauth:')) {
                 twitchManualAccessToken = token.substring(6); // Eliminar 'oauth:'
            } else {
                 twitchManualAccessToken = token;
            }
            localStorage.setItem('twitchManualAccessToken', twitchManualAccessToken);
            showStatus(saveStatus, 'Access Token manual de Twitch guardado. ¡Prioridad a este token!', 'success');
            // Opcional: limpiar el OAuth token automático si se guarda uno manual
            localStorage.removeItem('twitchOAuthAccessToken');
            twitchOAuthAccessToken = null;
        } else {
            twitchManualAccessToken = null;
            localStorage.removeItem('twitchManualAccessToken');
            showStatus(saveStatus, 'Access Token manual de Twitch eliminado.', 'info');
        }
        loadSettings(); // Recargar el estado
    });


    connectTwitchBtn.addEventListener('click', () => {
        // Si hay un token manual, lo usamos. Si no, intentamos el OAuth.
        if (twitchManualAccessToken) {
            console.log('Usando Access Token manual para conectar.');
            connectToTwitchChat();
        } else if (twitchOAuthAccessToken) {
            console.log('Usando Access Token OAuth para conectar.');
            connectToTwitchChat();
        } else {
            // Si no hay ningún token, iniciar el flujo OAuth
            console.log('No hay tokens guardados, iniciando flujo OAuth de Twitch.');
            authenticateWithTwitch();
        }
    });

    saveGeminiApiKeyBtn.addEventListener('click', () => {
        geminiApiKey = geminiApiKeyInput.value.trim();
        localStorage.setItem('geminiApiKey', geminiApiKey);
        if (geminiApiKey) {
            // Inicializar el modelo Gemini
            try {
                geminiModel = new GoogleGenerativeLanguageCloud.GenerativeModel({
                    apiKey: geminiApiKey,
                    model: "gemini-pro" // Puedes especificar el modelo aquí
                });
                showStatus(saveStatus, 'API Key de Gemini guardada e inicializada.', 'success');
                console.log('Gemini AI Model initialized.');
            } catch (e) {
                showStatus(saveStatus, `Error inicializando Gemini: ${e.message}`, 'error');
                console.error('Error initializing Gemini model:', e);
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
        showStatus(saveStatus, 'Configuración de voz actualizada.', 'info');
    });

    voiceSelect.addEventListener('change', () => {
        selectedVoiceURI = voiceSelect.value;
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
        showStatus(saveStatus, 'Voz seleccionada.', 'info');
        // Opcional: Probar la voz seleccionada
        // speakText("Hola, esta es una prueba de voz.");
    });

    wordLimitInput.addEventListener('input', () => {
        chatbotWordLimit = parseInt(wordLimitInput.value);
        wordLimitValueSpan.textContent = `${chatbotWordLimit} palabras`;
    });

    saveFilterWordsBtn.addEventListener('click', () => {
        filteredWords = filterWordsInput.value.split(',').map(word => word.trim()).filter(word => word.length > 0);
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

    // Inicializar Gemini AI si la API Key ya está guardada
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
});
