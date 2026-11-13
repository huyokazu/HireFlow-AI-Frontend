
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "agent_actions": {
                  Row: {
                    "application_id": string | null,"approved_at": string | null,"approved_by": string | null,"attempts": number,"campaign_id": string | null,"candidate_id": string | null,"created_at": string,"error": string | null,"id": string,"idempotency_key": string,"kind": string,"payload": NonNullable<Json>,"provider_ref": string | null,"requested_by": string,"requires_approval": boolean,"result": Json | null,"simulated": boolean,"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"attempts"?: number,"campaign_id"?: string | null,"candidate_id"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"idempotency_key": string,"kind": string,"payload": NonNullable<Json>,"provider_ref"?: string | null,"requested_by": string,"requires_approval"?: boolean,"result"?: Json | null,"simulated"?: boolean,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "application_id"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"attempts"?: number,"campaign_id"?: string | null,"candidate_id"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"idempotency_key"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"provider_ref"?: string | null,"requested_by"?: string,"requires_approval"?: boolean,"result"?: Json | null,"simulated"?: boolean,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_actions_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_actions_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_actions_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_actions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_events": {
                  Row: {
                    "actor": string,"at": string,"campaign_id": string | null,"id": number,"kind": string,"payload": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"at"?: string,"campaign_id"?: string | null,"id"?: never,"kind": string,"payload"?: NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "actor"?: string,"at"?: string,"campaign_id"?: string | null,"id"?: never,"kind"?: string,"payload"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_settings": {
                  Row: {
                    "agent_key": string,"paused": boolean,"updated_at": string,"updated_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_key": string,"paused"?: boolean,"updated_at"?: string,"updated_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "agent_key"?: string,"paused"?: boolean,"updated_at"?: string,"updated_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_stats": {
                  Row: {
                    "agent_key": string,"agreement_rate": number,"done_today": number,"last_active_at": string,"median_seconds": number,"queued": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_key": string,"agreement_rate"?: number,"done_today"?: number,"last_active_at"?: string,"median_seconds"?: number,"queued"?: number,"workspace_id": string
                  }
                  Update: {
                    "agent_key"?: string,"agreement_rate"?: number,"done_today"?: number,"last_active_at"?: string,"median_seconds"?: number,"queued"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_stats_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_weeks": {
                  Row: {
                    "hours_saved": number,"week_start": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hours_saved"?: number,"week_start": string,"workspace_id": string
                  }
                  Update: {
                    "hours_saved"?: number,"week_start"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_weeks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_months": {
                  Row: {
                    "hires": number,"month_start": string,"time_to_hire_days": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hires"?: number,"month_start": string,"time_to_hire_days"?: number,"workspace_id": string
                  }
                  Update: {
                    "hires"?: number,"month_start"?: string,"time_to_hire_days"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_months_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "ai_assessment": NonNullable<Json>,"ai_details": Json | null,"campaign_id": string,"candidate_id": string,"created_at": string,"hr_decision": string | null,"id": string,"match_score": number,"stage": string,"stage_entered_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_assessment"?: NonNullable<Json>,"ai_details"?: Json | null,"campaign_id": string,"candidate_id": string,"created_at"?: string,"hr_decision"?: string | null,"id"?: string,"match_score"?: number,"stage"?: string,"stage_entered_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ai_assessment"?: NonNullable<Json>,"ai_details"?: Json | null,"campaign_id"?: string,"candidate_id"?: string,"created_at"?: string,"hr_decision"?: string | null,"id"?: string,"match_score"?: number,"stage"?: string,"stage_entered_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_campaign_id_workspace_id_fkey"
      columns: ["campaign_id","workspace_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "applications_candidate_id_workspace_id_fkey"
      columns: ["candidate_id","workspace_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "applications_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"bottleneck_alerts": {
                  Row: {
                    "approved_fix_id": string | null,"campaign_id": string,"content": NonNullable<Json>,"decided_at": string | null,"decided_by": string | null,"detected_at": string,"id": string,"severity": string,"status": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_fix_id"?: string | null,"campaign_id": string,"content": NonNullable<Json>,"decided_at"?: string | null,"decided_by"?: string | null,"detected_at"?: string,"id"?: string,"severity": string,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "approved_fix_id"?: string | null,"campaign_id"?: string,"content"?: NonNullable<Json>,"decided_at"?: string | null,"decided_by"?: string | null,"detected_at"?: string,"id"?: string,"severity"?: string,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bottleneck_alerts_campaign_id_workspace_id_fkey"
      columns: ["campaign_id","workspace_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "bottleneck_alerts_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_channel_results": {
                  Row: {
                    "applicants": number,"campaign_id": string,"channel": string,"qualified": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applicants"?: number,"campaign_id": string,"channel": string,"qualified"?: number,"workspace_id": string
                  }
                  Update: {
                    "applicants"?: number,"campaign_id"?: string,"channel"?: string,"qualified"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_channel_results_campaign_id_workspace_id_fkey"
      columns: ["campaign_id","workspace_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "applicants": number,"created_at": string,"created_by": string | null,"department": NonNullable<Json>,"dropped_after_interview": number,"dropped_after_offer": number,"health": string,"id": string,"match_rate": number,"setup": Json | null,"stage": string,"target_match_rate": number,"title": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applicants"?: number,"created_at"?: string,"created_by"?: string | null,"department": NonNullable<Json>,"dropped_after_interview"?: number,"dropped_after_offer"?: number,"health"?: string,"id"?: string,"match_rate"?: number,"setup"?: Json | null,"stage"?: string,"target_match_rate"?: number,"title": NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "applicants"?: number,"created_at"?: string,"created_by"?: string | null,"department"?: NonNullable<Json>,"dropped_after_interview"?: number,"dropped_after_offer"?: number,"health"?: string,"id"?: string,"match_rate"?: number,"setup"?: Json | null,"stage"?: string,"target_match_rate"?: number,"title"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"candidates": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"location": NonNullable<Json>,"name": string,"role": NonNullable<Json>,"skills": (string)[],"workspace_id": string,"years_of_experience": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"location": NonNullable<Json>,"name": string,"role": NonNullable<Json>,"skills"?: (string)[],"workspace_id": string,"years_of_experience"?: number
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"location"?: NonNullable<Json>,"name"?: string,"role"?: NonNullable<Json>,"skills"?: (string)[],"workspace_id"?: string,"years_of_experience"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidates_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"google_connections": {
                  Row: {
                    "access_token_enc": string | null,"access_token_expires_at": string | null,"connected_at": string,"google_email": string,"google_sub": string,"last_error": string | null,"refresh_token_enc": string,"scopes": (string)[],"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_enc"?: string | null,"access_token_expires_at"?: string | null,"connected_at"?: string,"google_email": string,"google_sub": string,"last_error"?: string | null,"refresh_token_enc": string,"scopes": (string)[],"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "access_token_enc"?: string | null,"access_token_expires_at"?: string | null,"connected_at"?: string,"google_email"?: string,"google_sub"?: string,"last_error"?: string | null,"refresh_token_enc"?: string,"scopes"?: (string)[],"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "google_connections_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"healing_records": {
                  Row: {
                    "alert_id": string | null,"at": string,"campaign_id": string,"content": NonNullable<Json>,"id": string,"outcome": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id"?: string | null,"at"?: string,"campaign_id": string,"content": NonNullable<Json>,"id"?: string,"outcome": string,"workspace_id": string
                  }
                  Update: {
                    "alert_id"?: string | null,"at"?: string,"campaign_id"?: string,"content"?: NonNullable<Json>,"id"?: string,"outcome"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "healing_records_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "bottleneck_alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "healing_records_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_states": {
                  Row: {
                    "code_verifier": string,"expires_at": string,"return_to": string,"state_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_verifier": string,"expires_at": string,"return_to": string,"state_hash": string,"user_id": string
                  }
                  Update: {
                    "code_verifier"?: string,"expires_at"?: string,"return_to"?: string,"state_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "oauth_states_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"default_workspace_id": string | null,"display_name": string,"email": string,"id": string,"locale": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_workspace_id"?: string | null,"display_name"?: string,"email"?: string,"id": string,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"default_workspace_id"?: string | null,"display_name"?: string,"email"?: string,"id"?: string,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_default_workspace_id_fkey"
      columns: ["default_workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_metrics": {
                  Row: {
                    "average_time_to_hire_days": number,"hires_previous_period": number,"hours_saved_before_today": number,"new_candidates_this_week": number,"tasks_yesterday": number,"time_to_hire_change_days": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "average_time_to_hire_days"?: number,"hires_previous_period"?: number,"hours_saved_before_today"?: number,"new_candidates_this_week"?: number,"tasks_yesterday"?: number,"time_to_hire_change_days"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "average_time_to_hire_days"?: number,"hires_previous_period"?: number,"hours_saved_before_today"?: number,"new_candidates_this_week"?: number,"tasks_yesterday"?: number,"time_to_hire_change_days"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_metrics_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "auto_approve_interviews": boolean,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_approve_interviews"?: boolean,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "auto_approve_interviews"?: boolean,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "approve_alert_fix":
{ Args: { "actor": string,"alert_id": string,"fix_id": string,"fix_label": Json,"record": Json,"setup_patch": Json,"ws": string }; Returns: Json
                           },
"dashboard_summary":
{ Args: { "ws": string }; Returns: Json
                           },
"list_my_sessions":
{ Args: Record<PropertyKey, never>; Returns: {
              "aal": string,"created_at": string,"id": string,"ip": string,"refreshed_at": string,"user_agent": string
            }[]
                           },
"revoke_my_session":
{ Args: { "session_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
