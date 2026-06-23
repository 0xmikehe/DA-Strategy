import Link from "next/link";
import React from "react";
import { AppShell } from "./_components/phase1/app-shell";
import { StatusBadge } from "./_components/phase1/status-badge";

const checkpoints = [
  ["P1.1", "业务表 migration", "strategy_version / ledger_event / market facts"],
  ["P1.2", "fixture 计算闭环", "signal snapshot / ledger replay / planned action"],
  ["P1.3", "BFF read model", "market + ledger summary API"],
  ["P1.4", "只读页面", "market page + ledger page"],
  ["P1.5", "行情影子采集", "market-data page + Binance public facts"]
] as const;

export default function HomePage() {
  return (
    <AppShell active="home" context="Phase 1 / Walking Skeleton" title="Digital Asset OS">
      <main className="page-frame">
        <header className="page-head">
          <div>
            <p className="page-kicker">Phase 1 / Product Workspace</p>
            <h1 className="page-title">数字资产投资操作系统</h1>
            <p className="page-summary">
              当前交付的是 fixture 驱动的最小闭环：市场事实生成信号快照，策略生成计划动作，账本回放成交与资金流，复盘草稿保留追溯链。
            </p>
          </div>
          <div className="action-row">
            <Link className="button primary" href="/market">
              市场页
            </Link>
            <Link className="button" href="/market-data">
              行情数据页
            </Link>
            <Link className="button" href="/ledger">
              账本页
            </Link>
          </div>
        </header>

        <section className="grid-home">
          <div className="stack">
            <section className="panel">
              <div className="panel-head">
                <span>交付状态</span>
                <StatusBadge tone="good">fixture proof</StatusBadge>
              </div>
              <div className="panel-body">
                <div className="snapshot-grid home-status">
                  <div className="snapshot-item">
                    <span>snapshot_id</span>
                    <strong>snap_2026_06_19_0001</strong>
                    <small>所有计划动作与成交归属围绕这个快照追溯。</small>
                  </div>
                  <div className="snapshot-item">
                    <span>strategy_version</span>
                    <strong>v1</strong>
                    <small>策略版本固定为 core_allocation_lt@v1。</small>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <span>P1 施工链</span>
                <span>verified</span>
              </div>
              <div className="panel-body tight">
                <table className="data-table">
                  <tbody>
                    {checkpoints.map(([phase, name, scope]) => (
                      <tr key={phase}>
                        <td>{phase}</td>
                        <td>{name}</td>
                        <td className="right">{scope}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="entry-grid">
            <Link className="entry-card" href="/market">
              <h2>市场页</h2>
              <p>查看启用信号、快照摘要、数据健康和 input refs 摘要。这里是判断层的肉眼入口。</p>
              <div className="badge-row align-left">
                <StatusBadge tone="good">risk_regime</StatusBadge>
                <StatusBadge tone="good">core_tilt</StatusBadge>
                <StatusBadge tone="good">funding_sentiment</StatusBadge>
              </div>
            </Link>
            <Link className="entry-card" href="/market-data">
              <h2>行情数据页</h2>
              <p>查看 Binance public futures-data 的影子采集结果、缺口、延迟和历史记录。这里是 P1.5 的数据验收入口。</p>
              <div className="badge-row align-left">
                <StatusBadge tone="warn">shadow</StatusBadge>
                <StatusBadge tone="good">history</StatusBadge>
              </div>
            </Link>
            <Link className="entry-card" href="/ledger">
              <h2>账本页</h2>
              <p>查看策略持仓、成交归属、资金流、计划动作和复盘草稿。这里是事实层的回放入口。</p>
              <div className="badge-row align-left">
                <StatusBadge tone="good">fixture_synced</StatusBadge>
                <StatusBadge tone="frozen">snapshot linked</StatusBadge>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
