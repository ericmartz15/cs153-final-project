import { useEffect } from "react";
import { useSessionStore } from "../store/sessionStore";

export function useAgentSocket() {
  const { sessionId, connectSocket, disconnectSocket } = useSessionStore();

  useEffect(() => {
    if (sessionId) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [sessionId, connectSocket, disconnectSocket]);
}
