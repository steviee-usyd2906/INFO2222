-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_description TEXT,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  assigned_user TEXT DEFAULT 'Unassigned',
  completed BOOLEAN DEFAULT FALSE,
  due_date TEXT DEFAULT 'TBD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for now, allow all operations for demo purposes)
-- In production, you would tie these to auth.uid() for user-specific access

-- Projects policies
CREATE POLICY "Allow public read access to projects" 
  ON public.projects FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert to projects" 
  ON public.projects FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update to projects" 
  ON public.projects FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete from projects" 
  ON public.projects FOR DELETE 
  USING (true);

-- Tasks policies
CREATE POLICY "Allow public read access to tasks" 
  ON public.tasks FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert to tasks" 
  ON public.tasks FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update to tasks" 
  ON public.tasks FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete from tasks" 
  ON public.tasks FOR DELETE 
  USING (true);

-- Task comments policies
CREATE POLICY "Allow public read access to task_comments" 
  ON public.task_comments FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert to task_comments" 
  ON public.task_comments FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update to task_comments" 
  ON public.task_comments FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete from task_comments" 
  ON public.task_comments FOR DELETE 
  USING (true);
