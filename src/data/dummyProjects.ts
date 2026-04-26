export type ProjectTask = {
  id: string;
  title: string;
  progressPercentage: number;
  assignedUser: string;
  completed: boolean;
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
      },
      {
        id: "task-layout-structure",
        title: "Dashboard layout grid + spacing",
        progressPercentage: 80,
        assignedUser: "Quinn",
        completed: true,
      },
      {
        id: "task-micro-interactions",
        title: "Micro-interactions and hover states",
        progressPercentage: 45,
        assignedUser: "Amin",
        completed: false,
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
      },
      {
        id: "task-status-panels",
        title: "Latency/output/quality status panels",
        progressPercentage: 60,
        assignedUser: "Tariq",
        completed: false,
      },
      {
        id: "task-live-banners",
        title: "Live indicators + readiness states",
        progressPercentage: 30,
        assignedUser: "Amin",
        completed: false,
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
      },
      {
        id: "task-output-switch",
        title: "Switch output dropdown/button (prototype)",
        progressPercentage: 40,
        assignedUser: "Nina",
        completed: false,
      },
      {
        id: "task-accessibility",
        title: "Accessibility pass (labels, focus rings)",
        progressPercentage: 20,
        assignedUser: "Sam",
        completed: false,
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
      },
      {
        id: "task-card-states",
        title: "Card hover/elevation + subtle borders",
        progressPercentage: 55,
        assignedUser: "Amin",
        completed: false,
      },
      {
        id: "task-empty-states",
        title: "Empty states for future data connections",
        progressPercentage: 35,
        assignedUser: "Quinn",
        completed: false,
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
      },
      {
        id: "task-demo-script",
        title: "Demo script + UI tour sequencing",
        progressPercentage: 80,
        assignedUser: "Sam",
        completed: true,
      },
      {
        id: "task-performance-check",
        title: "Performance sanity check (prototype)",
        progressPercentage: 50,
        assignedUser: "Tariq",
        completed: false,
      },
    ],
  },
];

