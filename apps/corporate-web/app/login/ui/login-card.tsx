type LoginCardProps = {
  error?: string | null;
};

export function LoginCard({ error }: LoginCardProps) {
  return (
    <section className="login-card">
      <p className="eyebrow">Corporate Login</p>
      <h2>Welcome back</h2>
      <p>Use your corporate maker or checker credentials to enter the dashboard.</p>

      <form action="/login/submit" className="login-form" method="post">
        <label>
          Username
          <input autoComplete="username" name="username" placeholder="grvmaker" required />
        </label>

        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            type="password"
            placeholder="9771"
            required
          />
        </label>

        <div className="login-actions">
          <span className="hint">Test users: `grvmaker` / `grvchecker` with password `9771`</span>
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </div>
      </form>

      {error ? <div className="error-box">{error}</div> : null}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              document.cookie = "cmsCorporateSession=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              document.cookie = "cmsSelectedCorporateId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              const bffUrl = "${process.env.NEXT_PUBLIC_BFF_URL || 'https://cmsv01-bff.onrender.com'}";
              console.log("Waking up BFF and Core API in background via " + bffUrl + "/health ...");
              fetch(bffUrl + "/health", { mode: "no-cors" }).catch(() => {});
            })();
          `
        }}
      />
    </section>
  );
}
