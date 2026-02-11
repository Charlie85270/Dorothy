import { create } from 'zustand';
import type { Agent, Task, Project, Skill, Entity, Chat, DashboardStats } from '@/types';

// Sample data generators
const generateId = () => Math.random().toString(36).substring(2, 15);

const sampleSkills: Skill[] = [
  { id: '1', name: 'Code Review', description: 'Analyze code for bugs, security issues, and improvements', icon: 'code', category: 'code', enabled: true },
  { id: '2', name: 'Frontend Design', description: 'Create beautiful, responsive user interfaces', icon: 'palette', category: 'design', enabled: true },
  { id: '3', name: 'Database Optimization', description: 'Optimize queries and database schemas', icon: 'database', category: 'data', enabled: true },
  { id: '4', name: 'API Development', description: 'Design and implement RESTful APIs', icon: 'server', category: 'code', enabled: true },
  { id: '5', name: 'Testing', description: 'Write unit, integration, and e2e tests', icon: 'flask-conical', category: 'code', enabled: true },
  { id: '6', name: 'CI/CD Pipeline', description: 'Setup and manage deployment pipelines', icon: 'git-branch', category: 'devops', enabled: true },
  { id: '7', name: 'Documentation', description: 'Write technical documentation and guides', icon: 'file-text', category: 'general', enabled: true },
  { id: '8', name: 'Refactoring', description: 'Improve code structure without changing behavior', icon: 'refresh-cw', category: 'code', enabled: true },
];

const sampleAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Alpha',
    status: 'running',
    model: 'opus',
    currentTask: 'task-1',
    assignedProject: 'proj-1',
    skills: ['1', '2', '4'],
    tokensUsed: 125000,
    tasksCompleted: 12,
    createdAt: new Date('2025-01-20'),
    lastActive: new Date(),
    logs: [
      { id: 'log-1', timestamp: new Date(), type: 'info', message: 'Starting task: Implement user authentication' },
      { id: 'log-2', timestamp: new Date(), type: 'success', message: 'Created auth middleware' },
      { id: 'log-3', timestamp: new Date(), type: 'info', message: 'Reading existing user model...' },
    ]
  },
  {
    id: 'agent-2',
    name: 'Beta',
    status: 'idle',
    model: 'sonnet',
    currentTask: null,
    assignedProject: 'proj-1',
    skills: ['3', '5', '6'],
    tokensUsed: 89000,
    tasksCompleted: 8,
    createdAt: new Date('2025-01-21'),
    lastActive: new Date(Date.now() - 3600000),
    logs: []
  },
  {
    id: 'agent-3',
    name: 'Gamma',
    status: 'running',
    model: 'sonnet',
    currentTask: 'task-3',
    assignedProject: 'proj-2',
    skills: ['2', '7', '8'],
    tokensUsed: 45000,
    tasksCompleted: 5,
    createdAt: new Date('2025-01-22'),
    lastActive: new Date(),
    logs: [
      { id: 'log-4', timestamp: new Date(), type: 'info', message: 'Analyzing component structure...' },
    ]
  },
  {
    id: 'agent-4',
    name: 'Delta',
    status: 'paused',
    model: 'haiku',
    currentTask: 'task-4',
    assignedProject: 'proj-2',
    skills: ['1', '5'],
    tokensUsed: 23000,
    tasksCompleted: 15,
    createdAt: new Date('2025-01-22'),
    lastActive: new Date(Date.now() - 1800000),
    logs: []
  },
];

const sampleProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-Commerce Platform',
    description: 'Full-stack e-commerce application with React and Node.js',
    path: '/Users/dev/projects/ecommerce',
    status: 'active',
    agents: ['agent-1', 'agent-2'],
    tasks: ['task-1', 'task-2'],
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date(),
    color: '#3D9B94'
  },
  {
    id: 'proj-2',
    name: 'Dashboard Analytics',
    description: 'Real-time analytics dashboard with data visualization',
    path: '/Users/dev/projects/analytics',
    status: 'active',
    agents: ['agent-3', 'agent-4'],
    tasks: ['task-3', 'task-4'],
    createdAt: new Date('2025-01-18'),
    updatedAt: new Date(),
    color: '#a78bfa'
  },
  {
    id: 'proj-3',
    name: 'Mobile API',
    description: 'RESTful API for mobile applications',
    path: '/Users/dev/projects/mobile-api',
    status: 'paused',
    agents: [],
    tasks: [],
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-20'),
    color: '#4ade80'
  },
];

const sampleTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication with login, register, and password reset',
    status: 'in_progress',
    progress: 65,
    assignedAgent: 'agent-1',
    projectId: 'proj-1',
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date(),
    subtasks: [
      { id: 'st-1', title: 'Create user model', completed: true },
      { id: 'st-2', title: 'Implement JWT middleware', completed: true },
      { id: 'st-3', title: 'Build login endpoint', completed: true },
      { id: 'st-4', title: 'Build register endpoint', completed: false },
      { id: 'st-5', title: 'Add password reset flow', completed: false },
    ]
  },
  {
    id: 'task-2',
    title: 'Setup database migrations',
    description: 'Configure database migrations for PostgreSQL',
    status: 'pending',
    progress: 0,
    assignedAgent: null,
    projectId: 'proj-1',
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date(),
    subtasks: []
  },
  {
    id: 'task-3',
    title: 'Build chart components',
    description: 'Create reusable chart components for the dashboard',
    status: 'in_progress',
    progress: 40,
    assignedAgent: 'agent-3',
    projectId: 'proj-2',
    createdAt: new Date('2025-01-21'),
    updatedAt: new Date(),
    subtasks: [
      { id: 'st-6', title: 'Line chart component', completed: true },
      { id: 'st-7', title: 'Bar chart component', completed: true },
      { id: 'st-8', title: 'Pie chart component', completed: false },
      { id: 'st-9', title: 'Area chart component', completed: false },
    ]
  },
  {
    id: 'task-4',
    title: 'Write unit tests',
    description: 'Add comprehensive unit tests for utility functions',
    status: 'in_progress',
    progress: 25,
    assignedAgent: 'agent-4',
    projectId: 'proj-2',
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date(),
    subtasks: []
  },
];

const sampleEntities: Entity[] = [
  { id: 'ent-1', name: 'UserModel', type: 'class', path: '/src/models/User.ts', projectId: 'proj-1', references: 15, lastModified: new Date() },
  { id: 'ent-2', name: 'authMiddleware', type: 'function', path: '/src/middleware/auth.ts', projectId: 'proj-1', references: 8, lastModified: new Date() },
  { id: 'ent-3', name: 'ChartWrapper', type: 'class', path: '/src/components/ChartWrapper.tsx', projectId: 'proj-2', references: 12, lastModified: new Date() },
  { id: 'ent-4', name: 'formatDate', type: 'function', path: '/src/utils/date.ts', projectId: 'proj-2', references: 23, lastModified: new Date() },
];

const sampleChats: Chat[] = [
  {
    id: 'chat-1',
    title: 'Auth Implementation Discussion',
    projectId: 'proj-1',
    agentId: 'agent-1',
    messages: [
      { id: 'msg-1', role: 'user', content: 'Can you implement JWT authentication for this project?', timestamp: new Date(Date.now() - 3600000) },
      { id: 'msg-2', role: 'assistant', content: 'I\'ll implement JWT authentication. Let me first analyze the existing codebase and then create the necessary components.', timestamp: new Date(Date.now() - 3500000) },
      { id: 'msg-3', role: 'assistant', content: 'I\'ve created the auth middleware. Now working on the login endpoint.', timestamp: new Date(Date.now() - 1800000) },
    ],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
  },
];

interface AppState {
  // Data
  agents: Agent[];
  tasks: Task[];
  projects: Project[];
  skills: Skill[];
  entities: Entity[];
  chats: Chat[];

  // UI State
  selectedProject: string | null;
  selectedAgent: string | null;
  selectedChat: string | null;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;

  // Actions - Agents
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'lastActive' | 'logs' | 'tokensUsed' | 'tasksCompleted'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  assignAgentToProject: (agentId: string, projectId: string | null) => void;
  assignSkillToAgent: (agentId: string, skillId: string) => void;
  removeSkillFromAgent: (agentId: string, skillId: string) => void;

  // Actions - Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  assignTaskToAgent: (taskId: string, agentId: string | null) => void;

  // Actions - Projects
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'agents' | 'tasks'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Actions - Skills
  toggleSkill: (id: string) => void;

  // Actions - UI
  setSelectedProject: (id: string | null) => void;
  setSelectedAgent: (id: string | null) => void;
  setSelectedChat: (id: string | null) => void;
  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;

  // Computed
  getStats: () => DashboardStats;
  getProjectAgents: (projectId: string) => Agent[];
  getProjectTasks: (projectId: string) => Task[];
  getAgentTasks: (agentId: string) => Task[];
}

export const useStore = create<AppState>((set, get) => ({
  // Initial Data
  agents: sampleAgents,
  tasks: sampleTasks,
  projects: sampleProjects,
  skills: sampleSkills,
  entities: sampleEntities,
  chats: sampleChats,

  // Initial UI State
  selectedProject: null,
  selectedAgent: null,
  selectedChat: null,
  sidebarCollapsed: false,
  mobileMenuOpen: false,

  // Agent Actions
  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, {
      ...agent,
      id: generateId(),
      createdAt: new Date(),
      lastActive: new Date(),
      logs: [],
      tokensUsed: 0,
      tasksCompleted: 0,
    }]
  })),

  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map(a => a.id === id ? { ...a, ...updates, lastActive: new Date() } : a)
  })),

  deleteAgent: (id) => set((state) => ({
    agents: state.agents.filter(a => a.id !== id),
    projects: state.projects.map(p => ({
      ...p,
      agents: p.agents.filter(aid => aid !== id)
    }))
  })),

  assignAgentToProject: (agentId, projectId) => set((state) => {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return state;

    // Remove from old project
    const updatedProjects = state.projects.map(p => ({
      ...p,
      agents: p.agents.filter(aid => aid !== agentId)
    }));

    // Add to new project if specified
    if (projectId) {
      const projectIndex = updatedProjects.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        updatedProjects[projectIndex].agents.push(agentId);
      }
    }

    return {
      agents: state.agents.map(a => a.id === agentId ? { ...a, assignedProject: projectId } : a),
      projects: updatedProjects
    };
  }),

  assignSkillToAgent: (agentId, skillId) => set((state) => ({
    agents: state.agents.map(a =>
      a.id === agentId && !a.skills.includes(skillId)
        ? { ...a, skills: [...a.skills, skillId] }
        : a
    )
  })),

  removeSkillFromAgent: (agentId, skillId) => set((state) => ({
    agents: state.agents.map(a =>
      a.id === agentId
        ? { ...a, skills: a.skills.filter(s => s !== skillId) }
        : a
    )
  })),

  // Task Actions
  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, {
      ...task,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }]
  })),

  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t)
  })),

  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),

  assignTaskToAgent: (taskId, agentId) => set((state) => ({
    tasks: state.tasks.map(t =>
      t.id === taskId ? { ...t, assignedAgent: agentId, updatedAt: new Date() } : t
    ),
    agents: state.agents.map(a =>
      a.id === agentId ? { ...a, currentTask: taskId } : a
    )
  })),

  // Project Actions
  addProject: (project) => set((state) => ({
    projects: [...state.projects, {
      ...project,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      agents: [],
      tasks: [],
    }]
  })),

  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)
  })),

  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id),
    agents: state.agents.map(a => a.assignedProject === id ? { ...a, assignedProject: null } : a),
    tasks: state.tasks.filter(t => t.projectId !== id)
  })),

  // Skill Actions
  toggleSkill: (id) => set((state) => ({
    skills: state.skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
  })),

  // UI Actions
  setSelectedProject: (id) => set({ selectedProject: id }),
  setSelectedAgent: (id) => set({ selectedAgent: id }),
  setSelectedChat: (id) => set({ selectedChat: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

  // Computed
  getStats: () => {
    const state = get();
    return {
      totalAgents: state.agents.length,
      activeAgents: state.agents.filter(a => a.status === 'running').length,
      totalTasks: state.tasks.length,
      completedTasks: state.tasks.filter(t => t.status === 'completed').length,
      totalProjects: state.projects.length,
      tokensUsedToday: state.agents.reduce((sum, a) => sum + a.tokensUsed, 0),
    };
  },

  getProjectAgents: (projectId) => {
    const state = get();
    return state.agents.filter(a => a.assignedProject === projectId);
  },

  getProjectTasks: (projectId) => {
    const state = get();
    return state.tasks.filter(t => t.projectId === projectId);
  },

  getAgentTasks: (agentId) => {
    const state = get();
    return state.tasks.filter(t => t.assignedAgent === agentId);
  },
}));
