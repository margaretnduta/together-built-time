export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          ip: unknown
          summary: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          ip?: unknown
          summary?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          ip?: unknown
          summary?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      celebrations: {
        Row: {
          acknowledged_at: string | null
          celebrant_id: string
          created_at: string
          goal_count: number
          honoree_id: string
          id: string
          message: string | null
          month: string
          partnership_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          celebrant_id: string
          created_at?: string
          goal_count?: number
          honoree_id: string
          id?: string
          message?: string | null
          month: string
          partnership_id: string
        }
        Update: {
          acknowledged_at?: string | null
          celebrant_id?: string
          created_at?: string
          goal_count?: number
          honoree_id?: string
          id?: string
          message?: string | null
          month?: string
          partnership_id?: string
        }
        Relationships: []
      }
      challenge_check_ins: {
        Row: {
          challenge_id: string
          check_in_date: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          check_in_date: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          check_in_date?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_check_ins_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          is_solo: boolean
          owner_id: string
          partner_id: string | null
          partnership_id: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          is_solo?: boolean
          owner_id: string
          partner_id?: string | null
          partnership_id?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          is_solo?: boolean
          owner_id?: string
          partner_id?: string | null
          partnership_id?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      couple_goals: {
        Row: {
          approval_status: string
          approved_by: string[]
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          decline_reason: string | null
          declined_by: string | null
          description: string | null
          id: string
          is_complete: boolean
          month: string
          partnership_id: string
          proposed_by: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string[]
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          decline_reason?: string | null
          declined_by?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean
          month: string
          partnership_id: string
          proposed_by?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_by?: string[]
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          declined_by?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean
          month?: string
          partnership_id?: string
          proposed_by?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_goals_declined_by_fkey"
            columns: ["declined_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_complete: boolean
          owner_id: string
          partnership_id: string
          sort_order: number
          task_date: string
          template_id: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          owner_id: string
          partnership_id: string
          sort_order?: number
          task_date?: string
          template_id?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          owner_id?: string
          partnership_id?: string
          sort_order?: number
          task_date?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      important_dates: {
        Row: {
          approval_status: string
          approved_by: string[]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: string
          created_at: string
          created_by: string
          date: string
          decline_reason: string | null
          declined_by: string | null
          deliverables: string[]
          done_at: string | null
          done_by: string | null
          dress_code: string | null
          event_time: string | null
          id: string
          is_done: boolean
          notes: string | null
          partnership_id: string
          proposed_by: string | null
          recurrence: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string[]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: string
          created_at?: string
          created_by: string
          date: string
          decline_reason?: string | null
          declined_by?: string | null
          deliverables?: string[]
          done_at?: string | null
          done_by?: string | null
          dress_code?: string | null
          event_time?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          partnership_id: string
          proposed_by?: string | null
          recurrence?: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_by?: string[]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          decline_reason?: string | null
          declined_by?: string | null
          deliverables?: string[]
          done_at?: string | null
          done_by?: string | null
          dress_code?: string | null
          event_time?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          partnership_id?: string
          proposed_by?: string | null
          recurrence?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "important_dates_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "important_dates_declined_by_fkey"
            columns: ["declined_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          created_at: string
          formed_at: string | null
          id: string
          invite_code: string | null
          invite_expires_at: string | null
          partner_a_id: string
          partner_b_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          formed_at?: string | null
          id?: string
          invite_code?: string | null
          invite_expires_at?: string | null
          partner_a_id: string
          partner_b_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          formed_at?: string | null
          id?: string
          invite_code?: string | null
          invite_expires_at?: string | null
          partner_a_id?: string
          partner_b_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_partner_a_id_fkey"
            columns: ["partner_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnerships_partner_b_id_fkey"
            columns: ["partner_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_complete: boolean
          month: string
          owner_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_complete?: boolean
          month: string
          owner_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_complete?: boolean
          month?: string
          owner_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          created_at: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_task_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          owner_id: string
          partnership_id: string
          recurrence: string
          title: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          owner_id: string
          partnership_id: string
          recurrence: string
          title: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          owner_id?: string
          partnership_id?: string
          recurrence?: string
          title?: string
          weekday?: number | null
        }
        Relationships: []
      }
      weekly_reflections: {
        Row: {
          appreciation_for_partner: string | null
          created_at: string
          id: string
          owner_id: string
          partnership_id: string
          submitted_at: string | null
          updated_at: string
          visibility: string
          was_hard: string | null
          week_start: string
          went_well: string | null
        }
        Insert: {
          appreciation_for_partner?: string | null
          created_at?: string
          id?: string
          owner_id: string
          partnership_id: string
          submitted_at?: string | null
          updated_at?: string
          visibility?: string
          was_hard?: string | null
          week_start: string
          went_well?: string | null
        }
        Update: {
          appreciation_for_partner?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          partnership_id?: string
          submitted_at?: string | null
          updated_at?: string
          visibility?: string
          was_hard?: string | null
          week_start?: string
          went_well?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { _code: string }; Returns: string }
      delete_my_account_data: { Args: never; Returns: undefined }
      dissolve_partnership: { Args: never; Returns: string }
      get_challenge_streak: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: number
      }
      get_daily_streak: { Args: { _partnership_id: string }; Returns: number }
      get_monthly_couple_streak: {
        Args: { _partnership_id: string }
        Returns: number
      }
      get_my_partnership_id: { Args: never; Returns: string }
      get_personal_streak: { Args: never; Returns: number }
      is_in_partnership: { Args: { _partnership_id: string }; Returns: boolean }
      log_account_event: {
        Args: { _action: string; _summary: string }
        Returns: undefined
      }
      materialize_recurring_tasks_for_today: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
