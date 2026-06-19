const baselineItems = [
  "Next.js App Router",
  "TypeScript strict mode",
  "PostgreSQL + Prisma baseline",
  "Independent worker entry",
  "Phase 1 shared contracts"
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="status-panel" aria-labelledby="page-title">
        <p className="eyebrow">Phase 1 / P0</p>
        <h1 id="page-title">工程骨架施工中</h1>
        <p className="summary">
          当前页面只验证 P0 应用骨架可运行。市场页、账本页和三层业务闭环从 P1 开始实现。
        </p>
        <ul className="baseline-list" aria-label="P0 baseline items">
          {baselineItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
