/*
  # Enhanced Coaching Trainer System Schema - FIXED
  
  This schema extends the existing database to support:
  1. Workout Templates and Exercises
  2. Workout Plans and Scheduling
  3. Enhanced Client Management
  4. Session Management
  5. Progress Tracking
  
  Run this in your Supabase SQL editor to add the new functionality.
*/

-- =============================================
-- DROP EXISTING VIEWS FIRST (if they exist)
-- =============================================

DROP VIEW IF EXISTS trainer_dashboard_view;
DROP VIEW IF EXISTS client_progress_summary;

-- =============================================
-- WORKOUT TEMPLATES AND EXERCISES SYSTEM
-- =============================================

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  muscle_groups text[] DEFAULT '{}',
  instructions text,
  equipment text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create workout_templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  estimated_duration_minutes integer DEFAULT 60,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create template_exercises table (junction table)
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  sets_config jsonb DEFAULT '[]', -- Array of set configurations
  notes text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- WORKOUT PLANS SYSTEM
-- =============================================

-- Create workout_plans table
CREATE TABLE IF NOT EXISTS workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  schedule_type text CHECK (schedule_type IN ('weekly', 'monthly', 'custom')) DEFAULT 'weekly',
  schedule_data jsonb DEFAULT '{}', -- Flexible schedule configuration
  status text CHECK (status IN ('draft', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plan_sessions table (scheduled workout sessions)
CREATE TABLE IF NOT EXISTS plan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES workout_plans(id) ON DELETE CASCADE,
  template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  scheduled_time time,
  day_of_week text, -- For weekly repeating plans
  week_number integer, -- For monthly plans
  status text CHECK (status IN ('scheduled', 'completed', 'skipped', 'cancelled')) DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- ENHANCED SESSION MANAGEMENT
-- =============================================

-- Add columns to existing training_sessions table (only if they don't exist)
DO $$
BEGIN
  -- Add template_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_sessions' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE training_sessions ADD COLUMN template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL;
  END IF;

  -- Add plan_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_sessions' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE training_sessions ADD COLUMN plan_id uuid REFERENCES workout_plans(id) ON DELETE SET NULL;
  END IF;

  -- Add session_data for storing workout details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_sessions' AND column_name = 'session_data'
  ) THEN
    ALTER TABLE training_sessions ADD COLUMN session_data jsonb DEFAULT '{}';
  END IF;

  -- Add completion_data for storing results
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_sessions' AND column_name = 'completion_data'
  ) THEN
    ALTER TABLE training_sessions ADD COLUMN completion_data jsonb DEFAULT '{}';
  END IF;
END $$;

-- =============================================
-- CLIENT PROGRESS TRACKING
-- =============================================

-- Create client_progress table
CREATE TABLE IF NOT EXISTS client_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  weight_kg decimal(5,2),
  body_fat_percentage decimal(4,2),
  muscle_mass_kg decimal(5,2),
  measurements jsonb DEFAULT '{}', -- Store various body measurements
  photos text[], -- Array of photo URLs
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'client_progress' 
    AND constraint_name = 'client_progress_client_id_date_key'
  ) THEN
    ALTER TABLE client_progress ADD CONSTRAINT client_progress_client_id_date_key UNIQUE(client_id, date);
  END IF;
END $$;

-- Create client_goals table (enhanced goals)
CREATE TABLE IF NOT EXISTS client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  target_value decimal(10,2),
  target_unit text,
  current_value decimal(10,2) DEFAULT 0,
  target_date date,
  priority text CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  status text CHECK (status IN ('active', 'completed', 'paused', 'cancelled')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- ENHANCED CLIENT ASSIGNMENTS
-- =============================================

-- Add columns to existing client_assignments table (only if they don't exist)
DO $$
BEGIN
  -- Add assignment_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_assignments' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE client_assignments ADD COLUMN assignment_type text CHECK (assignment_type IN ('training', 'nutrition', 'both')) DEFAULT 'training';
  END IF;

  -- Add start_date and end_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_assignments' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE client_assignments ADD COLUMN start_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_assignments' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE client_assignments ADD COLUMN end_date date;
  END IF;

  -- Add notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_assignments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE client_assignments ADD COLUMN notes text;
  END IF;
END $$;

-- =============================================
-- MESSAGING SYSTEM
-- =============================================

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create unique constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'conversations' 
    AND constraint_name = 'conversations_participant_1_id_participant_2_id_key'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_participant_1_id_participant_2_id_key UNIQUE(participant_1_id, participant_2_id);
  END IF;
END $$;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text CHECK (message_type IN ('text', 'image', 'file', 'system')) DEFAULT 'text',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROW LEVEL SECURITY POLICIES (Drop existing first)
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read public exercises" ON exercises;
DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can create exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can read public templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can read own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can create templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can manage template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Trainers can manage their plans" ON workout_plans;
DROP POLICY IF EXISTS "Clients can read their plans" ON workout_plans;
DROP POLICY IF EXISTS "Users can manage plan sessions" ON plan_sessions;
DROP POLICY IF EXISTS "Trainers can manage client progress" ON client_progress;
DROP POLICY IF EXISTS "Clients can read own progress" ON client_progress;
DROP POLICY IF EXISTS "Users can manage client goals" ON client_goals;
DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can read conversation messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Exercises policies
CREATE POLICY "Users can read public exercises"
  ON exercises
  FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can read own exercises"
  ON exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = created_by AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create exercises"
  ON exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = created_by AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own exercises"
  ON exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = created_by AND p.user_id = auth.uid()
    )
  );

-- Workout templates policies
CREATE POLICY "Users can read public templates"
  ON workout_templates
  FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can read own templates"
  ON workout_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = created_by AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create templates"
  ON workout_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = created_by AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own templates"
  ON workout_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = created_by AND p.user_id = auth.uid()
    )
  );

-- Template exercises policies
CREATE POLICY "Users can manage template exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates wt
      JOIN profiles p ON p.id = wt.created_by
      WHERE wt.id = template_id AND p.user_id = auth.uid()
    )
  );

-- Workout plans policies
CREATE POLICY "Trainers can manage their plans"
  ON workout_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = trainer_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read their plans"
  ON workout_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = client_id AND p.user_id = auth.uid()
    )
  );

-- Plan sessions policies
CREATE POLICY "Users can manage plan sessions"
  ON plan_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_plans wp
      JOIN profiles p ON (p.id = wp.trainer_id OR p.id = wp.client_id)
      WHERE wp.id = plan_id AND p.user_id = auth.uid()
    )
  );

-- Client progress policies
CREATE POLICY "Trainers can manage client progress"
  ON client_progress
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = trainer_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read own progress"
  ON client_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = client_id AND p.user_id = auth.uid()
    )
  );

-- Client goals policies
CREATE POLICY "Users can manage client goals"
  ON client_goals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.id = client_id OR p.id = trainer_id) AND p.user_id = auth.uid()
    )
  );

-- Conversations policies
CREATE POLICY "Users can read own conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.id = participant_1_id OR p.id = participant_2_id) AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.id = participant_1_id OR p.id = participant_2_id) AND p.user_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Users can read conversation messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN profiles p ON (p.id = c.participant_1_id OR p.id = c.participant_2_id)
      WHERE c.id = conversation_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = sender_id AND p.user_id = auth.uid()
    )
  );

-- =============================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================

-- Exercises indexes
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON exercises(created_by);
CREATE INDEX IF NOT EXISTS idx_exercises_public ON exercises(is_public);

-- Workout templates indexes
CREATE INDEX IF NOT EXISTS idx_workout_templates_category ON workout_templates(category);
CREATE INDEX IF NOT EXISTS idx_workout_templates_created_by ON workout_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workout_templates_public ON workout_templates(is_public);

-- Template exercises indexes
CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(template_id);
CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise ON template_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_template_exercises_order ON template_exercises(template_id, order_index);

-- Workout plans indexes
CREATE INDEX IF NOT EXISTS idx_workout_plans_client ON workout_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_trainer ON workout_plans(trainer_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_dates ON workout_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_workout_plans_status ON workout_plans(status);

-- Plan sessions indexes
CREATE INDEX IF NOT EXISTS idx_plan_sessions_plan ON plan_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_sessions_date ON plan_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_plan_sessions_status ON plan_sessions(status);

-- Client progress indexes
CREATE INDEX IF NOT EXISTS idx_client_progress_client_date ON client_progress(client_id, date);
CREATE INDEX IF NOT EXISTS idx_client_progress_trainer ON client_progress(trainer_id);

-- Client goals indexes
CREATE INDEX IF NOT EXISTS idx_client_goals_client ON client_goals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_trainer ON client_goals(trainer_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_status ON client_goals(status);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- =============================================
-- SAMPLE DATA FOR DEVELOPMENT
-- =============================================

-- Insert sample exercises
INSERT INTO exercises (name, category, muscle_groups, instructions, equipment, is_public) VALUES
  ('Push-ups', 'Bodyweight', ARRAY['Chest', 'Shoulders', 'Triceps'], 'Start in plank position, lower body to ground, push back up', 'None', true),
  ('Squats', 'Bodyweight', ARRAY['Quadriceps', 'Glutes', 'Hamstrings'], 'Stand with feet shoulder-width apart, lower hips back and down', 'None', true),
  ('Bench Press', 'Strength', ARRAY['Chest', 'Shoulders', 'Triceps'], 'Lie on bench, lower bar to chest, press up', 'Barbell, Bench', true),
  ('Deadlift', 'Strength', ARRAY['Hamstrings', 'Glutes', 'Back'], 'Stand with feet hip-width apart, lift bar from ground', 'Barbell', true),
  ('Pull-ups', 'Bodyweight', ARRAY['Back', 'Biceps'], 'Hang from bar, pull body up until chin over bar', 'Pull-up bar', true),
  ('Plank', 'Core', ARRAY['Core', 'Shoulders'], 'Hold plank position with straight body line', 'None', true),
  ('Lunges', 'Bodyweight', ARRAY['Quadriceps', 'Glutes', 'Hamstrings'], 'Step forward into lunge position, alternate legs', 'None', true),
  ('Burpees', 'HIIT', ARRAY['Full Body'], 'Squat down, jump back to plank, jump forward, jump up', 'None', true)
ON CONFLICT DO NOTHING;

-- Insert sample workout templates (using the trainer profile from existing data)
-- Only insert if trainer profile exists
DO $$
DECLARE
    trainer_id uuid;
BEGIN
    -- Get the trainer profile ID
    SELECT id INTO trainer_id 
    FROM profiles 
    WHERE email = 'trainer@vinayfit.com' AND role = 'trainer' 
    LIMIT 1;
    
    -- Only insert if trainer exists
    IF trainer_id IS NOT NULL THEN
        INSERT INTO workout_templates (name, description, category, estimated_duration_minutes, created_by, is_public) VALUES
            ('Beginner Full Body', 'A complete full body workout for beginners', 'Full Body', 45, trainer_id, true),
            ('Upper Body Strength', 'Focus on building upper body strength', 'Upper Body', 60, trainer_id, true),
            ('HIIT Cardio Blast', 'High intensity interval training for cardio', 'HIIT', 30, trainer_id, true),
            ('Lower Body Power', 'Build lower body strength and power', 'Lower Body', 50, trainer_id, true)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_exercises_updated_at ON exercises;
DROP TRIGGER IF EXISTS update_workout_templates_updated_at ON workout_templates;
DROP TRIGGER IF EXISTS update_workout_plans_updated_at ON workout_plans;
DROP TRIGGER IF EXISTS update_plan_sessions_updated_at ON plan_sessions;
DROP TRIGGER IF EXISTS update_client_progress_updated_at ON client_progress;
DROP TRIGGER IF EXISTS update_client_goals_updated_at ON client_goals;
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON messages;

-- Create triggers for updated_at
CREATE TRIGGER update_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_templates_updated_at
    BEFORE UPDATE ON workout_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_plans_updated_at
    BEFORE UPDATE ON workout_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_sessions_updated_at
    BEFORE UPDATE ON plan_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_progress_updated_at
    BEFORE UPDATE ON client_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_goals_updated_at
    BEFORE UPDATE ON client_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation last_message_at when a new message is added
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- =============================================
-- VIEWS FOR COMMON QUERIES (Recreate after dropping)
-- =============================================

-- View for trainer dashboard data
CREATE VIEW trainer_dashboard_view AS
SELECT 
  p.id as trainer_id,
  p.full_name as trainer_name,
  COUNT(DISTINCT ca.client_id) as total_clients,
  COUNT(DISTINCT CASE WHEN ts.scheduled_date = CURRENT_DATE THEN ts.id END) as todays_sessions,
  COUNT(DISTINCT CASE WHEN ts.scheduled_date = CURRENT_DATE AND ts.status = 'completed' THEN ts.id END) as completed_today,
  COUNT(DISTINCT wp.id) as active_plans
FROM profiles p
LEFT JOIN client_assignments ca ON ca.trainer_id = p.id AND ca.status = 'active'
LEFT JOIN training_sessions ts ON ts.trainer_id = p.id
LEFT JOIN workout_plans wp ON wp.trainer_id = p.id AND wp.status = 'active'
WHERE p.role = 'trainer'
GROUP BY p.id, p.full_name;

-- View for client progress summary
CREATE VIEW client_progress_summary AS
SELECT 
  cp.client_id,
  c.full_name as client_name,
  cp.trainer_id,
  t.full_name as trainer_name,
  COUNT(*) as total_entries,
  MAX(cp.date) as last_update,
  (SELECT weight_kg FROM client_progress cp2 
   WHERE cp2.client_id = cp.client_id 
   ORDER BY cp2.date DESC LIMIT 1) as current_weight,
  (SELECT weight_kg FROM client_progress cp3 
   WHERE cp3.client_id = cp.client_id 
   ORDER BY cp3.date ASC LIMIT 1) as starting_weight
FROM client_progress cp
JOIN profiles c ON c.id = cp.client_id
LEFT JOIN profiles t ON t.id = cp.trainer_id
GROUP BY cp.client_id, c.full_name, cp.trainer_id, t.full_name;

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

-- Add a comment to indicate successful completion
COMMENT ON SCHEMA public IS 'Enhanced Coaching Trainer System - Schema updated successfully';