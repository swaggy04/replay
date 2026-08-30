export default function Home() {
  return (
    <main>
      <aside>
        <h1>DevReplay</h1>

        <nav>
          <div>Requests</div>
          <div>Replays</div>
          <div>Collections</div>
          <div>Settings</div>
        </nav>

        <div>
          <p>Recent</p>
          <div>GET /users</div>
          <div>POST /users</div>
        </div>

        <div>● Local</div>
      </aside>

      <section>
        <h2>Requests</h2>
        <p>Captured HTTP traffic</p>
      </section>
    </main>
  );
}
