function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Secure Access</p>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

export default AuthLayout;
