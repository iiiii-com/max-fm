"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Star,
  Pencil,
  Trash2,
  Search,
  FolderKanban,
  Repeat2,
  Circle,
  CircleDot,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, Loading } from "@/components/ui/feedback";
import { SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  nextTaskStatus,
  PRIORITY_LABELS,
  REPEAT_LABELS,
  REPEAT_RULES,
} from "@/lib/labels";
import { todayYmd } from "@/lib/date";
import type { ClientProject, ClientTask } from "@/lib/types";
import type { Priority, RepeatRule, TaskStatus } from "@prisma/client";

type StatusFilter = "ALL" | TaskStatus;

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  TODO: Circle,
  IN_PROGRESS: CircleDot,
  DONE: CheckCircle2,
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "text-subtle-foreground",
  IN_PROGRESS: "text-primary",
  DONE: "text-success",
};

const PRIORITY_TONE: Record<Priority, "destructive" | "warning" | "neutral"> = {
  HIGH: "destructive",
  MID: "warning",
  LOW: "neutral",
};

interface TaskFormState {
  title: string;
  description: string;
  projectId: string;
  priority: Priority;
  dueDate: string;
  repeatRule: "" | RepeatRule;
}

const EMPTY_FORM: TaskFormState = {
  title: "",
  description: "",
  projectId: "",
  priority: "MID",
  dueDate: "",
  repeatRule: "",
};

export function TasksView() {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [q, setQ] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientTask | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [projectsOpen, setProjectsOpen] = useState(false);

  async function loadAll() {
    const [t, p] = await Promise.all([
      apiGet<{ tasks: ClientTask[] }>("/api/tasks"),
      apiGet<{ projects: ClientProject[] }>("/api/projects"),
    ]);
    if (t) setTasks(t.tasks);
    if (p) setProjects(p.projects);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (
        projectFilter === "__none__"
          ? t.projectId !== null
          : projectFilter && t.projectId !== projectFilter
      )
        return false;
      if (q && !t.title.includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, projectFilter, q]);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, ClientTask[]>();
    for (const s of TASK_STATUS_ORDER) map.set(s, []);
    for (const t of visibleTasks) map.get(t.status)!.push(t);
    // 组内排序：高优先级 > 有截止日期早的在前
    const prioWeight: Record<Priority, number> = { HIGH: 0, MID: 1, LOW: 2 };
    for (const s of TASK_STATUS_ORDER) {
      map.get(s)!.sort((a, b) => {
        const d =
          prioWeight[a.priority] - prioWeight[b.priority] ||
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        return d;
      });
    }
    return map;
  }, [visibleTasks]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(t: ClientTask) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      projectId: t.projectId ?? "",
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      repeatRule: "",
    });
    setDialogOpen(true);
  }

  async function submitForm() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        projectId: form.projectId || null,
        priority: form.priority,
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        ...(!editing && form.repeatRule ? { repeatRule: form.repeatRule } : {}),
      };
      const res = await fetch(
        editing ? `/api/tasks/${editing.id}` : "/api/tasks",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "保存失败");
        return;
      }
      setDialogOpen(false);
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
    }
  }

  async function removeTask(id: string) {
    if (!confirm("确定删除这个任务吗？")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const today = todayYmd();
  const activeProjects = projects.filter((p) => !p.archived);

  const renderCard = (t: ClientTask) => {
    const Icon = STATUS_ICON[t.status];
    const overdue =
      !!t.dueDate &&
      t.status !== "DONE" &&
      t.dueDate.slice(0, 10) < today;
    const isFocusToday =
      !!t.focusDate && t.focusDate.slice(0, 10) === today;
    return (
      <li
        key={t.id}
        className={cn(
          "group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-all duration-150",
          "hover:border-border-strong hover:shadow-float",
          t.status === "DONE" && "opacity-70"
        )}
      >
        <button
          onClick={() =>
            patchTask(t.id, { status: nextTaskStatus(t.status) })
          }
          title={`点击切换为「${
            TASK_STATUS_LABELS[nextTaskStatus(t.status)]
          }」`}
          aria-label={`切换状态，当前${TASK_STATUS_LABELS[t.status]}`}
          className="mt-px shrink-0 rounded transition-transform duration-150 hover:scale-110"
        >
          <Icon
            className={cn("size-[18px] transition-colors", STATUS_COLOR[t.status])}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-[13px] font-medium",
                t.status === "DONE" &&
                  "text-muted-foreground line-through decoration-muted-foreground/40"
              )}
            >
              {t.title}
            </span>
            <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>
            {t.repeatRule && (
              <Badge tone="outline">
                <Repeat2 className="size-2.5" />
                {REPEAT_LABELS[t.repeatRule]}
              </Badge>
            )}
            {t.project && (
              <span
                className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium"
                style={{
                  backgroundColor: `${t.project.color}1f`,
                  color: t.project.color,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: t.project.color }}
                />
                {t.project.name}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-subtle-foreground">
            {t.dueDate && (
              <span
                className={cn(
                  "tabular",
                  overdue && "font-medium text-destructive"
                )}
              >
                {overdue ? "已逾期 · " : "截止 "}
                {t.dueDate.slice(5, 10).replace("-", "/")}
              </span>
            )}
            {isFocusToday && (
              <span className="flex items-center gap-1 font-medium text-primary">
                <Star className="size-2.5 fill-primary" />
                今日焦点
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            title={isFocusToday ? "取消今日焦点" : "设为今日焦点"}
            onClick={() => patchTask(t.id, { focusDate: "toggle" })}
            className={isFocusToday ? "text-primary" : undefined}
          >
            <Star
              className={cn("size-3.5", isFocusToday && "fill-primary")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="编辑"
            onClick={() => openEdit(t)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="删除"
            className="hover:text-destructive"
            onClick={() => removeTask(t.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          items={[
            { value: "ALL" as StatusFilter, label: "全部", count: visibleTasks.length },
            ...TASK_STATUS_ORDER.map((s) => ({
              value: s as StatusFilter,
              label: TASK_STATUS_LABELS[s],
              count: grouped.get(s)?.length ?? 0,
            })),
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />

        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-7 w-auto min-w-28 text-xs"
        >
          <option value="">全部项目</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索任务…"
            aria-label="搜索任务"
            className="h-7 w-44 pl-8 text-xs"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProjectsOpen(true)}
          >
            <FolderKanban />
            管理项目
          </Button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus />
            新建任务
          </Button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <Loading label="正在加载任务" />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo />}
          title="没有匹配的任务"
          description="换个筛选条件，或点击右上角「新建任务」创建一条。"
          action={
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus />
              新建任务
            </Button>
          }
        />
      ) : statusFilter === "ALL" ? (
        <div className="space-y-6">
          {TASK_STATUS_ORDER.map((s) => {
            const list = grouped.get(s)!;
            if (!list.length) return null;
            return (
              <section key={s}>
                <div className="mb-2 flex items-center gap-2">
                  <SectionLabel>{TASK_STATUS_LABELS[s]}</SectionLabel>
                  <span className="tabular text-[10.5px] text-subtle-foreground">
                    {list.length}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <ul className="space-y-1.5">{list.map(renderCard)}</ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-1.5">{visibleTasks.map(renderCard)}</ul>
      )}

      {/* 新建/编辑对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "编辑任务" : "新建任务"}
        size="lg"
      >
        <div className="space-y-4">
          <Field label="标题">
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="要做什么？"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitForm();
                }
              }}
            />
          </Field>
          <Field label="描述（可选）">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="补充说明…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="项目">
              <Select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              >
                <option value="">无项目</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="优先级">
              <Select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as Priority })
                }
              >
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="截止日期">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
            {!editing && (
              <Field label="重复规则">
                <Select
                  value={form.repeatRule}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      repeatRule: e.target.value as TaskFormState["repeatRule"],
                    })
                  }
                >
                  <option value="">不重复</option>
                  {REPEAT_RULES.map((r) => (
                    <option key={r} value={r}>
                      {REPEAT_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={submitForm} disabled={saving || !form.title.trim()}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ProjectManagerDialog
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        projects={projects}
        onChanged={loadAll}
      />
    </div>
  );
}

function ProjectManagerDialog({
  open,
  onClose,
  projects,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  projects: ClientProject[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0e7490");
  const [busy, setBusy] = useState(false);

  async function addProject() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        setName("");
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "创建失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchProject(
    id: string,
    patch: Record<string, unknown>
  ) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) onChanged();
  }

  async function removeProject(p: ClientProject) {
    if (
      !confirm(
        `删除项目「${p.name}」？其下任务不会被删除，将变为“无项目”。`
      )
    )
      return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="项目管理"
      description="项目用于给任务分组归类，报表会按项目统计工时占比"
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded-md border border-input"
            aria-label="项目颜色"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新项目名称…"
            onKeyDown={(e) => e.key === "Enter" && addProject()}
          />
          <Button variant="primary" onClick={addProject} disabled={busy || !name.trim()}>
            <Plus />
            添加
          </Button>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-lg border">
          {projects.length === 0 && (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              还没有项目
            </p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-subtle"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px] font-medium",
                  p.archived && "text-muted-foreground line-through"
                )}
              >
                {p.name}
              </span>
              {p.archived && <Badge tone="neutral">已归档</Badge>}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => patchProject(p.id, { archived: !p.archived })}
              >
                {p.archived ? "恢复" : "归档"}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="hover:text-destructive"
                onClick={() => removeProject(p)}
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
