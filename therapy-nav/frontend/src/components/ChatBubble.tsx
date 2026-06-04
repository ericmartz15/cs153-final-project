import ReactMarkdown from "react-markdown";
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
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-sage-500 text-white rounded-br-sm whitespace-pre-wrap"
            : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
