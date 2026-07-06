import React from 'react';
import {
  formatOfficialPerCall,
  formatOfficialTokenPair,
  formatOfficialTokenPrice,
  formatPerCallPrice,
  formatTieredSecondPrice,
  formatTokenPrice,
  getCacheCreationPrice,
  getCacheReadPrice,
  getFixedPrice,
  getInputPrice,
  getOfficialPricing,
  getOutputPrice,
  hasSitePricing,
  isPerCallModel,
  isTieredExprModel,
  parseTieredSecondPricing,
} from '../utils/modelMeta';
import { useCurrency } from '../context/SiteContext';

const TOKENBOOM_PRICE_MULTIPLIER = 0.8;
const TOKENBOOM_DISCOUNT_LABEL = '20% off';

const discounted = (value) => {
  if (value === undefined || value === null || value === '') return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric * TOKENBOOM_PRICE_MULTIPLIER : value;
};

export default function ModelPrice({ model, compact = false }) {
  const { symbol, rate, code, usdRate } = useCurrency();
  const showSitePricing = hasSitePricing(model);
  const dataSource = String(model?.data_source || model?.dataSource || '').toLowerCase();

  if (showSitePricing) {
    const tieredRows = parseTieredSecondPricing(model?.billing_expr);
    if (isTieredExprModel(model)) {
      if (tieredRows.length === 0) {
        return (
          <span className="font-mono text-sm text-page" title="Site expression pricing">
            Expression pricing
          </span>
        );
      }

      const values = tieredRows.map((row) => ({
        ...row,
        value: formatTieredSecondPrice(row.price, model, { symbol, rate, code, usdRate }),
      }));

      if (compact) {
        const first = values[0];
        const suffix = values.length > 1 ? ` +${values.length - 1}` : '';
        return (
          <span className="font-mono text-sm text-page" title="Site video pricing per second">
            {first.label} {first.value}{suffix}
          </span>
        );
      }

      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {values.map((row) => (
            <PriceBox key={`${row.label}-${row.price}`} label={`${row.label} / sec`} value={row.value} />
          ))}
        </div>
      );
    }

    const perCall = isPerCallModel(model);
    const inputPrice = getInputPrice(model);
    const outputPrice = getOutputPrice(model);
    const fixedPrice = getFixedPrice(model);
    const cacheReadPrice = getCacheReadPrice(model);
    const cacheCreationPrice = getCacheCreationPrice(model);

    if (perCall) {
      return (
        <span className="font-mono text-sm text-page" title="Site per-call pricing">
          {formatPerCallPrice(fixedPrice, symbol, rate)}
        </span>
      );
    }

    if (compact) {
      return (
        <span className="font-mono text-sm text-page" title="Site input and output pricing per 1M tokens">
          {formatTokenPrice(inputPrice, symbol, rate)} in / {formatTokenPrice(outputPrice, symbol, rate)} out
        </span>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2 text-xs">
        <PriceBox label="Input / 1M" value={formatTokenPrice(inputPrice, symbol, rate)} />
        <PriceBox label="Output / 1M" value={formatTokenPrice(outputPrice, symbol, rate)} />
        {cacheReadPrice !== null && <PriceBox label="Cache read / 1M" value={formatTokenPrice(cacheReadPrice, symbol, rate)} />}
        {cacheCreationPrice !== null && <PriceBox label="Cache create / 1M" value={formatTokenPrice(cacheCreationPrice, symbol, rate)} />}
      </div>
    );
  }

  const pricing = getOfficialPricing(model);

  if (!pricing) {
    const label = dataSource === 'fallback' ? 'Site pricing unavailable' : 'Pricing unavailable';
    return (
      <span className="text-sm text-page-muted" title="No site or public pricing row is currently available for this model">
        {label}
      </span>
    );
  }

  if (pricing.type === 'per_call') {
    const tokenBoomPrice = discounted(pricing.modelPrice);
    return (
      <PriceInline
        compact={compact}
        title="TokenBoom per-call price, 20% off official pricing"
        price={formatOfficialPerCall(tokenBoomPrice)}
        official={formatOfficialPerCall(pricing.modelPrice)}
      />
    );
  }

  const inputPrice = pricing.inputPrice ?? pricing.inputRatio;
  const outputPrice = pricing.outputPrice ?? pricing.outputRatio;
  const tokenBoomInputPrice = discounted(inputPrice);
  const tokenBoomOutputPrice = discounted(outputPrice);
  const input = formatOfficialTokenPrice(tokenBoomInputPrice);
  const output = formatOfficialTokenPrice(tokenBoomOutputPrice);
  const officialInput = formatOfficialTokenPrice(inputPrice);
  const officialOutput = formatOfficialTokenPrice(outputPrice);

  if (compact) {
    return (
      <PriceInline
        compact
        title="TokenBoom input and output USD pricing, 20% off official pricing"
        price={formatOfficialTokenPair(tokenBoomInputPrice, tokenBoomOutputPrice)}
        official={formatOfficialTokenPair(inputPrice, outputPrice)}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs" title="TokenBoom price is 20% off official pricing">
      <PriceBox label="Input USD" value={input} official={officialInput} badge={TOKENBOOM_DISCOUNT_LABEL} />
      <PriceBox label="Output USD" value={output} official={officialOutput} badge={TOKENBOOM_DISCOUNT_LABEL} />
    </div>
  );
}

function PriceInline({ compact, title, price, official }) {
  if (compact) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5" title={title}>
        <span className="font-mono text-sm text-page">{price}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-page-success">{TOKENBOOM_DISCOUNT_LABEL}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5" title={title}>
      <span className="font-mono text-sm text-page">{price}</span>
      <span className="text-xs text-page-muted line-through">Official {official}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-page-success">{TOKENBOOM_DISCOUNT_LABEL}</span>
    </span>
  );
}

function PriceBox({ label, value, official, badge }) {
  return (
    <div className="rounded-lg border border-page-divider bg-page-surface/50 px-3 py-2">
      <p className="text-page-muted">{label}</p>
      <p className="mt-1 font-mono font-semibold text-page">{value}</p>
      {official && official !== '-' && (
        <p className="mt-1 text-[11px] text-page-muted line-through">Official {official}</p>
      )}
      {badge && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-page-success">{badge}</p>}
    </div>
  );
}
