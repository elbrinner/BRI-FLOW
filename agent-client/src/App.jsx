import { useState, useRef, useEffect } from 'react'
import './App.css'
import './App.css'
import UIComponentRenderer from './components/UIComponentRenderer'
import VoiceRecorder from './components/VoiceRecorder'

function App() {
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hello! I am your UI Agent. How can I help you today?' }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault()
    if (!inputValue.trim()) return

    const userMsg = { role: 'user', content: inputValue }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    // Simulate Agent Response with Streaming
    setTimeout(async () => {
      const mockResponse = getMockResponse(inputValue)
      setIsTyping(false)

      if (mockResponse.type === 'ui') {
        // UI components render immediately for now
        setMessages(prev => [...prev, mockResponse])
      } else {
        // Stream text response
        await simulateStreamingResponse(mockResponse.content)
      }
    }, 1000)
  }

  const handleAudioCaptured = (audioBlob) => {
    // Mock transcription
    const userMsg = { role: 'user', content: '🎤 [Voice Message] (Transcribing...)' }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    setTimeout(() => {
      // Replace "Transcribing..." with actual text (mocked)
      setMessages(prev => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1] = { role: 'user', content: 'Hello, I would like to see my profile card.' }
        return newMsgs
      })

      // Trigger bot response for the transcribed text
      setInputValue('show profile card') // Hack to reuse logic
      setTimeout(() => {
        handleSendMessage(null) // Trigger send with the "transcribed" intent
      }, 500)
    }, 1500)
  }

  const simulateStreamingResponse = async (fullText) => {
    const botMsgId = Date.now()
    // Initial empty message
    setMessages(prev => [...prev, { role: 'bot', content: '', id: botMsgId }])

    const words = fullText.split(' ')
    let currentText = ''

    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i]
      setMessages(prev => prev.map(msg =>
        msg.id === botMsgId ? { ...msg, content: currentText } : msg
      ))
      // Random delay for typing effect
      await new Promise(r => setTimeout(r, 30 + Math.random() * 50))
    }
  }

  const getMockResponse = (input) => {
    const lower = input.toLowerCase()

    if (lower.includes('card') || lower.includes('tarjeta')) {
      return {
        role: 'bot',
        type: 'ui',
        content: {
          type: 'card',
          title: 'User Profile',
          data: {
            Name: 'Alice Johnson',
            Role: 'Software Engineer',
            Department: 'Frontend'
          },
          actions: [
            { label: 'View Details', action: 'view' },
            { label: 'Edit', action: 'edit' }
          ]
        }
      }
    }

    if (lower.includes('list') || lower.includes('lista')) {
      return {
        role: 'bot',
        type: 'ui',
        content: {
          type: 'list',
          title: 'Recent Transactions',
          data: [
            'Payment to AWS - $120.00',
            'Coffee Shop - $4.50',
            'Uber Ride - $15.20'
          ]
        }
      }
    }

    return {
      role: 'bot',
      content: `I received your message: "${input}". Try asking for a "card" or a "list" to see UI components!`
    }
  }

  return (
    <div className="app-container">
      <header className="chat-header">
        <h1>UI Agent Client</h1>
      </header>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.role === 'user' ? 'user-row' : 'bot-row'}`}>
            <div className={`message-bubble ${msg.role}`}>
              {msg.type === 'ui' ? (
                <UIComponentRenderer component={msg.content} />
              ) : (
                <div className="text-content">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-row bot-row">
            <div className="message-bubble bot typing">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSendMessage}>
        <VoiceRecorder onAudioCaptured={handleAudioCaptured} />
        <input
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}

export default App
