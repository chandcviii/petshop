# Employee accounts

Open `login.html` and select **Create an account**. Enter an email address and a password
with at least 8 characters. The app signs in automatically after creating the account.
Future visits use the same email and password. Use **Sign out** in the sidebar to end the
current browser session.

Accounts and shop records are stored in the current browser only. They do not sync to other
devices, and clearing browser storage removes them. This simple local login is for demos or
personal use only: it is not server-side authentication, and must not be used to protect
sensitive business or employee data.

The optional `supabase-schema.sql` file is a separate cloud-database foundation. It is not
used by this local login or by the pages' current `localStorage` data operations.
