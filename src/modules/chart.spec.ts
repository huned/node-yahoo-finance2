import { jest } from "@jest/globals";

import chart from "./chart.js";
import { testSymbols } from "../../tests/symbols.js";

import testYf from "../../tests/testYf.js";
import { consoleSilent, consoleRestore } from "../../tests/console.js";

const yf = testYf({ chart });

describe("chart", () => {
  // See also common module tests in moduleExec.spec.js

  const symbolsToSkip = [
    "ADH", // currency: null; Yahoo-finance does show a chart though, should we allow this?
    "BEKE", // BadRequestError: Data doesn't exist for startDate = 1577836800, endDate = 1578009600
    "BFLY", // BadRequestError: Data doesn't exist for startDate = 1577836800, endDate = 1578009600
    "^VXAPL", // firstTradeDate: null; Yahoo-finance shows an empty chart even though there's some data.
  ];
  const symbols = testSymbols.filter((s) => symbolsToSkip.indexOf(s) === -1);
  //const symbols = ["ADH"];

  it.each(symbols)("passes validation for symbol '%s'", async (symbol) => {
    await yf.chart(
      symbol,
      {
        period1: "2020-01-01",
        period2: "2020-01-03",
        return: "object", // native Yahoo return format, first validation step.
      },
      {
        devel: `chart-${symbol}-2020-01-01-to-2020-01-03.json`,
      }
    );
  });

  describe("specific cases", () => {
    it("optional fields, empty arrays", async () => {
      /*
       * Same day period with 1h interval, this result has these aspects:
       *
       *   - Missing fields: timestamp (because no quotes)
       *   - New fields: previousClose, scale, tradingPeriods
       *   - Pecularity: indicators.quote is [{}], indicators.adjclose missing
       */
      await yf.chart(
        "TSLA",
        { period1: "2021-11-23", period2: "2021-11-23", interval: "1h" },
        { devel: "chart-TSLA-2021-11-23-to-2021-11-23-interval-1h.json" }
      );
    });

    it("", async () => {
      // Had tradingPeriod.regular, probably a timezone thing
      await yf.chart(
        "TSLA",
        { period1: "2021-11-22", period2: "2021-11-23", interval: "30m" },
        { devel: "chart-TSLA-2021-11-22-to-2021-11-23-interval-30m.json" }
      );
    });
  });

  it("throws on malformed result", () => {
    return expect(() => {
      consoleSilent();
      return yf
        .chart(
          "AAPL",
          { period1: "2020-01-01" },
          { devel: `weirdJsonResult.fake.json` }
        )
        .finally(consoleRestore);
    }).rejects.toMatchObject({ message: /Unexpected/ });
  });

  describe("query transformWith", () => {
    /*
     * We need "transformWith" that chart() calls moduleExec() with.
     * So we create a fake moduleExec and grab it from the query params.
     * The below call is a promise that will resolve outside of this
     * test block, but that's ok, as it's irrelevant for this test.
     * As long as it doesn't throw an error, that could confuse jest :)
     */
    const yf = {
      _moduleExec: jest.fn(async () => ({
        meta: {},
        timestamp: [],
      })),
      chart,
    };

    // @ts-ignore: TODO
    yf.chart("symbol", { period1: "required-but-not-used" });
    // @ts-ignore: TODO
    const { transformWith } = yf._moduleExec.mock.calls[0][0].query;

    it("uses today's date as default for period2", () => {
      const now = new Date();
      const options = transformWith({ period1: "2020-01-01" });
      expect(options.period2).toBeDefined();
      expect(options.period2).toBe(Math.floor(now.getTime() / 1000));
    });
  });

  describe("return type", () => {
    const symbol = "AAPL"; // split 2020-08-31, div 2020-11-06
    const queryOpts = { period1: "2020-08-31", period2: "2020-11-07" };
    const fetchOpts = { devel: "chart-AAPL-2020-08-31-to-2020-11-07.json" };

    it("array (not specified, as default)", async () => {
      const result = await yf.chart(
        symbol,
        { ...queryOpts /* default, i.e. return: "array" */ },
        fetchOpts
      );

      // More comprehensive tests below.
      expect(result.timestamp).not.toBeDefined();
    });

    it("array", async () => {
      const result = await yf.chart(
        symbol,
        { ...queryOpts, return: "array" },
        fetchOpts
      );

      expect(result.timestamp).not.toBeDefined();

      // @ts-ignore
      expect(result.quotes).toBeType("array");
      // @ts-ignore
      expect(result.quotes[0]).toBeType("object");
      // @ts-ignore
      expect(result.quotes[0].high).toBeType("number");

      // @ts-ignore
      expect(result.events).toBeType("object");
      // @ts-ignore
      expect(result.events.dividends).toBeType("array");
      // @ts-ignore
      expect(result.events.dividends[0]).toBeType("object");
      // @ts-ignore
      expect(result.events.dividends[0].amount).toBeType("number");

      // @ts-ignore
      expect(result.events.splits).toBeType("array");
      // @ts-ignore
      expect(result.events.splits[0]).toBeType("object");
      // @ts-ignore
      expect(result.events.splits[0].numerator).toBeType("number");
    });

    it("object", async () => {
      const result = await yf.chart(
        symbol,
        { ...queryOpts, return: "object" },
        fetchOpts
      );

      // @ts-ignore
      expect(result.timestamp).toBeType("array");
      // @ts-ignore
      expect(result.timestamp[0]).toBeType("number");

      // @ts-ignore
      expect(result.events.dividends).toBeType("object");
      // @ts-ignore
      expect(result.events.splits).toBeType("object");

      // @ts-ignore
      expect(result.indicators.quote).toBeType("array");
      // @ts-ignore
      expect(result.indicators.quote[0]).toBeType("object");
      // @ts-ignore
      expect(result.indicators.quote[0].high).toBeType("array");
      // @ts-ignore
      expect(result.indicators.quote[0].high[0]).toBeType("number");

      // @ts-ignore
      expect(result.indicators.adjclose).toBeType("array");
      // @ts-ignore
      expect(result.indicators.adjclose[0]).toBeType("object");
      // @ts-ignore
      expect(result.indicators.adjclose[0].adjclose).toBeType("array");
      // @ts-ignore
      expect(result.indicators.adjclose[0].adjclose[0]).toBeType("number");
    });
  });
});
