import { dummyProjects, type Project, type ProjectTask, type TaskComment } from "@/src/data/dummyProjects";
import { createAdminClient } from "@/lib/supabase/admin";

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  short_description: string | null;
  progress_percentage: number | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  progress_percentage: number | null;
  assigned_user: string | null;
  completed: boolean | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
};

type ProjectPayload = {
  name: string;
  shortDescription?: string;
  tasks?: Array<{
    title: string;
    assignedUser?: string;
    dueDate?: string;
  }>;
};

type ProjectUpdatePayload = {
  name?: string;
  shortDescription?: string;
};

type TaskPayload = {
  title: string;
  assignedUser?: string;
  dueDate?: string;
};

type TaskUpdatePayload = {
  title?: string;
  assignedUser?: string;
  dueDate?: string;
  progressPercentage?: number;
  completed?: boolean;
};

type CommentPayload = {
  user: string;
  text: string;
};

type CommentUpdatePayload = {
  text: string;
};

const DEMO_OWNER = {
  username: "mango_demo_owner",
  email: "mango-demo-owner@example.com",
};

const DEMO_PASSWORD_HASH = "demo-password-hash";
const DEMO_PASSWORD_SALT = "demo-password-salt";

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getProjectProgress(tasks: ProjectTask[]) {
  if (!tasks.length) return 0;

  const total = tasks.reduce(
    (sum, task) => sum + clampProgress(task.progressPercentage),
    0,
  );

  return Math.round(total / tasks.length);
}

function buildUserEmail(username: string) {
  return `${slugifyName(username) || "user"}@mango-demo.local`;
}

function buildProject(row: ProjectRow, tasks: ProjectTask[]): Project {
  return {
    id: row.id,
    name: row.name,
    shortDescription: row.short_description ?? "No description provided.",
    progressPercentage: getProjectProgress(tasks),
    tasks,
  };
}

function buildTask(row: TaskRow, comments: TaskComment[]): ProjectTask {
  return {
    id: row.id,
    title: row.title,
    progressPercentage: clampProgress(row.progress_percentage ?? 0),
    assignedUser: row.assigned_user ?? "Unassigned",
    completed: Boolean(row.completed),
    dueDate: row.due_date ?? "TBD",
    comments,
  };
}

function buildComment(row: CommentRow, userMap: Map<string, string>): TaskComment {
  return {
    id: row.id,
    user: userMap.get(row.user_id) ?? "Unknown",
    text: row.content,
    timestamp: new Date(row.created_at),
  };
}

async function ensureUser(username: string, email = buildUserEmail(username)) {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id, username, email")
    .eq("email", email)
    .maybeSingle<UserRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      username,
      email,
      password_hash: DEMO_PASSWORD_HASH,
      password_salt: DEMO_PASSWORD_SALT,
      is_active: true,
      is_email_verified: true,
    })
    .select("id, username, email")
    .single<UserRow>();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

async function ensureSeededData() {
  const supabase = createAdminClient();
  const owner = await ensureUser(DEMO_OWNER.username, DEMO_OWNER.email);

  const { data: existingProjects, error: projectsError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", owner.id)
    .limit(1);

  if (projectsError) {
    throw projectsError;
  }

  if (existingProjects.length > 0) {
    return owner.id;
  }

  const commentAuthors = new Set<string>();
  for (const project of dummyProjects) {
    for (const task of project.tasks) {
      for (const comment of task.comments) {
        commentAuthors.add(comment.user);
      }
    }
  }

  const authorMap = new Map<string, string>();
  for (const author of commentAuthors) {
    const user = await ensureUser(author);
    authorMap.set(author, user.id);
  }

  for (const project of dummyProjects) {
    const { data: insertedProject, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: owner.id,
        name: project.name,
        short_description: project.shortDescription,
      })
      .select("id")
      .single<{ id: string }>();

    if (projectError) {
      throw projectError;
    }

    for (const task of project.tasks) {
      const { data: insertedTask, error: taskError } = await supabase
        .from("project_tasks")
        .insert({
          project_id: insertedProject.id,
          title: task.title,
          progress_percentage: clampProgress(task.progressPercentage),
          assigned_user: task.assignedUser,
          completed: task.completed,
          due_date: task.dueDate,
        })
        .select("id")
        .single<{ id: string }>();

      if (taskError) {
        throw taskError;
      }

      if (task.comments.length === 0) {
        continue;
      }

      const commentRows = task.comments.map((comment) => ({
        task_id: insertedTask.id,
        user_id: authorMap.get(comment.user) ?? owner.id,
        content: comment.text,
        created_at: comment.timestamp.toISOString(),
      }));

      const { error: commentError } = await supabase
        .from("task_comments")
        .insert(commentRows);

      if (commentError) {
        throw commentError;
      }
    }
  }

  return owner.id;
}

async function getUsersByIds(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((user) => [user.id, user.username]));
}

async function getTasksForProjects(projectIds: string[]) {
  if (projectIds.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("id, project_id, title, progress_percentage, assigned_user, completed, due_date, created_at, updated_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TaskRow[];
}

async function getCommentsForTasks(taskIds: string[]) {
  if (taskIds.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, user_id, content, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CommentRow[];
}

async function assembleProjects(projectRows: ProjectRow[]) {
  const tasks = await getTasksForProjects(projectRows.map((project) => project.id));
  const comments = await getCommentsForTasks(tasks.map((task) => task.id));
  const users = await getUsersByIds([...new Set(comments.map((comment) => comment.user_id))]);

  const commentsByTask = new Map<string, TaskComment[]>();
  for (const comment of comments) {
    const entry = commentsByTask.get(comment.task_id) ?? [];
    entry.push(buildComment(comment, users));
    commentsByTask.set(comment.task_id, entry);
  }

  const tasksByProject = new Map<string, ProjectTask[]>();
  for (const task of tasks) {
    const entry = tasksByProject.get(task.project_id) ?? [];
    entry.push(buildTask(task, commentsByTask.get(task.id) ?? []));
    tasksByProject.set(task.project_id, entry);
  }

  return projectRows.map((project) =>
    buildProject(project, tasksByProject.get(project.id) ?? []),
  );
}

export async function listProjects() {
  const ownerId = await ensureSeededData();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, name, short_description, progress_percentage, created_at, updated_at")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return assembleProjects((data ?? []) as ProjectRow[]);
}

export async function getProject(projectId: string) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, name, short_description, progress_percentage, created_at, updated_at")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [project] = await assembleProjects([data]);
  return project;
}

export async function createProject(payload: ProjectPayload) {
  const ownerId = await ensureSeededData();
  const supabase = createAdminClient();

  const { data: insertedProject, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: ownerId,
      name: payload.name.trim(),
      short_description: payload.shortDescription?.trim() || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (projectError) {
    throw projectError;
  }

  const tasks = (payload.tasks ?? []).filter((task) => task.title.trim().length > 0);
  if (tasks.length > 0) {
    const { error: taskError } = await supabase.from("project_tasks").insert(
      tasks.map((task) => ({
        project_id: insertedProject.id,
        title: task.title.trim(),
        assigned_user: task.assignedUser?.trim() || "Unassigned",
        due_date: task.dueDate?.trim() || "TBD",
        progress_percentage: 0,
        completed: false,
      })),
    );

    if (taskError) {
      throw taskError;
    }
  }

  const project = await getProject(insertedProject.id);
  if (!project) {
    throw new Error("Project was created but could not be loaded.");
  }

  return project;
}

export async function updateProject(projectId: string, payload: ProjectUpdatePayload) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const updateValues: Record<string, string | null> = {};

  if (typeof payload.name === "string") {
    updateValues.name = payload.name.trim();
  }

  if (typeof payload.shortDescription === "string") {
    updateValues.short_description = payload.shortDescription.trim() || null;
  }

  const { error } = await supabase
    .from("projects")
    .update(updateValues)
    .eq("id", projectId);

  if (error) {
    throw error;
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new Error("Project could not be loaded after update.");
  }

  return project;
}

export async function deleteProject(projectId: string) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    throw error;
  }
}

export async function createTask(projectId: string, payload: TaskPayload) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("project_tasks")
    .insert({
      project_id: projectId,
      title: payload.title.trim(),
      assigned_user: payload.assignedUser?.trim() || "Unassigned",
      due_date: payload.dueDate?.trim() || "TBD",
      progress_percentage: 0,
      completed: false,
    });

  if (error) {
    throw error;
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new Error("Project could not be loaded after creating task.");
  }

  return project;
}

export async function updateTask(taskId: string, payload: TaskUpdatePayload) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { data: task, error: taskLookupError } = await supabase
    .from("project_tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle<{ project_id: string }>();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!task) {
    throw new Error("Task not found.");
  }

  const updateValues: Record<string, string | number | boolean | null> = {};

  if (typeof payload.title === "string") {
    updateValues.title = payload.title.trim();
  }

  if (typeof payload.assignedUser === "string") {
    updateValues.assigned_user = payload.assignedUser.trim() || "Unassigned";
  }

  if (typeof payload.dueDate === "string") {
    updateValues.due_date = payload.dueDate.trim() || "TBD";
  }

  if (typeof payload.progressPercentage === "number") {
    updateValues.progress_percentage = clampProgress(payload.progressPercentage);
  }

  if (typeof payload.completed === "boolean") {
    updateValues.completed = payload.completed;
    if (payload.completed) {
      updateValues.progress_percentage = 100;
    }
  }

  const { error } = await supabase
    .from("project_tasks")
    .update(updateValues)
    .eq("id", taskId);

  if (error) {
    throw error;
  }

  const project = await getProject(task.project_id);
  if (!project) {
    throw new Error("Project could not be loaded after updating task.");
  }

  return project;
}

export async function deleteTask(taskId: string) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { data: task, error: taskLookupError } = await supabase
    .from("project_tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle<{ project_id: string }>();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!task) {
    throw new Error("Task not found.");
  }

  const { error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    throw error;
  }

  const project = await getProject(task.project_id);
  if (!project) {
    throw new Error("Project could not be loaded after deleting task.");
  }

  return project;
}

export async function createComment(taskId: string, payload: CommentPayload) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { data: task, error: taskLookupError } = await supabase
    .from("project_tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle<{ project_id: string }>();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!task) {
    throw new Error("Task not found.");
  }

  const user = await ensureUser(payload.user.trim() || "You");

  const { error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      user_id: user.id,
      content: payload.text.trim(),
    });

  if (error) {
    throw error;
  }

  const project = await getProject(task.project_id);
  if (!project) {
    throw new Error("Project could not be loaded after creating comment.");
  }

  return project;
}

export async function updateComment(commentId: string, payload: CommentUpdatePayload) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { data: comment, error: commentLookupError } = await supabase
    .from("task_comments")
    .select("task_id")
    .eq("id", commentId)
    .maybeSingle<{ task_id: string }>();

  if (commentLookupError) {
    throw commentLookupError;
  }

  if (!comment) {
    throw new Error("Comment not found.");
  }

  const { data: task, error: taskLookupError } = await supabase
    .from("project_tasks")
    .select("project_id")
    .eq("id", comment.task_id)
    .maybeSingle<{ project_id: string }>();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!task) {
    throw new Error("Task not found.");
  }

  const { error } = await supabase
    .from("task_comments")
    .update({
      content: payload.text.trim(),
    })
    .eq("id", commentId);

  if (error) {
    throw error;
  }

  const project = await getProject(task.project_id);
  if (!project) {
    throw new Error("Project could not be loaded after updating comment.");
  }

  return project;
}

export async function deleteComment(commentId: string) {
  await ensureSeededData();
  const supabase = createAdminClient();

  const { data: comment, error: commentLookupError } = await supabase
    .from("task_comments")
    .select("task_id")
    .eq("id", commentId)
    .maybeSingle<{ task_id: string }>();

  if (commentLookupError) {
    throw commentLookupError;
  }

  if (!comment) {
    throw new Error("Comment not found.");
  }

  const { data: task, error: taskLookupError } = await supabase
    .from("project_tasks")
    .select("project_id")
    .eq("id", comment.task_id)
    .maybeSingle<{ project_id: string }>();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!task) {
    throw new Error("Task not found.");
  }

  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    throw error;
  }

  const project = await getProject(task.project_id);
  if (!project) {
    throw new Error("Project could not be loaded after deleting comment.");
  }

  return project;
}
