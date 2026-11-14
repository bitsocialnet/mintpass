export function NotFoundPage() {
  return (
    <>
      <header className="site-header">
        {" "}
        <a className="brand" href="/" aria-label="MintPass home">
          <picture>
            <source srcSet="/mintpass-dark.svg" media="(prefers-color-scheme: dark)" />
            <img src="/mintpass.svg" alt="" width="40" height="29" />
          </picture>
          <span>MintPass</span>
        </a>
      </header>
      <main id="main">
        <section className="hero hero-plain">
          <div className="hero-copy">
            <h1>This page doesn't exist.</h1>
            <p className="lede">
              MintPass no longer verifies phone numbers, so the old request and admin pages are
              gone. <a href="/">Go to the MintPass home page</a>.
            </p>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <p>MintPass is open source under the MIT license.</p>
      </footer>
    </>
  );
}
