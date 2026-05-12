"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project, ProjectTask } from "../../../src/data/dummyProjects";
import ProgressWheel from "../../../src/components/ProgressWheel";
import { ToastContainer, useToast } from "../../../src/components/Toast";
import {
  createComment,
  createTask,
  deleteComment,
  deleteProject,
  deleteTask,
  fetchProject,
  updateComment,
  updateProject,
  updateTask,
} from "../../../src/lib/project-api";
import {
  buildSignaturePayload,
  decryptMessage,
  deriveRatchetMessageKey,
  deriveSharedAesKey,
  encryptMessage,
  generateRuntimeKeyBundle,
  importSigningPublicKeyFromBase64,
  signPayload,
  verifyPayloadSignature,
} from "../../../src/lib/e2ee";
import {
  bootstrapSecureChat,
  fetchEncryptedMessages,
  markReadReceipts,
  postEncryptedMessage,
} from "../../../src/lib/secure-chat-api";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getTaskProgress(task: ProjectTask) {
  return task.completed
    ? 100
    : Math.max(0, Math.min(100, task.progressPercentage));
}

function getWheelProgress(tasks: ProjectTask[]) {
  if (!tasks.length) return 0;
  const total = tasks.reduce(
    (sum, task) => sum + getTaskProgress(task),
    0,
  );
  return Math.round(total / tasks.length);
}

type ChatMessage = {
  id: string;
  sender: "user" | "system";
  text: string;
  timestamp: Date;
  isSignatureValid?: boolean;
  readByCount?: number;
};

type SecureChatContext = {
  username: string;
  conversationId: string;
  senderSigningKeyId: string;
  senderExchangePublicKey: string;
  signingPrivateKey: CryptoKey;
  baseMessageKey: CryptoKey;
  chainIndex: number;
  consumedPreKeyId?: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = params?.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [dropActive, setDropActive] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskAssignedUser, setEditTaskAssignedUser] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [newSpecTask, setNewSpecTask] = useState({
    title: "",
    assignedUser: "",
    dueDate: "",
  });
  const [isAddingTask, setIsAddingTask] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "system",
      text: "Welcome to the project chat! How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatUsername, setChatUsername] = useState("You");
  const [chatPassphrase, setChatPassphrase] = useState("");
  const [isBootstrappingChat, setIsBootstrappingChat] = useState(false);
  const [secureChatError, setSecureChatError] = useState<string | null>(null);
  const [secureChatContext, setSecureChatContext] =
    useState<SecureChatContext | null>(null);

  const tasks = useMemo(() => project?.tasks ?? [], [project]);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks],
  );
  const wheelProgress = useMemo(() => getWheelProgress(tasks), [tasks]);
  const totalCount = tasks.length || 1;
  const dropHintOpacity = clamp01(wheelProgress / 100);

  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.assignedUser)));
  }, [tasks]);

  const displayedTasks = useMemo(() => {
    if (!showMyTasks || !selectedUser) return tasks;
    return tasks.filter((task) => task.assignedUser === selectedUser);
  }, [tasks, showMyTasks, selectedUser]);

  const syncProject = useCallback((nextProject: Project) => {
    setProject(nextProject);
    setProjectError(null);
    setProjectName(nextProject.name);
    setProjectDescription(nextProject.shortDescription);

    if (
      selectedTaskId &&
      !nextProject.tasks.some((task) => task.id === selectedTaskId)
    ) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      try {
        setIsLoadingProject(true);
        setProjectError(null);
        const nextProject = await fetchProject(projectId);

        if (!isMounted) {
          return;
        }

        syncProject(nextProject);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProjectError(
          error instanceof Error ? error.message : "Failed to load project.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingProject(false);
        }
      }
    }

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId, syncProject]);

  async function completeTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.completed) return;

    try {
      const nextProject = await updateTask(taskId, {
        completed: true,
        progressPercentage: 100,
      });
      syncProject(nextProject);
      toast.success(`Task "${task.title}" completed!`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete task.",
      );
    }
  }

  async function handleAddComment(taskId: string, text: string) {
    if (!text.trim()) return;

    try {
      const nextProject = await createComment(taskId, {
        user: "You",
        text,
      });
      syncProject(nextProject);
      setNewComment("");
      toast.success("Comment added!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add comment.",
      );
    }
  }

  async function handleUpdateComment(commentId: string) {
    if (!editingCommentText.trim()) return;

    try {
      const nextProject = await updateComment(commentId, {
        text: editingCommentText,
      });
      syncProject(nextProject);
      setEditingCommentId(null);
      setEditingCommentText("");
      toast.success("Comment updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update comment.",
      );
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const nextProject = await deleteComment(commentId);
      syncProject(nextProject);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentText("");
      }
      toast.success("Comment removed!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete comment.",
      );
    }
  }

  const handleDropOnWheel = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(false);
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    void completeTask(taskId);
    setDraggingTaskId(null);
  };

  const handleDragStartTask = (taskId: string) => (event: React.DragEvent) => {
    setDraggingTaskId(taskId);
    event.dataTransfer.setData("text/plain", taskId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const nextFiles = Array.from(files).map((file) => file.name);
    setUploadedFiles((prev) => [...prev, ...nextFiles]);
    setIsUploading(false);
    toast.success(`${nextFiles.length} file(s) uploaded successfully!`);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const refreshSecureMessages = useCallback(
    async (context: SecureChatContext) => {
      const encryptedRows = await fetchEncryptedMessages(context.conversationId);
      const nextMessages: ChatMessage[] = [];
      const incomingMessageIds: string[] = [];

      for (const row of encryptedRows) {
        const signaturePayload = buildSignaturePayload({
          conversationId: context.conversationId,
          ciphertextB64: row.encryptedContent,
          ivB64: row.iv,
          authTagB64: row.authTag,
          chainIndex: row.chainIndex,
        });
        const senderPublicSigningKey = await importSigningPublicKeyFromBase64(
          row.senderSigningPublicKey,
        );
        const signatureOk = await verifyPayloadSignature(
          signaturePayload,
          row.signature,
          senderPublicSigningKey,
        );

        // Ratchet progression: derive a unique AES key per message index.
        // This demonstrates key evolution instead of a single static chat key.
        const perMessageKey = await deriveRatchetMessageKey(
          context.baseMessageKey,
          row.chainIndex,
        );
        const plainText = await decryptMessage(
          row.encryptedContent,
          row.iv,
          row.authTag,
          perMessageKey,
        );

        const isOwn = row.senderUsername === context.username;
        if (!isOwn) {
          incomingMessageIds.push(row.id);
        }

        nextMessages.push({
          id: row.id,
          sender: isOwn ? "user" : "system",
          text: plainText,
          timestamp: new Date(row.createdAt),
          isSignatureValid: signatureOk,
          readByCount: row.readByCount,
        });
      }

      setChatMessages(nextMessages);

      // Read receipts: acknowledge all received messages for this viewer.
      if (incomingMessageIds.length > 0) {
        await markReadReceipts({
          conversationId: context.conversationId,
          username: context.username,
          messageIds: incomingMessageIds,
        });
      }
    },
    [],
  );

  const initializeSecureChat = useCallback(async () => {
    if (!chatUsername.trim() || !chatPassphrase.trim()) {
      setSecureChatError("Username and passphrase are required.");
      return;
    }

    try {
      setIsBootstrappingChat(true);
      setSecureChatError(null);

      const runtimeBundle = await generateRuntimeKeyBundle(chatPassphrase);
      const bootstrap = await bootstrapSecureChat(
        chatUsername.trim(),
        runtimeBundle.serverPayload,
      );

      // Demo key agreement: derive shared AES key from our own X25519 key pair.
      // In the next phase, replace this with sender<->recipient key agreement using pre-keys.
      const sharedMessageKey = await deriveSharedAesKey(
        runtimeBundle.exchangePrivateKey,
        bootstrap.keyBundle.exchangePublicKey,
      );

      const context: SecureChatContext = {
        username: bootstrap.username,
        conversationId: bootstrap.conversationId,
        senderSigningKeyId: bootstrap.keyBundle.signingKeyId,
        senderExchangePublicKey: bootstrap.keyBundle.exchangePublicKey,
        signingPrivateKey: runtimeBundle.signingPrivateKey,
        baseMessageKey: sharedMessageKey,
        chainIndex: 0,
        consumedPreKeyId: bootstrap.consumedPreKey?.id,
      };

      setSecureChatContext(context);
      await refreshSecureMessages(context);
    } catch (error) {
      setSecureChatError(
        error instanceof Error ? error.message : "Failed to initialize secure chat.",
      );
    } finally {
      setIsBootstrappingChat(false);
    }
  }, [chatPassphrase, chatUsername, refreshSecureMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !secureChatContext) return;

    try {
      const nextChainIndex = secureChatContext.chainIndex + 1;
      const perMessageKey = await deriveRatchetMessageKey(
        secureChatContext.baseMessageKey,
        nextChainIndex,
      );
      const encrypted = await encryptMessage(chatInput.trim(), perMessageKey);
      const signaturePayload = buildSignaturePayload({
        conversationId: secureChatContext.conversationId,
        ciphertextB64: encrypted.ciphertextB64,
        ivB64: encrypted.ivB64,
        authTagB64: encrypted.authTagB64,
        chainIndex: nextChainIndex,
      });
      const signature = await signPayload(
        signaturePayload,
        secureChatContext.signingPrivateKey,
      );

      await postEncryptedMessage({
        conversationId: secureChatContext.conversationId,
        senderUsername: secureChatContext.username,
        encryptedContent: encrypted.ciphertextB64,
        iv: encrypted.ivB64,
        authTag: encrypted.authTagB64,
        signature,
        senderKeyId: secureChatContext.senderSigningKeyId,
        ratchetPublicKey: secureChatContext.senderExchangePublicKey,
        chainIndex: nextChainIndex,
        // TASK 2 DEMO ONLY - plaintext transport to demonstrate message interception when TLS is disabled
        // content: chatInput.trim(),
        // encryptedContent: encrypted.ciphertextB64,
        // iv: encrypted.ivB64,
        // authTag: encrypted.authTagB64,
        // signature,
        // senderKeyId: secureChatContext.senderSigningKeyId,
        // ratchetPublicKey: secureChatContext.senderExchangePublicKey,
        // chainIndex: nextChainIndex,
      });

      setChatInput("");

      const nextContext = { ...secureChatContext, chainIndex: nextChainIndex };
      setSecureChatContext(nextContext);
      await refreshSecureMessages(nextContext);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send encrypted message.",
      );
    }
  };

  useEffect(() => {
    if (!isChatOpen || !secureChatContext) return;
    void refreshSecureMessages(secureChatContext);
  }, [isChatOpen, refreshSecureMessages, secureChatContext]);

  const startEditTask = (task: ProjectTask) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskAssignedUser(task.assignedUser);
    setEditTaskDueDate(task.dueDate);
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editTaskTitle.trim()) return;

    try {
      const nextProject = await updateTask(editingTaskId, {
        title: editTaskTitle,
        assignedUser: editTaskAssignedUser || "Unassigned",
        dueDate: editTaskDueDate || "TBD",
      });
      syncProject(nextProject);
      setEditingTaskId(null);
      setEditTaskTitle("");
      setEditTaskAssignedUser("");
      setEditTaskDueDate("");
      toast.success("Task updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task.",
      );
    }
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskTitle("");
    setEditTaskAssignedUser("");
    setEditTaskDueDate("");
  };

  const deleteSpecTask = async (taskId: string) => {
    try {
      const nextProject = await deleteTask(taskId);
      syncProject(nextProject);
      toast.success("Task removed!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete task.",
      );
    }
  };

  const addSpecTask = async () => {
    if (!project || !newSpecTask.title.trim()) return;

    try {
      const nextProject = await createTask(project.id, {
        title: newSpecTask.title,
        assignedUser: newSpecTask.assignedUser,
        dueDate: newSpecTask.dueDate,
      });
      syncProject(nextProject);
      setNewSpecTask({ title: "", assignedUser: "", dueDate: "" });
      setIsAddingTask(false);
      toast.success("Task added!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add task.",
      );
    }
  };

  const openProjectEditor = () => {
    if (!project) return;
    setProjectName(project.name);
    setProjectDescription(project.shortDescription);
    setIsProjectModalOpen(true);
  };

  const saveProjectDetails = async () => {
    if (!project || !projectName.trim()) return;

    try {
      setIsSavingProject(true);
      const nextProject = await updateProject(project.id, {
        name: projectName,
        shortDescription: projectDescription,
      });
      syncProject(nextProject);
      setIsProjectModalOpen(false);
      toast.success("Project updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update project.",
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    try {
      setIsDeletingProject(true);
      await deleteProject(project.id);
      toast.success("Project deleted!");
      router.push("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project.",
      );
      setIsDeletingProject(false);
    }
  };

  if (isLoadingProject) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-12">
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Loading project</p>
          <p className="mt-2 text-sm text-muted">Pulling the latest tasks and comments...</p>
        </div>
      </main>
    );
  }

  if (projectError) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-12">
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Project unavailable</p>
          <p className="mt-2 text-sm text-muted">{projectError}</p>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-12">
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Project not found</p>
          <p className="mt-2 text-sm text-muted">
            The project you requested does not exist anymore.
          </p>
          <Link href="/" className="btn mt-6 inline-flex">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-8 py-12">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden="true" className="text-muted">
                &larr;
              </span>
              Dashboard
            </Link>
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full bg-[rgba(255,255,255,0.25)]"
            />
            <p className="text-sm font-semibold text-muted">Project</p>
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {project.name}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {project.shortDescription}{" "}
            <span className="font-semibold text-foreground/90">
              {completedCount}/{totalCount}
            </span>{" "}
            tasks complete.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_360px]">
          <aside className="card relative h-fit p-6 lg:sticky lg:top-10">
            <p className="text-xs font-semibold tracking-wide text-muted">ACTIONS</p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                className="btn w-full"
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
              >
                Submit
              </button>
              <button
                className="w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(124,58,237,0.18)]"
                type="button"
                onClick={() => setIsSpecModalOpen(true)}
              >
                Project Spec
              </button>
              <button
                className="w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
                type="button"
                onClick={openProjectEditor}
              >
                Edit Project
              </button>
              <button
                className={`w-full rounded-[12px] border px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)] ${
                  showMyTasks
                    ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)]"
                    : "border-border bg-[rgba(255,255,255,0.03)]"
                }`}
                type="button"
                onClick={() => {
                  if (showMyTasks) {
                    setShowMyTasks(false);
                    setSelectedUser(null);
                  } else {
                    setShowMyTasks(true);
                  }
                }}
              >
                {showMyTasks ? "Show All Tasks" : "My Tasks"}
              </button>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload Material
              </button>
            </div>

            {showMyTasks && (
              <div className="mt-4 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">FILTER BY USER</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uniqueUsers.map((user) => (
                    <button
                      key={user}
                      type="button"
                      onClick={() =>
                        setSelectedUser(selectedUser === user ? null : user)
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        selectedUser === user
                          ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                          : "border-border bg-[rgba(255,255,255,0.03)] text-muted hover:text-foreground"
                      }`}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-xs font-semibold text-muted">STATUS</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted">Tasks</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {showMyTasks ? displayedTasks.length : tasks.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted">Done</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {showMyTasks
                      ? displayedTasks.filter((task) => task.completed).length
                      : completedCount}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleDeleteProject()}
              disabled={isDeletingProject}
              className="mt-6 w-full rounded-[12px] border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-[rgba(239,68,68,0.14)] disabled:cursor-wait disabled:opacity-70"
            >
              {isDeletingProject ? "Deleting..." : "Delete Project"}
            </button>
          </aside>

          <div
            className={`card p-7 transition-transform duration-200 ${
              dropActive ? "scale-[1.01] ring-4 ring-[rgba(96,165,250,0.25)]" : ""
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
              event.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={handleDropOnWheel}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted">
                  OVERVIEW
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  Project progress wheel
                </p>
              </div>
              <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
                {wheelProgress}%
              </span>
            </div>

            <div className="mt-7 grid place-items-center">
              <div className="relative">
                <ProgressWheel value={wheelProgress} tasks={tasks} />
                <div
                  className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200 ${
                    dropActive ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    background: `rgba(96,165,250,${0.08 + 0.12 * dropHintOpacity})`,
                  }}
                />
                <div
                  className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-200 ${
                    dropActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="flex items-center gap-2 rounded-full border border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.10)] px-4 py-2 text-xs font-semibold text-foreground shadow-[0_25px_80px_rgba(96,165,250,0.20)]">
                    Drop to complete
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">Target</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  Hi-fi demo
                </p>
              </div>
              <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">Mode</p>
                <p className="mt-2 text-lg font-semibold text-foreground">Live</p>
              </div>
              <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">Health</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  Stable
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-semibold text-muted">
              Drag a task here to complete it
            </p>
          </div>

          <aside className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted">
                  TASKS
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {showMyTasks && selectedUser
                    ? `${selectedUser}'s tasks`
                    : "Control checklist"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {showMyTasks
                    ? `${displayedTasks.filter((task) => task.completed).length} / ${displayedTasks.length} completed`
                    : `${completedCount} / ${totalCount} completed`}
                </p>
              </div>
              <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
                {wheelProgress}%
              </span>
            </div>

            <div className="mt-6 flex max-h-[540px] flex-col gap-3 overflow-auto pr-1">
              {displayedTasks.length === 0 ? (
                <div className="rounded-[16px] border border-border bg-[rgba(255,255,255,0.03)] p-8 text-center">
                  <p className="text-sm font-semibold text-muted">No tasks found</p>
                  <p className="mt-1 text-xs text-muted">
                    Select a different user or show all tasks
                  </p>
                </div>
              ) : (
                displayedTasks.map((task) => {
                  const progress = Math.round(getTaskProgress(task));
                  const isDragging = draggingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      draggable={!task.completed}
                      onDragStart={
                        task.completed ? undefined : handleDragStartTask(task.id)
                      }
                      onClick={() => {
                        if (draggingTaskId) return;
                        setSelectedTaskId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDropActive(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedTaskId(task.id);
                      }}
                      className={`group rounded-[16px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.30)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)] ${
                        task.completed ? "opacity-80" : ""
                      } ${
                        isDragging
                          ? "cursor-grabbing scale-[1.03] border-[rgba(96,165,250,0.55)] bg-[rgba(96,165,250,0.10)] opacity-60"
                          : task.completed
                            ? "cursor-pointer"
                            : "cursor-grab"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {task.title}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted">
                            {task.assignedUser}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] font-semibold text-muted">
                            {progress}%
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              task.completed
                                ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                                : "border-border bg-[rgba(255,255,255,0.03)] text-muted"
                            }`}
                          >
                            {task.completed ? "Done" : "Active"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-300 ease-out group-hover:from-accent2 group-hover:to-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </section>
      </main>

      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsUploadModalOpen(false)}
        >
          <div
            className="card mx-4 w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Upload Material
                </h2>
                <p className="mt-1 text-sm text-muted">Add files to {project.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <label
                className={`flex h-44 w-full cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed transition-colors ${
                  isUploading
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/50 hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <span className="h-10 w-10 animate-spin rounded-full border-2 border-accent2 border-t-transparent" />
                    <p className="text-sm text-muted">Uploading files...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface2">
                      <svg
                        className="h-7 w-7 text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">
                        Click to upload
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        or drag and drop files here
                      </p>
                    </div>
                  </div>
                )}
              </label>

              {uploadedFiles.length > 0 && (
                <div className="mt-5">
                  <p className="mb-3 text-xs font-semibold tracking-wide text-muted">
                    UPLOADED FILES ({uploadedFiles.length})
                  </p>
                  <div className="max-h-40 space-y-2 overflow-auto">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={`${file}-${index}`}
                        className="flex items-center gap-3 rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3"
                      >
                        <svg
                          className="h-5 w-5 shrink-0 text-accent2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="flex-1 truncate text-sm text-foreground">
                          {file}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedFiles((prev) =>
                              prev.filter((_, idx) => idx !== index),
                            )
                          }
                          className="text-muted transition-colors hover:text-foreground"
                          aria-label="Remove file"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-6">
              <button
                className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedTaskId(null)}
        >
          <div
            className="card mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border p-6">
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-xs font-semibold tracking-wide text-muted">TASK</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  {selectedTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-xs font-semibold text-muted">ASSIGNED TO</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {selectedTask.assignedUser}
                  </p>
                </div>
                <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-xs font-semibold text-muted">DUE DATE</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {selectedTask.dueDate}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted">PROGRESS</p>
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                      selectedTask.completed
                        ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                        : "border-border bg-[rgba(255,255,255,0.03)] text-muted"
                    }`}
                  >
                    {selectedTask.completed ? "Done" : "Active"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                    style={{ width: `${getTaskProgress(selectedTask)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {getTaskProgress(selectedTask)}% complete
                </p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold tracking-wide text-muted">
                  COMMENTS
                </p>
                <div className="mt-3 max-h-[240px] space-y-3 overflow-auto">
                  {selectedTask.comments.length === 0 ? (
                    <div className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-center">
                      <p className="text-sm text-muted">No comments yet</p>
                    </div>
                  ) : (
                    selectedTask.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {comment.user}
                            </p>
                            <p className="text-xs text-muted">
                              {comment.timestamp.toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.text);
                              }}
                              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                              aria-label="Edit comment"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteComment(comment.id)}
                              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400"
                              aria-label="Delete comment"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {editingCommentId === comment.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              className="input min-h-[84px] resize-none py-2 text-sm"
                              value={editingCommentText}
                              onChange={(event) =>
                                setEditingCommentText(event.target.value)
                              }
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText("");
                                }}
                                className="rounded-[10px] border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleUpdateComment(comment.id)}
                                disabled={!editingCommentText.trim()}
                                className="rounded-[10px] border border-accent2/30 bg-accent2/20 px-3 py-1.5 text-xs font-semibold text-accent2 transition-colors hover:bg-accent2/30 disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted">{comment.text}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleAddComment(selectedTask.id, newComment);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddComment(selectedTask.id, newComment)}
                    className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    disabled={!newComment.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-border p-6">
              <button
                type="button"
                onClick={() => void completeTask(selectedTask.id)}
                disabled={selectedTask.completed}
                className={`flex w-full items-center justify-center gap-3 rounded-[12px] border px-4 py-3 text-sm font-semibold transition-colors ${
                  selectedTask.completed
                    ? "cursor-default border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                    : "border-border bg-[rgba(255,255,255,0.03)] text-foreground hover:bg-[rgba(255,255,255,0.06)]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    selectedTask.completed
                      ? "border-accent2 bg-accent2"
                      : "border-muted"
                  }`}
                >
                  {selectedTask.completed && (
                    <svg
                      className="h-3 w-3 text-background"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
                {selectedTask.completed ? "Task Completed" : "Mark Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="Chat"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-5 left-0 z-50 ml-4 flex h-12 w-28 items-center justify-center rounded-r-full rounded-l-none border border-[rgba(96,165,250,0.28)] bg-[rgba(96,165,250,0.10)] px-4 text-sm font-semibold text-foreground shadow-[0_22px_70px_rgba(96,165,250,0.18)] backdrop-blur-sm transition-transform duration-200 ease-out hover:translate-x-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent2" />
        Chat
      </button>

      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() =>
            !isSubmitting && !submitSuccess && setIsSubmitModalOpen(false)
          }
        >
          <div
            className="card mx-4 w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {submitSuccess ? (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(96,165,250,0.12)]">
                  <svg
                    className="h-8 w-8 text-accent2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  Project Submitted!
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Your project has been submitted for review. You will receive
                  feedback within 24-48 hours.
                </p>
                <button
                  className="btn mt-6"
                  type="button"
                  onClick={() => {
                    setIsSubmitModalOpen(false);
                    setSubmitSuccess(false);
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground">
                  Submit Project
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Are you ready to submit this project for review? Make sure all
                  tasks are completed.
                </p>

                <div className="mt-6 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {project.name}
                    </p>
                    <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
                      {wheelProgress}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                      style={{ width: `${wheelProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {completedCount} of {totalCount} tasks completed
                  </p>
                </div>

                {wheelProgress < 100 && (
                  <div className="mt-4 rounded-[14px] border border-[rgba(236,72,153,0.35)] bg-[rgba(236,72,153,0.08)] p-4">
                    <p className="text-sm text-foreground">
                      Warning: Some tasks are incomplete. You can still submit,
                      but the project may require revisions.
                    </p>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Project"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isProjectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !isSavingProject && setIsProjectModalOpen(false)}
        >
          <div
            className="card mx-4 w-full max-w-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border p-6">
              <h2 className="text-xl font-semibold text-foreground">
                Edit Project
              </h2>
              <p className="mt-1 text-sm text-muted">
                Update the project title and description.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="text-xs font-semibold tracking-wide text-muted">
                  PROJECT NAME
                </label>
                <input
                  type="text"
                  className="input mt-2"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold tracking-wide text-muted">
                  DESCRIPTION
                </label>
                <textarea
                  className="input mt-2 min-h-[96px] resize-none"
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-6">
              <button
                className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                disabled={isSavingProject}
              >
                Cancel
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => void saveProjectDetails()}
                disabled={isSavingProject || !projectName.trim()}
              >
                {isSavingProject ? "Saving..." : "Save Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSpecModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setIsSpecModalOpen(false);
            setIsEditingSpec(false);
            setEditingTaskId(null);
            setIsAddingTask(false);
          }}
        >
          <div
            className="card mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Project Specification
                </h2>
                <p className="mt-1 text-sm text-muted">{project.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingSpec(!isEditingSpec)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isEditingSpec
                      ? "border border-accent2/30 bg-accent2/20 text-accent2"
                      : "border border-border bg-[rgba(255,255,255,0.03)] text-muted hover:text-foreground"
                  }`}
                >
                  {isEditingSpec ? "Done Editing" : "Edit Spec"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSpecModalOpen(false);
                    setIsEditingSpec(false);
                    setEditingTaskId(null);
                    setIsAddingTask(false);
                  }}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-auto p-6">
              <div>
                <h3 className="text-sm font-semibold text-muted">DESCRIPTION</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {project.shortDescription}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted">OBJECTIVES</h3>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent2" />
                    Deliver a polished hi-fi prototype ready for stakeholder review
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent2" />
                    Ensure all interactive elements are functional and responsive
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent2" />
                    Maintain visual consistency with the established design system
                  </li>
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted">TASK BREAKDOWN</h3>
                  {isEditingSpec && (
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(true)}
                      className="flex items-center gap-1 rounded-full border border-accent2/30 bg-accent2/10 px-3 py-1 text-xs font-semibold text-accent2 transition-colors hover:bg-accent2/20"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add Task
                    </button>
                  )}
                </div>

                {isAddingTask && (
                  <div className="mt-3 rounded-[12px] border border-accent2/30 bg-accent2/5 p-4">
                    <p className="mb-3 text-xs font-semibold text-accent2">NEW TASK</p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        className="input py-2 text-sm"
                        placeholder="Task title..."
                        value={newSpecTask.title}
                        onChange={(event) =>
                          setNewSpecTask((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          className="input py-2 text-sm"
                          placeholder="Assigned to..."
                          value={newSpecTask.assignedUser}
                          onChange={(event) =>
                            setNewSpecTask((prev) => ({
                              ...prev,
                              assignedUser: event.target.value,
                            }))
                          }
                        />
                        <input
                          type="text"
                          className="input py-2 text-sm"
                          placeholder="Due date..."
                          value={newSpecTask.dueDate}
                          onChange={(event) =>
                            setNewSpecTask((prev) => ({
                              ...prev,
                              dueDate: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingTask(false);
                            setNewSpecTask({
                              title: "",
                              assignedUser: "",
                              dueDate: "",
                            });
                          }}
                          className="rounded-[10px] border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void addSpecTask()}
                          disabled={!newSpecTask.title.trim()}
                          className="rounded-[10px] border border-accent2/30 bg-accent2/20 px-3 py-1.5 text-xs font-semibold text-accent2 transition-colors hover:bg-accent2/30 disabled:opacity-50"
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 max-h-[280px] space-y-2 overflow-auto">
                  {tasks.length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-border bg-[rgba(255,255,255,0.02)] p-6 text-center">
                      <p className="text-sm text-muted">No tasks yet</p>
                      <p className="mt-1 text-xs text-muted">
                        Click &quot;Add Task&quot; to create spec tasks
                      </p>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-3"
                      >
                        {editingTaskId === task.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              className="input py-2 text-sm"
                              value={editTaskTitle}
                              onChange={(event) =>
                                setEditTaskTitle(event.target.value)
                              }
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                className="input py-2 text-sm"
                                value={editTaskAssignedUser}
                                onChange={(event) =>
                                  setEditTaskAssignedUser(event.target.value)
                                }
                              />
                              <input
                                type="text"
                                className="input py-2 text-sm"
                                value={editTaskDueDate}
                                onChange={(event) =>
                                  setEditTaskDueDate(event.target.value)
                                }
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditTask}
                                className="rounded-[10px] border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveEditTask()}
                                disabled={!editTaskTitle.trim()}
                                className="rounded-[10px] border border-accent2/30 bg-accent2/20 px-3 py-1.5 text-xs font-semibold text-accent2 transition-colors hover:bg-accent2/30 disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">
                                {task.title}
                              </p>
                              <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                                <span>{task.assignedUser}</span>
                                <span className="h-1 w-1 rounded-full bg-border" />
                                <span>{task.dueDate}</span>
                                {task.completed && (
                                  <>
                                    <span className="h-1 w-1 rounded-full bg-border" />
                                    <span className="text-accent2">Completed</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isEditingSpec && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditTask(task)}
                                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                                  aria-label="Edit task"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteSpecTask(task.id)}
                                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400"
                                  aria-label="Delete task"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted">TIMELINE</h3>
                <p className="mt-2 text-sm text-foreground">
                  Target completion: 2 weeks from project start
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChatOpen && (
        <div className="fixed bottom-0 left-0 z-50 m-4 w-80 sm:w-96">
          <div className="card flex h-[480px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent2" />
                <p className="font-semibold text-foreground">Project Chat</p>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-4">
              {!secureChatContext && (
                <div className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-3">
                  <p className="text-xs font-semibold text-muted">E2EE SETUP</p>
                  <p className="mt-1 text-xs text-muted">
                    Initialize secure chat keys once per session. Messages are then
                    encrypted before storage.
                  </p>
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      className="input py-2 text-sm"
                      placeholder="Username"
                      value={chatUsername}
                      onChange={(event) => setChatUsername(event.target.value)}
                    />
                    <input
                      type="password"
                      className="input py-2 text-sm"
                      placeholder="Passphrase for private key encryption"
                      value={chatPassphrase}
                      onChange={(event) => setChatPassphrase(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn w-full"
                      onClick={() => void initializeSecureChat()}
                      disabled={isBootstrappingChat}
                    >
                      {isBootstrappingChat ? "Initializing..." : "Initialize Secure Chat"}
                    </button>
                    {secureChatError && (
                      <p className="text-xs text-[#fda4af]">{secureChatError}</p>
                    )}
                  </div>
                </div>
              )}
              {secureChatContext && (
                <div className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-3">
                  <p className="text-xs font-semibold text-muted">E2EE ACTIVE</p>
                  <p className="mt-1 text-xs text-muted">
                    Pre-key consumed: {secureChatContext.consumedPreKeyId ?? "n/a"}.
                    Per-message ratchet keys + signature verification enabled.
                  </p>
                </div>
              )}

              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-[12px] px-3 py-2 text-sm ${
                      message.sender === "user"
                        ? "bg-gradient-to-r from-accent to-accent2 text-background"
                        : "bg-surface2 text-foreground"
                    }`}
                  >
                    {message.text}
                    {message.isSignatureValid === false && (
                      <p className="mt-1 text-[11px] font-semibold text-[#fda4af]">
                        Signature check failed
                      </p>
                    )}
                    {message.sender === "user" && typeof message.readByCount === "number" && (
                      <p className="mt-1 text-[11px] text-background/70">
                        Read by {message.readByCount}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  className="btn px-4"
                  disabled={!chatInput.trim() || !secureChatContext}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );
}
