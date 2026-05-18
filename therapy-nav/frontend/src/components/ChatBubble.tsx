import { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-sage-500 flex items-center justify-center text-white text-xs font-semibold mr-3 flex-shrink-0 mt-1">
          TN
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-sage-500 text-white rounded-br-sm"
            : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
