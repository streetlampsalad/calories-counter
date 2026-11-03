# Google sign-in is the only way to authenticate

Users sign in with Google OAuth through Supabase Auth, and there is no email-based sign-in (password, magic link or one-time code). On Supabase's free plan, the built-in email service only delivers to members of the Supabase organisation, and we chose not to run a custom SMTP service for a handful of users. Google sign-in sends no email, costs nothing, and every current User is on Android with a Google account.

## Considered Options

- **Admin-created email and password accounts**: works without email, but means managing and resetting passwords by hand.
- **Magic link or one-time code**: would need every User added to the Supabase organisation, or a custom SMTP service.
