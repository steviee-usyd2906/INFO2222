import type { Project } from "@/src/data/dummyProjects";

type JsonResponse<T> = T & {
  error?: string;
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as JsonResponse<T>;

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export async function fetchProjects() {
  const data = await requestJson<{ projects: Project[] }>("/api/projects");
  return data.projects;
}

export async function fetchProject(projectId: string) {
  const data = await requestJson<{ project: Project }>(`/api/projects/${projectId}`);
  return data.project;
}

export async function createProject(payload: {
  name: string;
  shortDescription: string;
  tasks: Array<{ title: string; assignedUser: string; dueDate: string }>;
}) {
  const data = await requestJson<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.project;
}

export async function updateProject(
  projectId: string,
  payload: { name?: string; shortDescription?: string },
) {
  const data = await requestJson<{ project: Project }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.project;
}

export async function deleteProject(projectId: string) {
  await requestJson<{ success: boolean }>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function createTask(
  projectId: string,
  payload: { title: string; assignedUser: string; dueDate: string },
) {
  const data = await requestJson<{ project: Project }>(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.project;
}

export async function updateTask(
  taskId: string,
  payload: {
    title?: string;
    assignedUser?: string;
    dueDate?: string;
    progressPercentage?: number;
    completed?: boolean;
  },
) {
  const data = await requestJson<{ project: Project }>(`/api/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.project;
}

export async function deleteTask(taskId: string) {
  const data = await requestJson<{ project: Project }>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });

  return data.project;
}

export async function createComment(
  taskId: string,
  payload: { user: string; text: string },
) {
  const data = await requestJson<{ project: Project }>(`/api/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.project;
}

export async function updateComment(
  commentId: string,
  payload: { text: string },
) {
  const data = await requestJson<{ project: Project }>(`/api/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.project;
}

export async function deleteComment(commentId: string) {
  const data = await requestJson<{ project: Project }>(`/api/comments/${commentId}`, {
    method: "DELETE",
  });

  return data.project;
}
