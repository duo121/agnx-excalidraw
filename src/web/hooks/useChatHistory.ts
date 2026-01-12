import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {readJsonWithFallback, writeJson} from "../../storage";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const MAX_SESSIONS = 50;
const CHAT_SAVE_DEBOUNCE_MS = 10_000;

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const loadSessions = (storageKey: string, legacyKey?: string): ChatSession[] => {
  return readJsonWithFallback<ChatSession[]>(storageKey, legacyKey ? [legacyKey] : [], []);
};

const saveSessions = (storageKey: string, sessions: ChatSession[]) => {
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  writeJson(storageKey, trimmed);
};

export const useChatHistory = (storageKey: string, legacyKey?: string) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const sessionsRef = useRef<ChatSession[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = loadSessions(storageKey, legacyKey);
    setSessions(loaded);
    if (loaded.length > 0) {
      setCurrentSessionId(loaded[0].id);
    }
    setIsLoaded(true);
  }, [storageKey, legacyKey]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const flushSave = useCallback(() => {
    if (!isLoaded) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveSessions(storageKey, sessionsRef.current);
  }, [isLoaded, storageKey]);

  const scheduleSave = useCallback(() => {
    if (!isLoaded) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveSessions(storageKey, sessionsRef.current);
    }, CHAT_SAVE_DEBOUNCE_MS);
  }, [isLoaded, storageKey]);

  useEffect(() => {
    scheduleSave();
  }, [sessions, scheduleSave]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushSave();
      }
    };
    const handleBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushSave();
    };
  }, [flushSave]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId) || null,
    [sessions, currentSessionId]
  );

  const createSession = useCallback((title?: string) => {
    const newSession: ChatSession = {
      id: generateId(),
      title: title || `New chat ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  }, []);

  const addMessage = useCallback((sessionId: string, role: ChatRole, content: string) => {
    const messageId = generateId();
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextMessage: ChatMessage = {
          id: messageId,
          role,
          content,
          timestamp: Date.now(),
        };
        let nextTitle = session.title;
        if (role === "user" && session.messages.length === 0) {
          nextTitle = content.slice(0, 40) + (content.length > 40 ? "..." : "");
        }
        return {
          ...session,
          title: nextTitle,
          messages: [...session.messages, nextMessage],
          updatedAt: Date.now(),
        };
      })
    );
    return messageId;
  }, []);

  const updateMessage = useCallback((sessionId: string, messageId: string, content: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          messages: session.messages.map((message) =>
            message.id === messageId ? {...message, content} : message
          ),
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((session) => session.id !== sessionId);
        if (sessionId === currentSessionId) {
          setCurrentSessionId(filtered[0]?.id || null);
        }
        return filtered;
      });
    },
    [currentSessionId]
  );

  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoaded,
    createSession,
    addMessage,
    updateMessage,
    deleteSession,
    switchSession,
  };
};
