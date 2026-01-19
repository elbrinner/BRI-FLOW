import React, { useState, useRef } from 'react';

const VoiceRecorder = ({ onAudioCaptured }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                if (onAudioCaptured) {
                    onAudioCaptured(blob);
                }
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please ensure you have granted permission.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`voice-recorder-btn ${isRecording ? 'recording' : ''}`}
            title={isRecording ? "Stop Recording" : "Start Recording"}
            style={{
                padding: '8px 12px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: isRecording ? '#ef4444' : '#e5e7eb',
                color: isRecording ? 'white' : '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
                transition: 'all 0.2s ease'
            }}
        >
            {isRecording ? (
                <span style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '2px' }}></span>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
            )}
        </button>
    );
};

export default VoiceRecorder;
