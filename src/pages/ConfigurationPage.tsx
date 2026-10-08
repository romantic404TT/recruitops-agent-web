import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { ASSISTANT_STATUS_LABELS, MODEL_PRESETS } from "@/types/configuration";
import { degreeOption, splitLines, useConfigurationStore } from "@/stores/configuration";
import { showToast } from "@/stores/toast";
import { text } from "@/lib/format";
import type { ModelConnection, ModelProvider } from "@/types/configuration";

const CAPABILITY_FIELDS = ["vision_enabled"];

function InlineMessage({ id }: { id: string }) {
  const map = useConfigurationStore((state) => state.inlineMessages);
  const entry = map[id];
  if (!entry?.text) return null;
  return (
    <span className={`configuration-inline-message${entry.failed ? " is-error" : " is-success"}`} role="status">
      {entry.text}
    </span>
  );
}

export default function ConfigurationPage() {
  const store = useConfigurationStore.getState;
  const original = useConfigurationStore((state) => state.original);
  const message = useConfigurationStore((state) => state.message);
  const messageFailed = useConfigurationStore((state) => state.messageFailed);
  const connections = useConfigurationStore((state) => state.modelConnections);
  const activeId = useConfigurationStore((state) => state.activeModelConnectionId);
  const resumeDraft = useConfigurationStore((state) => state.resumeDraft);
  const [settings, setSettings] = useState<Record<string, string | boolean | number>>({});
  const [keywords, setKeywords] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [assistantMode, setAssistantMode] = useState("auto");
  const [modeEdited, setModeEdited] = useState(false);
  const [mailPassword, setMailPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState("");

  useEffect(() => {
    if (!original) void store().read();
  }, [original]);

  useEffect(() => {
    if (!original) return;
    const next: Record<string, string | boolean | number> = {};
    for (const [key, value] of Object.entries(original.settings)) {
      const control = document.querySelector(`[name="${key}"]`) as HTMLInputElement | null;
      next[key] =
        control?.type === "checkbox"
          ? (original.configured_capabilities?.[key] ?? Boolean(value))
          : (value as string) ?? "";
    }
    for (const key of CAPABILITY_FIELDS) {
      next[key] = (original.configured_capabilities?.[key] ?? original.settings[key]) === true;
    }
    setSettings(next);
    setKeywords((original.profile.matching?.title_keywords ?? []).join("\n"));
    setGroups(original.profile.scope?.industry_groups ?? []);
    setAssistantMode(original.module_readiness?.assistant?.status === "disabled" ? "disabled" : "auto");
    setModeEdited(false);
  }, [original]);

  if (!original) {
    return (
      <section className="view-panel is-visible" data-view-panel="configuration">
        <SectionHeading title="个人配置" description={message || "正在读取配置…"} />
        <Button variant="secondary" onClick={() => void store().read()}>重新读取</Button>
      </section>
    );
  }

  const readiness = original.onboarding;
  const diagnostic = original.module_readiness?.assistant ?? { status: "unknown" };
  const mailConfigured = Boolean(settings.mail_imap_host && settings.mail_imap_username) || Boolean(original.secrets.mail_imap_password);

  const patchConnection = (id: string, patch: Partial<ModelConnection>) =>
    store().modelConnections &&
    useConfigurationStore.setState((state) => ({
      modelConnections: state.modelConnections.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const addConnection = () => {
    const id = `conn-${Date.now()}`;
    useConfigurationStore.setState((state) => ({
      modelConnections: [
        ...state.modelConnections,
        { id, name: "新连接", provider: "deepseek", api_style: MODEL_PRESETS.deepseek.api_style, base_url: MODEL_PRESETS.deepseek.base_url, model: MODEL_PRESETS.deepseek.model, key_configured: false },
      ],
      activeModelConnectionId: state.activeModelConnectionId || id,
    }));
  };

  const submitSave = async (complete: boolean) => {
    if (!splitLines(keywords).length) {
      showToast("请至少填写一个岗位标题关键词。", "error");
      return;
    }
    try {
      const result = await store().saveConfiguration({
        settings: {
          ...settings,
          ...(modeEdited ? { llm_enabled: assistantMode !== "disabled", codex_runtime_enabled: assistantMode !== "disabled" } : {}),
        },
        profile: { ...original.profile, matching: { ...original.profile.matching, title_keywords: splitLines(keywords) }, scope: { industry_groups: groups } },
        ...(mailPassword ? { settings: { ...settings, mail_imap_password: mailPassword } } : {}),
        complete_onboarding: complete,
      });
      await store().read();
      store().setInlineMessage("configuration-save-result", result.message);
      showToast(result.message, "success");
    } catch (error) {
      store().setInlineMessage("configuration-save-result", `保存失败：${(error as Error).message}`, true);
    }
  };

  return (
    <section className="view-panel is-visible" data-view-panel="configuration" aria-labelledby="configuration-heading">
      <SectionHeading
        titleId="configuration-heading"
        title="个人配置"
        actions={<Button variant="secondary" onClick={() => void store().read()}>重新读取</Button>}
      />
      {message ? <div className={messageFailed ? "configuration-error" : "configuration-message"} role="status">{message}</div> : null}

      <section className="configuration-onboarding" aria-label="首次配置" aria-live="polite">
        <h3>{readiness?.ready === true ? "基础配置已就绪" : readiness ? "首次配置尚未完成" : "配置能力状态暂不可用"}</h3>
        <p className="configuration-section-copy">
          首次使用只需完成模型连接、简历事实、岗位筛选关键词和行业范围。招聘邮箱与高级选项可以稍后配置。
        </p>
        <ul>{[...new Set(Object.values(readiness?.messages ?? {}))].map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <div className="configuration-status" aria-label="核心能力状态">
        <div><span>模型与求职助理</span><strong>{ASSISTANT_STATUS_LABELS[String(diagnostic.status)] ?? "状态待检查"}</strong></div>
        <div><span>抓取后评分</span><strong>{original.module_readiness?.job_scoring?.ready ? "已开启" : "未就绪"}</strong></div>
        <div><span>招聘邮箱</span><strong>{mailConfigured ? "已配置" : "可选，未配置"}</strong></div>
      </div>

      <form className="configuration-form" onSubmit={(event) => { event.preventDefault(); void submitSave(false); }}>
        <fieldset>
          <legend>模型连接</legend>
          <div className="configuration-section-heading">
            <p>所有智能功能使用主连接；可以保留备用连接，切换后统一生效。</p>
            <Button variant="secondary" onClick={addConnection}>添加连接</Button>
          </div>
          <div className="model-connection-list">
            {connections.map((connection) => (
              <section key={connection.id} className="model-connection" data-connection-id={connection.id}>
                <div className="model-connection-heading">
                  <label className="model-primary-choice">
                    <input
                      type="radio"
                      name="active-model-connection"
                      checked={connection.id === activeId}
                      onChange={() => useConfigurationStore.setState({ activeModelConnectionId: connection.id })}
                    />
                    设为主连接
                  </label>
                  <label>名称<input value={connection.name} onChange={(e) => patchConnection(connection.id, { name: e.target.value })} /></label>
                  <label>
                    服务商
                    <select
                      value={connection.provider}
                      onChange={(e) => {
                        const provider = e.target.value as ModelProvider;
                        patchConnection(connection.id, { provider, api_style: MODEL_PRESETS[provider].api_style, base_url: connection.base_url || MODEL_PRESETS[provider].base_url });
                      }}
                    >
                      {Object.entries(MODEL_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}                    </select>
                  </label>
                  <label>服务地址<input value={connection.base_url} onChange={(e) => patchConnection(connection.id, { base_url: e.target.value })} /></label>
                  <label>模型名称<input value={connection.model} onChange={(e) => patchConnection(connection.id, { model: e.target.value })} /></label>
                  <label>
                    API 密钥
                    <input type="password" autoComplete="new-password" placeholder={connection.key_configured ? "已配置，留空保留" : ""} value={connection.api_key ?? ""} onChange={(e) => patchConnection(connection.id, { api_key: e.target.value })} />
                  </label>
                </div>
                <div className="configuration-inline-actions">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const result = await store().testModel({ connection_id: connection.id });
                      store().setInlineMessage("model-connection-message", text(result.message, result.ok ? "连接通过" : "连接失败"), !result.ok);
                    }}
                  >
                    测试连接
                  </Button>
                </div>
              </section>
            ))}
          </div>
          <Button variant="primary" onClick={() => void store().saveModelConnections(modeEdited ? { llm_enabled: assistantMode !== "disabled", codex_runtime_enabled: assistantMode !== "disabled" } : {})}>
            保存模型连接
          </Button>
          <InlineMessage id="model-connection-message" />
          <details className="configuration-guide">
            <summary>高级：助理模式</summary>
            <label>
              求职助理
              <select value={assistantMode} onChange={(e) => { setAssistantMode(e.target.value); setModeEdited(true); }}>
                <option value="auto">随有效模型连接启用</option>
                <option value="disabled">保持关闭</option>
              </select>
            </label>
          </details>
          <p className="configuration-hint">连接测试会真实验证鉴权、模型名称、结构化输出和求职助理接口，不会保存尚未提交的密钥。</p>
        </fieldset>

        <fieldset>
          <legend>简历与岗位筛选</legend>
          <p className="configuration-section-copy">上传简历后，模型生成技能、项目摘要和岗位筛选关键词。关键词可自行修改，保存后生效。</p>
          <div className="configuration-grid">
            <label className="configuration-wide">
              上传简历
              <div className="configuration-file-row">
                <input type="file" accept=".pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!file) return showToast("请先选择简历文件。", "error");
                    if (file.size > 10 * 1024 * 1024) return showToast("简历超过 10 MB 上限。", "error");
                    const content = await file.text();
                    try {
                      const result = await store().parseResume({ filename: file.name, content });
                      useConfigurationStore.setState({ resumeDraft: result });
                      if (result.title_keywords?.length) setKeywords(result.title_keywords.join("\n"));
                      if (result.degree) setSettings((prev) => ({ ...prev, degree: result.degree as string }));
                    } catch (error) {
                      showToast(`简历分析失败：${(error as Error).message}`, "error");
                    }
                  }}
                >
                  分析简历
                </Button>
              </div>
              <small>{file ? `已选择：${file.name}` : "支持文字版 PDF、TXT、Markdown，最大 10 MB"}</small>
            </label>
            <label>
              学历
              <select name="degree" value={String(settings.degree ?? "")} onChange={(e) => setSettings((p) => ({ ...p, degree: e.target.value }))}>
                <option value="">尚未填写</option>
                <option value="本科">本科</option>
                <option value="硕士">硕士</option>
                <option value="博士">博士</option>
              </select>
            </label>
            <label className="configuration-wide">
              岗位筛选关键词（必填）
              <textarea rows={5} required value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="上传简历后自动生成；每行一个，可自行增删" />
              <small>填写希望保留的岗位标题词，每行一个；标题不含这些词的岗位不会继续抓取。</small>
            </label>
          </div>
          {resumeDraft ? (
            <section aria-label="简历分析结果">
              <h3>简历分析结果</h3>
              <p className="configuration-hint">以下内容都有简历原文依据。请重点检查岗位筛选关键词，确认后再保存整页配置。</p>
              <div className="configuration-grid">
                <label>学历<input readOnly value={degreeOption(resumeDraft.degree)} /></label>
                <label>已验证技能<textarea rows={4} readOnly value={(resumeDraft.skills ?? []).join("\n")} /></label>
                <label>工程与辅助技能<textarea rows={4} readOnly value={(resumeDraft.stack ?? []).join("\n")} /></label>
                <label className="configuration-wide">项目依据<textarea rows={5} readOnly value={(resumeDraft.projects ?? []).join("\n")} /></label>
              </div>
              <details>
                <summary>查看原文依据</summary>
                <pre>{resumeDraft.evidence ?? "无"}</pre>
              </details>
              {(resumeDraft.warnings ?? []).length ? (
                <ul className="crawl-failure-list">{(resumeDraft.warnings ?? []).map((item) => <li key={item}><strong>{item}</strong></li>)}</ul>
              ) : null}
              <div className="resume-actions">
                <Button variant="primary" onClick={() => void submitSave(false)}>应用分析结果</Button>
                <Button onClick={() => useConfigurationStore.setState({ resumeDraft: null })}>取消</Button>
              </div>
            </section>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>岗位来源范围</legend>
          <div className="configuration-policy"><strong>固定规则</strong><span>仅收集校招正式岗位，默认排除社招、实习和不符合当前学历要求的岗位。</span></div>
          <div>
            <span className="configuration-field-label">OfferBiu 行业大类（必选）</span>
            <p className="configuration-hint">至少选择一个。行业决定从哪些公司寻找岗位，岗位关键词决定继续抓取哪些岗位。</p>
            <div className="configuration-industry-grid">
              {original.options.industry_groups.map((option) => (
                <label key={option.code} className="configuration-choice">
                  <input
                    type="checkbox"
                    checked={groups.includes(option.code)}
                    onChange={(e) => setGroups((prev) => (e.target.checked ? [...prev, option.code] : prev.filter((code) => code !== option.code)))}
                  />
                  {option.label}
                  {option.default ? <small className="muted-label">（默认）</small> : null}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>招聘邮箱（可选）</legend>
          <p className="configuration-section-copy">
            不配置不会影响助理、岗位抓取、评分、投递记录和日程；仅邮件查询与处理不可用。配置成功后，启动时会自动同步。系统不会发送、删除邮件或主动标记为已读。
          </p>
          <div className="configuration-grid">
            <label>
              邮箱服务商
              <select onChange={(e) => { const provider = original.options.mail_providers.find((item) => item.id === e.target.value); if (provider) setSettings((p) => ({ ...p, mail_imap_host: provider.host, mail_imap_port: provider.port })); }}>
                {original.options.mail_providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
              </select>
              <small>选择后自动填写服务器和端口。</small>
            </label>
            <label>邮箱账号<input name="mail_imap_username" autoComplete="username" value={String(settings.mail_imap_username ?? "")} onChange={(e) => setSettings((p) => ({ ...p, mail_imap_username: e.target.value }))} /><small>填写完整邮箱地址。</small></label>
            <label>IMAP 服务器<input name="mail_imap_host" value={String(settings.mail_imap_host ?? "")} onChange={(e) => setSettings((p) => ({ ...p, mail_imap_host: e.target.value }))} /></label>
            <label>SSL 端口<input name="mail_imap_port" type="number" min={1} max={65535} required value={String(settings.mail_imap_port ?? 993)} onChange={(e) => setSettings((p) => ({ ...p, mail_imap_port: Number(e.target.value) }))} /></label>
            <label>
              邮箱授权码
              <input name="mail_imap_password" type="password" autoComplete="new-password" value={mailPassword} onChange={(e) => setMailPassword(e.target.value)} />
              <span>{original.secrets.mail_imap_password ? "已配置，留空保留" : "未配置"}</span>
              <small>请填写授权码或应用专用密码，不是网页登录密码。</small>
            </label>
            <label>邮件文件夹<input name="mail_imap_mailbox" value={String(settings.mail_imap_mailbox ?? "INBOX")} onChange={(e) => setSettings((p) => ({ ...p, mail_imap_mailbox: e.target.value }))} /></label>
          </div>
          <div className="configuration-inline-actions">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const result = await store().testMail({ ...settings, mail_imap_password: mailPassword });
                  store().setInlineMessage("mail-test-result", text(result.message, result.ok ? "连接成功" : "连接失败"), !result.ok);
                  await store().read();
                } catch (error) {
                  store().setInlineMessage("mail-test-result", `测试失败：${(error as Error).message}`, true);
                }
              }}
            >
              测试邮箱连接
            </Button>
            <InlineMessage id="mail-test-result" />
          </div>
        </fieldset>

        <details className="configuration-guide">
          <summary>其他运行选项</summary>
          <div className="configuration-choices">
            {CAPABILITY_FIELDS.map((key) => (
              <label key={key} className="configuration-toggle">
                <input type="checkbox" name={key} checked={Boolean(settings[key])} disabled={assistantMode === "disabled"} onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.checked }))} />
                浏览器截图识别（高级，需启用模型）
              </label>
            ))}
          </div>
          <p className="configuration-hint">普通方式无法读取招聘页面时，允许模型识别用户授权的当前页面截图；可能产生额外模型费用。</p>
        </details>

        <p className="configuration-hint">
          助理使用已保存的模型连接，无需先填写简历或关键词。普通保存不会调用模型、同步邮箱或自动重启；邮箱配置完整时自动启用启动同步，未配置时自动跳过。
        </p>
        <Button variant="primary" type="submit">保存配置</Button>{" "}
        <Button variant="secondary" onClick={() => void submitSave(true)}>保存并完成首次配置</Button>
        <InlineMessage id="configuration-save-result" />
      </form>

      <section className="workspace-section configuration-import">
        <div className="section-heading">
          <h3>投递记录导入</h3>
          <Button
            variant="secondary"
            onClick={() => {
              const csv = "company_name,job_title,stage,record_url,note\n示例科技,后端开发工程师,applied,,示例备注\n";
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = "applications-template.csv";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            下载 CSV 模板
          </Button>
        </div>
        <label>
          CSV / JSON 文件
          <input type="file" accept=".csv,.json" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
        </label>
        <Button
          variant="primary"
          onClick={async () => {
            if (!importFile) return setImportResult("请先选择文件。");
            const content = await importFile.text();
            try {
              const result = await store().importApplications({
                filename: importFile.name,
                format: importFile.name.endsWith(".json") ? "json" : "csv",
                content,
              });
              setImportResult(text(result.message, "导入完成"));
              showToast("投递记录已导入", "success");
            } catch (error) {
              setImportResult(`导入失败：${(error as Error).message}`);
            }
          }}
        >
          导入投递记录
        </Button>
        <p role="status">{importResult}</p>
      </section>
    </section>
  );
}
