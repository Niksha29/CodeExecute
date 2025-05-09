import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  FaPlay,
  FaCopy,
  FaShareAlt,
  FaTerminal,
  FaCog,
  FaChevronDown,
  FaCode,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSpinner,
  FaDownload,
  FaSun,
  FaMoon,
  FaComments,
} from "react-icons/fa";
import { GiArtificialIntelligence } from "react-icons/gi";

const languageOptions = [
  { id: 54, label: "C++ (GCC 9.2.0)", value: "cpp", icon: <FaCode /> },
  { id: 62, label: "Java (OpenJDK 13.0.1)", value: "java", icon: <FaCode /> },
  { id: 71, label: "Python (3.8.1)", value: "python", icon: <FaCode /> },
  {
    id: 63,
    label: "JavaScript (Node.js 12.14.0)",
    value: "javascript",
    icon: <FaCode />,
  },
];

const languageTemplates = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
  python: `# Write your Python code here...\nprint("Hello, World!")`,
  javascript: `// Write your JavaScript code here\nconsole.log("Hello, World!");`,
};

const statusMap = {
  1: { label: "In Queue", color: "text-yellow-600" },
  2: { label: "Processing", color: "text-blue-600" },
  3: { label: "Accepted", color: "text-green-600" },
  4: { label: "Wrong Answer", color: "text-red-600" },
  5: { label: "Time Limit Exceeded", color: "text-orange-600" },
  6: { label: "Compilation Error", color: "text-red-600" },
  7: { label: "Runtime Error", color: "text-red-600" },
  8: { label: "Internal Error", color: "text-gray-600" },
  9: { label: "Execution Error", color: "text-red-600" },
};

const SOCKET_URL =
  "https://5e40d533-50dc-4cc6-8261-93eb42642588-00-1jk6vuubv5k5e.sisko.replit.dev:5000/";
const ROOM_ID = "default-room";

export default function EditorPage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState(languageOptions[2]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [theme, setTheme] = useState("dark"); // 'dark' or 'light'
  const [editorTheme, setEditorTheme] = useState("vs-dark");
  const [fontSize, setFontSize] = useState(16);
  const [showSettings, setShowSettings] = useState(false);
  const [executionTime, setExecutionTime] = useState(null);
  const [memory, setMemory] = useState(null);
  const [notification, setNotification] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [socket, setSocket] = useState(null);
  const [role, setRole] = useState("editor");
  const [roomId, setRoomId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const dropdownRef = useRef(null);
  const settingsRef = useRef(null);

  // Apply theme to body
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      setEditorTheme("vs-dark");
    } else {
      document.documentElement.classList.remove("dark");
      setEditorTheme("light");
    }
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target) &&
        !event.target.closest("[data-settings-trigger]")
      ) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    const urlRole = params.get("role") || "editor";
    const sock = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    sock.on("connect", () => {
      setSocket(sock);
      if (room) {
        setRoomId(room);
        setRole(urlRole);
        sock.emit("join-room", { roomId: room, role: urlRole });
        sock.on("sync-code", ({ code, language, input }) => {
          if (code) setCode(code);
          if (language)
            setLanguage(languageOptions.find((l) => l.value === language));
          if (input) setInput(input);
        });
        sock.on("code-change", (newCode) => setCode(newCode));
        sock.on("language-change", (langVal) => {
          setLanguage(languageOptions.find((l) => l.value === langVal));
        });
        sock.on("input-change", (newInput) => setInput(newInput));
      } else {
        setCode(languageTemplates[language.value] || "// Write your code here");
      }
    });
    sock.on("connect_error", (error) => {
      showNotification("Connection error: " + error.message, "error");
    });
    return () => {
      if (sock) {
        sock.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!roomId) {
      setCode(languageTemplates[language.value] || "// Write your code here");
    }
  }, [language.value, roomId]);

  // AI Completion
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onKeyDown((e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyB") {
        e.preventDefault();
        if (aiEnabled) requestAICompletion();
      }
    });
    editor.focus();
  };

  const requestAICompletion = () => {
    if (!code.trim() || !socket) return;
    setIsLoadingAI(true);
    socket.emit(
      "ai-autocomplete",
      { code, language: language.value },
      (response) => {
        setIsLoadingAI(false);
        if (response.error) {
          showNotification("AI completion error: " + response.error, "error");
          return;
        }
        if (response.suggestion) {
          insertSuggestionAtCursor(response.suggestion);
        } else {
          showNotification("No suggestion received from AI", "error");
        }
      },
    );
  };

  const insertSuggestionAtCursor = (suggestion) => {
    if (!editorRef.current || !suggestion) return;
    const editor = editorRef.current;
    const position = editor.getPosition();
    editor.executeEdits("ai-suggestion", [
      {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
        text: suggestion,
      },
    ]);
    editor.focus();
    showNotification("AI suggestion inserted", "success");
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRun = async () => {
    setLoading(true);
    setOutput("");
    setStatus(null);
    setExecutionTime(null);
    setMemory(null);
    const encodedCode = btoa(code);
    const encodedInput = btoa(input);
    try {
      const res = await axios.post(`${SOCKET_URL}api/execute`, {
        source_code: encodedCode,
        language_id: language.id,
        stdin: encodedInput,
      });
      const token = res.data.token;
      const pollResult = async () => {
        try {
          const resultRes = await axios.get(
            `${SOCKET_URL}api/submission/${token}`,
          );
          const {
            stdout,
            stderr,
            compile_output,
            status,
            time,
            memory: memUsage,
          } = resultRes.data;
          setStatus(status);
          if (status.id <= 2) {
            setTimeout(pollResult, 1000);
          } else {
            const decodedOutput = atob(
              stdout || stderr || compile_output || "",
            );
            setOutput(decodedOutput || "No output");
            setExecutionTime(time);
            setMemory(memUsage);
            setLoading(false);
          }
        } catch (err) {
          setOutput("Error fetching result: " + err.message);
          setLoading(false);
          setStatus({ id: 8, description: "Internal Error" });
        }
      };
      pollResult();
    } catch (err) {
      setOutput("Error: " + (err.response?.data?.error || err.message));
      setLoading(false);
      setStatus({ id: 8, description: "Internal Error" });
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    showNotification("Code copied to clipboard!");
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const generateShareLinks = async () => {
    const newRoomId = roomId || Math.random().toString(36).substr(2, 9);
    const baseUrl = window.location.origin + window.location.pathname;
    const editorUrl = `${baseUrl}?room=${newRoomId}&role=editor`;
    const viewerUrl = `${baseUrl}?room=${newRoomId}&role=viewer`;
    if (!roomId) {
      return new Promise((resolve) => {
        setRoomId(newRoomId);
        setRole("editor");
        socket.emit("join-room", { roomId: newRoomId, role: "editor" }, () => {
          socket.emit("code-change", { roomId: newRoomId, code });
          socket.emit("language-change", {
            roomId: newRoomId,
            language: language.value,
          });
          socket.emit("input-change", { roomId: newRoomId, input });
          setTimeout(() => {
            resolve({ editorUrl, viewerUrl });
          }, 200);
        });
      });
    }
    return { editorUrl, viewerUrl };
  };

  const copyShareLink = async (type) => {
    const { editorUrl, viewerUrl } = await generateShareLinks();
    const linkToCopy = type === "editor" ? editorUrl : viewerUrl;
    navigator.clipboard.writeText(linkToCopy);
    showNotification(
      `${type === "editor" ? "Editor" : "Viewer"} link copied to clipboard!`,
    );
    setShowShareModal(false);
    if (type === "editor" && !roomId) {
      window.location.replace(editorUrl);
    }
  };

  const emitCodeChange = (value) => {
    setCode(value || "");
    if (socket && (roomId || ROOM_ID) && role === "editor") {
      socket.emit("code-change", { roomId: roomId || ROOM_ID, code: value });
    }
  };

  const emitLanguageChange = (lang) => {
    setLanguage(lang);
    if (socket && (roomId || ROOM_ID) && role === "editor") {
      socket.emit("language-change", {
        roomId: roomId || ROOM_ID,
        language: lang.value,
      });
    }
  };

  const emitInputChange = (val) => {
    setInput(val);
    if (socket && (roomId || ROOM_ID) && role === "editor") {
      socket.emit("input-change", { roomId: roomId || ROOM_ID, input: val });
    }
  };

  const handleDownloadCode = () => {
    const extMap = {
      cpp: "cpp",
      java: "java",
      python: "py",
      javascript: "js",
    };
    const ext = extMap[language.value] || "txt";
    const filename = `code.${ext}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Code downloaded as ${filename}!`);
  };

  const toggleAI = () => {
    setAiEnabled(!aiEnabled);
    showNotification(
      aiEnabled ? "AI suggestions disabled" : "AI suggestions enabled",
    );
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Theme classes
  const bgClass = theme === "dark" ? "bg-[#181A20]" : "bg-gray-50";
  const textClass = theme === "dark" ? "text-gray-100" : "text-gray-900";
  const cardClass =
    theme === "dark"
      ? "bg-[#23272F] border-[#23272F]"
      : "bg-white border-gray-100";
  const borderClass = theme === "dark" ? "border-[#23272F]" : "border-gray-100";
  const shadowClass =
    theme === "dark"
      ? "shadow-lg shadow-black/20"
      : "shadow-lg shadow-blue-100/30";
  const inputBgClass =
    theme === "dark"
      ? "bg-[#23272F] text-gray-100"
      : "bg-gray-50 text-gray-900";

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${bgClass} ${textClass}`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-10 shadow-md transition-colors duration-300 ${theme === "dark" ? "bg-[#1A1C23]" : "bg-gradient-to-r from-blue-600 to-indigo-700 text-white"}`}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-2xl mr-1">
              <FaCode />
            </div>
            <h1 className="text-xl font-bold tracking-tight">CodeExecute</h1>
            {roomId && (
              <span
                className={`ml-2 px-2 py-0.5 ${theme === "dark" ? "bg-white/10 text-white" : "bg-white/20 text-white"} text-xs rounded-full backdrop-blur-sm`}
              >
                {role === "editor" ? "Editor Mode" : "Viewer Mode"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${theme === "dark" ? "bg-[#23272F] text-yellow-300 hover:bg-[#23272F]/80" : "bg-white/10 text-yellow-600 hover:bg-white/20"}`}
              title="Toggle Theme"
            >
              {theme === "dark" ? <FaSun /> : <FaMoon />}
              <span className="hidden sm:inline">
                {theme === "dark" ? "Light" : "Dark"} Mode
              </span>
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${theme === "dark" ? "bg-[#23272F] text-gray-100 hover:bg-[#23272F]/80" : "bg-white/10 text-gray-900 hover:bg-white/20"}`}
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={role !== "editor"}
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  {language.icon}
                  {language.label}
                </span>
                <FaChevronDown />
              </button>
              {showDropdown && (
                <div
                  className={`absolute top-full right-0 mt-1 w-64 rounded-lg shadow-xl border z-20 overflow-hidden ${cardClass}`}
                >
                  {languageOptions.map((lang) => (
                    <button
                      key={lang.id}
                      className={`w-full text-left px-4 py-3 flex items-center gap-2 text-base ${theme === "dark" ? "hover:bg-[#23272F]/80 text-gray-100" : "hover:bg-blue-50 text-gray-900"}`}
                      onClick={() => {
                        emitLanguageChange(lang);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-700 rounded text-xs font-mono">
                        {lang.icon}
                      </span>
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={toggleAI}
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${aiEnabled ? "bg-yellow-400 text-yellow-900" : theme === "dark" ? "bg-[#23272F] text-gray-100" : "bg-white/10 text-gray-900"} hover:bg-yellow-500 hover:text-yellow-900`}
              title={
                aiEnabled ? "Disable AI suggestions" : "Enable AI suggestions"
              }
            >
              <GiArtificialIntelligence />
              <span className="hidden sm:inline">
                {aiEnabled ? "AI: ON" : "AI: OFF"}
              </span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-md transition-colors ${theme === "dark" ? "text-gray-100 hover:bg-[#23272F]/80" : "text-gray-900 hover:bg-white/20"}`}
              title="Editor Settings"
              data-settings-trigger="true"
            >
              <FaCog />
            </button>
            {showSettings && (
              <div
                ref={settingsRef}
                className={`absolute right-24 top-16 p-5 rounded-lg shadow-xl border z-20 w-72 ${cardClass}`}
              >
                <h3 className="font-medium mb-4 border-b pb-2">
                  Editor Settings
                </h3>
                <div className="mb-4">
                  <label className="block text-sm mb-2 font-medium">
                    Font Size: {fontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs mt-1">
                    <span>12px</span>
                    <span>24px</span>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleDownloadCode}
              className={`p-2 rounded-md transition-colors ${theme === "dark" ? "text-gray-100 hover:bg-[#23272F]/80" : "text-gray-900 hover:bg-white/20"}`}
              title="Download Code"
            >
              <FaDownload />
            </button>
            <button
              onClick={handleShare}
              className={`p-2 rounded-md transition-colors ${theme === "dark" ? "text-gray-100 hover:bg-[#23272F]/80" : "text-gray-900 hover:bg-white/20"}`}
              title="Share Code"
            >
              <FaShareAlt />
            </button>
          </div>
        </div>
      </header>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 backdrop-blur-sm">
          <div
            className={`p-6 rounded-xl shadow-2xl w-full max-w-md animate-fade-in ${cardClass}`}
          >
            <h2 className="text-xl font-bold mb-2">Share Code</h2>
            <p className="mb-6 text-sm">
              Choose how you want others to access your code:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => copyShareLink("editor")}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg flex items-center justify-between hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
              >
                <span className="font-medium">Editor Access</span>
                <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                  Can edit code
                </span>
              </button>
              <button
                onClick={() => copyShareLink("viewer")}
                className="w-full py-3 px-4 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 rounded-lg flex items-center justify-between hover:from-gray-200 hover:to-gray-300 transition-all border border-gray-300"
              >
                <span className="font-medium">Viewer Access</span>
                <span className="text-sm bg-gray-700/10 px-2 py-0.5 rounded-full">
                  Read-only
                </span>
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="mt-6 w-full py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
            notification.type === "success"
              ? "bg-green-100 text-green-800 border-l-4 border-green-500"
              : "bg-red-100 text-red-800 border-l-4 border-red-500"
          }`}
        >
          {notification.type === "success" ? (
            <FaCheckCircle />
          ) : (
            <FaTimesCircle />
          )}
          {notification.message}
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-col lg:flex-row flex-1 container mx-auto p-4 gap-4">
        {/* Editor Column */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Code Editor */}
          <div
            className={`${cardClass} rounded-xl overflow-hidden ${shadowClass} flex-1 border`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${borderClass} ${theme === "dark" ? "bg-[#23272F]" : "bg-gray-50"}`}
            >
              <div className="flex items-center gap-2">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-sm font-medium ml-2">
                  {language.label} Editor
                  {isLoadingAI && (
                    <span className="ml-2 text-blue-500 animate-pulse">
                      AI thinking...
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className={`p-1.5 rounded transition-colors ${theme === "dark" ? "text-gray-100 hover:bg-[#23272F]/80" : "text-gray-900 hover:bg-gray-100"}`}
                  title="Copy Code"
                >
                  <FaCopy />
                </button>
                <button
                  onClick={requestAICompletion}
                  className={`p-1.5 rounded ${aiEnabled ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400"} ${theme === "dark" ? "hover:bg-[#23272F]/80" : "hover:bg-gray-100"} transition-colors`}
                  title="Trigger AI Completion (Ctrl+B)"
                  disabled={!aiEnabled || isLoadingAI}
                >
                  {isLoadingAI ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <GiArtificialIntelligence />
                  )}
                </button>
              </div>
            </div>
            <div className={`border-b ${borderClass}`}>
              <Editor
                height="60vh"
                onMount={handleEditorDidMount}
                language={language.value}
                theme={editorTheme}
                value={code}
                onChange={role === "editor" ? emitCodeChange : undefined}
                options={{
                  fontSize: fontSize,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: "on",
                  padding: { top: 10 },
                  readOnly: role !== "editor",
                  tabCompletion: "on",
                  quickSuggestions: true,
                  suggestOnTriggerCharacters: true,
                  renderLineHighlight: "all",
                  cursorBlinking: "smooth",
                }}
              />
            </div>
          </div>

          {/* Input Section */}
          <div
            className={`${cardClass} rounded-xl overflow-hidden ${shadowClass} border`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${borderClass} ${theme === "dark" ? "bg-[#23272F]" : "bg-gray-50"}`}
            >
              <div className="flex items-center gap-2">
                <FaTerminal />
                <h3 className="font-medium">Input</h3>
              </div>
              <div className="text-xs">Standard Input (stdin)</div>
            </div>
            <textarea
              className={`w-full p-4 h-32 focus:outline-none resize-none font-mono text-sm transition-colors ${inputBgClass}`}
              value={input}
              onChange={(e) => emitInputChange(e.target.value)}
              placeholder="Enter input for your code..."
              disabled={role !== "editor"}
            />
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium self-start mt-2 transition-all ${loading ? "bg-gray-600 text-white" : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"} ${shadowClass}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <FaPlay />
                <span>Execute Code</span>
              </>
            )}
          </button>
        </div>

        {/* Output Column */}
        <div
          className={`lg:w-2/5 ${cardClass} rounded-xl overflow-hidden ${shadowClass} flex flex-col border`}
        >
          <div
            className={`flex items-center justify-between px-4 py-3 border-b ${borderClass} ${theme === "dark" ? "bg-[#23272F]" : "bg-gray-50"}`}
          >
            <h2 className="font-medium flex items-center gap-2">
              <span className="text-lg">
                <FaShareAlt />
              </span>{" "}
              Output
            </h2>
            {status && (
              <div
                className={`flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-full ${
                  status.id === 3
                    ? "bg-green-100 text-green-800"
                    : status.id >= 4
                      ? "bg-red-100 text-red-800"
                      : status.id <= 2
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                }`}
              >
                {status.id === 3 ? (
                  <FaCheckCircle />
                ) : status.id >= 4 ? (
                  <FaTimesCircle />
                ) : status.id <= 2 ? (
                  <FaClock />
                ) : null}
                {statusMap[status.id]?.label || status.description}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto relative">
            <pre
              className={`p-4 text-sm font-mono h-full whitespace-pre-wrap ${theme === "dark" ? "text-gray-100" : "text-gray-800"}`}
            >
              {output ||
                (loading
                  ? "Running your code..."
                  : "Your output will appear here")}
            </pre>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                <div
                  className={`flex flex-col items-center gap-3 p-6 rounded-lg shadow-md border ${cardClass}`}
                >
                  <FaSpinner className="animate-spin text-2xl" />
                  <p className="font-medium">Executing code...</p>
                </div>
              </div>
            )}
          </div>
          {(executionTime || memory) && (
            <div
              className={`border-t p-3 flex gap-6 text-xs ${borderClass} ${theme === "dark" ? "bg-[#23272F]" : "bg-gray-50"}`}
            >
              {executionTime && (
                <div className="flex items-center gap-1">
                  <FaClock />
                  <span>
                    Execution time:{" "}
                    <span className="font-medium">{executionTime} sec</span>
                  </span>
                </div>
              )}
              {memory && (
                <div className="flex items-center gap-1">
                  <span>
                    Memory used:{" "}
                    <span className="font-medium">
                      {memory ? Math.round(memory / 1000) : 0} KB
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`mt-auto py-4 text-center text-sm border-t ${borderClass} ${theme === "dark" ? "bg-[#1A1C23] text-gray-400" : "bg-white text-gray-500"}`}
      >
        <p>CodeExecute Pro - Online collaborative code editor and compiler</p>
      </footer>
    </div>
  );
}
