// The password page. A plain HTML form that posts to /api/login, so it needs
// no JavaScript. A wrong password comes back here with ?error=wrong.
export const metadata = { title: "Log in · Tabs I Never Closed" };

const ERRORS: Record<string, string> = {
  wrong: "Wrong password. Try again.",
  setup: "The server has no APP_PASSWORD set yet. Add it in Vercel and redeploy.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;

  return (
    <main>
      <header className="masthead">
        <h1 className="app-title">Tabs I Never Closed</h1>
      </header>
      <form method="post" action="/api/login" className="login">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-describedby={message ? "login-error" : undefined}
        />
        {message && (
          <p id="login-error" role="alert" className="error">
            {message}
          </p>
        )}
        <div className="row-buttons">
          <button type="submit" className="primary">
            Log in
          </button>
        </div>
      </form>
    </main>
  );
}
