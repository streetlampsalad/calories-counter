
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "count": number,"day": string,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"day": string,"kind": string,"user_id"?: string
                  }
                  Update: {
                    "count"?: number,"day"?: string,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"allowed_emails": {
                  Row: {
                    "created_at": string,"email": string,"is_owner": boolean,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"is_owner"?: boolean,"note"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"is_owner"?: boolean,"note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"calories_burned": {
                  Row: {
                    "calories": number,"day": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calories": number,"day": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "calories"?: number,"day"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"entries": {
                  Row: {
                    "created_at": string,"day": string,"food_id": string,"id": string,"quantity": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"food_id": string,"id"?: string,"quantity": number,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"food_id"?: string,"id"?: string,"quantity"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_requests": {
                  Row: {
                    "created_at": string,"details": string | null,"feature_issue": number | null,"goal": string,"id": string,"latest_comment": string | null,"problem": string | null,"ready_note": string | null,"spec_issue": number | null,"stage": string,"stage_changed_at": string,"user_id": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"feature_issue"?: number | null,"goal": string,"id"?: string,"latest_comment"?: string | null,"problem"?: string | null,"ready_note"?: string | null,"spec_issue"?: number | null,"stage"?: string,"stage_changed_at"?: string,"user_id": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"feature_issue"?: number | null,"goal"?: string,"id"?: string,"latest_comment"?: string | null,"problem"?: string | null,"ready_note"?: string | null,"spec_issue"?: number | null,"stage"?: string,"stage_changed_at"?: string,"user_id"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"foods": {
                  Row: {
                    "archived_at": string | null,"calories": number,"created_at": string,"id": string,"name": string,"portion": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"calories": number,"created_at"?: string,"id"?: string,"name": string,"portion": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"calories"?: number,"created_at"?: string,"id"?: string,"name"?: string,"portion"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reference_foods": {
                  Row: {
                    "calories_per_100": number,"energy_kj_per_100": number,"id": string,"name": string,"source": string,"source_id": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calories_per_100": number,"energy_kj_per_100": number,"id"?: string,"name": string,"source": string,"source_id": string,"unit": string
                  }
                  Update: {
                    "calories_per_100"?: number,"energy_kj_per_100"?: number,"id"?: string,"name"?: string,"source"?: string,"source_id"?: string,"unit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"toggle_overrides": {
                  Row: {
                    "enabled": boolean,"toggle_key": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled": boolean,"toggle_key": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "enabled"?: boolean,"toggle_key"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "toggle_overrides_toggle_key_fkey"
      columns: ["toggle_key"]
isOneToOne: false
      referencedRelation: "toggles"
      referencedColumns: ["key"]
    }
                  ]
                },"toggles": {
                  Row: {
                    "created_at": string,"key": string,"state": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"state"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"state"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "daily_goal_calories": number | null,"reminder_enabled": boolean,"reminder_last_sent_on": string | null,"reminder_time": string,"time_zone": string | null,"track_calories_burned": boolean,"updated_at": string,"user_id": string,"week_starts_on": number
                  }
                  ComputedFields: never
                  Insert: {
                    "daily_goal_calories"?: number | null,"reminder_enabled"?: boolean,"reminder_last_sent_on"?: string | null,"reminder_time"?: string,"time_zone"?: string | null,"track_calories_burned"?: boolean,"updated_at"?: string,"user_id"?: string,"week_starts_on"?: number
                  }
                  Update: {
                    "daily_goal_calories"?: number | null,"reminder_enabled"?: boolean,"reminder_last_sent_on"?: string | null,"reminder_time"?: string,"time_zone"?: string | null,"track_calories_burned"?: boolean,"updated_at"?: string,"user_id"?: string,"week_starts_on"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_feature_request_sync":
{ Args: { "updates": Json }; Returns: {
              "comment": string,"goal_text": string,"new_stage": string,"notify": boolean,"request_id": string,"requester_id": string
            }[]
                           },
"can_switch_toggle":
{ Args: { "key": string }; Returns: boolean
                           },
"can_try_toggle":
{ Args: { "key": string }; Returns: boolean
                           },
"daily_totals":
{ Args: { "range_from": string,"range_to": string }; Returns: {
              "calories": number,"day": string,"entry_count": number
            }[]
                           },
"due_reminders":
{ Args: { "at": string }; Returns: {
              "auth_secret": string,"endpoint": string,"local_day": string,"p256dh_key": string,"subscription_id": string,"user_id": string
            }[]
                           },
"feature_requests_ahead":
{ Args: { "request_id": string }; Returns: number
                           },
"food_entry_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "entry_count": number,"food_id": string
            }[]
                           },
"food_totals":
{ Args: { "range_from": string,"range_to": string }; Returns: {
              "archived": boolean,"calories": number,"entry_count": number,"food_id": string,"name": string,"portion": string
            }[]
                           },
"food_usage":
{ Args: { "since": string }; Returns: {
              "entry_count": number,"food_id": string,"last_logged_at": string
            }[]
                           } |
{ Args: { "since": string,"until": string }; Returns: {
              "entry_count": number,"food_id": string,"last_logged_at": string
            }[]
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"import_foods":
{ Args: { "rows": Json }; Returns: {
              "added": number,"updated": number
            }[]
                           },
"increment_ai_usage":
{ Args: { "max_per_day": number,"usage_kind": string }; Returns: boolean
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_toggles":
{ Args: Record<PropertyKey, never>; Returns: {
              "can_switch": boolean,"is_on": boolean,"key": string,"state": string,"title": string
            }[]
                           },
"other_feature_requests":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"feature_issue": number,"goal": string,"id": string,"stage": string
            }[]
                           },
"period_days":
{ Args: { "range_from": string,"range_to": string }; Returns: {
              "calories": number,"calories_burned": number,"day": string,"entry_count": number
            }[]
                           },
"remove_foods":
{ Args: { "ids": (string)[] }; Returns: {
              "food_id": string,"outcome": string
            }[]
                           },
"restore_foods":
{ Args: { "ids": (string)[] }; Returns: {
              "food_id": string
            }[]
                           },
"search_reference_foods":
{ Args: { "max_results"?: number,"q": string }; Returns: {
              "calories_per_100": number,"energy_kj_per_100": number,"id": string,"name": string,"source": string,"source_id": string,"unit": string
            }[]
                           },
"send_due_reminders":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"toggle_is_on":
{ Args: { "key": string }; Returns: boolean
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
  "public": {
          Enums: {
            
          }
        }
} as const
