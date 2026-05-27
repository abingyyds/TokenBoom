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

export default function ModelPrice({ model, compact = false }) {
  const { symbol, rate, code, usdRate } = useCurrency();
  const showSitePricing = hasSitePricing(model);

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
    return (
      <span className="text-sm text-page-muted" title="No official pricing row was returned by the public pricing feed for this model">
        Official pricing unavailable
      </span>
    );
  }

  if (pricing.type === 'per_call') {
    return (
      <span className="font-mono text-sm text-page" title="Official per-call pricing">
        {formatOfficialPerCall(pricing.modelPrice)}
      </span>
    );
  }

  const inputPrice = pricing.inputPrice ?? pricing.inputRatio;
  const outputPrice = pricing.outputPrice ?? pricing.outputRatio;
  const input = formatOfficialTokenPrice(inputPrice);
  const output = formatOfficialTokenPrice(outputPrice);

  if (compact) {
    return (
      <span className="font-mono text-sm text-page" title="Official input and output USD pricing">
        {formatOfficialTokenPair(inputPrice, outputPrice)}
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <PriceBox label="Input USD" value={input} />
      <PriceBox label="Output USD" value={output} />
    </div>
  );
}

function PriceBox({ label, value }) {
  return (
    <div className="rounded-lg border border-page-divider bg-page-surface/50 px-3 py-2">
      <p className="text-page-muted">{label}</p>
      <p className="mt-1 font-mono font-semibold text-page">{value}</p>
    </div>
  );
}
