import { isoAt } from "./_clock";
import type { CodexThread } from "@/types/codex";

/**
 * Codex 会话 fixture。上游把 App Server 的线程对象原样透传，
 * 字段命名混用 camelCase / snake_case，前端对两种都做了兜底 ——
 * 这里刻意保留这种不一致，以便验证前端的容错分支真的在跑。
 */
export function buildThreads(): CodexThread[] {
  return [
    {
      id: "thread-daily-intel",
      preview: "今天有哪些新增岗位值得投递？",
      turn_count: 2,
      updated_at: isoAt(0, 9, 12),
      turns: [
        {
          id: "turn-1",
          status: "completed",
          created_at: isoAt(-1, 20, 4),
          items: [
            { id: "item-1", type: "user_message", role: "user", text: "今天有哪些新增岗位值得投递？" },
            {
              id: "item-2",
              type: "agent_message",
              role: "assistant",
              text:
                "今天新确认 6 个 2027 校招岗位，其中 3 个匹配度在 70 分以上：\n\n1. 腾讯 · 后台开发工程师（提前批）88 分 —— 与你简历中的网关项目高度重合，且提前批竞争更小，建议优先投递。\n2. 字节跳动 · 基础架构后端 84 分 —— 服务治理方向对得上，面试需补充容量规划案例。\n3. 米哈游 · 游戏服务器 82 分 —— 实时同步经验契合。\n\n另有 1 个岗位 JD 尚未补全（小米 · 嵌入式），暂不建议投入准备时间。",
            },
          ],
        },
        {
          id: "turn-2",
          status: "completed",
          created_at: isoAt(0, 9, 10),
          items: [
            { id: "item-3", type: "user_message", role: "user", text: "帮我把腾讯那个岗位的匹配理由再说细一点。" },
            {
              id: "item-4",
              type: "agent_message",
              role: "assistant",
              text:
                "匹配理由集中在三点：\n- 岗位要求「高并发系统设计经验」，你简历里独立实现了限流与熔断的网关组件，属于直接命中。\n- 语言要求 C++/Go 二选一，你有 Go 与 C++ 双语言项目。\n- 学历要求本科及以上，你的学历字段已确认匹配。\n\n扣分项是缺少消息队列与容量规划的实战，建议在面试前准备一个可量化的容量估算例子。",
            },
          ],
        },
      ],
    },
    {
      id: "thread-schedule-check",
      name: "本周安排梳理",
      turnCount: 1,
      recencyAt: isoAt(-2, 21, 30),
      turns: [
        {
          id: "turn-11",
          status: "completed",
          created_at: isoAt(-2, 21, 28),
          items: [
            { id: "item-11", type: "user_message", role: "user", text: "这周还有哪些安排？" },
            {
              id: "item-12",
              type: "agent_message",
              role: "assistant",
              text:
                "本周共 4 项待处理：美团前端笔试已逾期 2 天（截止型，建议尽快联系），米哈游一面在今天 14:30，字节测评明天 23:59 截止，金山办公二面在下周三 10:00。另有 1 项蔚来面试日期未定。",
            },
          ],
        },
      ],
    },
    {
      id: "thread-mail-review",
      title: "招聘邮件关联复核",
      turn_count: 0,
      updated_at: isoAt(-6, 8, 5),
      turns: [],
    },
  ];
}
