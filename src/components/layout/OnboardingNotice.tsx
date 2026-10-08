import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useConfigurationStore } from "@/stores/configuration";

/**
 * 上游 #onboarding-notice：配置未就绪时全局挂着的一条提示 + 「打开配置」按钮。
 * 读取时机与上游一致 —— 只在进入配置页时读，避免每次刷新都打一次配置接口。
 */
export function OnboardingNotice() {
  const navigate = useNavigate();
  const original = useConfigurationStore((state) => state.original);
  const read = useConfigurationStore((state) => state.read);
  const ready = original?.onboarding?.ready === true;

  useEffect(() => {
    if (!original) void read();
  }, [original, read]);

  if (ready) return null;

  return (
    <div className="onboarding-notice" role="status">
      <span>
        {original
          ? "首次配置待完成：模型连接、简历事实、岗位筛选关键词和行业范围。"
          : "配置状态不可用，智能功能可能尚未就绪。"}
      </span>
      <button type="button" className="text-button" onClick={() => navigate("/configuration")}>
        打开配置
      </button>
    </div>
  );
}
