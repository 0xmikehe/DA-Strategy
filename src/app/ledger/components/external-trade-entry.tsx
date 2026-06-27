import React from "react";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { submitLedgerExternalTradeForm } from "../actions";

type ExternalTradeEntryProps = {
  options: LedgerPageModel["externalTradeFormOptions"];
};

export function ExternalTradeEntry({ options }: ExternalTradeEntryProps) {
  const defaultAccount = options.accounts[0] ?? "wallet_manual";
  const defaultBaseAsset = options.assets.find((asset) => asset !== options.defaultQuoteAsset) ?? "BTC";

  return (
    <div className="external-trade-entry">
      <div className="section-label-row">
        <span>外部交易录入</span>
        <span>append-only</span>
      </div>
      <form action={submitLedgerExternalTradeForm} className="ledger-form-grid">
        <label className="field-label">
          <span>wallet_account</span>
          <input className="text-input" name="wallet_account_id" defaultValue={defaultAccount} />
        </label>
        <label className="field-label">
          <span>side</span>
          <select className="text-input" name="side" defaultValue="buy">
            <option value="buy">buy</option>
            <option value="sell">sell</option>
          </select>
        </label>
        <label className="field-label">
          <span>base_asset</span>
          <input className="text-input" name="base_asset" defaultValue={defaultBaseAsset} />
        </label>
        <label className="field-label">
          <span>quote_asset</span>
          <input className="text-input" name="quote_asset" defaultValue={options.defaultQuoteAsset} />
        </label>
        <label className="field-label">
          <span>base_qty</span>
          <input className="text-input" name="base_qty" defaultValue="0.01000000" />
        </label>
        <label className="field-label">
          <span>price</span>
          <input className="text-input" name="price" defaultValue="65000.00" />
        </label>
        <label className="field-label wide">
          <span>occurred_at</span>
          <input className="text-input" name="occurred_at" defaultValue="2026-06-25T00:16:00.000Z" />
        </label>
        <label className="field-label">
          <span>venue</span>
          <input className="text-input" name="venue" defaultValue="external_wallet" />
        </label>
        <label className="field-label">
          <span>strategy_id</span>
          <input className="text-input" name="strategy_id" defaultValue="" placeholder="optional" />
        </label>
        <label className="field-label">
          <span>strategy_version</span>
          <input className="text-input" name="strategy_version" defaultValue="" placeholder="optional" />
        </label>
        <label className="field-label wide">
          <span>note</span>
          <input className="text-input" name="note" defaultValue="ledger page manual external trade" />
        </label>
        <div className="form-actions">
          <button className="button primary" type="submit">提交外部交易</button>
          <span className="danger-note">不提供手工改余额；录错用冲正 + 重录。</span>
        </div>
      </form>
    </div>
  );
}
