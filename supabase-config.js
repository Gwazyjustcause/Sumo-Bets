// Public browser configuration. The Supabase publishable/anon key is designed
// to be shipped to clients; database access is constrained by supabase/schema.sql.
window.SUMO_SHARED_DRAFT_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  table: "shared_drafts",
  saveFunction: "save_shared_draft",
};
