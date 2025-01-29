import { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  Download, 
  Play, 
  Pause, 
  Settings, 
  Mic
} from 'lucide-react';
import { franc } from 'franc-min';

function App() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<number>(0);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Language mapping for display
  const languageNames: { [key: string]: string } = {
    eng: 'English',
    spa: 'Spanish',
    fra: 'French',
    deu: 'German',
    ita: 'Italian',
    por: 'Portuguese',
    rus: 'Russian',
    jpn: 'Japanese',
    kor: 'Korean',
    cmn: 'Chinese',
    und: 'Unknown'
  };

  // Language codes for translation API
  const translateCodes: { [key: string]: string } = {
    eng: 'en',
    spa: 'es',
    fra: 'fr',
    deu: 'de',
    ita: 'it',
    por: 'pt',
    rus: 'ru',
    jpn: 'ja',
    kor: 'ko',
    cmn: 'zh'
  };

  // Function to translate text
  const translateText = async (text: string, sourceLang: string, targetLang: string) => {
    try {
      setIsTranslating(true);
      const sourceCode = translateCodes[sourceLang] || 'auto';
      const targetCode = translateCodes[targetLang];
      
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetCode}`
      );

      const data = await response.json();
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
      throw new Error('Translation failed');
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text if translation fails
    } finally {
      setIsTranslating(false);
    }
  };

  // Initialize speech synthesis
  useEffect(() => {
    const synth = window.speechSynthesis;
    console.log('Speech synthesis initialized');
    
    const updateVoices = () => {
      const voices = synth.getVoices();
      console.log('Available voices:', voices);
      if (voices.length > 0) {
        setAvailableVoices(voices);
        setSelectedVoice(0); // Set default voice
        console.log('Default voice set:', voices[0]);
      }
    };

    // Initial load of voices
    updateVoices();

    // Chrome loads voices asynchronously
    if ('onvoiceschanged' in speechSynthesis) {
      console.log('Browser supports onvoiceschanged event');
      speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if ('onvoiceschanged' in speechSynthesis) {
        speechSynthesis.onvoiceschanged = null;
      }
      synth.cancel();
    };
  }, []);

  // Detect language and update voice when text changes
  useEffect(() => {
    if (text.length > 10) {
      try {
        const detected = franc(text) || 'und';
        setDetectedLanguage(detected);
        
        // Only auto-select voice if no target language is selected or if the text is not in English
        if (!targetLanguage || detected !== 'eng') {
          // Find a voice that matches the detected language
          const voices = availableVoices;
          const matchingVoiceIndex = voices.findIndex(voice => 
            voice.lang.toLowerCase().startsWith(detected === 'eng' ? 'en' : detected)
          );
          
          if (matchingVoiceIndex !== -1) {
            setSelectedVoice(matchingVoiceIndex);
          }
        }
      } catch (error) {
        console.error('Language detection error:', error);
        setDetectedLanguage('und');
      }
    } else {
      setDetectedLanguage('');
    }
  }, [text, availableVoices, targetLanguage]);

  // Update voice when target language changes
  useEffect(() => {
    if (targetLanguage && detectedLanguage === 'eng') {
      const voices = availableVoices;
      const langCode = translateCodes[targetLanguage];
      const matchingVoiceIndex = voices.findIndex(voice => 
        voice.lang.toLowerCase().startsWith(langCode)
      );
      
      if (matchingVoiceIndex !== -1) {
        setSelectedVoice(matchingVoiceIndex);
      }
    }
  }, [targetLanguage, availableVoices]);

  // Handle text-to-speech conversion
  const handleSpeak = async () => {
    if (!text || !window.speechSynthesis) {
      console.log('Speech synthesis not available or no text to speak');
      return;
    }

    try {
      console.log('Starting speech synthesis');
      window.speechSynthesis.cancel();

      let textToSpeak = text;
      
      if (targetLanguage && detectedLanguage && targetLanguage !== detectedLanguage) {
        console.log('Translating from', detectedLanguage, 'to', targetLanguage);
        const translated = await translateText(text, detectedLanguage, targetLanguage);
        textToSpeak = translated;
        setTranslatedText(translated);
      }

      const newUtterance = new SpeechSynthesisUtterance(textToSpeak);
      console.log('Created utterance with text:', textToSpeak);
      
      if (availableVoices.length > 0) {
        const selectedVoiceObj = availableVoices[selectedVoice] || availableVoices[0];
        newUtterance.voice = selectedVoiceObj;
        console.log('Selected voice:', selectedVoiceObj.name);
      } else {
        console.warn('No voices available');
      }

      newUtterance.rate = rate;
      newUtterance.pitch = pitch;
      newUtterance.volume = 1;
      console.log('Voice settings:', { rate, pitch, volume: 1 });

      newUtterance.onstart = () => {
        console.log('Speech started');
        setIsPlaying(true);
      };
      newUtterance.onend = () => {
        console.log('Speech ended');
        setIsPlaying(false);
      };
      newUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsPlaying(false);
      };

      setUtterance(newUtterance);
      window.speechSynthesis.speak(newUtterance);
    } catch (error) {
      console.error('Error in handleSpeak:', error);
      setIsPlaying(false);
    }
  };

  // Handle play/pause
  const togglePlayPause = () => {
    const synth = window.speechSynthesis;
    
    if (isPlaying) {
      synth.pause();
      setIsPlaying(false);
    } else {
      if (synth.paused && utterance) {
        synth.resume();
        setIsPlaying(true);
      } else {
        handleSpeak();
      }
    }
  };

  // Handle text download
  const handleTextDownload = async () => {
    if (!text) return;

    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'voicecraft-text.txt';
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">VoiceCraft</h1>
            </div>
            <nav className="flex space-x-4">
              <a href="#" className="text-gray-600 hover:text-blue-600">Features</a>
              <a href="#" className="text-gray-600 hover:text-blue-600">Pricing</a>
              <a href="#" className="text-gray-600 hover:text-blue-600">API</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Text Input Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your text here to convert to speech..."
                className="w-full h-48 sm:h-64 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              {translatedText && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Translated Text:</h3>
                  <p className="text-gray-600">{translatedText}</p>
                </div>
              )}
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <span className="text-sm text-gray-500">
                    {text.length} / 5000 characters
                  </span>
                  {detectedLanguage && (
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {languageNames[detectedLanguage] || 'Unknown Language'}
                    </span>
                  )}
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="text-sm border border-blue-200 rounded-lg p-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
                  >
                    <option value="">Translate to...</option>
                    {Object.entries(languageNames)
                      .filter(([code]) => code !== detectedLanguage && code !== 'und')
                      .map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                  </select>
                </div>
                <button 
                  onClick={handleSpeak}
                  disabled={!text || isTranslating}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                >
                  {isTranslating ? (
                    <span>Translating...</span>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Convert to Speech</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-blue-600" />
                Voice Settings
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Voice
                  </label>
                  <select 
                    className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(Number(e.target.value))}
                  >
                    {availableVoices.map((voice, index) => (
                      <option key={index} value={index}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Speaking Rate: {rate}x
                  </label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pitch: {pitch}x
                  </label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Audio Preview */}
            <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mic className="h-5 w-5 mr-2 text-blue-600" />
                Audio Preview
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-center h-20 sm:h-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <button 
                    onClick={togglePlayPause}
                    disabled={!text}
                    className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleTextDownload}
                    disabled={!text}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-4 w-4" />
                    <span>Text</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Product
              </h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Features</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Pricing</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">API</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Company
              </h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600">About</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Blog</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Support
              </h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Documentation</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Contact</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Legal
              </h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Privacy</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-8 flex justify-between items-center">
            <p className="text-gray-500">&copy; 2024 VoiceCraft. All rights reserved.</p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-600 hover:text-blue-600">
                Twitter
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600">
                GitHub
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;