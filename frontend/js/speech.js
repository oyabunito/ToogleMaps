// Dictée vocale d'adresse via l'API Web Speech du navigateur (gratuite,
// 100% côté client). Support correct sur Android/Chrome ; support limité
// ou absent sur iOS/Safari — le bouton est simplement masqué si absent.

const Speech = (() => {
  const SpeechRecognitionCtor =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function isSupported() {
    return !!SpeechRecognitionCtor;
  }

  // onResult(text, isFinal) est appelé à chaque mise à jour (résultats
  // provisoires puis final). L'appelant décide quand arrêter/valider.
  function start(onResult, onEnd, onError) {
    if (!SpeechRecognitionCtor) {
      onError && onError(new Error("Reconnaissance vocale non supportée sur ce navigateur."));
      return null;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onResult(transcript, isFinal);
    };
    recognition.onerror = (event) => onError && onError(event.error);
    recognition.onend = () => onEnd && onEnd();

    recognition.start();
    return recognition;
  }

  return { isSupported, start };
})();
