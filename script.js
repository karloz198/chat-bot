// --- Elementos del DOM ---
const connectTwitchBtn = document.getElementById('connectTwitchBtn');
const twitchStatus = document.getElementById('twitchStatus');
const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
const saveGeminiApiKey = document.getElementById('saveGeminiApiKey');
const enableChatbotVoice = document.getElementById('enableChatbotVoice');
const voiceSelect = document.getElementById('voiceSelect');
const wordLimit = document.getElementById('wordLimit');
const wordLimitValue = document.getElementById('wordLimitValue');
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

// --- Configuración Global ---
const TWITCH_CLIENT_ID = 'y7u0s6218w6byx4whe352xpq6l3a9i'; // <--- ¡IMPORTANTE! Reemplaza con tu Client ID de Twitch
// La URL de redirección ahora se construirá dinámicamente o se basará en la URL actual del navegador.
// Asegúrate de que esta URL esté registrada EXACTAMENTE en tu aplicación de Twitch Developers.
const TWITCH_REDIRECT_URI = window.location.origin + window.location.pathname; 
const TWITCH_SCOPES = 'chat:read+chat:edit+user:read:email'; // Añadimos user:read:email para obtener el nombre del usuario
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=';

let twitchClient = null;
let twitchAccessToken = null;
let twitchAuthenticatedUsername = null; // Para guardar el nombre del usuario de Twitch que inició sesión
let geminiApiKey = null;
let chatbotEnabled = false;
let currentVoice = null;
let filteredWords = [];
let blacklistedUsers = [];
let conversationLogMessages = []; // Array para almacenar mensajes antes de volcarlos al textarea

// --- Funciones de Utilidad ---

function showStatus(element, message, type = 'info') {
    element.textContent = message;
    element.className = `status-message ${type}`;
    // No borramos el mensaje de Twitch de forma automática si es un error persistente
    if (element !== twitchStatus || type !== 'error') {
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status-message';
        }, 5000); 
    }
}

function saveSettings() {
    localStorage.setItem('geminiApiKey', geminiApiKeyInput.value);
    localStorage.setItem('enableChatbotVoice', enableChatbotVoice.checked);
    localStorage.setItem('selectedVoiceURI', voiceSelect.value);
    localStorage.setItem('wordLimit', wordLimit.value);
    localStorage.setItem('filterWords', filterWordsInput.value);
    localStorage.setItem('blacklistUsers', blacklistUsersInput.value);
    showStatus(saveStatus, 'Configuración guardada exitosamente.', 'success');
}

function loadSettings() {
    geminiApiKey = localStorage.getItem('geminiApiKey');
    if (geminiApiKey) {
        geminiApiKeyInput.value = geminiApiKey;
    }

    const savedEnableVoice = localStorage.getItem('enableChatbotVoice');
    enableChatbotVoice.checked = savedEnableVoice === 'true';
    chatbotEnabled = enableChatbotVoice.checked; // Sincronizar estado

    wordLimit.value = localStorage.getItem('wordLimit') || 10;
    wordLimitValue.textContent = `${wordLimit.value} palabras`;

    const savedFilterWords = localStorage.getItem('filterWords');
    if (savedFilterWords) {
        filterWordsInput.value = savedFilterWords;
        filteredWords = savedFilterWords.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
    }

    const savedBlacklistUsers = localStorage.getItem('blacklistUsers');
    if (savedBlacklistUsers) {
        blacklistUsersInput.value = savedBlacklistUsers;
        blacklistedUsers = savedBlacklistUsers.split('\n').map(u => u.trim().toLowerCase()).filter(u => u);
    }

    // Cargar la conversación guardada si existe (opcional)
    const savedLog = localStorage.getItem('conversationLog');
    if (savedLog) {
        try {
            conversationLogMessages = JSON.parse(savedLog);
            conversationLog.value = conversationLogMessages.join('\n');
            conversationLog.scrollTop = conversationLog.scrollHeight; // Scroll al final
        } catch (e) {
            console.error("Error al cargar el log de conversación:", e);
            conversationLogMessages = []; // Resetear si hay un error de parseo
        }
    }
}

function updateLog(message) {
    conversationLogMessages.push(message);
    conversationLog.value = conversationLogMessages.join('\n');
    conversationLog.scrollTop = conversationLog.scrollHeight; // Scroll al final
    localStorage.setItem('conversationLog', JSON.stringify(conversationLogMessages)); // Guardar en LocalStorage
}


// --- Lógica de Twitch ---

function getTwitchAccessTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
}

async function getTwitchUserInfo(token) {
    try {
        const response = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error fetching user info: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].login; // Retorna el nombre de usuario
        }
        return null;
    } catch (error) {
        console.error('Error al obtener la información del usuario de Twitch:', error);
        return null;
    }
}


async function handleTwitchRedirect() {
    const token = getTwitchAccessTokenFromUrl();
    if (token) {
        twitchAccessToken = token;
        localStorage.setItem('twitchAccessToken', token);
        
        // Obtener el nombre de usuario autenticado
        twitchAuthenticatedUsername = await getTwitchUserInfo(token);
        localStorage.setItem('twitchAuthenticatedUsername', twitchAuthenticatedUsername); // Guardar también
        
        if (twitchAuthenticatedUsername) {
            showStatus(twitchStatus, `Autenticado con Twitch como: ${twitchAuthenticatedUsername}`, 'success');
            connectToTwitchChat(twitchAuthenticatedUsername);
        } else {
            showStatus(twitchStatus, 'Autenticado con Twitch, pero no se pudo obtener el nombre de usuario.', 'error');
        }
        
        // Limpiar el hash de la URL para que no quede visible el token
        window.history.pushState("", document.title, TWITCH_REDIRECT_URI); // Redirige a la URL limpia
        
    } else {
        twitchStatus.textContent = 'No conectado a Twitch. Autorización fallida o no completada.';
        twitchStatus.className = 'status-message error';
    }
}

async function connectToTwitchChat(channelName) {
    if (!twitchAccessToken) {
        showStatus(twitchStatus, 'No hay token de acceso de Twitch. Por favor, conecta primero.', 'error');
        return;
    }
    if (!channelName) {
        showStatus(twitchStatus, 'No se pudo obtener el nombre del canal de Twitch. Por favor, autentícate de nuevo.', 'error');
        return;
    }

    try {
        // Si ya hay un cliente conectado, desconectarlo primero
        if (twitchClient && twitchClient.readyState === 'OPEN') {
            await twitchClient.disconnect();
            console.log('Cliente Twitch existente desconectado.');
        }

        twitchClient = new tmi.Client({
            options: { debug: false },
            identity: {
                username: channelName, // Usamos el nombre del usuario autenticado para la conexión
                password: `oauth:${twitchAccessToken}`
            },
            channels: [channelName] // Conectamos al canal del usuario autenticado
        });

        twitchClient.on('message', onTwitchMessage);
        
        // Eventos de conexión
        twitchClient.on('connected', (addr, port) => {
            const channel = twitchClient.getChannels()[0].replace('#', '');
            showStatus(twitchStatus, `Conectado al chat de Twitch: ${channel}`, 'success');
            console.log(`Conectado a Twitch Chat en ${addr}:${port}`);
        });
        
        twitchClient.on('disconnected', (reason) => {
            showStatus(twitchStatus, `Desconectado de Twitch: ${reason || 'Desconocido'}`, 'error');
            console.error('Desconectado de Twitch Chat:', reason);
            twitchClient = null; // Reset client
        });
        
        twitchClient.on('connecting', () => {
            showStatus(twitchStatus, 'Conectando a Twitch...', 'info');
        });
        
        twitchClient.on('reconnect', () => {
            showStatus(twitchStatus, 'Reconectando a Twitch...', 'info');
        });
        
        twitchClient.on('logon', () => {
            // Se dispara cuando el cliente está logeado y listo para recibir mensajes
            const channel = twitchClient.getChannels()[0].replace('#', '');
            showStatus(twitchStatus, `Conectado al chat de Twitch: ${channel}`, 'success');
        });

        await twitchClient.connect();

    } catch (error) {
        console.error('Error al conectar a Twitch:', error);
        showStatus(twitchStatus, `Error al conectar a Twitch: ${error.message}`, 'error');
        twitchClient = null;
    }
}

function onTwitchMessage(channel, tags, message, self) {
    if (self) return; // Ignora tus propios mensajes

    const username = tags['display-name'] || tags.username;
    // Algunos bots pueden tener la badge 'bot', pero no todos.
    // Podrías necesitar una lista más robusta de IDs de usuarios de bots si quieres filtrarlos con precisión.
    const isBot = tags.badges && tags.badges.bot; 

    // Mostrar mensaje en el área de chat de Twitch
    const chatMessageElement = document.createElement('p');
    chatMessageElement.classList.add('message');
    chatMessageElement.innerHTML = `<strong>${username}:</strong> <span>${message}</span>`;
    twitchChatArea.appendChild(chatMessageElement);
    twitchChatArea.scrollTop = twitchChatArea.scrollHeight; // Auto-scroll al final

    // Añadir al log de conversación
    updateLog(`[${new Date().toLocaleTimeString()}] ${username}: ${message}`);


    // --- Lógica del Chatbot ---
    if (!chatbotEnabled) return; // Si el chatbot está desactivado, no hagas nada más.

    const lowerCaseMessage = message.toLowerCase();

    // Filtrar palabras
    for (const word of filteredWords) {
        if (lowerCaseMessage.includes(word)) {
            console.log(`Mensaje filtrado por palabra clave: "${word}"`);
            return;
        }
    }

    // Lista negra de usuarios
    if (blacklistedUsers.includes(username.toLowerCase()) || isBot) {
        console.log(`Mensaje ignorado de usuario en lista negra o bot: "${username}"`);
        return;
    }

    // Si todo lo anterior pasó, procesa con Gemini
    processMessageWithGemini(message, username);
}

// --- Lógica de Google Gemini ---

async function processMessageWithGemini(userMessage, username) {
    if (!geminiApiKey) {
        console.error('API Key de Gemini no configurada.');
        updateLog(`[ERROR GEMINI] API Key no configurada. Por favor, introdúcela en la configuración.`);
        showStatus(saveStatus, 'API Key de Gemini no configurada. El chatbot no funcionará.', 'error');
        return;
    }

    try {
        // Estructura mínima para la conversación con Gemini
        const model = "gemini-pro"; 
        const prompt = `El usuario ${username} dice: "${userMessage}". Responde de forma concisa y amigable, como un asistente de chat. Limita tu respuesta a un máximo de ${wordLimit.value} palabras.`;

        const response = await fetch(`${GEMINI_API_BASE_URL}${geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error ? errorData.error.message : 'Unknown error';
            console.error('Error al comunicarse con la API de Gemini:', errorData);
            throw new Error(`Error HTTP (${response.status}): ${errorMessage}`);
        }

        const data = await response.json();
        const geminiText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : 'No se pudo generar una respuesta.';

        // Aplicar límite de palabras final (por si Gemini se excede, aunque el prompt ya lo pide)
        const finalResponseText = geminiText.split(' ').slice(0, parseInt(wordLimit.value)).join(' ');

        updateLog(`[${new Date().toLocaleTimeString()}] Chatbot: ${finalResponseText}`);
        speakText(finalResponseText);

    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini:', error);
        updateLog(`[ERROR GEMINI] ${error.message}`);
        showStatus(saveStatus, `Error con Gemini: ${error.message}`, 'error');
    }
}

// --- Lógica de Texto a Voz (Web Speech API) ---

const synth = window.speechSynthesis;
let voices = [];

function populateVoiceList() {
    voices = synth.getVoices().sort((a, b) => {
        const langA = a.lang.toLowerCase();
        const langB = b.lang.toLowerCase();
        if (langA < langB) return -1;
        if (langA > langB) return 1;
        return a.name.localeCompare(b.name);
    });

    voiceSelect.innerHTML = ''; // Limpiar opciones existentes
    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Seleccionar Voz';
    defaultOption.value = ''; // Valor vacío para la opción por defecto
    voiceSelect.appendChild(defaultOption);

    let savedVoiceURI = localStorage.getItem('selectedVoiceURI');
    let foundSavedVoice = false;

    voices.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.voiceURI; // Usar voiceURI para guardar/cargar
        option.setAttribute('data-lang', voice.lang);
        option.setAttribute('data-name', voice.name);
        if (voice.default) {
            option.textContent += ' (Default)';
        }
        voiceSelect.appendChild(option);

        if (savedVoiceURI && voice.voiceURI === savedVoiceURI) {
            option.selected = true;
            foundSavedVoice = true;
        }
    });

    // Si no se encontró la voz guardada, intentar usar la primera disponible o la por defecto
    if (!foundSavedVoice && voices.length > 0) {
        const firstVoice = voices.find(v => v.default) || voices[0];
        voiceSelect.value = firstVoice.voiceURI;
        localStorage.setItem('selectedVoiceURI', firstVoice.voiceURI); // Actualizar LocalStorage
        currentVoice = firstVoice;
    } else if (foundSavedVoice) {
         currentVoice = voices.find(v => v.voiceURI === savedVoiceURI);
    } else {
        currentVoice = null; // No hay voces disponibles
    }
}

// Asegurarse de que las voces se carguen cuando estén disponibles
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoiceList;
} else {
    // Para navegadores que no activan onvoiceschanged automáticamente (ej. a veces Firefox/Safari)
    populateVoiceList();
}


function speakText(text) {
    if (!chatbotEnabled) return; // Si el chatbot está desactivado, no hablar.
    
    // Evitar superposición si ya está hablando o en cola
    if (synth.speaking || synth.pending) {
        console.log('Chatbot ya hablando o en cola, ignorando nueva solicitud de voz.');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (currentVoice) {
        utterance.voice = currentVoice;
    } else {
        console.warn('No se seleccionó una voz o no hay voces disponibles. Usando la voz predeterminada del navegador.');
    }
    utterance.rate = 1; // Velocidad normal
    utterance.pitch = 1; // Tono normal
    
    utterance.onerror = (event) => {
        console.error('Error en Web Speech API:', event.error);
        showStatus(saveStatus, `Error al generar voz: ${event.error}`, 'error');
    };

    synth.speak(utterance);
}

// --- Manejadores de Eventos ---

connectTwitchBtn.addEventListener('click', () => {
    // Redirige al usuario para la autorización de Twitch OAuth
    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITCH_REDIRECT_URI)}&scope=${TWITCH_SCOPES}`;
    window.location.href = authUrl;
});

saveGeminiApiKey.addEventListener('click', () => {
    geminiApiKey = geminiApiKeyInput.value.trim();
    saveSettings();
    if (geminiApiKey) {
        showStatus(saveStatus, 'API Key de Gemini guardada.', 'success');
    } else {
        showStatus(saveStatus, 'API Key de Gemini vacía. El chatbot no funcionará.', 'error');
    }
});

enableChatbotVoice.addEventListener('change', () => {
    chatbotEnabled = enableChatbotVoice.checked;
    saveSettings();
    showStatus(saveStatus, `Chatbot de voz: ${chatbotEnabled ? 'Activado' : 'Desactivado'}.`, 'info');
});

voiceSelect.addEventListener('change', () => {
    const selectedURI = voiceSelect.value;
    currentVoice = voices.find(voice => voice.voiceURI === selectedURI) || null;
    saveSettings();
    showStatus(saveStatus, `Voz seleccionada: ${currentVoice ? currentVoice.name : 'Ninguna'}.`, 'info');
});

wordLimit.addEventListener('input', () => {
    wordLimitValue.textContent = `${wordLimit.value} palabras`;
});

wordLimit.addEventListener('change', () => {
    saveSettings();
    showStatus(saveStatus, `Límite de palabras establecido en ${wordLimit.value}.`, 'info');
});

saveFilterWordsBtn.addEventListener('click', () => {
    filteredWords = filterWordsInput.value.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
    saveSettings();
    showStatus(saveStatus, 'Filtros de palabras guardados.', 'success');
});

saveBlacklistUsersBtn.addEventListener('click', () => {
    blacklistedUsers = blacklistUsersInput.value.split('\n').map(u => u.trim().toLowerCase()).filter(u => u);
    saveSettings();
    showStatus(saveStatus, 'Lista negra de usuarios guardada.', 'success');
});

saveAllSettingsBtn.addEventListener('click', () => {
    saveSettings();
});

saveLogBtn.addEventListener('click', () => {
    const blob = new Blob([conversationLog.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chatbot_conversation_log.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus(saveStatus, 'Log de conversación guardado como TXT.', 'success');
});

clearLogBtn.addEventListener('click', () => {
    conversationLog.value = '';
    conversationLogMessages = [];
    localStorage.removeItem('conversationLog');
    showStatus(saveStatus, 'Log de conversación limpiado.', 'info');
});


// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings(); // Cargar configuraciones guardadas

    // Si hay un token de Twitch en la URL, manejar la redirección
    if (window.location.hash.includes('access_token')) {
        await handleTwitchRedirect();
    } else {
        // Si no, intentar usar un token guardado previamente
        twitchAccessToken = localStorage.getItem('twitchAccessToken');
        twitchAuthenticatedUsername = localStorage.getItem('twitchAuthenticatedUsername');
        
        if (twitchAccessToken && twitchAuthenticatedUsername) {
            showStatus(twitchStatus, `Reconectando como: ${twitchAuthenticatedUsername}`, 'info');
            connectToTwitchChat(twitchAuthenticatedUsername);
        } else {
            showStatus(twitchStatus, 'Por favor, conecta con Twitch para comenzar.', 'info');
        }
    }

    // Asegurarse de que las voces se carguen cuando estén disponibles
    populateVoiceList(); 
});
