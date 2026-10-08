import { useNavigate } from "react-router-dom";
import { DEFAULT_QUESTIONS } from "@/lib/labels";
import { useAssistantStore } from "@/stores/assistant";

export interface DashboardTodo {
  kind: "pending" | "success" | "warning";
  kindLabel: string;
  status: string;
  title: string;
  detail: string;
  actionLabel: string;
  taskType?: string;
  question?: string;
  view?: string;
}

/** 上游 createTodoCard（app.js:2560）：动作要么跳视图，要么带预设问题去助理。 */
export function TodoCard({ todo }: { todo: DashboardTodo }) {
  const navigate = useNavigate();
  const ask = useAssistantStore((state) => state.ask);
  const setContext = useAssistantStore((state) => state.setContext);

  return (
    <article className="todo-card">
      <div className="todo-card-head">
        <span className={`status-label status-label--${todo.kind}`}>{todo.status}</span>
        <span className="todo-kind">{todo.kindLabel}</span>
      </div>
      <strong className="todo-title">{todo.title}</strong>
      <p className="todo-detail">{todo.detail}</p>
      <button
        type="button"
        className="text-button todo-action"
        onClick={() => {
          if (todo.view) {
            navigate(`/${todo.view}`);
            return;
          }
          if (!todo.taskType) return;
          const question = todo.question ?? DEFAULT_QUESTIONS[todo.taskType] ?? todo.title;
          setContext({ last_task_type: todo.taskType });
          navigate(`/assistant?ask=${encodeURIComponent(question)}`);
          void ask(question);
        }}
      >
        {todo.actionLabel}
      </button>
    </article>
  );
}
