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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  cn,
} from "@/lib/utils";
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
  TODO: "text-muted-foreground",
  IN_PROGRESS: "text-primary",
  DONE: "text-success",
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
    const [tRes, pRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/projects"),
    ]);
    if (tRes.ok) {
      const data = await tRes.json();
      setTasks(data.tasks);
    }
    if (pRes.ok) {
      const data = await pRes.json();
      setProjects(data.projects);
    }
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
      <div
        key={t.id}
        className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-shadow hover:shadow-sm"
      >
        <button
          onClick={() =>
            patchTask(t.id, { status: nextTaskStatus(t.status) })
          }
          title={`点击切换为「${
            TASK_STATUS_LABELS[nextTaskStatus(t.status)]
          }」`}
          className="shrink-0"
        >
          <Icon
            className={cn(
              "size-5 transition-colors hover:opacity-70",
              STATUS_COLOR[t.status]
            )}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "truncate font-medium",
                t.status === "DONE" &&
                  "text-muted-foreground line-through decoration-muted-foreground/40"
              )}
            >
              {t.title}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px]",
                t.priority === "HIGH"
                  ? "bg-destructive/10 text-destructive"
                  : t.priority === "MID"
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {PRIORITY_LABELS[t.priority]}
            </span>
            {t.repeatRule && (
              <span className="flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">
                <Repeat2 className="size-3" />
                {REPEAT_LABELS[t.repeatRule]}
              </span>
            )}
            {t.project && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: `${t.project.color}22`,
                  color: t.project.color,
                }}
              >
                {t.project.name}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {t.dueDate && (
              <span className={cn(overdue && "font-medium text-destructive")}>
                {overdue ? "已逾期 · " : "截止 "}
                {t.dueDate.slice(5, 10).replace("-", "/")}
              </span>
            )}
            {isFocusToday && (
              <span className="flex items-center gap-1 text-primary">
                <Star className="size-3 fill-primary" />
                今日焦点
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            title={isFocusToday ? "取消今日焦点" : "设为今日焦点"}
            onClick={() => patchTask(t.id, { focusDate: "toggle" })}
          >
            <Star
              className={cn("size-4", isFocusToday && "fill-primary text-primary")}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-destructive"
            onClick={() => removeTask(t.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          {(["ALL", ...TASK_STATUS_ORDER] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "ALL" ? "全部" : TASK_STATUS_LABELS[s]}
              {s !== "ALL" && (
                <span className="ml-1 opacity-70">
                  {grouped.get(s)?.length ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-8 w-auto min-w-32 text-xs"
        >
          <option value="">全部项目</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索任务…"
            className="h-8 w-44 pl-7 text-xs"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setProjectsOpen(true)}>
            <FolderKanban className="size-4" />
            管理项目
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            新建任务
          </Button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          加载中…
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
          <Circle className="size-6" />
          <p className="text-sm">暂无任务，点击右上角「新建任务」开始</p>
        </div>
      ) : statusFilter === "ALL" ? (
        <div className="space-y-5">
          {TASK_STATUS_ORDER.map((s) => {
            const list = grouped.get(s)!;
            if (!list.length) return null;
            return (
              <section key={s}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {TASK_STATUS_LABELS[s]}
                  <span className="rounded-full bg-muted px-1.5 text-[10px]">
                    {list.length}
                  </span>
                </h3>
                <div className="space-y-2">{list.map(renderCard)}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">{visibleTasks.map(renderCard)}</div>
      )}

      {/* 新建/编辑对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "编辑任务" : "新建任务"}
        wide
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={submitForm} disabled={saving || !form.title.trim()}>
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
  const [color, setColor] = useState("#6366f1");
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
    <Dialog open={open} onClose={onClose} title="项目管理" wide>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
            aria-label="项目颜色"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新项目名称…"
            onKeyDown={(e) => e.key === "Enter" && addProject()}
          />
          <Button onClick={addProject} disabled={busy || !name.trim()}>
            <Plus className="size-4" />
            添加
          </Button>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-lg border">
          {projects.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              还没有项目。项目用于给任务分组归类，报表会按项目统计工时占比。
            </p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-medium",
                  p.archived && "text-muted-foreground line-through"
                )}
              >
                {p.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patchProject(p.id, { archived: !p.archived })}
              >
                {p.archived ? "恢复" : "归档"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
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
