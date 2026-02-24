'use client';

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';
import SchedulerCalendar from '@/components/SchedulerCalendar';
import { useToast, useScheduledTasks, useTaskForm, useEditForm, useTaskLogs } from './hooks';
import {
  Toast,
  PageHeader,
  FilterBar,
  TaskList,
  CreateTaskModal,
  EditTaskModal,
  LogsModal,
} from './components';

export default function RecurringTasksPage() {
  const { toast, showToast } = useToast();
  const scheduled = useScheduledTasks(showToast);
  const taskForm = useTaskForm(scheduled.agents, scheduled.loadTasks, showToast);
  const editForm = useEditForm(scheduled.loadTasks, showToast);
  const taskLogs = useTaskLogs();

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  if (!isElectron()) {
    return (
      <div className="pt-4 lg:pt-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-yellow-500">This feature is only available in the desktop app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 pt-4 lg:pt-6">
      <PageHeader
        isRefreshing={scheduled.isRefreshing}
        onRefresh={scheduled.handleRefresh}
        onCreateNew={() => taskForm.setShowCreateForm(true)}
      />

      {!scheduled.isLoading && scheduled.tasks.length > 0 && (
        <SchedulerCalendar
          tasks={scheduled.tasks}
          runningTasks={scheduled.runningTasks}
          onRunTask={scheduled.handleRunTask}
          onEditTask={editForm.handleEditTask}
          onDeleteTask={scheduled.handleDeleteTask}
          onViewLogs={taskLogs.handleViewLogs}
        />
      )}

      <Toast toast={toast} />

      {scheduled.isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading scheduled tasks...</span>
          </div>
        </div>
      ) : (
        <>
          {scheduled.tasks.length > 0 && (
            <FilterBar
              projects={scheduled.projects}
              filterProject={scheduled.filterProject}
              onFilterProjectChange={scheduled.setFilterProject}
              filterSchedule={scheduled.filterSchedule}
              onFilterScheduleChange={scheduled.setFilterSchedule}
            />
          )}

          <TaskList
            tasks={scheduled.filteredTasks}
            expandedTasks={expandedTasks}
            onToggleExpand={toggleExpand}
            runningTaskId={scheduled.runningTaskId}
            runningTasks={scheduled.runningTasks}
            onRun={scheduled.handleRunTask}
            onViewLogs={taskLogs.handleViewLogs}
            onEdit={editForm.handleEditTask}
            onDelete={scheduled.handleDeleteTask}
            onCreateNew={() => taskForm.setShowCreateForm(true)}
          />
        </>
      )}

      <CreateTaskModal
        show={taskForm.showCreateForm}
        onClose={() => taskForm.setShowCreateForm(false)}
        agents={scheduled.agents}
        formData={taskForm.formData}
        onFormChange={taskForm.setFormData}
        isCreating={taskForm.isCreating}
        createError={taskForm.createError}
        onSubmit={taskForm.handleCreateTask}
      />

      <EditTaskModal
        task={editForm.editingTask}
        onClose={() => editForm.setEditingTask(null)}
        editForm={editForm.editForm}
        onFormChange={editForm.setEditForm}
        isSaving={editForm.isSavingEdit}
        onSave={editForm.handleSaveEdit}
      />

      <LogsModal
        selectedLogs={taskLogs.selectedLogs}
        onClose={() => taskLogs.setSelectedLogs(null)}
        onRunIndexChange={(idx) =>
          taskLogs.setSelectedLogs(prev => prev ? { ...prev, selectedRunIndex: idx } : null)
        }
        logsContainerRef={taskLogs.logsContainerRef}
      />
    </div>
  );
}
