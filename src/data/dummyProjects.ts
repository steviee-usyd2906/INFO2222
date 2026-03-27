export type TaskComment = {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
};

export type ProjectTask = {
  id: string;
  title: string;
  progressPercentage: number;
  assignedUser: string;
  completed: boolean;
  dueDate: string;
  comments: TaskComment[];
};

export type Project = {
  id: string;
  name: string;
  shortDescription: string;
  progressPercentage: number;
  tasks: ProjectTask[];
};

export const dummyProjects: Project[] = [
  {
    id: "proj-neon-mango",
    name: "Neon Mango",
    shortDescription: "Dashboard skin + interaction polish for the hi-fi prototype.",
    progressPercentage: 72,
    tasks: [
      {
        id: "task-theme-tokens",
        title: "Design tokens (colors, radius, shadows)",
        progressPercentage: 90,
        assignedUser: "Nina",
        completed: true,
        dueDate: "15th Nov",
        comments: [
          { id: "c1", user: "Quinn", text: "Great work on the color palette!", timestamp: new Date("2024-11-10") },
          { id: "c2", user: "Amin", text: "The shadows look perfect.", timestamp: new Date("2024-11-12") },
        ],
      },
      {
        id: "task-layout-structure",
        title: "Dashboard layout grid + spacing",
        progressPercentage: 80,
        assignedUser: "Quinn",
        completed: true,
        dueDate: "18th Nov",
        comments: [
          { id: "c3", user: "Nina", text: "Nice grid system!", timestamp: new Date("2024-11-15") },
        ],
      },
      {
        id: "task-micro-interactions",
        title: "Micro-interactions and hover states",
        progressPercentage: 45,
        assignedUser: "Amin",
        completed: false,
        dueDate: "22nd Nov",
        comments: [
          { id: "c4", user: "Quinn", text: "Looking forward to seeing the animations.", timestamp: new Date("2024-11-14") },
          { id: "c5", user: "Nina", text: "Let me know if you need help with timing.", timestamp: new Date("2024-11-16") },
        ],
      },
    ],
  },
  {
    id: "proj-signal-path",
    name: "Signal Path",
    shortDescription: "Playback UI wiring for frequency response + status panels.",
    progressPercentage: 58,
    tasks: [
      {
        id: "task-freq-placeholder",
        title: "Frequency response placeholder visualization",
        progressPercentage: 100,
        assignedUser: "Sam",
        completed: true,
        dueDate: "10th Nov",
        comments: [
          { id: "c6", user: "Tariq", text: "The visualization looks amazing!", timestamp: new Date("2024-11-08") },
        ],
      },
      {
        id: "task-status-panels",
        title: "Latency/output/quality status panels",
        progressPercentage: 60,
        assignedUser: "Tariq",
        completed: false,
        dueDate: "20th Nov",
        comments: [
          { id: "c7", user: "Sam", text: "Need help with the quality metrics?", timestamp: new Date("2024-11-12") },
        ],
      },
      {
        id: "task-live-banners",
        title: "Live indicators + readiness states",
        progressPercentage: 30,
        assignedUser: "Amin",
        completed: false,
        dueDate: "25th Nov",
        comments: [],
      },
    ],
  },
  {
    id: "proj-device-control",
    name: "Device Control",
    shortDescription: "Prototype controls for connecting and switching outputs.",
    progressPercentage: 41,
    tasks: [
      {
        id: "task-connect-flow",
        title: "Connect button + fake connection state",
        progressPercentage: 70,
        assignedUser: "Quinn",
        completed: true,
        dueDate: "12th Nov",
        comments: [
          { id: "c8", user: "Nina", text: "Great job on the connection flow!", timestamp: new Date("2024-11-10") },
        ],
      },
      {
        id: "task-output-switch",
        title: "Switch output dropdown/button (prototype)",
        progressPercentage: 40,
        assignedUser: "Nina",
        completed: false,
        dueDate: "19th Nov",
        comments: [
          { id: "c9", user: "Quinn", text: "Let me know if you need the connection API.", timestamp: new Date("2024-11-14") },
        ],
      },
      {
        id: "task-accessibility",
        title: "Accessibility pass (labels, focus rings)",
        progressPercentage: 20,
        assignedUser: "Sam",
        completed: false,
        dueDate: "28th Nov",
        comments: [
          { id: "c10", user: "Tariq", text: "Remember to test with screen readers.", timestamp: new Date("2024-11-13") },
        ],
      },
    ],
  },
  {
    id: "proj-ux-polish",
    name: "UX Polish",
    shortDescription: "Refine typography, empty states, and card behaviors.",
    progressPercentage: 63,
    tasks: [
      {
        id: "task-typography-scale",
        title: "Typography scale + muted text styles",
        progressPercentage: 85,
        assignedUser: "Tariq",
        completed: true,
        dueDate: "8th Nov",
        comments: [
          { id: "c11", user: "Nina", text: "The type scale is perfect!", timestamp: new Date("2024-11-06") },
        ],
      },
      {
        id: "task-card-states",
        title: "Card hover/elevation + subtle borders",
        progressPercentage: 55,
        assignedUser: "Amin",
        completed: false,
        dueDate: "21st Nov",
        comments: [
          { id: "c12", user: "Tariq", text: "Consider adding a slight glow on hover.", timestamp: new Date("2024-11-15") },
        ],
      },
      {
        id: "task-empty-states",
        title: "Empty states for future data connections",
        progressPercentage: 35,
        assignedUser: "Quinn",
        completed: false,
        dueDate: "26th Nov",
        comments: [],
      },
    ],
  },
  {
    id: "proj-release-mock",
    name: "Release Mock",
    shortDescription: "Prepare a demo-ready prototype with realistic sample content.",
    progressPercentage: 84,
    tasks: [
      {
        id: "task-sample-content",
        title: "Sample projects/tracks content",
        progressPercentage: 100,
        assignedUser: "Nina",
        completed: true,
        dueDate: "5th Nov",
        comments: [
          { id: "c13", user: "Sam", text: "Content looks great!", timestamp: new Date("2024-11-04") },
          { id: "c14", user: "Amin", text: "Love the sample tracks.", timestamp: new Date("2024-11-05") },
        ],
      },
      {
        id: "task-demo-script",
        title: "Demo script + UI tour sequencing",
        progressPercentage: 80,
        assignedUser: "Sam",
        completed: true,
        dueDate: "14th Nov",
        comments: [
          { id: "c15", user: "Nina", text: "Nice flow on the tour!", timestamp: new Date("2024-11-12") },
        ],
      },
      {
        id: "task-performance-check",
        title: "Performance sanity check (prototype)",
        progressPercentage: 50,
        assignedUser: "Tariq",
        completed: false,
        dueDate: "30th Nov",
        comments: [
          { id: "c16", user: "Quinn", text: "Let me know if you find any bottlenecks.", timestamp: new Date("2024-11-18") },
        ],
      },
    ],
  },
];

