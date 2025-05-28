// ... (todo tu código anterior, sin cambios hasta populateVoiceList) ...

// --- Funciones de Voz (Text-to-Speech) ---

function populateVoiceList() {
    console.log('populateVoiceList() llamado.'); // Nuevo log
    const voices = speechSynthesis.getVoices();
    console.log('Numero de voces encontradas:', voices.length); // Nuevo log CRÍTICO
    console.log('Voces obtenidas:', voices); // Nuevo log para ver qué hay en el array

    voiceSelect.innerHTML = ''; // Limpiar opciones existentes
    let foundSelected = false;

    if (voices.length === 0) {
        console.warn('No se encontraron voces de síntesis de voz en este navegador. Deshabilitando opciones de voz.');
        const option = document.createElement('option');
        option.textContent = 'No hay voces disponibles';
        option.value = '';
        voiceSelect.appendChild(option);
        voiceSelect.disabled = true; // Deshabilitar si no hay voces
        enableChatbotVoiceCheckbox.disabled = true; // Deshabilitar el checkbox de voz también
        showStatus(saveStatus, 'No se encontraron voces de síntesis en el navegador.', 'warning');
        return;
    }

    // ... (el resto de populateVoiceList() sigue igual) ...
    voices.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = voice.name + ' (' + voice.lang + ')';
        option.setAttribute('data-lang', voice.lang);
        option.setAttribute('data-name', voice.name);
        option.value = voice.voiceURI;

        if (selectedVoiceURI && voice.voiceURI === selectedVoiceURI) {
            option.selected = true;
            foundSelected = true;
        } else if (!selectedVoiceURI && voice.lang.startsWith('es')) { // Selecciona la primera voz en español por defecto si no hay una guardada
            option.selected = true;
            selectedVoiceURI = voice.voiceURI;
            foundSelected = true;
        }
        voiceSelect.appendChild(option);
    });

    // Si no se encontró ninguna voz guardada ni española, selecciona la primera disponible
    if (!foundSelected && voices.length > 0) {
        voiceSelect.options[0].selected = true;
        selectedVoiceURI = voices[0].voiceURI;
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI);
    } else if (foundSelected) {
        localStorage.setItem('selectedVoiceURI', selectedVoiceURI); // Asegurarse de guardar la seleccionada
    }
    voiceSelect.disabled = false; // Habilitar si hay voces
    enableChatbotVoiceCheckbox.disabled = false; // Habilitar el checkbox de voz
}

// ... (el resto de tu script.js sigue igual) ...
