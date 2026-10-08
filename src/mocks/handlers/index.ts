import { applicationHandlers, companyHandlers, jobHandlers, scheduleHandlers, systemHandlers } from "./core";
import {
  approvalHandlers,
  automationHandlers,
  companySourceHandlers,
  mailHandlers,
} from "./business";
import { codexHandlers } from "./codex";
import { configurationHandlers } from "./configuration";

/**
 * 全量 mock 端点清单，与解读报告第五节逐条对齐：
 * 系统 3、岗位 3、公司 1、投递 8、日程 3、邮件 4、定时任务 2、
 * 审批 5、Codex 12、数据接入 5、配置 9 = 55 条 handler（与 grep 计数一致）。
 */
export const handlers = [
  ...systemHandlers,
  ...jobHandlers,
  ...companyHandlers,
  ...scheduleHandlers,
  ...applicationHandlers,
  ...mailHandlers,
  ...automationHandlers,
  ...approvalHandlers,
  ...codexHandlers,
  ...companySourceHandlers,
  ...configurationHandlers,
];
